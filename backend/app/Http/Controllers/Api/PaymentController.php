<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Payment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PaymentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $payments = Payment::with('order')
            ->where('user_id', $request->user()->id)
            ->latest()
            ->get();

        return response()->json(['data' => $payments]);
    }

    public function show(Request $request, Payment $payment): JsonResponse
    {
        return response()->json(['data' => $payment->load('order')]);
    }

    public function store(Request $request): JsonResponse
    {
        return response()->json(['message' => 'Payment handling will be implemented in upcoming milestone'], 501);
    }
}
