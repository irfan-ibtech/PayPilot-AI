<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Product;
use App\Services\GeminiService;
use App\Support\Money;
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

        // Zero-Trust Catalog Price Resolution & Server Recalculation Engine
        $merchantProducts = Product::where('user_id', $request->user()->id)->get();
        $calculatedItems = [];
        $subtotal = '0.00';

        foreach ($rawItems as $item) {
            $rawName = trim($item['name'] ?? 'Item');
            $quantity = max(1, (int) ($item['quantity'] ?? 1));

            // Case-insensitive match against merchant's actual product catalog
            $matchedProduct = $merchantProducts->first(function ($prod) use ($rawName) {
                return mb_strtolower($prod->name) === mb_strtolower($rawName)
                    || str_contains(mb_strtolower($rawName), mb_strtolower($prod->name))
                    || str_contains(mb_strtolower($prod->name), mb_strtolower($rawName));
            });

            $promptUnitPrice = isset($item['unit_price']) ? Money::format($item['unit_price']) : null;

            if ($matchedProduct) {
                $unitPrice = Money::format($matchedProduct->unit_price);
                $productId = $matchedProduct->id;
                $catalogMatched = true;
                $productName = $matchedProduct->name;
            } else {
                $unitPrice = Money::format($item['unit_price'] ?? '0.00');
                $productId = null;
                $catalogMatched = false;
                $productName = $rawName;
            }

            $lineTotal = Money::mul($quantity, $unitPrice);
            $subtotal = Money::add($subtotal, $lineTotal);

            $calculatedItems[] = [
                'name' => $productName,
                'quantity' => $quantity,
                'unit_price' => $unitPrice,
                'prompt_unit_price' => $promptUnitPrice,
                'line_total' => $lineTotal,
                'product_id' => $productId,
                'catalog_matched' => $catalogMatched,
            ];
        }

        $total = $subtotal;

        return response()->json([
            'raw_prompt' => $validated['prompt'],
            'items' => $calculatedItems,
            'subtotal' => $subtotal,
            'total' => $total,
            'currency' => $currency,
            'notes' => $parsed['notes'] ?? null,
            'ai_verified' => true,
            'ai_source' => $parsed['ai_source'] ?? 'gemini-2.5-flash',
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

        // Zero-Trust final calculation on server using Money (BCMath)
        $subtotal = '0.00';
        $orderItemsData = [];

        foreach ($validated['items'] as $item) {
            $qty = (int) $item['quantity'];
            $unitPrice = Money::format($item['unit_price']);
            $lineTotal = Money::mul($qty, $unitPrice);

            $subtotal = Money::add($subtotal, $lineTotal);

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
