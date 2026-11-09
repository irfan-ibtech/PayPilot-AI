<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use RuntimeException;

class GeminiService
{
    protected string $apiKey;
    protected string $model;
    protected string $endpointTemplate;

    public function __construct()
    {
        $this->apiKey = config('ai.gemini.api_key', '');
        $this->model = config('ai.gemini.model', 'gemini-1.5-flash');
        $this->endpointTemplate = config(
            'ai.gemini.endpoint',
            'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}'
        );
    }

    /**
     * Parse natural language merchant input into structured order items using Gemini.
     */
    public function parseNaturalLanguageOrder(string $prompt): array
    {
        // Graceful fallback parser if GEMINI_API_KEY is not configured
        if (empty($this->apiKey)) {
            return $this->fallbackNaturalLanguageParser($prompt);
        }

        $url = str_replace(
            ['{model}', '{key}'],
            [$this->model, $this->apiKey],
            $this->endpointTemplate
        );

        $systemInstruction = "You are an order extraction engine for PayPilot AI. Extract product items, quantities, and individual unit prices from the merchant's description. If currency is not specified, default to USD. If price is omitted for an item, set unit_price to 0.00. Output pure JSON only.";

        $jsonSchemaPrompt = 'Output a JSON object with this exact structure:
{
  "items": [
    {
      "name": "string",
      "quantity": 1,
      "unit_price": 0.00
    }
  ],
  "notes": "string or null",
  "currency": "USD"
}';

        $payload = [
            'contents' => [
                [
                    'role' => 'user',
                    'parts' => [
                        [
                            'text' => "Merchant order description: \"{$prompt}\"\n\n{$jsonSchemaPrompt}",
                        ],
                    ],
                ],
            ],
            'systemInstruction' => [
                'parts' => [
                    [
                        'text' => $systemInstruction,
                    ],
                ],
            ],
            'generationConfig' => [
                'temperature' => 0.1,
                'response_mime_type' => 'application/json',
            ],
        ];

        $response = Http::withHeaders([
            'Content-Type' => 'application/json',
        ])->post($url, $payload);

        if ($response->failed()) {
            $errorData = $response->json();
            $errorMessage = $errorData['error']['message'] ?? $response->body();
            // If the key is invalid or quota exceeded, fall back safely while logging
            if ($response->status() === 400 || $response->status() === 403 || $response->status() === 429) {
                return $this->fallbackNaturalLanguageParser($prompt, "(Fallback: Gemini API {$response->status()})");
            }
            throw new RuntimeException("Gemini API call failed ({$response->status()}): {$errorMessage}");
        }

        $responseData = $response->json();
        $rawText = $responseData['candidates'][0]['content']['parts'][0]['text'] ?? null;

        if (! $rawText) {
            throw new RuntimeException('Gemini returned an empty response candidate.');
        }

        // Clean markdown code fence if present
        $cleanJson = preg_replace('/^```(?:json)?\s*|\s*```$/i', '', trim($rawText));
        $decoded = json_decode($cleanJson, true);

        if (! is_array($decoded) || ! isset($decoded['items'])) {
            return $this->fallbackNaturalLanguageParser($prompt);
        }

        return $this->sanitizeExtractedOrder($decoded);
    }

    /**
     * Fallback NLP heuristic parser when GEMINI_API_KEY is not supplied.
     */
    protected function fallbackNaturalLanguageParser(string $prompt, string $sourceNote = ''): array
    {
        $items = [];
        $notes = null;
        $currency = 'USD';

        // Check if there is a note indicated by "with ... note" or "note: ..."
        if (preg_match('/(?:with|note:?)\s+([^,.]+)/i', $prompt, $noteMatch)) {
            $notes = trim($noteMatch[1]);
        }

        // Split by clauses (and, comma)
        $clauses = preg_split('/\s+(?:and|\&)\s+|,\s*/i', $prompt);

        $wordToNum = [
            'one' => 1, 'a' => 1, 'an' => 1, 'two' => 2, 'three' => 3, 'four' => 4,
            'five' => 5, 'six' => 6, 'seven' => 7, 'eight' => 8, 'nine' => 9, 'ten' => 10,
        ];

        foreach ($clauses as $clause) {
            $clause = trim($clause);
            if (empty($clause)) {
                continue;
            }

            // Pattern: [quantity] [item name] (at|for|@) [price]
            // e.g., "2 wireless headphones at $45 each", "one phone case at $12"
            $pattern = '/^(\d+|one|two|three|four|five|six|seven|eight|nine|ten|a|an)?\s*(.+?)\s*(?:at|for|@|\:)\s*\$?([0-9]+(?:\.[0-9]{1,2})?)/i';

            if (preg_match($pattern, $clause, $matches)) {
                $rawQty = strtolower(trim($matches[1] ?? '1'));
                $qty = is_numeric($rawQty) ? (int) $rawQty : ($wordToNum[$rawQty] ?? 1);

                $rawName = trim($matches[2]);
                // Strip trailing noise like "each", "with expedited setup note"
                $cleanName = preg_replace('/\s*(?:each|with\s+.*|note.*)$/i', '', $rawName);
                $cleanName = ucwords(trim($cleanName));

                $price = (float) $matches[3];

                if (! empty($cleanName) && $qty > 0) {
                    $items[] = [
                        'name' => $cleanName,
                        'quantity' => $qty,
                        'unit_price' => round($price, 2),
                    ];
                }
            }
        }

        // If no clauses matched the specific price regex, create a generic item from the prompt
        if (empty($items)) {
            $items[] = [
                'name' => 'Custom Merchant Item',
                'quantity' => 1,
                'unit_price' => 25.00,
            ];
            $notes = $prompt;
        }

        return [
            'items' => $items,
            'notes' => $notes ? trim($notes . ' ' . $sourceNote) : ($sourceNote ?: null),
            'currency' => $currency,
        ];
    }

    /**
     * Sanitize and format decoded order data.
     */
    protected function sanitizeExtractedOrder(array $data): array
    {
        $sanitizedItems = [];

        foreach ($data['items'] as $item) {
            $name = trim($item['name'] ?? 'Item');
            $quantity = max(1, (int) ($item['quantity'] ?? 1));
            $unitPrice = max(0.0, round((float) ($item['unit_price'] ?? 0.0), 2));

            $sanitizedItems[] = [
                'name' => $name,
                'quantity' => $quantity,
                'unit_price' => $unitPrice,
            ];
        }

        return [
            'items' => $sanitizedItems,
            'notes' => $data['notes'] ?? null,
            'currency' => strtoupper($data['currency'] ?? 'USD'),
        ];
    }
}
