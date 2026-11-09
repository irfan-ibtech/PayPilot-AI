<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Payment;
use App\Services\PayPalService;
use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

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
     * Initiate a PayPal Order for the given local merchant order.
     */
    public function createPayPalOrder(Request $request, $orderId): JsonResponse
    {
        $order = Order::where('user_id', $request->user()->id)
            ->findOrFail($orderId);

        if ($order->status !== 'PENDING') {
            return response()->json([
                'message' => "Order cannot be paid because its status is '{$order->status}'.",
            ], 422);
        }

        try {
            $payPalOrder = $this->payPalService->createOrder($order);
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

        // Create or update local Payment record
        $payment = Payment::updateOrCreate(
            [
                'order_id' => $order->id,
                'paypal_order_id' => $paypalOrderId,
            ],
            [
                'user_id' => $request->user()->id,
                'provider' => 'paypal',
                'amount' => $order->total,
                'currency' => $order->currency,
                'status' => 'CREATED',
                'payload' => $payPalOrder,
            ]
        );

        return response()->json([
            'paypal_order_id' => $paypalOrderId,
            'order' => $order->load(['items', 'payment']),
            'payment' => $payment,
        ]);
    }

    /**
     * Capture payment for an approved PayPal order and verify server-side.
     */
    public function capturePayPalOrder(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'paypal_order_id' => ['required', 'string'],
        ]);

        $paypalOrderId = $validated['paypal_order_id'];

        $payment = Payment::where('paypal_order_id', $paypalOrderId)
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        $order = $payment->order;

        // Idempotency guard: Return immediately if already completed
        if ($payment->status === 'COMPLETED') {
            return response()->json([
                'success' => true,
                'message' => 'Payment has already been processed and verified.',
                'payment' => $payment,
                'order' => $order,
            ]);
        }

        try {
            $captureResponse = $this->payPalService->capturePayment($paypalOrderId);
        } catch (\Throwable $e) {
            return response()->json([
                'message' => 'PayPal payment capture failed: ' . $e->getMessage(),
            ], 400);
        }

        // Validate capture response status
        $status = $captureResponse['status'] ?? null;
        if ($status !== 'COMPLETED') {
            return response()->json([
                'message' => "Payment capture status is '{$status}' instead of 'COMPLETED'.",
                'payload' => $captureResponse,
            ], 422);
        }

        // Extract capture unit details
        $capture = $captureResponse['purchase_units'][0]['payments']['captures'][0] ?? null;
        $captureId = $capture['id'] ?? ($captureResponse['id'] ?? null);

        // Security check: Validate captured amount and currency against local order to prevent tampering
        if (! str_starts_with($paypalOrderId, 'SIMULATED-') && $capture) {
            $capturedAmount = (float) ($capture['amount']['value'] ?? 0);
            $capturedCurrency = strtoupper($capture['amount']['currency_code'] ?? '');

            $expectedAmount = (float) $order->total;
            $expectedCurrency = strtoupper($order->currency);

            if (abs($capturedAmount - $expectedAmount) > 0.01 || $capturedCurrency !== $expectedCurrency) {
                // Record failed verification state
                $payment->update([
                    'status' => 'FAILED',
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

        // Update Payment and Order atomically inside a database transaction
        DB::transaction(function () use ($payment, $order, $captureId, $captureResponse) {
            $payment->update([
                'status' => 'COMPLETED',
                'paypal_capture_id' => $captureId,
                'captured_at' => now(),
                'payload' => $captureResponse,
            ]);

            $order->update([
                'status' => 'PAID',
            ]);
        });

        return response()->json([
            'success' => true,
            'message' => 'Payment captured and verified successfully.',
            'payment' => $payment->fresh(),
            'order' => $order->fresh(['items', 'payment']),
        ]);
    }

    /**
     * Display a listing of merchant payments.
     */
    public function index(Request $request): JsonResponse
    {
        $payments = Payment::with('order')
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
