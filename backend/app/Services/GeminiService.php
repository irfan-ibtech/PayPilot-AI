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
        $this->apiKey = config('ai.gemini.api_key', config('ai.gemini_api_key', ''));
        $this->model = config('ai.gemini.model', config('ai.gemini_model', 'gemini-3.1-flash-lite'));
        $this->endpointTemplate = config(
            'ai.gemini.endpoint',
            'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}'
        );
    }

    /**
     * Sanitize user prompt to neutralize prompt injection vectors.
     */
    public function sanitizePrompt(string $prompt): string
    {
        $sanitized = preg_replace('/(ignore\s+(all\s+)?previous\s+instructions|system\s*:\s*|```)/i', '', $prompt);
        return trim($sanitized);
    }

    /**
     * Centralized caller for Google Gemini REST API with candidate model fallback.
     */
    protected function callGemini(array $contents, ?string $systemInstruction = null, float $temperature = 0.1, bool $jsonMode = true): array
    {
        if (empty($this->apiKey)) {
            throw new RuntimeException('Gemini API key is not configured.');
        }

        // Live candidate models on Google Gemini API v1beta
        $candidateModels = array_unique([
            $this->model,
            'gemini-3.1-flash-lite',
            'gemini-3.5-flash-lite',
            'gemini-3.1-flash-lite-preview',
        ]);

        $lastException = null;

        foreach ($candidateModels as $candidateModel) {
            $url = str_replace(
                ['{model}', '{key}'],
                [$candidateModel, $this->apiKey],
                $this->endpointTemplate
            );

            $payload = [
                'contents' => $contents,
                'generationConfig' => [
                    'temperature' => $temperature,
                ],
            ];

            if ($jsonMode) {
                $payload['generationConfig']['response_mime_type'] = 'application/json';
            }

            if ($systemInstruction) {
                $payload['systemInstruction'] = [
                    'parts' => [
                        ['text' => $systemInstruction],
                    ],
                ];
            }

            try {
                $response = Http::timeout(config('ai.gemini.timeout', 15))
                    ->connectTimeout(config('ai.gemini.connect_timeout', 5))
                    ->withHeaders(['Content-Type' => 'application/json'])
                    ->post($url, $payload);

                if ($response->successful()) {
                    $responseData = $response->json();
                    $rawText = $responseData['candidates'][0]['content']['parts'][0]['text'] ?? null;
                    if ($rawText) {
                        return [
                            'text' => $rawText,
                            'model' => $candidateModel,
                            'ai_source' => 'gemini_live',
                        ];
                    }
                }

                // If model deprecated (404) or busy (429/503), attempt next candidate model
                if (in_array($response->status(), [404, 429, 503])) {
                    $lastException = new RuntimeException("Model {$candidateModel} returned HTTP {$response->status()}");
                    continue;
                }

                $errorData = $response->json();
                $errorMessage = $errorData['error']['message'] ?? $response->body();
                throw new RuntimeException("Gemini API call failed ({$response->status()}): {$errorMessage}");
            } catch (\Throwable $e) {
                $lastException = $e;
                continue;
            }
        }

        throw ($lastException ?: new RuntimeException('All Gemini candidate endpoints failed.'));
    }

    /**
     * Parse natural language merchant input into structured order items using Gemini.
     */
    public function parseNaturalLanguageOrder(string $prompt): array
    {
        $cleanPrompt = $this->sanitizePrompt($prompt);

        if (empty($this->apiKey)) {
            $fallback = $this->fallbackNaturalLanguageParser($cleanPrompt);
            $fallback['ai_source'] = 'fallback_rules';
            return $fallback;
        }

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

        $contents = [
            [
                'role' => 'user',
                'parts' => [
                    [
                        'text' => "Merchant order description: \"{$cleanPrompt}\"\n\n{$jsonSchemaPrompt}",
                    ],
                ],
            ],
        ];

        try {
            $geminiRes = $this->callGemini($contents, $systemInstruction, 0.1, true);
            $rawText = $geminiRes['text'];

            $cleanJson = preg_replace('/^```(?:json)?\s*|\s*```$/i', '', trim($rawText));
            $decoded = json_decode($cleanJson, true);

            if (! is_array($decoded) || ! isset($decoded['items'])) {
                $fallback = $this->fallbackNaturalLanguageParser($cleanPrompt);
                $fallback['ai_source'] = 'fallback_rules';
                return $fallback;
            }

            $sanitized = $this->sanitizeExtractedOrder($decoded);
            $sanitized['ai_source'] = 'gemini_live';
            $sanitized['model'] = $geminiRes['model'];
            return $sanitized;
        } catch (\Throwable $e) {
            $fallback = $this->fallbackNaturalLanguageParser($cleanPrompt, "(Fallback: " . $e->getMessage() . ")");
            $fallback['ai_source'] = 'fallback_rules';
            return $fallback;
        }
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

        $contents = [
            [
                'role' => 'user',
                'parts' => [
                    [
                        'text' => $userPrompt,
                    ],
                ],
            ],
        ];

        try {
            $geminiRes = $this->callGemini($contents, $systemInstruction, 0.2, true);
            $rawText = $geminiRes['text'];

            $cleanJson = preg_replace('/^```(?:json)?\s*|\s*```$/i', '', trim($rawText));
            $decoded = json_decode($cleanJson, true);

            if (! is_array($decoded) || ! isset($decoded['analysis']) || ! isset($decoded['recommendations'])) {
                return $this->fallbackBusinessInsights($metrics, $question);
            }

            return [
                'analysis' => $decoded['analysis'],
                'recommendations' => $this->sanitizeRecommendations($decoded['recommendations']),
                'ai_source' => 'gemini_live',
                'model' => $geminiRes['model'],
            ];
        } catch (\Throwable $e) {
            return $this->fallbackBusinessInsights($metrics, $question);
        }
    }

    /**
     * Generate an AI Revenue Recovery diagnostic and personalized action plan.
     */
    public function generateRecoveryStrategy(array $recoveryContext): array
    {
        $order = $recoveryContext['order'];
        $failureReason = $recoveryContext['failure_reason'] ?? 'Payment authorization failed';
        $attemptCount = $recoveryContext['attempt_count'] ?? 1;
        $amount = $recoveryContext['amount'] ?? '0.00';
        $currency = $recoveryContext['currency'] ?? 'USD';
        $itemsDescription = $recoveryContext['items_description'] ?? 'Merchant Products';
        $hoursSinceDropoff = $recoveryContext['hours_since_dropoff'] ?? 2;

        if (empty($this->apiKey)) {
            return $this->fallbackRecoveryStrategy($recoveryContext);
        }

        $systemInstruction = "You are PayPilot AI's Revenue Recovery Agent. Your mission is to analyze failed checkout transactions and draft high-converting, personalized, non-intrusive recovery messaging for merchants. Never output ungrounded data. Output strict JSON only.";

        $jsonSchemaPrompt = 'Output a JSON object with this exact structure:
{
  "ai_summary": "1-2 sentence executive explanation of failure",
  "ai_reasoning": "Technical and behavioral analysis of why this drop-off occurred and why it is recoverable",
  "ai_recommended_action": "Specific tactical action recommended for the merchant",
  "customer_message_draft": "Personalized, warm email/SMS reminder message to customer with recovery link placeholder [RECOVERY_LINK]",
  "ai_confidence": 85
}';

        $promptText = "Analyze this failed checkout:
- Order Number: {$order['order_number']}
- Amount: {$currency} {$amount}
- Items: {$itemsDescription}
- Drop-off Reason: {$failureReason}
- Attempts Recorded: {$attemptCount}
- Elapsed Time: {$hoursSinceDropoff} hours ago

{$jsonSchemaPrompt}";

        $contents = [
            [
                'role' => 'user',
                'parts' => [
                    ['text' => $promptText],
                ],
            ],
        ];

        try {
            $geminiRes = $this->callGemini($contents, $systemInstruction, 0.2, true);
            $rawText = $geminiRes['text'];

            $cleanJson = preg_replace('/^```(?:json)?\s*|\s*```$/i', '', trim($rawText));
            $decoded = json_decode($cleanJson, true);

            if (! is_array($decoded) || ! isset($decoded['ai_summary'])) {
                return $this->fallbackRecoveryStrategy($recoveryContext);
            }

            return [
                'ai_summary' => trim($decoded['ai_summary']),
                'ai_reasoning' => trim($decoded['ai_reasoning'] ?? ''),
                'ai_recommended_action' => trim($decoded['ai_recommended_action'] ?? 'Send 1-Click PayPal Paylink'),
                'customer_message_draft' => trim($decoded['customer_message_draft'] ?? ''),
                'ai_confidence' => max(1, min(100, (int) ($decoded['ai_confidence'] ?? 85))),
                'ai_source' => 'gemini_live',
                'model' => $geminiRes['model'],
            ];
        } catch (\Throwable $e) {
            return $this->fallbackRecoveryStrategy($recoveryContext);
        }
    }

    /**
     * Fallback recovery strategy when API key is missing or request fails.
     */
    protected function fallbackRecoveryStrategy(array $recoveryContext): array
    {
        $order = $recoveryContext['order'];
        $failureReason = $recoveryContext['failure_reason'] ?? 'Payment authorization pending';
        $amount = $recoveryContext['amount'] ?? '0.00';
        $currency = $recoveryContext['currency'] ?? 'USD';
        $orderNumber = $order['order_number'] ?? 'Order';

        return [
            'ai_summary' => "Cart abandoned during checkout ({$failureReason}). High recovery potential via one-click PayPal checkout.",
            'ai_reasoning' => "The customer initiated checkout for {$currency} {$amount} but encountered a transaction interruption ({$failureReason}). There are no repeated fraud signals. Re-engaging with a pre-authenticated PayPal link resolves payment friction.",
            'ai_recommended_action' => 'Deploy verified 1-Click PayPal Recovery checkout link to customer',
            'customer_message_draft' => "Hi there! We noticed your checkout for order #{$orderNumber} ({$currency} {$amount}) was not completed due to a temporary payment session interruption. Your reserved items are still saved for you. You can securely complete your purchase in 1 click via PayPal here: [RECOVERY_LINK]\n\nLet us know if you need any assistance!",
            'ai_confidence' => 88,
            'ai_source' => 'fallback_rules',
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
- **Average Order Value (AOV):** **{$aov}** per paid customer.
- **Current Cart Friction:** **{$pending}** pending orders awaiting settlement.

### Strategic Observations:
The primary bottleneck to maximizing revenue is checkout friction among high-intent shoppers who initiate checkout but abandon prior to PayPal authorization. Deploying automated recovery workflows will immediately convert pending volume into settled cash flow.";

        $recommendations = [
            [
                'title' => 'Deploy 1-Click PayPal Recovery Links',
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
            'ai_source' => 'fallback_rules',
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
            'ai_source' => 'fallback_rules',
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
