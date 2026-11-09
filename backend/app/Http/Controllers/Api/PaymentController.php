<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Payment;
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
            'amount' => Money::format($order->total),
            'currency' => $order->currency,
            'attempt_number' => $attemptNumber,
            'idempotency_key' => $idempotencyKey,
            'is_recovery_attempt' => (bool) ($validated['is_recovery_attempt'] ?? false),
            'status' => 'CREATED',
            'payload' => $payPalOrder,
        ]);

        return response()->json([
            'paypal_order_id' => $paypalOrderId,
            'order' => $order->load(['items', 'payment']),
            'payment' => $payment,
        ]);
    }

    /**
     * Capture payment for an approved PayPal order with pessimistic locking and server-side verification.
     */
    public function capturePayPalOrder(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'paypal_order_id' => ['required', 'string'],
        ]);

        $paypalOrderId = $validated['paypal_order_id'];

        return DB::transaction(function () use ($request, $paypalOrderId) {
            // Pessimistic row locking on Payment and Order
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
                return response()->json([
                    'success' => true,
                    'message' => 'Payment has already been processed and verified.',
                    'payment' => $payment,
                    'order' => $order->load(['items', 'payment']),
                ]);
            }

            try {
                $captureResponse = $this->payPalService->capturePayment(
                    $paypalOrderId,
                    'pp_cap_' . $payment->id . '_' . $paypalOrderId
                );
            } catch (\Throwable $e) {
                $payment->update([
                    'status' => 'FAILED',
                    'failure_reason' => $e->getMessage(),
                ]);

                return response()->json([
                    'message' => 'PayPal payment capture failed: ' . $e->getMessage(),
                ], 400);
            }

            // Validate capture response status
            $status = $captureResponse['status'] ?? null;
            if ($status !== 'COMPLETED') {
                $payment->update([
                    'status' => 'FAILED',
                    'failure_reason' => "Payment capture status is '{$status}' instead of 'COMPLETED'.",
                    'payload' => $captureResponse,
                ]);

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
                $capturedAmount = Money::format($capture['amount']['value'] ?? '0.00');
                $capturedCurrency = strtoupper($capture['amount']['currency_code'] ?? '');

                $expectedAmount = Money::format($order->total);
                $expectedCurrency = strtoupper($order->currency);

                if (! Money::equals($capturedAmount, $expectedAmount) || $capturedCurrency !== $expectedCurrency) {
                    $failureReason = "Amount or currency mismatch: received {$capturedCurrency} {$capturedAmount}, expected {$expectedCurrency} {$expectedAmount}";

                    $payment->update([
                        'status' => 'FAILED',
                        'failure_reason' => $failureReason,
                        'payload' => array_merge($captureResponse, [
                            'security_warning' => 'Amount or currency mismatch during verification.',
                            'expected' => ['amount' => $expectedAmount, 'currency' => $expectedCurrency],
                            'received' => ['amount' => $capturedAmount, 'currency' => $capturedCurrency],
                        ]),
                    ]);

                    return response()->json([
                        'message' => 'Security verification failed: Captured amount or currency mismatch.',
                    ], 422);
                }
            }

            // Update Payment and Order atomically inside database transaction
            $payment->update([
                'status' => 'COMPLETED',
                'paypal_capture_id' => $captureId,
                'captured_at' => now(),
                'payload' => $captureResponse,
            ]);

            $order->update([
                'status' => 'PAID',
            ]);

            // Reconcile associated Recovery Opportunity if present
            if (class_exists(\App\Models\RecoveryOpportunity::class)) {
                $opportunity = \App\Models\RecoveryOpportunity::where('order_id', $order->id)
                    ->whereIn('status', ['PENDING', 'APPROVED', 'IN_FLIGHT'])
                    ->first();

                if ($opportunity) {
                    $opportunity->update([
                        'status' => 'RECOVERED',
                        'recovered_payment_id' => $payment->id,
                        'recovered_at' => now(),
                    ]);
                }
            }

            return response()->json([
                'success' => true,
                'message' => 'Payment captured and verified successfully.',
                'payment' => $payment->fresh(),
                'order' => $order->fresh(['items', 'payment']),
            ]);
        });
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
