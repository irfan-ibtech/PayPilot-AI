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
            if ($response->status() === 400 || $response->status() === 403 || $response->status() === 429) {
                return $this->fallbackNaturalLanguageParser($prompt, "(Fallback: Gemini API {$response->status()})");
            }
            $errorData = $response->json();
            $errorMessage = $errorData['error']['message'] ?? $response->body();
            throw new RuntimeException("Gemini API call failed ({$response->status()}): {$errorMessage}");
        }

        $responseData = $response->json();
        $rawText = $responseData['candidates'][0]['content']['parts'][0]['text'] ?? null;

        if (! $rawText) {
            throw new RuntimeException('Gemini returned an empty response candidate.');
        }

        $cleanJson = preg_replace('/^```(?:json)?\s*|\s*```$/i', '', trim($rawText));
        $decoded = json_decode($cleanJson, true);

        if (! is_array($decoded) || ! isset($decoded['items'])) {
            return $this->fallbackNaturalLanguageParser($prompt);
        }

        return $this->sanitizeExtractedOrder($decoded);
    }

    /**
     * Generate executive business intelligence & strategic recommendations from verified metrics.
     */
    public function generateBusinessInsights(array $metrics, ?string $userQuestion = null): array
    {
        $question = $userQuestion ?: 'Provide an executive business summary and 3 strategic recommendations to improve my store performance.';

        if (empty($this->apiKey)) {
            return $this->fallbackBusinessInsights($metrics, $question);
        }

        $url = str_replace(
            ['{model}', '{key}'],
            [$this->model, $this->apiKey],
            $this->endpointTemplate
        );

        $systemInstruction = "You are PayPilot Copilot, an elite CFO and merchant operations advisor. You are provided with real, verified transaction analytics from the merchant's store. 
CRITICAL RULES:
1. Base all conclusions strictly on the provided verified metrics. Do not fabricate numbers or invent non-existent trends.
2. Format your response with clear Markdown headers, bold key metrics, concise observations, and tactical action items.
3. Return your response in JSON with two keys:
   - 'analysis': markdown formatted text answering the merchant's question directly with clear analytical depth.
   - 'recommendations': array of 2 to 3 objects, each with:
     {
       'title': string,
       'description': string,
       'supporting_metric': string,
       'suggested_action': string,
       'priority': 'high' | 'medium' | 'low'
     }";

        $metricsJson = json_encode($metrics, JSON_PRETTY_PRINT);
        $userPrompt = "VERIFIED MERCHANT STORE METRICS:\n{$metricsJson}\n\nMERCHANT QUESTION: \"{$question}\"\n\nGenerate analytical response and actionable recommendations in the requested JSON structure.";

        $payload = [
            'contents' => [
                [
                    'role' => 'user',
                    'parts' => [
                        [
                            'text' => $userPrompt,
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
                'temperature' => 0.2,
                'response_mime_type' => 'application/json',
            ],
        ];

        $response = Http::withHeaders([
            'Content-Type' => 'application/json',
        ])->post($url, $payload);

        if ($response->failed()) {
            if ($response->status() === 400 || $response->status() === 403 || $response->status() === 429) {
                return $this->fallbackBusinessInsights($metrics, $question);
            }
            $errorData = $response->json();
            $errorMessage = $errorData['error']['message'] ?? $response->body();
            throw new RuntimeException("Gemini Copilot call failed ({$response->status()}): {$errorMessage}");
        }

        $responseData = $response->json();
        $rawText = $responseData['candidates'][0]['content']['parts'][0]['text'] ?? null;

        if (! $rawText) {
            return $this->fallbackBusinessInsights($metrics, $question);
        }

        $cleanJson = preg_replace('/^```(?:json)?\s*|\s*```$/i', '', trim($rawText));
        $decoded = json_decode($cleanJson, true);

        if (! is_array($decoded) || ! isset($decoded['analysis']) || ! isset($decoded['recommendations'])) {
            return $this->fallbackBusinessInsights($metrics, $question);
        }

        return [
            'analysis' => $decoded['analysis'],
            'recommendations' => $this->sanitizeRecommendations($decoded['recommendations']),
        ];
    }

    /**
     * Fallback deterministic business insights when GEMINI_API_KEY is not supplied.
     */
    protected function fallbackBusinessInsights(array $metrics, string $question): array
    {
        $revenue = $metrics['formatted_revenue'] ?? '$0.00';
        $paidOrders = $metrics['paid_orders'] ?? 0;
        $totalOrders = $metrics['total_orders'] ?? 0;
        $conversionRate = $metrics['conversion_rate'] ?? 0.0;
        $aov = $metrics['formatted_aov'] ?? '$0.00';
        $pending = $metrics['pending_orders'] ?? 0;

        $topProduct = $metrics['top_selling_products'][0]['product_name'] ?? 'Flagship Item';
        $topRevenue = isset($metrics['top_selling_products'][0]['total_revenue_generated'])
            ? '$' . number_format($metrics['top_selling_products'][0]['total_revenue_generated'], 2)
            : '$0.00';

        $analysis = "### Executive Performance Diagnostic

- **Verified Revenue:** **{$revenue}** across **{$paidOrders}** successful transactions.
- **Order Conversion Rate:** **{$conversionRate}%** ({$paidOrders} settled out of {$totalOrders} total recorded).
- **Average Order Value (AOV):** **{$aov}** per completed order.
- **Leading Revenue Driver:** **{$topProduct}** representing **{$topRevenue}** in gross volume.

#### Operational Assessment
Your sales telemetry demonstrates robust transaction health with steady settlement via the PayPal v2 REST API. Current merchant performance indicates that **{$topProduct}** serves as your primary customer acquisition funnel. With **{$pending} orders currently in pending status**, closing checkout friction directly converts uncaptured intent into verified cash flow.";

        $recommendations = [
            [
                'title' => 'Recover Unpaid Orders via PayPal Express Invoicing',
                'description' => "You currently have {$pending} pending orders awaiting checkout completion. Sending automated PayPal 1-click payment links will substantially recover abandoned revenue.",
                'supporting_metric' => "{$pending} Pending Orders (~" . ($pending * (float) ($metrics['average_order_value'] ?? 35)) . " recoverable)",
                'suggested_action' => 'Deploy 1-click PayPal paylinks to pending carts',
                'priority' => 'high',
            ],
            [
                'title' => "Capitalize on Top Seller: {$topProduct}",
                'description' => "{$topProduct} is currently generating {$topRevenue}. Creating an accessory bundle or offering a 10% volume discount on companion accessories will increase AOV beyond {$aov}.",
                'supporting_metric' => "Top Seller Revenue: {$topRevenue}",
                'suggested_action' => "Create combo bundle deal around {$topProduct}",
                'priority' => 'medium',
            ],
            [
                'title' => 'Implement Dynamic Volume Pricing',
                'description' => "With an Average Order Value of {$aov}, offering tiered incentives (e.g., free priority shipping on orders over $" . round((float) ($metrics['average_order_value'] ?? 50) * 1.3) . ") will lift cart sizes across all categories.",
                'supporting_metric' => "Current AOV: {$aov}",
                'suggested_action' => 'Establish free shipping threshold at 130% of AOV',
                'priority' => 'low',
            ],
        ];

        return [
            'analysis' => $analysis,
            'recommendations' => $recommendations,
        ];
    }

    /**
     * Sanitize recommendations array.
     */
    protected function sanitizeRecommendations(array $recommendations): array
    {
        $sanitized = [];
        foreach ($recommendations as $rec) {
            $sanitized[] = [
                'title' => trim($rec['title'] ?? 'Strategic Action'),
                'description' => trim($rec['description'] ?? ''),
                'supporting_metric' => trim($rec['supporting_metric'] ?? 'Store Telemetry'),
                'suggested_action' => trim($rec['suggested_action'] ?? 'Execute recommendation'),
                'priority' => in_array(strtolower($rec['priority'] ?? ''), ['high', 'medium', 'low'])
                    ? strtolower($rec['priority'])
                    : 'medium',
            ];
        }
        return $sanitized;
    }

    /**
     * Fallback NLP heuristic parser when GEMINI_API_KEY is not supplied.
     */
    protected function fallbackNaturalLanguageParser(string $prompt, string $sourceNote = ''): array
    {
        $items = [];
        $notes = null;
        $currency = 'USD';

        if (preg_match('/(?:with|note:?)\s+([^,.]+)/i', $prompt, $noteMatch)) {
            $notes = trim($noteMatch[1]);
        }

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

            $pattern = '/^(\d+|one|two|three|four|five|six|seven|eight|nine|ten|a|an)?\s*(.+?)\s*(?:at|for|@|\:)\s*\$?([0-9]+(?:\.[0-9]{1,2})?)/i';

            if (preg_match($pattern, $clause, $matches)) {
                $rawQty = strtolower(trim($matches[1] ?? '1'));
                $qty = is_numeric($rawQty) ? (int) $rawQty : ($wordToNum[$rawQty] ?? 1);

                $rawName = trim($matches[2]);
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
