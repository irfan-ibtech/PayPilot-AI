<?php

use App\Http\Controllers\Api\AICopilotController;
use App\Http\Controllers\Api\AIOrderController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\RecoveryController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes - PayPilot AI
|--------------------------------------------------------------------------
*/

// Public Authentication
Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);

// Authenticated Merchant Routes
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::get('/user', [AuthController::class, 'me']);

    // Products Catalog
    Route::apiResource('products', ProductController::class);

    // Order Management
    Route::get('/orders', [OrderController::class, 'index']);
    Route::post('/orders', [OrderController::class, 'store']);
    Route::get('/orders/{id}', [OrderController::class, 'show']);

    // AI Natural Language Order Extraction & Zero-Trust Engine
    Route::post('/ai/parse-order', [AIOrderController::class, 'parse']);
    Route::post('/ai/confirm-order', [AIOrderController::class, 'confirmAndCreate']);

    // Deterministic Analytics & AI Copilot Insights
    Route::get('/analytics/overview', [AICopilotController::class, 'getOverview']);
    Route::post('/ai/copilot/ask', [AICopilotController::class, 'ask']);
    Route::get('/ai/copilot/recommendations', [AICopilotController::class, 'getRecommendations']);

    // PayPal Verification & Capture Engine
    Route::get('/payments/paypal/client-id', [PaymentController::class, 'getPayPalClientId']);
    Route::post('/payments/paypal/{orderId}/create', [PaymentController::class, 'createPayPalOrder']);
    Route::post('/payments/paypal/capture', [PaymentController::class, 'capturePayPalOrder']);
    Route::get('/payments', [PaymentController::class, 'index']);
    Route::get('/payments/{payment}', [PaymentController::class, 'show']);

    // AI Revenue Recovery Agent & Pipeline
    Route::get('/recovery/metrics', [RecoveryController::class, 'metrics']);
    Route::get('/recovery/opportunities', [RecoveryController::class, 'index']);
    Route::post('/recovery/scan', [RecoveryController::class, 'scan']);
    Route::get('/recovery/opportunities/{id}', [RecoveryController::class, 'show']);
    Route::post('/recovery/opportunities/{id}/approve', [RecoveryController::class, 'approve']);
    Route::post('/recovery/opportunities/{id}/reject', [RecoveryController::class, 'reject']);
    Route::post('/recovery/opportunities/{id}/checkout', [RecoveryController::class, 'launchCheckout']);
});
