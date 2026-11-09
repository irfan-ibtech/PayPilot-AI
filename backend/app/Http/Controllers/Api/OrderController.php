<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OrderController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $orders = Order::with(['items', 'payments'])
            ->where('user_id', $request->user()->id)
            ->latest()
            ->get();

        return response()->json(['data' => $orders]);
    }

    public function show(Request $request, Order $order): JsonResponse
    {
        return response()->json(['data' => $order->load(['items', 'payments'])]);
    }

    public function store(Request $request): JsonResponse
    {
        return response()->json(['message' => 'Order creation will be implemented in upcoming milestone'], 501);
    }
}
