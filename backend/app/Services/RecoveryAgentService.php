<?php

namespace App\Services;

use App\Models\Order;
use App\Models\Payment;
use App\Models\PaymentEvent;
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
        $cutoffTime = now()->subMinutes(15);

        // Fetch candidate orders:
        // Excludes healthy in-progress orders (< 15 mins old with no failed payments)
        $candidateOrders = Order::with(['items', 'payments'])
            ->where('user_id', $userId)
            ->where(function ($q) use ($cutoffTime) {
                $q->where('status', 'FAILED')
                  ->orWhere(function ($sub) use ($cutoffTime) {
                      $sub->where('status', 'PENDING')
                          ->where(function ($pendingSub) use ($cutoffTime) {
                              $pendingSub->whereNotNull('checkout_abandoned_at')
                                         ->orWhere('created_at', '<=', $cutoffTime)
                                         ->orWhereHas('payments', function ($payQ) {
                                             $payQ->where('status', 'FAILED');
                                         });
                          });
                  });
            })
            ->whereDoesntHave('recoveryOpportunities', function ($query) {
                $query->whereIn('status', ['PENDING', 'APPROVED', 'IN_FLIGHT', 'RECOVERED']);
            })
            ->latest('created_at')
            ->get();

        // Historical merchant recovery conversion rate (learned outcome signal)
        $historicalTotal = RecoveryOpportunity::where('user_id', $userId)
            ->whereIn('status', ['RECOVERED', 'REJECTED'])
            ->count();
        $historicalRecovered = RecoveryOpportunity::where('user_id', $userId)
            ->where('status', 'RECOVERED')
            ->count();
        $merchantHistoricalRecoveryRate = $historicalTotal > 0
            ? ($historicalRecovered / $historicalTotal) * 100
            : null;

        $discovered = [];

        foreach ($candidateOrders as $order) {
            $payments = $order->payments;
            $strategyKey = $this->determineStrategy($order, $payments);
            $scoreData = $this->calculateScore($order, $payments, $merchantHistoricalRecoveryRate);
            $score = $scoreData['score'];
            $priority = $this->determinePriority($score);

            $lastPayment = $payments->last();
            $failureReason = $lastPayment?->failure_reason ?? 'Customer exited during payment authorization';
            $hoursSinceCreation = max(1, (int) round(now()->diffInMinutes($order->created_at) / 60));

            $tierHigh = Money::comp($order->total, '100.00', $order->currency) >= 0;
            $tierMedium = Money::comp($order->total, '40.00', $order->currency) >= 0;

            $signals = [
                'cart_value_tier' => $tierHigh ? 'high' : ($tierMedium ? 'medium' : 'standard'),
                'hours_since_dropoff' => $hoursSinceCreation,
                'attempt_count' => $payments->count(),
                'last_failure_reason' => $failureReason,
                'is_multi_item' => $order->items->count() > 1,
                'score_breakdown' => $scoreData['breakdown'],
                'strategy' => $strategyKey,
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
                'strategy_key' => $strategyKey,
                'status' => 'PENDING',
                'workflow_state' => 'AWAITING_MERCHANT_APPROVAL',
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
                        'details' => "Opportunity scored at {$score} ({$priority} priority) with strategy {$strategyKey}.",
                    ],
                ],
            ]);

            PaymentEvent::log(
                $userId,
                $order->id,
                'RECOVERY_DETECTED',
                'AI_AGENT',
                "AI Recovery Agent flagged Order #{$order->order_number} for recovery (Score: {$score}, Strategy: {$strategyKey}).",
                [
                    'score' => $score,
                    'priority' => $priority,
                    'strategy' => $strategyKey,
                    'workflow_state' => 'AWAITING_MERCHANT_APPROVAL',
                    'breakdown' => $scoreData['breakdown'],
                ],
                $lastPayment?->id,
                $opportunity->id
            );

            $discovered[] = $opportunity->load(['order.items', 'latestPayment']);
        }

        return $discovered;
    }

    /**
     * Determine permitted recovery strategy based on order state and failure forensics.
     */
    public function determineStrategy(Order $order, Collection $payments): string
    {
        $lastPayment = $payments->last();
        $reason = strtolower($lastPayment?->failure_reason ?? '');
        $status = $lastPayment?->status ?? null;

        if ($status === 'REQUIRES_RECONCILIATION') {
            return 'RECONCILE_FIRST';
        }

        if (str_contains($reason, 'fraud') ||
            str_contains($reason, 'risk') ||
            str_contains($reason, 'stolen') ||
            str_contains($reason, 'do_not_honor') ||
            str_contains($reason, 'closed')) {
            return 'MERCHANT_REVIEW';
        }

        if (str_contains($reason, 'timeout') ||
            str_contains($reason, 'network') ||
            str_contains($reason, 'connection') ||
            str_contains($reason, 'gateway') ||
            str_contains($reason, '504') ||
            str_contains($reason, '503')) {
            return 'RETRY_TRANSIENT';
        }

        return 'FRESH_CHECKOUT';
    }

    /**
     * Explainable Recovery Priority Scoring Engine (10 - 98 heuristic).
     */
    public function calculateScore(Order $order, Collection $payments, ?float $merchantHistoricalRecoveryRate = null): array
    {
        $base = 50;
        $recencyAdjustment = 0;
        $cartTierAdjustment = 0;
        $attemptAdjustment = 0;
        $historicalAdjustment = 0;

        // Factor 1: Recency
        $minutes = now()->diffInMinutes($order->created_at);
        $hours = $minutes / 60;
        if ($hours <= 2) {
            $recencyAdjustment = 25;
        } elseif ($hours <= 24) {
            $recencyAdjustment = 15;
        } elseif ($hours <= 48) {
            $recencyAdjustment = 5;
        } else {
            $recencyAdjustment = -10;
        }

        // Factor 2: Cart size sweet-spot ($40 - $250)
        $isSweetSpot = Money::comp($order->total, '40.00', $order->currency) >= 0 && Money::comp($order->total, '250.00', $order->currency) <= 0;
        $isHighBand = Money::comp($order->total, '250.00', $order->currency) > 0 && Money::comp($order->total, '600.00', $order->currency) <= 0;
        $isLowBand = Money::comp($order->total, '40.00', $order->currency) < 0;

        if ($isSweetSpot) {
            $cartTierAdjustment = 15;
        } elseif ($isHighBand) {
            $cartTierAdjustment = 10;
        } elseif ($isLowBand) {
            $cartTierAdjustment = 5;
        } else {
            $cartTierAdjustment = 0;
        }

        // Factor 3: Payment attempts
        $attemptCount = $payments->count();
        if ($attemptCount === 0) {
            $attemptAdjustment = 10;
        } elseif ($attemptCount === 1) {
            $attemptAdjustment = 10;
        } elseif ($attemptCount === 2) {
            $attemptAdjustment = 0;
        } else {
            $attemptAdjustment = -15;
        }

        // Factor 4: Historical merchant recovery conversion rate (learned outcome signal)
        if ($merchantHistoricalRecoveryRate !== null) {
            if ($merchantHistoricalRecoveryRate >= 40.0) {
                $historicalAdjustment = 10;
            } elseif ($merchantHistoricalRecoveryRate >= 20.0) {
                $historicalAdjustment = 5;
            } elseif ($merchantHistoricalRecoveryRate < 10.0) {
                $historicalAdjustment = -5;
            }
        }

        $rawScore = $base + $recencyAdjustment + $cartTierAdjustment + $attemptAdjustment + $historicalAdjustment;
        $finalScore = max(10, min(98, $rawScore));

        return [
            'score' => $finalScore,
            'breakdown' => [
                'base' => $base,
                'recency_adjustment' => $recencyAdjustment,
                'hours_elapsed' => round($hours, 1),
                'cart_tier_adjustment' => $cartTierAdjustment,
                'cart_total' => $order->total,
                'attempt_history_adjustment' => $attemptAdjustment,
                'attempt_count' => $attemptCount,
                'historical_rate_adjustment' => $historicalAdjustment,
                'merchant_historical_rate' => $merchantHistoricalRecoveryRate !== null ? round($merchantHistoricalRecoveryRate, 1) . '%' : 'N/A',
            ],
        ];
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

        if (! in_array($opportunity->status, ['PENDING', 'APPROVED', 'REJECTED'])) {
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
            'workflow_state' => 'APPROVED',
            'approved_at' => now(),
            'customer_message_draft' => $customMessage ?: $opportunity->customer_message_draft,
            'audit_trail' => $audit,
        ]);

        PaymentEvent::log(
            $userId,
            $opportunity->order_id,
            'RECOVERY_APPROVED',
            'MERCHANT_ACTION',
            "Merchant approved recovery intervention for Order #{$opportunity->order?->order_number}.",
            ['approved_strategy' => $opportunity->strategy_key],
            $opportunity->latest_payment_id,
            $opportunity->id
        );

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

        if (! in_array($opportunity->status, ['PENDING', 'APPROVED'])) {
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
            'workflow_state' => 'DISMISSED',
            'rejected_at' => now(),
            'audit_trail' => $audit,
        ]);

        PaymentEvent::log(
            $userId,
            $opportunity->order_id,
            'RECOVERY_DISMISSED',
            'MERCHANT_ACTION',
            "Merchant dismissed recovery opportunity for Order #{$opportunity->order?->order_number}.",
            ['reason' => $reason],
            $opportunity->latest_payment_id,
            $opportunity->id
        );

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

        $strategyKey = $this->determineStrategy($order, $payments);

        $opportunity->update([
            'strategy_key' => $strategyKey,
            'ai_summary' => $aiStrategy['ai_summary'],
            'ai_reasoning' => $aiStrategy['ai_reasoning'],
            'ai_recommended_action' => $aiStrategy['ai_recommended_action'],
            'customer_message_draft' => $aiStrategy['customer_message_draft'],
            'ai_confidence' => $aiStrategy['ai_confidence'],
            'audit_trail' => $audit,
        ]);

        PaymentEvent::log(
            $userId,
            $order->id,
            'RECOVERY_ANALYZED',
            'AI_AGENT',
            "Opportunity re-analyzed via live AI diagnostic engine (" . ($aiStrategy['ai_source'] ?? 'gemini_live') . ").",
            [
                'confidence' => $aiStrategy['ai_confidence'],
                'recommended_action' => $aiStrategy['ai_recommended_action'],
                'strategy' => $strategyKey,
            ],
            $lastPayment?->id,
            $opportunity->id
        );

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

        if ($opportunity->status === 'RECOVERED') {
            throw new Exception('Opportunity has already been recovered.');
        }

        if (! in_array($opportunity->status, ['APPROVED', 'IN_FLIGHT'])) {
            throw new Exception("Opportunity must be approved by the merchant before launching recovery checkout (current status: {$opportunity->status}).");
        }

        // Idempotency: Return existing pending session if already created and uncaptured
        if ($opportunity->status === 'IN_FLIGHT' && $opportunity->latest_payment_id) {
            $existingPayment = Payment::where('id', $opportunity->latest_payment_id)
                ->where('status', 'CREATED')
                ->first();
            if ($existingPayment && $existingPayment->paypal_order_id) {
                return [
                    'opportunity' => $opportunity->fresh(['order.items', 'latestPayment']),
                    'paypal_order_id' => $existingPayment->paypal_order_id,
                    'payment' => $existingPayment,
                    'order' => $order->fresh(['items']),
                ];
            }
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
            'workflow_state' => 'CHECKOUT_PREPARED',
            'latest_payment_id' => $payment->id,
            'audit_trail' => $audit,
        ]);

        PaymentEvent::log(
            $userId,
            $order->id,
            'RECOVERY_CHECKOUT_PREPARED',
            'PAYPAL_API',
            "Fresh PayPal recovery session {$paypalOrderId} prepared.",
            [
                'paypal_order_id' => $paypalOrderId,
                'attempt_number' => $attemptNumber,
                'amount' => Money::format($order->total),
                'currency' => $order->currency,
            ],
            $payment->id,
            $opportunity->id
        );

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
