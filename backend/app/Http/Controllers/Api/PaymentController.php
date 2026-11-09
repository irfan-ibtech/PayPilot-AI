<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Payment;
use App\Models\PaymentEvent;
use App\Models\RecoveryOpportunity;
use App\Services\PayPalService;
use App\Support\Money;
use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class PaymentController extends Controller
{
    protected PayPalService $payPalService;

    public function __construct(PayPalService $payPalService)
    {
        $this->payPalService = $payPalService;
    }

    /**
     * Get PayPal Client ID for frontend SDK initialization.
     */
    public function getPayPalClientId(): JsonResponse
    {
        return response()->json([
            'client_id' => config('paypal.client_id'),
            'mode' => config('paypal.mode', 'sandbox'),
        ]);
    }

    /**
     * Initiate a PayPal Order for the given local merchant order with multi-attempt ledger tracking.
     */
    public function createPayPalOrder(Request $request, $orderId): JsonResponse
    {
        $validated = $request->validate([
            'idempotency_key' => ['nullable', 'string', 'max:255'],
            'is_recovery_attempt' => ['nullable', 'boolean'],
        ]);

        $order = Order::where('user_id', $request->user()->id)
            ->findOrFail($orderId);

        if ($order->status !== 'PENDING') {
            return response()->json([
                'message' => "Order cannot be paid because its status is '{$order->status}'.",
            ], 422);
        }

        // Determine attempt number and upstream request id
        $attemptNumber = $order->payments()->count() + 1;
        $idempotencyKey = $validated['idempotency_key'] ?? ('pp_idem_' . $order->id . '_att_' . $attemptNumber . '_' . Str::random(8));
        $upstreamRequestId = 'pp_req_' . $order->id . '_att_' . $attemptNumber;

        try {
            $payPalOrder = $this->payPalService->createOrder($order, $upstreamRequestId);
        } catch (\Throwable $e) {
            PaymentEvent::log(
                $request->user()->id,
                $order->id,
                'PAYPAL_ORDER_CREATION_FAILED',
                'BACKEND_ENGINE',
                "PayPal order creation failed for attempt #{$attemptNumber}: " . $e->getMessage(),
                ['error' => $e->getMessage()]
            );

            return response()->json([
                'message' => 'PayPal order creation failed: ' . $e->getMessage(),
            ], 400);
        }

        $paypalOrderId = $payPalOrder['id'] ?? null;

        if (! $paypalOrderId) {
            return response()->json([
                'message' => 'PayPal did not return a valid order ID.',
            ], 502);
        }

        // Create new Payment attempt record (preserving attempt history)
        $payment = Payment::create([
            'order_id' => $order->id,
            'user_id' => $request->user()->id,
            'provider' => 'paypal',
            'paypal_order_id' => $paypalOrderId,
            'amount' => Money::format($order->total, $order->currency),
            'currency' => $order->currency,
            'attempt_number' => $attemptNumber,
            'idempotency_key' => $idempotencyKey,
            'is_recovery_attempt' => (bool) ($validated['is_recovery_attempt'] ?? false),
            'status' => 'CREATED',
            'payload' => $payPalOrder,
        ]);

        PaymentEvent::log(
            $request->user()->id,
            $order->id,
            'PAYPAL_ORDER_CREATED',
            'PAYPAL_API',
            "PayPal Order token '{$paypalOrderId}' issued for payment attempt #{$attemptNumber}",
            [
                'paypal_order_id' => $paypalOrderId,
                'attempt_number' => $attemptNumber,
                'idempotency_key' => $idempotencyKey,
                'amount' => $payment->amount,
                'currency' => $payment->currency,
            ],
            $payment->id
        );

        return response()->json([
            'paypal_order_id' => $paypalOrderId,
            'order' => $order->load(['items', 'payment']),
            'payment' => $payment,
        ]);
    }

    /**
     * Capture payment for an approved PayPal order with decoupled 3-step concurrency safety:
     * 1. Short atomic lock to claim attempt and prevent double submission
     * 2. External HTTP call to PayPal REST API v2 (OUTSIDE database transaction)
     * 3. Short atomic lock to finalize outcome, verify currency/amount, and reconcile order.
     */
    public function capturePayPalOrder(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'paypal_order_id' => ['required', 'string'],
        ]);

        $paypalOrderId = $validated['paypal_order_id'];

        // STEP 1: Short atomic transaction to claim eligible attempt and prevent race conditions
        $claim = DB::transaction(function () use ($request, $paypalOrderId) {
            $payment = Payment::where('paypal_order_id', $paypalOrderId)
                ->where('user_id', $request->user()->id)
                ->lockForUpdate()
                ->firstOrFail();

            $order = Order::where('id', $payment->order_id)
                ->where('user_id', $request->user()->id)
                ->lockForUpdate()
                ->firstOrFail();

            // Idempotency guard: Return immediately if already completed
            if ($payment->status === 'COMPLETED' || $order->status === 'PAID') {
                return [
                    'action' => 'ALREADY_COMPLETED',
                    'payment' => $payment,
                    'order' => $order,
                ];
            }

            // In-flight guard: If already capturing in another process, prevent duplicate capture
            if ($payment->status === 'CAPTURING') {
                return [
                    'action' => 'IN_FLIGHT',
                    'payment' => $payment,
                    'order' => $order,
                ];
            }

            // Claim the attempt by transitioning to CAPTURING
            $payment->update(['status' => 'CAPTURING']);

            return [
                'action' => 'PROCEED',
                'payment' => $payment,
                'order' => $order,
            ];
        });

        if ($claim['action'] === 'ALREADY_COMPLETED') {
            return response()->json([
                'success' => true,
                'message' => 'Payment has already been processed and verified.',
                'payment' => $claim['payment'],
                'order' => $claim['order']->load(['items', 'payment']),
            ]);
        }

        if ($claim['action'] === 'IN_FLIGHT') {
            return response()->json([
                'success' => false,
                'message' => 'Payment capture is currently in-flight. Please wait or check reconciliation.',
                'payment' => $claim['payment'],
            ], 409);
        }

        $payment = $claim['payment'];
        $order = $claim['order'];

        // STEP 2: External HTTP call to PayPal (EXECUTED OUTSIDE THE DATABASE LOCK)
        $requestId = 'pp_cap_' . $payment->id . '_' . $paypalOrderId;
        $captureResponse = null;
        $externalError = null;

        try {
            $captureResponse = $this->payPalService->capturePayment($paypalOrderId, $requestId);
        } catch (\Throwable $e) {
            $externalError = $e->getMessage();
        }

        // STEP 3: Short atomic transaction to finalize outcome and reconcile records
        return DB::transaction(function () use ($request, $payment, $order, $paypalOrderId, $captureResponse, $externalError) {
            $lockedPayment = Payment::where('id', $payment->id)->lockForUpdate()->first();
            $lockedOrder = Order::where('id', $order->id)->lockForUpdate()->first();

            if ($externalError) {
                // If it's a network timeout / connection drop, state should be REQUIRES_RECONCILIATION so funds aren't lost
                $isTimeout = str_contains(strtolower($externalError), 'timeout') || str_contains(strtolower($externalError), 'connection');
                $targetStatus = $isTimeout ? 'REQUIRES_RECONCILIATION' : 'FAILED';

                $lockedPayment->update([
                    'status' => $targetStatus,
                    'failure_reason' => $externalError,
                ]);

                PaymentEvent::log(
                    $request->user()->id,
                    $lockedOrder->id,
                    'CAPTURE_FAILED',
                    'PAYPAL_API',
                    "PayPal capture attempt #{$lockedPayment->attempt_number} failed: {$externalError}",
                    ['paypal_order_id' => $paypalOrderId, 'status' => $targetStatus],
                    $lockedPayment->id
                );

                return response()->json([
                    'message' => 'PayPal payment capture failed: ' . $externalError,
                    'status' => $targetStatus,
                ], $isTimeout ? 504 : 400);
            }

            $status = $captureResponse['status'] ?? null;
            if ($status !== 'COMPLETED') {
                $lockedPayment->update([
                    'status' => 'FAILED',
                    'failure_reason' => "Payment capture status is '{$status}' instead of 'COMPLETED'.",
                    'payload' => $captureResponse,
                ]);

                PaymentEvent::log(
                    $request->user()->id,
                    $lockedOrder->id,
                    'CAPTURE_FAILED',
                    'PAYPAL_API',
                    "PayPal returned non-completed capture status: '{$status}'",
                    $captureResponse,
                    $lockedPayment->id
                );

                return response()->json([
                    'message' => "Payment capture status is '{$status}' instead of 'COMPLETED'.",
                    'payload' => $captureResponse,
                ], 422);
            }

            // Extract capture unit details
            $capture = $captureResponse['purchase_units'][0]['payments']['captures'][0] ?? null;
            $captureId = $capture['id'] ?? ($captureResponse['id'] ?? null);

            // Security check: Validate captured amount and currency using Money (BCMath)
            if (! str_starts_with($paypalOrderId, 'SIMULATED-') && $capture) {
                $capturedAmount = Money::format($capture['amount']['value'] ?? '0.00', $lockedOrder->currency);
                $capturedCurrency = strtoupper($capture['amount']['currency_code'] ?? '');

                $expectedAmount = Money::format($lockedOrder->total, $lockedOrder->currency);
                $expectedCurrency = strtoupper($lockedOrder->currency);

                if (! Money::equals($capturedAmount, $expectedAmount, $lockedOrder->currency) || $capturedCurrency !== $expectedCurrency) {
                    $failureReason = "Amount or currency mismatch: received {$capturedCurrency} {$capturedAmount}, expected {$expectedCurrency} {$expectedAmount}";

                    $lockedPayment->update([
                        'status' => 'FAILED',
                        'failure_reason' => $failureReason,
                        'payload' => array_merge($captureResponse, [
                            'security_warning' => 'Amount or currency mismatch during verification.',
                            'expected' => ['amount' => $expectedAmount, 'currency' => $expectedCurrency],
                            'received' => ['amount' => $capturedAmount, 'currency' => $capturedCurrency],
                        ]),
                    ]);

                    PaymentEvent::log(
                        $request->user()->id,
                        $lockedOrder->id,
                        'CAPTURE_SECURITY_ALERT',
                        'BACKEND_ENGINE',
                        $failureReason,
                        $captureResponse,
                        $lockedPayment->id
                    );

                    return response()->json([
                        'message' => 'Security verification failed: Captured amount or currency mismatch.',
                        'details' => $failureReason,
                    ], 422);
                }
            }

            // Update Payment and Order atomically inside database transaction
            $lockedPayment->update([
                'status' => 'COMPLETED',
                'paypal_capture_id' => $captureId,
                'captured_at' => now(),
                'payload' => $captureResponse,
            ]);

            $lockedOrder->update([
                'status' => 'PAID',
            ]);

            // Reconcile associated Recovery Opportunity if present
            $opportunity = RecoveryOpportunity::where('order_id', $lockedOrder->id)
                ->whereIn('status', ['PENDING', 'APPROVED', 'IN_FLIGHT'])
                ->first();

            if ($opportunity) {
                $recoveryTime = $opportunity->created_at ? max(1, now()->diffInSeconds($opportunity->created_at)) : null;

                $audit = $opportunity->audit_trail ?? [];
                $audit[] = [
                    'action' => 'RECOVERED',
                    'actor' => 'PAYPAL_REST_V2',
                    'timestamp' => now()->toIso8601String(),
                    'details' => "Payment verified and captured via PayPal. Capture ID: {$captureId}.",
                ];

                $opportunity->update([
                    'status' => 'RECOVERED',
                    'workflow_state' => 'RECOVERED',
                    'recovered_payment_id' => $lockedPayment->id,
                    'recovered_at' => now(),
                    'recovery_time_seconds' => $recoveryTime,
                    'audit_trail' => $audit,
                ]);

                PaymentEvent::log(
                    $request->user()->id,
                    $lockedOrder->id,
                    'RECOVERY_SETTLED',
                    'AI_AGENT',
                    "Revenue successfully recovered via PayPal Capture #{$captureId}",
                    ['capture_id' => $captureId, 'recovery_time_seconds' => $recoveryTime],
                    $lockedPayment->id,
                    $opportunity->id
                );
            }

            PaymentEvent::log(
                $request->user()->id,
                $lockedOrder->id,
                'CAPTURE_SUCCEEDED',
                'PAYPAL_API',
                "PayPal payment attempt #{$lockedPayment->attempt_number} completed and captured (Capture ID: {$captureId})",
                ['capture_id' => $captureId, 'amount' => $lockedPayment->amount, 'currency' => $lockedPayment->currency],
                $lockedPayment->id
            );

            return response()->json([
                'success' => true,
                'message' => 'Payment captured and verified successfully.',
                'payment' => $lockedPayment->fresh(),
                'order' => $lockedOrder->fresh(['items', 'payment']),
            ]);
        });
    }

    /**
     * Safely reconcile an uncertain payment attempt directly against PayPal v2 REST API.
     */
    public function reconcilePayment(Request $request, string $paypalOrderId): JsonResponse
    {
        $payment = Payment::with('order')
            ->where('paypal_order_id', $paypalOrderId)
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        if ($payment->status === 'COMPLETED') {
            return response()->json([
                'status' => 'COMPLETED',
                'message' => 'Payment is already settled and verified.',
                'payment' => $payment,
            ]);
        }

        try {
            $payPalDetails = $this->payPalService->getOrderDetails($paypalOrderId);
            $ppStatus = $payPalDetails['status'] ?? 'UNKNOWN';

            if ($ppStatus === 'COMPLETED') {
                $capture = $payPalDetails['purchase_units'][0]['payments']['captures'][0] ?? null;
                $captureId = $capture['id'] ?? null;
                $order = $payment->order;

                // Security check: Validate captured amount and currency using Money (BCMath)
                if (! str_starts_with($paypalOrderId, 'SIMULATED-') && $capture) {
                    $capturedAmount = Money::format($capture['amount']['value'] ?? '0.00', $order->currency);
                    $capturedCurrency = strtoupper($capture['amount']['currency_code'] ?? '');
                    $expectedAmount = Money::format($order->total, $order->currency);
                    $expectedCurrency = strtoupper($order->currency);

                    if (! Money::equals($capturedAmount, $expectedAmount, $order->currency) || $capturedCurrency !== $expectedCurrency) {
                        return response()->json([
                            'message' => 'Security verification failed: Captured amount or currency mismatch during reconciliation.',
                            'status' => 'FAILED',
                        ], 422);
                    }
                }

                $payment->update([
                    'status' => 'COMPLETED',
                    'paypal_capture_id' => $captureId,
                    'captured_at' => now(),
                    'payload' => $payPalDetails,
                ]);

                $order->update(['status' => 'PAID']);

                // Reconcile associated Recovery Opportunity if present
                $opportunity = RecoveryOpportunity::where('order_id', $order->id)
                    ->whereIn('status', ['PENDING', 'APPROVED', 'IN_FLIGHT'])
                    ->first();

                if ($opportunity) {
                    $recoveryTime = $opportunity->created_at ? max(1, now()->diffInSeconds($opportunity->created_at)) : null;
                    $audit = $opportunity->audit_trail ?? [];
                    $audit[] = [
                        'action' => 'RECOVERED',
                        'actor' => 'PAYPAL_RECONCILIATION',
                        'timestamp' => now()->toIso8601String(),
                        'details' => "Payment verified and captured via PayPal out-of-band reconciliation. Capture ID: {$captureId}.",
                    ];

                    $opportunity->update([
                        'status' => 'RECOVERED',
                        'workflow_state' => 'RECOVERED',
                        'recovered_payment_id' => $payment->id,
                        'recovered_at' => now(),
                        'recovery_time_seconds' => $recoveryTime,
                        'audit_trail' => $audit,
                    ]);
                }

                PaymentEvent::log(
                    $request->user()->id,
                    $payment->order_id,
                    'PAYMENT_RECONCILED',
                    'PAYPAL_API',
                    "Payment reconciled as COMPLETED via direct PayPal order inquiry (Capture ID: {$captureId}).",
                    $payPalDetails,
                    $payment->id,
                    $opportunity?->id
                );

                return response()->json([
                    'status' => 'COMPLETED',
                    'message' => 'Payment reconciled and confirmed as completed.',
                    'payment' => $payment->fresh(),
                ]);
            }

            return response()->json([
                'status' => $payment->status,
                'paypal_status' => $ppStatus,
                'message' => "PayPal reports order status as '{$ppStatus}'.",
                'details' => $payPalDetails,
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'message' => 'Reconciliation check failed: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Display a listing of merchant payments.
     */
    public function index(Request $request): JsonResponse
    {
        $payments = Payment::with(['order.items'])
            ->where('user_id', $request->user()->id)
            ->latest('created_at')
            ->get();

        return response()->json(['data' => $payments]);
    }

    /**
     * Display the specified payment.
     */
    public function show(Request $request, Payment $payment): JsonResponse
    {
        if ($payment->user_id !== $request->user()->id) {
            abort(403);
        }

        return response()->json(['data' => $payment->load('order')]);
    }
}
