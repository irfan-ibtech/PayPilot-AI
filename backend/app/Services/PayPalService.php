<?php

namespace App\Services;

use App\Models\Order;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class PayPalService
{
    protected string $mode;
    protected string $clientId;
    protected string $clientSecret;
    protected string $baseUrl;

    public function __construct()
    {
        $this->mode = config('paypal.mode', 'sandbox');
        $this->clientId = config('paypal.client_id', '');
        $this->clientSecret = config('paypal.client_secret', '');
        $this->baseUrl = config('paypal.base_url', 'https://api-m.sandbox.paypal.com');
    }

    /**
     * Get OAuth2 Access Token from PayPal API.
     */
    public function getAccessToken(): string
    {
        if (empty($this->clientId) || empty($this->clientSecret)) {
            if (config('paypal.mode') === 'mock') {
                return 'mock_paypal_access_token_' . md5($this->clientId ?: 'demo');
            }
            throw new RuntimeException('PayPal API credentials are not set. Please configure PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in backend/.env');
        }

        $cacheKey = 'paypal_access_token_' . md5($this->clientId);

        return Cache::remember($cacheKey, 300, function () use ($cacheKey) {
            $response = Http::asForm()
                ->withBasicAuth($this->clientId, $this->clientSecret)
                ->post("{$this->baseUrl}/v1/oauth2/token", [
                    'grant_type' => 'client_credentials',
                ]);

            if ($response->failed()) {
                $errorData = $response->json();
                $errorMsg = $errorData['error_description'] ?? $errorData['error'] ?? $response->body();
                throw new RuntimeException("PayPal OAuth authentication failed ({$response->status()}): {$errorMsg}");
            }

            $data = $response->json();
            $token = $data['access_token'] ?? null;
            $expiresIn = (int) ($data['expires_in'] ?? 3600);

            if (! $token) {
                throw new RuntimeException('PayPal OAuth response did not contain an access_token.');
            }

            // Cache token for expiry duration minus 60 seconds
            $cacheTtl = max(60, $expiresIn - 60);
            Cache::put($cacheKey, $token, $cacheTtl);

            return $token;
        });
    }

    /**
     * Create an order in PayPal v2 Checkout API.
     */
    public function createOrder(Order $order): array
    {
        if (config('paypal.mode') === 'mock' || (empty($this->clientId) && env('PAYPAL_ALLOW_SIMULATED', false))) {
            return [
                'id' => 'SIMULATED-' . strtoupper(bin2hex(random_bytes(6))),
                'status' => 'CREATED',
                'intent' => 'CAPTURE',
                'purchase_units' => [
                    [
                        'reference_id' => 'order_' . $order->id,
                        'amount' => [
                            'currency_code' => $order->currency,
                            'value' => number_format((float) $order->total, 2, '.', ''),
                        ],
                    ],
                ],
            ];
        }

        $accessToken = $this->getAccessToken();

        $payload = [
            'intent' => 'CAPTURE',
            'purchase_units' => [
                [
                    'reference_id' => 'order_' . $order->id,
                    'description' => 'PayPilot AI Order #' . $order->order_number,
                    'custom_id' => (string) $order->id,
                    'amount' => [
                        'currency_code' => $order->currency,
                        'value' => number_format((float) $order->total, 2, '.', ''),
                    ],
                ],
            ],
            'application_context' => [
                'brand_name' => 'PayPilot AI',
                'landing_page' => 'NO_PREFERENCE',
                'user_action' => 'PAY_NOW',
            ],
        ];

        $response = Http::withToken($accessToken)
            ->withHeaders([
                'Content-Type' => 'application/json',
            ])
            ->post("{$this->baseUrl}/v2/checkout/orders", $payload);

        if ($response->failed()) {
            $errorData = $response->json();
            $errorMsg = $errorData['message'] ?? $response->body();
            throw new RuntimeException("Failed to create PayPal order ({$response->status()}): {$errorMsg}");
        }

        return $response->json();
    }

    /**
     * Capture payment for an approved PayPal order.
     */
    public function capturePayment(string $paypalOrderId): array
    {
        if (str_starts_with($paypalOrderId, 'SIMULATED-')) {
            return [
                'id' => $paypalOrderId,
                'status' => 'COMPLETED',
                'purchase_units' => [
                    [
                        'payments' => [
                            'captures' => [
                                [
                                    'id' => 'CAPTURE-' . strtoupper(bin2hex(random_bytes(6))),
                                    'status' => 'COMPLETED',
                                    'amount' => [
                                        'value' => '0.00',
                                        'currency_code' => 'USD',
                                    ],
                                ],
                            ],
                        ],
                    ],
                ],
            ];
        }

        $accessToken = $this->getAccessToken();

        $response = Http::withToken($accessToken)
            ->withHeaders([
                'Content-Type' => 'application/json',
            ])
            ->post("{$this->baseUrl}/v2/checkout/orders/{$paypalOrderId}/capture", (object) []);

        if ($response->failed()) {
            $errorData = $response->json();
            $errorMsg = $errorData['message'] ?? $response->body();
            throw new RuntimeException("Failed to capture PayPal payment ({$response->status()}): {$errorMsg}");
        }

        return $response->json();
    }
}
