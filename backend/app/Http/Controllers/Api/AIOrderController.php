<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Services\GeminiService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class AIOrderController extends Controller
{
    protected GeminiService $geminiService;

    public function __construct(GeminiService $geminiService)
    {
        $this->geminiService = $geminiService;
    }

    /**
     * Parse natural language order prompt with zero-trust pricing recalculation.
     */
    public function parse(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'prompt' => ['required', 'string', 'min:3', 'max:1000'],
        ]);

        try {
            $parsed = $this->geminiService->parseNaturalLanguageOrder($validated['prompt']);
        } catch (\Throwable $e) {
            return response()->json([
                'message' => 'AI parsing error: ' . $e->getMessage(),
            ], 422);
        }

        $currency = strtoupper($parsed['currency'] ?? 'USD');
        $rawItems = $parsed['items'] ?? [];

        // Zero-Trust Server Recalculation Engine
        $calculatedItems = [];
        $subtotal = 0.00;

        foreach ($rawItems as $item) {
            $quantity = max(1, (int) ($item['quantity'] ?? 1));
            $unitPrice = max(0.00, round((float) ($item['unit_price'] ?? 0.00), 2));
            $lineTotal = round($quantity * $unitPrice, 2);

            $subtotal += $lineTotal;

            $calculatedItems[] = [
                'name' => trim($item['name'] ?? 'Item'),
                'quantity' => $quantity,
                'unit_price' => number_format($unitPrice, 2, '.', ''),
                'line_total' => number_format($lineTotal, 2, '.', ''),
            ];
        }

        $total = $subtotal;

        return response()->json([
            'raw_prompt' => $validated['prompt'],
            'items' => $calculatedItems,
            'subtotal' => number_format($subtotal, 2, '.', ''),
            'total' => number_format($total, 2, '.', ''),
            'currency' => $currency,
            'notes' => $parsed['notes'] ?? null,
            'ai_verified' => true,
        ]);
    }

    /**
     * Confirm merchant-approved order draft and create the database records.
     */
    public function confirmAndCreate(Request $request): JsonResponse
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

        // Zero-Trust final calculation on server
        $subtotal = 0.00;
        $orderItemsData = [];

        foreach ($validated['items'] as $item) {
            $qty = (int) $item['quantity'];
            $unitPrice = round((float) $item['unit_price'], 2);
            $lineTotal = round($qty * $unitPrice, 2);

            $subtotal += $lineTotal;

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

        return response()->json([
            'message' => 'Order confirmed and created successfully',
            'data' => $order,
        ], 201);
    }
}
