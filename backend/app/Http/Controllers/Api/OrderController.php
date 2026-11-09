<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\PaymentEvent;
use App\Support\Money;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class OrderController extends Controller
{
    /**
     * Display a listing of merchant orders with items and payment relations.
     */
    public function index(Request $request): JsonResponse
    {
        $orders = Order::with(['items', 'payment', 'payments'])
            ->where('user_id', $request->user()->id)
            ->latest('created_at')
            ->get();

        return response()->json([
            'data' => $orders,
        ]);
    }

    /**
     * Store a newly created merchant order in storage.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.name' => ['required', 'string', 'max:255'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'items.*.unit_price' => ['required', 'numeric', 'min:0'],
            'items.*.product_id' => ['nullable', 'integer', 'exists:products,id'],
            'currency' => ['nullable', 'string', 'max:3'],
            'notes' => ['nullable', 'string'],
        ]);

        $currency = strtoupper($validated['currency'] ?? 'USD');

        // Strictly calculate subtotal and total on the server using Money (BCMath)
        $subtotal = Money::format('0', $currency);
        $orderItemsData = [];

        foreach ($validated['items'] as $item) {
            $qty = (int) $item['quantity'];
            $unitPrice = Money::format($item['unit_price'], $currency);
            $lineTotal = Money::mul($qty, $unitPrice, $currency);

            $subtotal = Money::add($subtotal, $lineTotal, $currency);

            $orderItemsData[] = [
                'product_id' => $item['product_id'] ?? null,
                'product_name' => $item['name'],
                'quantity' => $qty,
                'unit_price' => $unitPrice,
                'line_total' => $lineTotal,
            ];
        }

        $total = $subtotal;

        // Generate unique order number
        do {
            $orderNumber = 'PP-' . strtoupper(Str::random(8));
        } while (Order::where('order_number', $orderNumber)->exists());

        $order = DB::transaction(function () use ($request, $orderNumber, $subtotal, $total, $currency, $validated, $orderItemsData) {
            $newOrder = Order::create([
                'user_id' => $request->user()->id,
                'order_number' => $orderNumber,
                'subtotal' => $subtotal,
                'total' => $total,
                'currency' => $currency,
                'status' => 'PENDING',
                'notes' => $validated['notes'] ?? null,
            ]);

            foreach ($orderItemsData as $itemData) {
                $newOrder->items()->create($itemData);
            }

            return $newOrder->load(['items', 'payment']);
        });

        PaymentEvent::log(
            userId: $request->user()->id,
            orderId: $order->id,
            eventType: 'ORDER_CREATED',
            source: 'MERCHANT_ACTION',
            summary: "Order {$order->order_number} initiated for {$currency} {$total} with " . count($orderItemsData) . " item(s).",
            payload: [
                'subtotal' => $subtotal,
                'total' => $total,
                'currency' => $currency,
                'item_count' => count($orderItemsData),
            ]
        );

        return response()->json([
            'message' => 'Order created successfully',
            'data' => $order,
        ], 201);
    }

    /**
     * Display the specified order with items and payment verification info.
     */
    public function show(Request $request, $id): JsonResponse
    {
        $order = Order::with(['items', 'payment', 'payments'])
            ->where('user_id', $request->user()->id)
            ->where('id', $id)
            ->firstOrFail();

        return response()->json([
            'data' => $order,
        ]);
    }

    /**
     * Retrieve chronological payment audit events timeline for the order.
     */
    public function events(Request $request, $id): JsonResponse
    {
        $order = Order::where('user_id', $request->user()->id)
            ->where('id', $id)
            ->firstOrFail();

        $events = $order->events()
            ->orderBy('occurred_at', 'asc')
            ->orderBy('id', 'asc')
            ->get();

        return response()->json([
            'data' => $events,
        ]);
    }
}
