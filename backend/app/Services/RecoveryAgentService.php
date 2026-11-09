<?php

namespace App\Services;

use App\Models\Order;
use App\Models\Payment;
use App\Models\RecoveryOpportunity;
use App\Support\Money;
use Exception;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class RecoveryAgentService
{
    protected GeminiService $geminiService;
    protected PayPalService $payPalService;

    public function __construct(GeminiService $geminiService, PayPalService $payPalService)
    {
        $this->geminiService = $geminiService;
        $this->payPalService = $payPalService;
    }

    /**
     * Scan candidate orders and identify high-converting revenue recovery opportunities.
     */
    public function scanOpportunities(int $userId): array
    {
        // 1. Fetch unrecovered candidate orders
        $candidateOrders = Order::with(['items', 'payments'])
            ->where('user_id', $userId)
            ->whereIn('status', ['PENDING', 'FAILED'])
            ->whereDoesntHave('recoveryOpportunities', function ($query) {
                $query->whereIn('status', ['PENDING', 'APPROVED', 'IN_FLIGHT', 'RECOVERED']);
            })
            ->latest('created_at')
            ->get();

        $discovered = [];

        foreach ($candidateOrders as $order) {
            $payments = $order->payments;
            $score = $this->calculateScore($order, $payments);
            $priority = $this->determinePriority($score);

            $lastPayment = $payments->last();
            $failureReason = $lastPayment?->failure_reason ?? 'Customer exited during payment authorization';
            $hoursSinceCreation = max(1, (int) round(now()->diffInMinutes($order->created_at) / 60));

            $signals = [
                'cart_value_tier' => (float) $order->total >= 100 ? 'high' : ((float) $order->total >= 40 ? 'medium' : 'standard'),
                'hours_since_dropoff' => $hoursSinceCreation,
                'attempt_count' => $payments->count(),
                'last_failure_reason' => $failureReason,
                'is_multi_item' => $order->items->count() > 1,
            ];

            $itemsSummary = $order->items->map(fn($item) => "{$item->quantity}x {$item->product_name}")->join(', ');

            // Generate AI Recovery Strategy using Gemini 2.5 Flash
            $aiStrategy = $this->geminiService->generateRecoveryStrategy([
                'order' => [
                    'id' => $order->id,
                    'order_number' => $order->order_number,
                    'total' => $order->total,
                    'currency' => $order->currency,
                ],
                'amount' => Money::format($order->total),
                'currency' => $order->currency,
                'items_description' => $itemsSummary ?: 'Store products',
                'failure_reason' => $failureReason,
                'attempt_count' => $payments->count(),
                'hours_since_dropoff' => $hoursSinceCreation,
            ]);

            $opportunity = RecoveryOpportunity::create([
                'user_id' => $userId,
                'order_id' => $order->id,
                'latest_payment_id' => $lastPayment?->id,
                'recovery_score' => $score,
                'priority' => $priority,
                'status' => 'PENDING',
                'failure_reason_summary' => $failureReason,
                'eligibility_signals' => $signals,
                'ai_summary' => $aiStrategy['ai_summary'],
                'ai_reasoning' => $aiStrategy['ai_reasoning'],
                'ai_recommended_action' => $aiStrategy['ai_recommended_action'],
                'customer_message_draft' => $aiStrategy['customer_message_draft'],
                'ai_confidence' => $aiStrategy['ai_confidence'],
                'audit_trail' => [
                    [
                        'action' => 'DISCOVERED',
                        'actor' => 'AI_RECOVERY_AGENT',
                        'timestamp' => now()->toIso8601String(),
                        'details' => "Opportunity scored at {$score} ({$priority} priority) based on telemetry and cart intent.",
                    ],
                ],
            ]);

            $discovered[] = $opportunity->load(['order.items', 'latestPayment']);
        }

        return $discovered;
    }

    /**
     * Deterministic scoring engine (0 - 100) evaluating cart intent and recovery probability.
     */
    public function calculateScore(Order $order, Collection $payments): int
    {
        $score = 50;

        // Factor 1: Recency
        $hours = now()->diffInMinutes($order->created_at) / 60;
        if ($hours <= 24) {
            $score += 20;
        } elseif ($hours <= 48) {
            $score += 10;
        }

        // Factor 2: Cart Size (Sweet-spot conversion bandwidth)
        $total = (float) $order->total;
        if ($total >= 40 && $total <= 350) {
            $score += 15;
        } elseif ($total > 350) {
            $score += 10;
        }

        // Factor 3: Payment attempts
        $attemptCount = $payments->count();
        if ($attemptCount === 1) {
            $score += 10; // Transient friction, high probability
        } elseif ($attemptCount >= 3) {
            $score -= 15; // Multiple declines, lower likelihood
        }

        // Factor 4: Error reason
        $lastReason = strtolower($payments->last()?->failure_reason ?? '');
        if (str_contains($lastReason, 'timeout') || str_contains($lastReason, 'session') || str_contains($lastReason, 'abandoned')) {
            $score += 5;
        }

        return max(10, min(98, $score));
    }

    /**
     * Categorize priority based on score.
     */
    public function determinePriority(int $score): string
    {
        if ($score >= 85) {
            return 'critical';
        }
        if ($score >= 70) {
            return 'high';
        }
        if ($score >= 50) {
            return 'medium';
        }
        return 'low';
    }

    /**
     * Merchant approves recovery strategy and outreach draft.
     */
    public function approve(RecoveryOpportunity $opportunity, int $userId, ?string $customMessage = null): RecoveryOpportunity
    {
        if ($opportunity->user_id !== $userId) {
            throw new Exception('Unauthorized opportunity access.');
        }

        if (! in_array($opportunity->status, ['PENDING', 'REJECTED'])) {
            throw new Exception("Opportunity cannot be approved from status '{$opportunity->status}'.");
        }

        $audit = $opportunity->audit_trail ?? [];
        $audit[] = [
            'action' => 'APPROVED',
            'actor' => 'MERCHANT',
            'user_id' => $userId,
            'timestamp' => now()->toIso8601String(),
            'details' => 'Merchant reviewed and approved recovery intervention.',
        ];

        $opportunity->update([
            'status' => 'APPROVED',
            'approved_at' => now(),
            'customer_message_draft' => $customMessage ?: $opportunity->customer_message_draft,
            'audit_trail' => $audit,
        ]);

        return $opportunity->fresh(['order.items', 'latestPayment']);
    }

    /**
     * Merchant rejects recovery opportunity.
     */
    public function reject(RecoveryOpportunity $opportunity, int $userId, ?string $reason = null): RecoveryOpportunity
    {
        if ($opportunity->user_id !== $userId) {
            throw new Exception('Unauthorized opportunity access.');
        }

        if ($opportunity->status !== 'PENDING') {
            throw new Exception("Opportunity cannot be rejected from status '{$opportunity->status}'.");
        }

        $audit = $opportunity->audit_trail ?? [];
        $audit[] = [
            'action' => 'REJECTED',
            'actor' => 'MERCHANT',
            'user_id' => $userId,
            'timestamp' => now()->toIso8601String(),
            'details' => $reason ?: 'Merchant dismissed recovery opportunity.',
        ];

        $opportunity->update([
            'status' => 'REJECTED',
            'rejected_at' => now(),
            'audit_trail' => $audit,
        ]);

        return $opportunity->fresh(['order.items', 'latestPayment']);
    }

    /**
     * Re-analyze an opportunity using the live Gemini diagnostic agent.
     */
    public function analyzeOpportunity(RecoveryOpportunity $opportunity, int $userId): RecoveryOpportunity
    {
        if ($opportunity->user_id !== $userId) {
            throw new Exception('Unauthorized opportunity access.');
        }

        $order = $opportunity->order;
        $payments = $order->payments;
        $lastPayment = $payments->last();
        $failureReason = $opportunity->failure_reason_summary ?: ($lastPayment?->failure_reason ?? 'Payment session interrupted');
        $hoursSinceCreation = max(1, (int) round(now()->diffInMinutes($order->created_at) / 60));
        $itemsSummary = $order->items->map(fn($item) => "{$item->quantity}x {$item->product_name}")->join(', ');

        $aiStrategy = $this->geminiService->generateRecoveryStrategy([
            'order' => [
                'id' => $order->id,
                'order_number' => $order->order_number,
                'total' => $order->total,
                'currency' => $order->currency,
            ],
            'amount' => Money::format($order->total),
            'currency' => $order->currency,
            'items_description' => $itemsSummary ?: 'Store products',
            'failure_reason' => $failureReason,
            'attempt_count' => $payments->count(),
            'hours_since_dropoff' => $hoursSinceCreation,
        ]);

        $audit = $opportunity->audit_trail ?? [];
        $audit[] = [
            'action' => 'ANALYZED',
            'actor' => 'GEMINI_LIVE_AGENT',
            'timestamp' => now()->toIso8601String(),
            'details' => "Re-analyzed via live AI diagnostic engine (" . ($aiStrategy['ai_source'] ?? 'gemini_live') . ").",
        ];

        $opportunity->update([
            'ai_summary' => $aiStrategy['ai_summary'],
            'ai_reasoning' => $aiStrategy['ai_reasoning'],
            'ai_recommended_action' => $aiStrategy['ai_recommended_action'],
            'customer_message_draft' => $aiStrategy['customer_message_draft'],
            'ai_confidence' => $aiStrategy['ai_confidence'],
            'audit_trail' => $audit,
        ]);

        return $opportunity->fresh(['order.items', 'latestPayment']);
    }

    /**
     * Prepare instant PayPal checkout session for approved recovery opportunity.
     */
    public function prepareRecoveryCheckout(RecoveryOpportunity $opportunity, int $userId): array
    {
        if ($opportunity->user_id !== $userId) {
            throw new Exception('Unauthorized opportunity access.');
        }

        $order = $opportunity->order;

        if ($order->status === 'PAID') {
            throw new Exception('Order has already been paid.');
        }

        $attemptNumber = $order->payments()->count() + 1;
        $idempotencyKey = 'pp_rec_' . $opportunity->id . '_att_' . $attemptNumber . '_' . Str::random(8);
        $upstreamRequestId = 'pp_rec_req_' . $order->id . '_att_' . $attemptNumber;

        $payPalOrder = $this->payPalService->createOrder($order, $upstreamRequestId);
        $paypalOrderId = $payPalOrder['id'] ?? null;

        if (! $paypalOrderId) {
            throw new Exception('PayPal did not return a valid order ID for recovery checkout.');
        }

        // Record recovery payment attempt
        $payment = Payment::create([
            'order_id' => $order->id,
            'user_id' => $userId,
            'provider' => 'paypal',
            'paypal_order_id' => $paypalOrderId,
            'amount' => Money::format($order->total),
            'currency' => $order->currency,
            'attempt_number' => $attemptNumber,
            'idempotency_key' => $idempotencyKey,
            'is_recovery_attempt' => true,
            'status' => 'CREATED',
            'payload' => $payPalOrder,
        ]);

        $audit = $opportunity->audit_trail ?? [];
        $audit[] = [
            'action' => 'CHECKOUT_INITIALIZED',
            'actor' => 'SYSTEM',
            'paypal_order_id' => $paypalOrderId,
            'attempt_number' => $attemptNumber,
            'timestamp' => now()->toIso8601String(),
            'details' => "1-Click PayPal Recovery checkout generated: {$paypalOrderId}",
        ];

        $opportunity->update([
            'status' => 'IN_FLIGHT',
            'latest_payment_id' => $payment->id,
            'audit_trail' => $audit,
        ]);

        return [
            'opportunity' => $opportunity->fresh(['order.items', 'latestPayment']),
            'paypal_order_id' => $paypalOrderId,
            'payment' => $payment,
            'order' => $order->fresh(['items']),
        ];
    }

    /**
     * Compute comprehensive AI Recovery metrics for merchant dashboard.
     */
    public function getRecoveryDashboardMetrics(int $userId): array
    {
        $baseQuery = RecoveryOpportunity::where('user_id', $userId);

        $totalCount = (clone $baseQuery)->count();
        $pendingCount = (clone $baseQuery)->where('status', 'PENDING')->count();
        $approvedCount = (clone $baseQuery)->where('status', 'APPROVED')->count();
        $inFlightCount = (clone $baseQuery)->where('status', 'IN_FLIGHT')->count();
        $recoveredCount = (clone $baseQuery)->where('status', 'RECOVERED')->count();
        $rejectedCount = (clone $baseQuery)->where('status', 'REJECTED')->count();

        // Calculate potential recoverable revenue
        $activeOpportunities = (clone $baseQuery)
            ->whereIn('status', ['PENDING', 'APPROVED', 'IN_FLIGHT'])
            ->with('order')
            ->get();

        $potentialRevenue = '0.00';
        foreach ($activeOpportunities as $opp) {
            if ($opp->order) {
                $potentialRevenue = Money::add($potentialRevenue, $opp->order->total);
            }
        }

        // Calculate recovered revenue
        $recoveredOpportunities = (clone $baseQuery)
            ->where('status', 'RECOVERED')
            ->with('order')
            ->get();

        $recoveredRevenue = '0.00';
        foreach ($recoveredOpportunities as $opp) {
            if ($opp->order) {
                $recoveredRevenue = Money::add($recoveredRevenue, $opp->order->total);
            }
        }

        $recoveryRate = $totalCount > 0 ? round(($recoveredCount / $totalCount) * 100, 1) : 0.0;

        return [
            'total_opportunities' => $totalCount,
            'pending_review' => $pendingCount,
            'approved_for_recovery' => $approvedCount,
            'in_flight' => $inFlightCount,
            'recovered_count' => $recoveredCount,
            'rejected_count' => $rejectedCount,
            'potential_recoverable_revenue' => (float) $potentialRevenue,
            'formatted_potential_revenue' => '$' . number_format((float) $potentialRevenue, 2),
            'recovered_revenue' => (float) $recoveredRevenue,
            'formatted_recovered_revenue' => '$' . number_format((float) $recoveredRevenue, 2),
            'recovery_rate' => $recoveryRate,
        ];
    }
}
