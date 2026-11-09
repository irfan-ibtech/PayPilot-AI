<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Payment;
use App\Models\RecoveryOpportunity;
use App\Models\User;
use App\Services\PayPalService;
use App\Services\RecoveryAgentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Mockery;
use RuntimeException;
use Tests\TestCase;

class PayPalSandboxIntegrationTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Test: Missing PayPal credentials throws a clear configuration error.
     */
    public function test_missing_credentials_throws_clear_configuration_error(): void
    {
        config(['paypal.client_id' => '', 'paypal.client_secret' => '', 'paypal.mode' => 'sandbox']);

        $service = new PayPalService();

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('PayPal API credentials are not set');

        $service->getAccessToken();
    }

    /**
     * Test: Invalid PayPal OAuth credentials throws a clear authentication error.
     */
    public function test_invalid_credentials_throws_clear_authentication_error(): void
    {
        config([
            'paypal.client_id' => 'INVALID_CLIENT_ID',
            'paypal.client_secret' => 'INVALID_SECRET',
            'paypal.mode' => 'sandbox',
            'paypal.base_url' => 'https://api-m.sandbox.paypal.com',
        ]);

        Http::fake([
            'https://api-m.sandbox.paypal.com/v1/oauth2/token' => Http::response([
                'error' => 'invalid_client',
                'error_description' => 'Client Authentication failed',
            ], 401),
        ]);

        $service = new PayPalService();

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('PayPal OAuth authentication failed (401): Client Authentication failed');

        $service->getAccessToken();
    }

    /**
     * Test: Order creation fails loudly with exception instead of silent simulation fallback.
     */
    public function test_order_creation_throws_exception_on_paypal_error_without_silent_simulation(): void
    {
        config([
            'paypal.client_id' => 'TEST_ID',
            'paypal.client_secret' => 'TEST_SECRET',
            'paypal.mode' => 'sandbox',
            'paypal.base_url' => 'https://api-m.sandbox.paypal.com',
        ]);

        Http::fake([
            'https://api-m.sandbox.paypal.com/v1/oauth2/token' => Http::response([
                'access_token' => 'valid_mock_token',
                'expires_in' => 3600,
            ], 200),
            'https://api-m.sandbox.paypal.com/v2/checkout/orders' => Http::response([
                'message' => 'System error at PayPal upstream',
            ], 500),
        ]);

        $user = User::factory()->create();
        $order = Order::create([
            'user_id' => $user->id,
            'order_number' => 'PP-FAIL-001',
            'subtotal' => '50.00',
            'total' => '50.00',
            'currency' => 'USD',
            'status' => 'PENDING',
        ]);

        $service = new PayPalService();

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('PayPal order creation failed (500)');

        $service->createOrder($order);
    }

    /**
     * Test: Genuine PayPal capture records is_simulated = false and updates order to PAID.
     */
    public function test_genuine_paypal_capture_sets_is_simulated_false_and_marks_order_paid(): void
    {
        $user = User::factory()->create();
        $order = Order::create([
            'user_id' => $user->id,
            'order_number' => 'PP-REAL-001',
            'subtotal' => '75.00',
            'total' => '75.00',
            'currency' => 'USD',
            'status' => 'PENDING',
        ]);

        $payment = Payment::create([
            'order_id' => $order->id,
            'user_id' => $user->id,
            'provider' => 'paypal',
            'paypal_order_id' => 'REAL-PP-ORDER-12345',
            'amount' => '75.00',
            'currency' => 'USD',
            'status' => 'CREATED',
            'attempt_number' => 1,
            'is_simulated' => false,
        ]);

        $payPalMock = Mockery::mock(PayPalService::class);
        $payPalMock->shouldReceive('capturePayment')
            ->once()
            ->with('REAL-PP-ORDER-12345', Mockery::any())
            ->andReturn([
                'id' => 'REAL-PP-ORDER-12345',
                'status' => 'COMPLETED',
                'is_simulated' => false,
                'purchase_units' => [
                    [
                        'payments' => [
                            'captures' => [
                                [
                                    'id' => 'REAL-CAPTURE-998877',
                                    'status' => 'COMPLETED',
                                    'amount' => [
                                        'value' => '75.00',
                                        'currency_code' => 'USD',
                                    ],
                                ],
                            ],
                        ],
                    ],
                ],
            ]);
        $this->app->instance(PayPalService::class, $payPalMock);

        $response = $this->actingAs($user)->postJson('/api/payments/paypal/capture', [
            'paypal_order_id' => 'REAL-PP-ORDER-12345',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Payment captured and verified successfully.',
            ]);

        $payment->refresh();
        $order->refresh();

        $this->assertEquals('COMPLETED', $payment->status);
        $this->assertEquals('REAL-CAPTURE-998877', $payment->paypal_capture_id);
        $this->assertFalse((bool) $payment->is_simulated);
        $this->assertEquals('PAID', $order->status);
    }

    /**
     * Test: Simulated captures do NOT increment genuine recovered revenue.
     */
    public function test_simulated_captures_do_not_increment_genuine_recovered_revenue(): void
    {
        $user = User::factory()->create();

        // 1. Genuine recovered opportunity
        $genuineOrder = Order::create([
            'user_id' => $user->id,
            'order_number' => 'PP-GENUINE-REC',
            'subtotal' => '120.00',
            'total' => '120.00',
            'currency' => 'USD',
            'status' => 'PAID',
        ]);

        $genuinePayment = Payment::create([
            'order_id' => $genuineOrder->id,
            'user_id' => $user->id,
            'provider' => 'paypal',
            'paypal_order_id' => 'REAL-REC-ORDER-111',
            'paypal_capture_id' => 'REAL-CAP-111',
            'amount' => '120.00',
            'currency' => 'USD',
            'status' => 'COMPLETED',
            'attempt_number' => 1,
            'is_recovery_attempt' => true,
            'is_simulated' => false,
            'captured_at' => now(),
        ]);

        $genuineOpp = RecoveryOpportunity::create([
            'user_id' => $user->id,
            'order_id' => $genuineOrder->id,
            'latest_payment_id' => $genuinePayment->id,
            'recovered_payment_id' => $genuinePayment->id,
            'recovery_score' => 95,
            'priority_level' => 'HIGH',
            'strategy_key' => 'VIP_DIRECT',
            'status' => 'RECOVERED',
            'workflow_state' => 'RECOVERED',
            'recovered_at' => now(),
        ]);

        // 2. Simulated recovered opportunity
        $simOrder = Order::create([
            'user_id' => $user->id,
            'order_number' => 'PP-SIM-REC',
            'subtotal' => '80.00',
            'total' => '80.00',
            'currency' => 'USD',
            'status' => 'PAID',
        ]);

        $simPayment = Payment::create([
            'order_id' => $simOrder->id,
            'user_id' => $user->id,
            'provider' => 'paypal',
            'paypal_order_id' => 'SIMULATED-ABCDEF12',
            'paypal_capture_id' => 'CAPTURE-SIM-998877',
            'amount' => '80.00',
            'currency' => 'USD',
            'status' => 'COMPLETED',
            'attempt_number' => 1,
            'is_recovery_attempt' => true,
            'is_simulated' => true,
            'captured_at' => now(),
        ]);

        $simOpp = RecoveryOpportunity::create([
            'user_id' => $user->id,
            'order_id' => $simOrder->id,
            'latest_payment_id' => $simPayment->id,
            'recovered_payment_id' => $simPayment->id,
            'recovery_score' => 70,
            'priority_level' => 'MEDIUM',
            'strategy_key' => 'STANDARD',
            'status' => 'RECOVERED',
            'workflow_state' => 'RECOVERED',
            'recovered_at' => now(),
        ]);

        $recoveryService = app(RecoveryAgentService::class);
        $metrics = $recoveryService->getRecoveryDashboardMetrics($user->id);

        // Genuine recovered revenue must be strictly $120.00 (NOT $200.00)
        $this->assertEquals(120.00, $metrics['recovered_revenue']);
        $this->assertEquals(120.00, $metrics['genuine_recovered_revenue']);
        $this->assertEquals(80.00, $metrics['simulated_recovered_revenue']);
        $this->assertEquals(1, $metrics['genuine_recovered_count']);
        $this->assertEquals(1, $metrics['simulated_recovered_count']);
    }

    /**
     * Test: Reconciliation queries PayPal REST API and synchronizes state accurately.
     */
    public function test_reconciliation_queries_paypal_api_and_syncs_completed_state(): void
    {
        $user = User::factory()->create();
        $order = Order::create([
            'user_id' => $user->id,
            'order_number' => 'PP-RECON-001',
            'subtotal' => '65.00',
            'total' => '65.00',
            'currency' => 'USD',
            'status' => 'PENDING',
        ]);

        $payment = Payment::create([
            'order_id' => $order->id,
            'user_id' => $user->id,
            'provider' => 'paypal',
            'paypal_order_id' => 'RECON-PP-9900',
            'amount' => '65.00',
            'currency' => 'USD',
            'status' => 'REQUIRES_RECONCILIATION',
            'attempt_number' => 1,
            'is_simulated' => false,
        ]);

        $payPalMock = Mockery::mock(PayPalService::class);
        $payPalMock->shouldReceive('getOrderDetails')
            ->once()
            ->with('RECON-PP-9900')
            ->andReturn([
                'id' => 'RECON-PP-9900',
                'status' => 'COMPLETED',
                'is_simulated' => false,
                'purchase_units' => [
                    [
                        'payments' => [
                            'captures' => [
                                [
                                    'id' => 'RECON-CAPTURE-112233',
                                    'status' => 'COMPLETED',
                                    'amount' => [
                                        'value' => '65.00',
                                        'currency_code' => 'USD',
                                    ],
                                ],
                            ],
                        ],
                    ],
                ],
            ]);
        $this->app->instance(PayPalService::class, $payPalMock);

        $response = $this->actingAs($user)->postJson('/api/payments/paypal/RECON-PP-9900/reconcile');

        $response->assertStatus(200)
            ->assertJson([
                'status' => 'COMPLETED',
                'message' => 'Payment reconciled and confirmed as completed.',
            ]);

        $payment->refresh();
        $order->refresh();

        $this->assertEquals('COMPLETED', $payment->status);
        $this->assertEquals('RECON-CAPTURE-112233', $payment->paypal_capture_id);
        $this->assertFalse((bool) $payment->is_simulated);
        $this->assertEquals('PAID', $order->status);
    }

    /**
     * Test: Network timeout during capture safely sets status to REQUIRES_RECONCILIATION.
     */
    public function test_network_timeout_during_capture_transitions_to_requires_reconciliation(): void
    {
        $user = User::factory()->create();
        $order = Order::create([
            'user_id' => $user->id,
            'order_number' => 'PP-TIMEOUT-001',
            'subtotal' => '50.00',
            'total' => '50.00',
            'currency' => 'USD',
            'status' => 'PENDING',
        ]);

        $payment = Payment::create([
            'order_id' => $order->id,
            'user_id' => $user->id,
            'provider' => 'paypal',
            'paypal_order_id' => 'TIMEOUT-PP-ORDER',
            'amount' => '50.00',
            'currency' => 'USD',
            'status' => 'CREATED',
            'attempt_number' => 1,
            'is_simulated' => false,
        ]);

        $payPalMock = Mockery::mock(PayPalService::class);
        $payPalMock->shouldReceive('capturePayment')
            ->once()
            ->andThrow(new RuntimeException('cURL error 28: Connection timed out after 10001 milliseconds'));
        $this->app->instance(PayPalService::class, $payPalMock);

        $response = $this->actingAs($user)->postJson('/api/payments/paypal/capture', [
            'paypal_order_id' => 'TIMEOUT-PP-ORDER',
        ]);

        $response->assertStatus(504)
            ->assertJson([
                'status' => 'REQUIRES_RECONCILIATION',
            ]);

        $payment->refresh();
        $this->assertEquals('REQUIRES_RECONCILIATION', $payment->status);
        $this->assertStringContainsString('timed out', $payment->failure_reason);
        $this->assertEquals('PENDING', $order->fresh()->status);
    }

    /**
     * Test: Currency mismatch during capture is strictly rejected with 422.
     */
    public function test_currency_mismatch_during_capture_is_rejected(): void
    {
        $user = User::factory()->create();
        $order = Order::create([
            'user_id' => $user->id,
            'order_number' => 'PP-CUR-MISMATCH',
            'subtotal' => '100.00',
            'total' => '100.00',
            'currency' => 'USD',
            'status' => 'PENDING',
        ]);

        Payment::create([
            'order_id' => $order->id,
            'user_id' => $user->id,
            'provider' => 'paypal',
            'paypal_order_id' => 'CUR-MISMATCH-ORDER',
            'amount' => '100.00',
            'currency' => 'USD',
            'status' => 'CREATED',
            'attempt_number' => 1,
            'is_simulated' => false,
        ]);

        // PayPal returns EUR instead of USD
        $payPalMock = Mockery::mock(PayPalService::class);
        $payPalMock->shouldReceive('capturePayment')
            ->once()
            ->andReturn([
                'id' => 'CUR-MISMATCH-ORDER',
                'status' => 'COMPLETED',
                'is_simulated' => false,
                'purchase_units' => [
                    [
                        'payments' => [
                            'captures' => [
                                [
                                    'id' => 'CAPTURE-WRONG-CURRENCY',
                                    'status' => 'COMPLETED',
                                    'amount' => [
                                        'value' => '100.00',
                                        'currency_code' => 'EUR', // Mismatched currency
                                    ],
                                ],
                            ],
                        ],
                    ],
                ],
            ]);
        $this->app->instance(PayPalService::class, $payPalMock);

        $response = $this->actingAs($user)->postJson('/api/payments/paypal/capture', [
            'paypal_order_id' => 'CUR-MISMATCH-ORDER',
        ]);

        $response->assertStatus(422)
            ->assertJsonFragment([
                'message' => 'Security verification failed: Captured amount or currency mismatch.',
            ]);

        $this->assertEquals('PENDING', $order->fresh()->status);
    }

    /**
     * Test: Unapproved recovery opportunity checkout is strictly blocked.
     */
    public function test_unapproved_recovery_checkout_is_strictly_blocked(): void
    {
        $user = User::factory()->create();
        $order = Order::create([
            'user_id' => $user->id,
            'order_number' => 'PP-UNAPPROVED-REC',
            'subtotal' => '85.00',
            'total' => '85.00',
            'currency' => 'USD',
            'status' => 'FAILED',
        ]);

        $opportunity = RecoveryOpportunity::create([
            'user_id' => $user->id,
            'order_id' => $order->id,
            'recovery_score' => 80,
            'priority_level' => 'HIGH',
            'strategy_key' => 'VIP_DIRECT',
            'status' => 'PENDING', // NOT approved!
            'workflow_state' => 'DIAGNOSED',
        ]);

        $response = $this->actingAs($user)->postJson("/api/recovery/opportunities/{$opportunity->id}/checkout");

        $response->assertStatus(400)
            ->assertJsonFragment([
                'message' => 'Recovery checkout initialization failed: Opportunity must be approved by the merchant before launching recovery checkout (current status: PENDING).',
            ]);
    }

    /**
     * Test: Cross-merchant recovery opportunity access is strictly blocked (IDOR protection).
     */
    public function test_cross_merchant_recovery_opportunity_access_is_blocked(): void
    {
        $merchantA = User::factory()->create();
        $merchantB = User::factory()->create();

        $orderB = Order::create([
            'user_id' => $merchantB->id,
            'order_number' => 'PP-IDOR-REC-001',
            'subtotal' => '50.00',
            'total' => '50.00',
            'currency' => 'USD',
            'status' => 'FAILED',
        ]);

        $oppB = RecoveryOpportunity::create([
            'user_id' => $merchantB->id,
            'order_id' => $orderB->id,
            'recovery_score' => 75,
            'priority_level' => 'MEDIUM',
            'strategy_key' => 'STANDARD',
            'status' => 'APPROVED',
            'workflow_state' => 'APPROVED_FOR_OUTREACH',
        ]);

        // Merchant A attempts to access or checkout Merchant B's opportunity
        $response = $this->actingAs($merchantA)->postJson("/api/recovery/opportunities/{$oppB->id}/checkout");

        $response->assertStatus(404);
    }
}
