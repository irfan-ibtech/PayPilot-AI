<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\PaymentEvent;
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
        $subtotal = Money::format('0', $currency);

        foreach ($rawItems as $item) {
            $rawName = trim($item['name'] ?? 'Item');
            $quantity = max(1, (int) ($item['quantity'] ?? 1));
            $rawLower = mb_strtolower($rawName);

            // Tier 1: Exact SKU or exact product name match
            $exactMatch = $merchantProducts->first(function ($prod) use ($rawLower) {
                return mb_strtolower($prod->sku ?? '') === $rawLower
                    || mb_strtolower($prod->name) === $rawLower;
            });

            if ($exactMatch) {
                $matchedProduct = $exactMatch;
                $isAmbiguous = false;
                $candidates = [];
            } else {
                // Tier 2: Substring or word matching, sorted by length descending to prefer specific matches
                $matches = $merchantProducts->filter(function ($prod) use ($rawLower) {
                    $prodNameLower = mb_strtolower($prod->name);
                    return str_contains($rawLower, $prodNameLower)
                        || str_contains($prodNameLower, $rawLower);
                })->sortByDesc(fn($prod) => strlen($prod->name));

                if ($matches->count() > 1) {
                    $matchedProduct = $matches->first();
                    $isAmbiguous = true;
                    $candidates = $matches->map(fn($p) => [
                        'id' => $p->id,
                        'name' => $p->name,
                        'sku' => $p->sku,
                        'unit_price' => Money::format($p->unit_price, $currency),
                    ])->values()->all();
                } elseif ($matches->count() === 1) {
                    $matchedProduct = $matches->first();
                    $isAmbiguous = false;
                    $candidates = [];
                } else {
                    $matchedProduct = null;
                    $isAmbiguous = false;
                    $candidates = [];
                }
            }

            $promptUnitPrice = isset($item['unit_price']) ? Money::format($item['unit_price'], $currency) : null;

            if ($matchedProduct) {
                $unitPrice = Money::format($matchedProduct->unit_price, $currency);
                $productId = $matchedProduct->id;
                $catalogMatched = true;
                $productName = $matchedProduct->name;
            } else {
                $unitPrice = Money::format($item['unit_price'] ?? '0.00', $currency);
                $productId = null;
                $catalogMatched = false;
                $productName = $rawName;
            }

            $lineTotal = Money::mul($quantity, $unitPrice, $currency);
            $subtotal = Money::add($subtotal, $lineTotal, $currency);

            $calculatedItems[] = [
                'name' => $productName,
                'quantity' => $quantity,
                'unit_price' => $unitPrice,
                'prompt_unit_price' => $promptUnitPrice,
                'line_total' => $lineTotal,
                'product_id' => $productId,
                'catalog_matched' => $catalogMatched,
                'is_ambiguous' => $isAmbiguous,
                'candidates' => $candidates,
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
            'ai_source' => $parsed['ai_source'] ?? config('ai.gemini_model', 'gemini-3.1-flash-lite'),
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
            source: 'AI_AGENT',
            summary: "AI-parsed draft confirmed by merchant as Order {$order->order_number} for {$currency} {$total} with " . count($orderItemsData) . " item(s).",
            payload: [
                'subtotal' => $subtotal,
                'total' => $total,
                'currency' => $currency,
                'item_count' => count($orderItemsData),
                'source' => 'AI_PARSER',
            ]
        );

        return response()->json([
            'message' => 'Order confirmed and created successfully',
            'data' => $order,
        ], 201);
    }
}
