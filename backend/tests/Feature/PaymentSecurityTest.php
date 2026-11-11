<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Payment;
use App\Models\Product;
use App\Models\User;
use App\Services\PayPalService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use Tests\TestCase;

class PaymentSecurityTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Test 1: Amount / currency mismatch during capture is strictly rejected.
     */
    public function test_rejects_tampered_or_mismatched_payment_amount_on_capture(): void
    {
        $user = User::factory()->create();
        $order = Order::create([
            'user_id' => $user->id,
            'order_number' => 'PP-SEC-001',
            'subtotal' => '100.00',
            'total' => '100.00',
            'currency' => 'USD',
            'status' => 'PENDING',
        ]);

        $payment = Payment::create([
            'order_id' => $order->id,
            'user_id' => $user->id,
            'provider' => 'paypal',
            'paypal_order_id' => 'PAYPAL-REAL-001',
            'amount' => '100.00',
            'currency' => 'USD',
            'status' => 'CREATED',
            'attempt_number' => 1,
        ]);

        // Mock PayPalService returning a tampered/mismatched capture value of $10.00
        $payPalMock = Mockery::mock(PayPalService::class);
        $payPalMock->shouldReceive('capturePayment')
            ->once()
            ->andReturn([
                'id' => 'PAYPAL-REAL-001',
                'status' => 'COMPLETED',
                'purchase_units' => [
                    [
                        'payments' => [
                            'captures' => [
                                [
                                    'id' => 'CAPTURE-TAMPERED',
                                    'status' => 'COMPLETED',
                                    'amount' => [
                                        'value' => '10.00',
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
            'paypal_order_id' => 'PAYPAL-REAL-001',
        ]);

        $response->assertStatus(422)
            ->assertJsonFragment([
                'message' => 'Security verification failed: Captured amount or currency mismatch.',
            ]);

        $payment->refresh();
        $this->assertEquals('FAILED', $payment->status);
        $this->assertStringContainsString('Amount or currency mismatch', $payment->failure_reason);
        $this->assertEquals('PENDING', $order->fresh()->status);
    }

    /**
     * Test 2: Idempotent capture returns cached completed record without duplicate capture calls.
     */
    public function test_idempotent_capture_returns_cached_success_without_duplicate_processing(): void
    {
        $user = User::factory()->create();
        $order = Order::create([
            'user_id' => $user->id,
            'order_number' => 'PP-SEC-002',
            'subtotal' => '50.00',
            'total' => '50.00',
            'currency' => 'USD',
            'status' => 'PAID',
        ]);

        $payment = Payment::create([
            'order_id' => $order->id,
            'user_id' => $user->id,
            'provider' => 'paypal',
            'paypal_order_id' => 'PAYPAL-COMPLETED-001',
            'paypal_capture_id' => 'CAPTURE-COMPLETED-001',
            'amount' => '50.00',
            'currency' => 'USD',
            'status' => 'COMPLETED',
            'attempt_number' => 1,
            'captured_at' => now(),
        ]);

        // PayPalService must NOT be called because payment is already COMPLETED
        $payPalMock = Mockery::mock(PayPalService::class);
        $payPalMock->shouldNotReceive('capturePayment');
        $this->app->instance(PayPalService::class, $payPalMock);

        $response = $this->actingAs($user)->postJson('/api/payments/paypal/capture', [
            'paypal_order_id' => 'PAYPAL-COMPLETED-001',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Payment has already been processed and verified.',
            ]);
    }

    /**
     * Test 3: Multi-attempt payment ledger increments attempt_number and assigns idempotency keys.
     */
    public function test_multi_attempt_ledger_increments_attempt_number_and_records_idempotency_key(): void
    {
        $user = User::factory()->create();
        $order = Order::create([
            'user_id' => $user->id,
            'order_number' => 'PP-SEC-003',
            'subtotal' => '75.00',
            'total' => '75.00',
            'currency' => 'USD',
            'status' => 'PENDING',
        ]);

        $payPalMock = Mockery::mock(PayPalService::class);
        $payPalMock->shouldReceive('createOrder')
            ->twice()
            ->andReturn(
                ['id' => 'PAYPAL-ATT-1', 'status' => 'CREATED'],
                ['id' => 'PAYPAL-ATT-2', 'status' => 'CREATED']
            );
        $this->app->instance(PayPalService::class, $payPalMock);

        // Attempt 1
        $res1 = $this->actingAs($user)->postJson("/api/payments/paypal/{$order->id}/create");
        $res1->assertStatus(200)
            ->assertJsonFragment(['paypal_order_id' => 'PAYPAL-ATT-1']);

        $payment1 = Payment::where('paypal_order_id', 'PAYPAL-ATT-1')->first();
        $this->assertEquals(1, $payment1->attempt_number);
        $this->assertNotNull($payment1->idempotency_key);

        // Attempt 2 (Retry on same order)
        $res2 = $this->actingAs($user)->postJson("/api/payments/paypal/{$order->id}/create");
        $res2->assertStatus(200)
            ->assertJsonFragment(['paypal_order_id' => 'PAYPAL-ATT-2']);

        $payment2 = Payment::where('paypal_order_id', 'PAYPAL-ATT-2')->first();
        $this->assertEquals(2, $payment2->attempt_number);
        $this->assertNotNull($payment2->idempotency_key);
        $this->assertNotEquals($payment1->idempotency_key, $payment2->idempotency_key);

        $this->assertEquals(2, $order->payments()->count());
    }

    /**
     * Test 4: Tenant isolation prevents capturing another merchant's order or payment.
     */
    public function test_tenant_isolation_prevents_capturing_another_merchant_order(): void
    {
        $merchantA = User::factory()->create();
        $merchantB = User::factory()->create();

        $orderB = Order::create([
            'user_id' => $merchantB->id,
            'order_number' => 'PP-SEC-004B',
            'subtotal' => '30.00',
            'total' => '30.00',
            'currency' => 'USD',
            'status' => 'PENDING',
        ]);

        Payment::create([
            'order_id' => $orderB->id,
            'user_id' => $merchantB->id,
            'provider' => 'paypal',
            'paypal_order_id' => 'PAYPAL-ORDER-B',
            'amount' => '30.00',
            'currency' => 'USD',
            'status' => 'CREATED',
            'attempt_number' => 1,
        ]);

        // Merchant A tries to capture Merchant B's payment
        $response = $this->actingAs($merchantA)->postJson('/api/payments/paypal/capture', [
            'paypal_order_id' => 'PAYPAL-ORDER-B',
        ]);

        $response->assertStatus(404);
    }

    /**
     * Test 5: Catalog price resolution overrides LLM-extracted unit price with true DB price.
     */
    public function test_ai_order_catalog_price_resolution_overrides_untrusted_prompt_prices(): void
    {
        $user = User::factory()->create();

        // Merchant product configured at $499.00
        Product::create([
            'user_id' => $user->id,
            'name' => 'Enterprise Plan',
            'description' => 'Annual SaaS Subscription',
            'unit_price' => '499.00',
            'currency' => 'USD',
        ]);

        // Customer prompt attempts to purchase for $1.00
        $response = $this->actingAs($user)->postJson('/api/ai/parse-order', [
            'prompt' => '1 Enterprise Plan for $1.00',
        ]);

        $response->assertStatus(200);

        $data = $response->json();
        $this->assertNotEmpty($data['items']);
        $item = $data['items'][0];

        $this->assertEquals('Enterprise Plan', $item['name']);
        $this->assertEquals('499.00', $item['unit_price']); // Overridden by DB
        $this->assertEquals('499.00', $item['line_total']);
        $this->assertTrue($item['catalog_matched']);
        $this->assertEquals('499.00', $data['total']);
    }

    /**
     * Test 6: Buyer cancellation marks checkout abandoned and payment attempt as failed.
     */
    public function test_buyer_checkout_cancellation_marks_abandoned_and_payment_failed(): void
    {
        $user = User::factory()->create();
        $order = Order::create([
            'user_id' => $user->id,
            'order_number' => 'PP-CANCEL-001',
            'subtotal' => '85.00',
            'total' => '85.00',
            'currency' => 'USD',
            'status' => 'PENDING',
        ]);

        $payment = Payment::create([
            'order_id' => $order->id,
            'user_id' => $user->id,
            'provider' => 'paypal',
            'paypal_order_id' => 'PAYPAL-CANCEL-TEST',
            'amount' => '85.00',
            'currency' => 'USD',
            'status' => 'CREATED',
            'attempt_number' => 1,
        ]);

        $response = $this->actingAs($user)->postJson("/api/payments/paypal/{$order->id}/cancel");
        $response->assertStatus(200);

        $order->refresh();
        $payment->refresh();

        $this->assertNotNull($order->checkout_abandoned_at);
        $this->assertEquals('FAILED', $payment->status);
        $this->assertStringContainsString('Buyer cancelled checkout', $payment->failure_reason);
    }
}
