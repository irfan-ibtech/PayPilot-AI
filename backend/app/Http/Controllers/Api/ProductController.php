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
            'name' => 'required|string',
            'description' => 'nullable|string',
            'unit_price' => 'required|numeric|min:0',
            'currency' => 'nullable|string|max:3',
        ]);

        $product = $request->user()->products()->create($validated);

        return response()->json(['data' => $product], 201);
    }
}
