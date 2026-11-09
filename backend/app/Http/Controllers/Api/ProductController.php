<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $products = Product::where('user_id', $request->user()->id)->get();
        return response()->json(['data' => $products]);
    }

    public function show(Request $request, Product $product): JsonResponse
    {
        return response()->json(['data' => $product]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'unit_price' => 'required|numeric|min:0',
            'currency' => 'nullable|string|max:3',
        ]);

        $product = $request->user()->products()->create([
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'unit_price' => $validated['unit_price'],
            'currency' => strtoupper($validated['currency'] ?? 'USD'),
        ]);

        return response()->json([
            'message' => 'Product added to catalog successfully.',
            'data' => $product,
        ], 201);
    }

    public function update(Request $request, Product $product): JsonResponse
    {
        if ($product->user_id !== $request->user()->id) {
            abort(403);
        }

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'unit_price' => 'sometimes|required|numeric|min:0',
            'currency' => 'nullable|string|max:3',
        ]);

        if (isset($validated['currency'])) {
            $validated['currency'] = strtoupper($validated['currency']);
        }

        $product->update($validated);

        return response()->json([
            'message' => 'Product updated successfully.',
            'data' => $product,
        ]);
    }

    public function destroy(Request $request, Product $product): JsonResponse
    {
        if ($product->user_id !== $request->user()->id) {
            abort(403);
        }

        $product->delete();

        return response()->json([
            'message' => 'Product removed from catalog successfully.',
        ]);
    }
}
