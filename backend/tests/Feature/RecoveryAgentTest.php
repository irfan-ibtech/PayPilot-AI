<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Payment;
use App\Models\RecoveryOpportunity;
use App\Models\User;
use App\Services\PayPalService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use Tests\TestCase;

class RecoveryAgentTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Test 1: Scan detects unrecovered drop-offs, calculates deterministic score, and assigns priority.
     */
    public function test_scan_identifies_unrecovered_dropoffs_and_scores_recovery_potential(): void
    {
        $user = User::factory()->create();

        $order = Order::create([
            'user_id' => $user->id,
            'order_number' => 'PP-REC-001',
            'subtotal' => '120.00',
            'total' => '120.00',
            'currency' => 'USD',
            'status' => 'FAILED',
            'created_at' => Carbon::now()->subHours(2),
        ]);

        Payment::create([
            'order_id' => $order->id,
            'user_id' => $user->id,
            'provider' => 'paypal',
            'paypal_order_id' => 'PAYPAL-FAIL-001',
            'amount' => '120.00',
            'currency' => 'USD',
            'status' => 'FAILED',
            'failure_reason' => 'PayPal checkout session timed out during payment authorization',
            'attempt_number' => 1,
            'created_at' => Carbon::now()->subHours(2),
        ]);

        $response = $this->actingAs($user)->postJson('/api/recovery/scan');

        $response->assertStatus(200)
            ->assertJson([
                'discovered_count' => 1,
            ]);

        $opportunity = RecoveryOpportunity::where('order_id', $order->id)->first();
        $this->assertNotNull($opportunity);
        $this->assertEquals('PENDING', $opportunity->status);
        $this->assertGreaterThanOrEqual(50, $opportunity->recovery_score);
        $this->assertContains($opportunity->priority, ['medium', 'high', 'critical']);
        $this->assertNotNull($opportunity->customer_message_draft);
        $this->assertNotEmpty($opportunity->audit_trail);
        $this->assertEquals('DISCOVERED', $opportunity->audit_trail[0]['action']);
    }

    /**
     * Test 2: Merchant can approve opportunity and customize customer reminder copy.
     */
    public function test_merchant_can_approve_opportunity_and_record_audit_trail(): void
    {
        $user = User::factory()->create();

        $order = Order::create([
            'user_id' => $user->id,
            'order_number' => 'PP-REC-002',
            'subtotal' => '80.00',
            'total' => '80.00',
            'currency' => 'USD',
            'status' => 'PENDING',
        ]);

        $opportunity = RecoveryOpportunity::create([
            'user_id' => $user->id,
            'order_id' => $order->id,
            'recovery_score' => 85,
            'priority' => 'high',
            'status' => 'PENDING',
            'customer_message_draft' => 'Original Draft Message',
            'audit_trail' => [
                ['action' => 'DISCOVERED', 'timestamp' => now()->toIso8601String()],
            ],
        ]);

        $response = $this->actingAs($user)->postJson("/api/recovery/opportunities/{$opportunity->id}/approve", [
            'custom_message' => 'Customized message: Complete your checkout here: [RECOVERY_LINK]',
        ]);

        $response->assertStatus(200)
            ->assertJsonFragment([
                'message' => 'Recovery opportunity approved successfully.',
            ]);

        $opportunity->refresh();
        $this->assertEquals('APPROVED', $opportunity->status);
        $this->assertNotNull($opportunity->approved_at);
        $this->assertEquals('Customized message: Complete your checkout here: [RECOVERY_LINK]', $opportunity->customer_message_draft);

        $actions = collect($opportunity->audit_trail)->pluck('action')->toArray();
        $this->assertContains('APPROVED', $actions);
    }

    /**
     * Test 3: Merchant can dismiss/reject an unwanted recovery opportunity.
     */
    public function test_merchant_can_reject_opportunity(): void
    {
        $user = User::factory()->create();

        $order = Order::create([
            'user_id' => $user->id,
            'order_number' => 'PP-REC-003',
            'subtotal' => '40.00',
            'total' => '40.00',
            'currency' => 'USD',
            'status' => 'PENDING',
        ]);

        $opportunity = RecoveryOpportunity::create([
            'user_id' => $user->id,
            'order_id' => $order->id,
            'recovery_score' => 45,
            'priority' => 'low',
            'status' => 'PENDING',
            'audit_trail' => [],
        ]);

        $response = $this->actingAs($user)->postJson("/api/recovery/opportunities/{$opportunity->id}/reject", [
            'reason' => 'Customer confirmed order was placed on alternate account',
        ]);

        $response->assertStatus(200)
            ->assertJsonFragment([
                'message' => 'Recovery opportunity dismissed.',
            ]);

        $opportunity->refresh();
        $this->assertEquals('REJECTED', $opportunity->status);
        $this->assertNotNull($opportunity->rejected_at);

        $actions = collect($opportunity->audit_trail)->pluck('action')->toArray();
        $this->assertContains('REJECTED', $actions);
    }

    /**
     * Test 4: Launching recovery checkout initializes PayPal attempt with recovery flag.
     */
    public function test_launch_recovery_checkout_creates_paypal_order_with_recovery_flag(): void
    {
        $user = User::factory()->create();

        $order = Order::create([
            'user_id' => $user->id,
            'order_number' => 'PP-REC-004',
            'subtotal' => '95.00',
            'total' => '95.00',
            'currency' => 'USD',
            'status' => 'PENDING',
        ]);

        $opportunity = RecoveryOpportunity::create([
            'user_id' => $user->id,
            'order_id' => $order->id,
            'recovery_score' => 90,
            'priority' => 'critical',
            'status' => 'APPROVED',
            'audit_trail' => [],
        ]);

        $payPalMock = Mockery::mock(PayPalService::class);
        $payPalMock->shouldReceive('createOrder')
            ->once()
            ->andReturn([
                'id' => 'PAYPAL-REC-ORDER-99',
                'status' => 'CREATED',
            ]);
        $this->app->instance(PayPalService::class, $payPalMock);

        $response = $this->actingAs($user)->postJson("/api/recovery/opportunities/{$opportunity->id}/checkout");

        $response->assertStatus(200)
            ->assertJsonFragment([
                'paypal_order_id' => 'PAYPAL-REC-ORDER-99',
            ]);

        $opportunity->refresh();
        $this->assertEquals('IN_FLIGHT', $opportunity->status);

        $payment = Payment::where('paypal_order_id', 'PAYPAL-REC-ORDER-99')->first();
        $this->assertNotNull($payment);
        $this->assertTrue($payment->is_recovery_attempt);
        $this->assertEquals('95.00', $payment->amount);
    }

    /**
     * Test 5: PayPal payment capture automatically reconciles associated recovery opportunity to RECOVERED.
     */
    public function test_capturing_paypal_order_reconciles_active_recovery_opportunity_to_recovered(): void
    {
        $user = User::factory()->create();

        $order = Order::create([
            'user_id' => $user->id,
            'order_number' => 'PP-REC-005',
            'subtotal' => '65.00',
            'total' => '65.00',
            'currency' => 'USD',
            'status' => 'PENDING',
        ]);

        $payment = Payment::create([
            'order_id' => $order->id,
            'user_id' => $user->id,
            'provider' => 'paypal',
            'paypal_order_id' => 'PAYPAL-RECOVER-CAPT',
            'amount' => '65.00',
            'currency' => 'USD',
            'status' => 'CREATED',
            'attempt_number' => 2,
            'is_recovery_attempt' => true,
        ]);

        $opportunity = RecoveryOpportunity::create([
            'user_id' => $user->id,
            'order_id' => $order->id,
            'latest_payment_id' => $payment->id,
            'recovery_score' => 92,
            'priority' => 'critical',
            'status' => 'IN_FLIGHT',
            'audit_trail' => [],
        ]);

        $payPalMock = Mockery::mock(PayPalService::class);
        $payPalMock->shouldReceive('capturePayment')
            ->once()
            ->andReturn([
                'id' => 'PAYPAL-RECOVER-CAPT',
                'status' => 'COMPLETED',
                'purchase_units' => [
                    [
                        'payments' => [
                            'captures' => [
                                [
                                    'id' => 'CAPTURE-RECOVERED-001',
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

        $response = $this->actingAs($user)->postJson('/api/payments/paypal/capture', [
            'paypal_order_id' => 'PAYPAL-RECOVER-CAPT',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);

        $opportunity->refresh();
        $this->assertEquals('RECOVERED', $opportunity->status);
        $this->assertEquals($payment->id, $opportunity->recovered_payment_id);
        $this->assertNotNull($opportunity->recovered_at);

        $this->assertEquals('PAID', $order->fresh()->status);
        $this->assertEquals('COMPLETED', $payment->fresh()->status);
    }

    /**
     * Test 6: Recovery metrics endpoint calculates deterministic pipeline totals with Money precision.
     */
    public function test_recovery_metrics_endpoint_aggregates_deterministic_pipeline_totals(): void
    {
        $user = User::factory()->create();

        // Opportunity 1: PENDING ($100.00)
        $order1 = Order::create([
            'user_id' => $user->id,
            'order_number' => 'PP-MTR-001',
            'subtotal' => '100.00',
            'total' => '100.00',
            'currency' => 'USD',
            'status' => 'PENDING',
        ]);
        RecoveryOpportunity::create([
            'user_id' => $user->id,
            'order_id' => $order1->id,
            'recovery_score' => 80,
            'priority' => 'high',
            'status' => 'PENDING',
        ]);

        // Opportunity 2: RECOVERED ($50.00)
        $order2 = Order::create([
            'user_id' => $user->id,
            'order_number' => 'PP-MTR-002',
            'subtotal' => '50.00',
            'total' => '50.00',
            'currency' => 'USD',
            'status' => 'PAID',
        ]);
        RecoveryOpportunity::create([
            'user_id' => $user->id,
            'order_id' => $order2->id,
            'recovery_score' => 95,
            'priority' => 'critical',
            'status' => 'RECOVERED',
            'recovered_at' => now(),
        ]);

        $response = $this->actingAs($user)->getJson('/api/recovery/metrics');

        $response->assertStatus(200)
            ->assertJsonFragment([
                'total_opportunities' => 2,
                'pending_review' => 1,
                'recovered_count' => 1,
                'potential_recoverable_revenue' => 100.0,
                'formatted_potential_revenue' => '$100.00',
                'recovered_revenue' => 50.0,
                'formatted_recovered_revenue' => '$50.00',
                'recovery_rate' => 50.0,
            ]);
    }
}
