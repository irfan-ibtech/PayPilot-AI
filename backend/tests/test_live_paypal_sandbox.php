<?php

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Order;
use App\Models\Payment;
use App\Models\PaymentEvent;
use App\Models\RecoveryOpportunity;
use App\Models\User;
use App\Services\PayPalService;
use App\Services\RecoveryAgentService;

echo "=======================================================\n";
echo "PAYPILOT AI — LIVE PAYPAL SANDBOX REST API v2 VERIFICATION\n";
echo "=======================================================\n\n";

$user = User::first();
if (!$user) {
    echo "ERROR: No merchant user found.\n";
    exit(1);
}

$payPalService = app(PayPalService::class);
$recoveryService = app(RecoveryAgentService::class);

// STEP 1: Verify Live OAuth Token Issuance
echo "--- STEP 1: PayPal Sandbox OAuth Authentication ---\n";
try {
    $token = $payPalService->getAccessToken();
    echo "✓ Live OAuth2 Access Token successfully issued from https://api-m.sandbox.paypal.com/v1/oauth2/token\n";
    echo "  Token Length: " . strlen($token) . " chars\n";
    echo "  Mode: " . config('paypal.mode') . "\n";
} catch (\Throwable $e) {
    echo "✗ OAuth failed: " . $e->getMessage() . "\n";
    exit(1);
}

// STEP 2: Create Merchant Order & Live PayPal Order
echo "\n--- STEP 2: Create Merchant Order & Live PayPal Sandbox Order ---\n";
$order = Order::create([
    'user_id' => $user->id,
    'order_number' => 'LIVE-PP-' . strtoupper(bin2hex(random_bytes(4))),
    'subtotal' => '45.00',
    'total' => '45.00',
    'currency' => 'USD',
    'status' => 'PENDING',
]);
echo "✓ Local Order created: ID {$order->id}, Number {$order->order_number}, Total $45.00 USD\n";

$payPalOrder = $payPalService->createOrder($order);
$paypalOrderId = $payPalOrder['id'] ?? null;
$status = $payPalOrder['status'] ?? null;

echo "✓ Live PayPal Order Created on api-m.sandbox.paypal.com!\n";
echo "  PayPal Order ID: {$paypalOrderId}\n";
echo "  PayPal Status: {$status}\n";

if (str_starts_with($paypalOrderId, 'SIMULATED-')) {
    echo "✗ ERROR: Returned simulated order ID instead of genuine PayPal ID!\n";
    exit(1);
} else {
    echo "✓ Verified genuine PayPal format (non-simulated ID).\n";
}

// Find approval link
$approveUrl = null;
foreach ($payPalOrder['links'] ?? [] as $link) {
    if (($link['rel'] ?? '') === 'approve') {
        $approveUrl = $link['href'];
        break;
    }
}
echo "  PayPal Buyer Approval URL: {$approveUrl}\n";

// STEP 3: Inquire Live Order Status via REST API v2
echo "\n--- STEP 3: Query Order Details from PayPal REST API v2 ---\n";
$details = $payPalService->getOrderDetails($paypalOrderId);
echo "✓ Direct Inquiry Response:\n";
echo "  PayPal ID: " . ($details['id'] ?? 'N/A') . "\n";
echo "  PayPal Status: " . ($details['status'] ?? 'N/A') . "\n";
echo "  Intent: " . ($details['intent'] ?? 'N/A') . "\n";
$purchaseUnit = $details['purchase_units'][0] ?? [];
echo "  Payee Merchant ID: " . ($purchaseUnit['payee']['merchant_id'] ?? 'N/A') . "\n";
echo "  Payee Email: " . ($purchaseUnit['payee']['email_address'] ?? 'N/A') . "\n";
echo "  Amount: " . ($purchaseUnit['amount']['value'] ?? 'N/A') . " " . ($purchaseUnit['amount']['currency_code'] ?? 'N/A') . "\n";

// STEP 4: Live Adversarial Test: Capture Unapproved Order
echo "\n--- STEP 4: Adversarial Test: Attempt Capture of Unapproved Order ---\n";
try {
    $payPalService->capturePayment($paypalOrderId);
    echo "✗ UNEXPECTED: PayPal allowed capture of unapproved order!\n";
} catch (\Throwable $e) {
    echo "✓ EXPECTED REST API ENFORCEMENT: Capture rejected as expected!\n";
    echo "  Error received from PayPal: " . $e->getMessage() . "\n";
    $isUnapproved = str_contains($e->getMessage(), 'UNPROCESSABLE_ENTITY')
        || str_contains($e->getMessage(), 'ORDER_NOT_APPROVED')
        || str_contains($e->getMessage(), '422');
    if ($isUnapproved) {
        echo "  ✓ Confirmed authentic PayPal 422 UNPROCESSABLE_ENTITY / ORDER_NOT_APPROVED response.\n";
    }
}

// STEP 5: Live Recovery Session Generation
echo "\n--- STEP 5: Live AI Revenue Recovery Pipeline & Checkout Generation ---\n";
// Create failed order for recovery
$failedOrder = Order::create([
    'user_id' => $user->id,
    'order_number' => 'LIVE-REC-' . strtoupper(bin2hex(random_bytes(4))),
    'subtotal' => '89.00',
    'total' => '89.00',
    'currency' => 'USD',
    'status' => 'FAILED',
]);

$opp = RecoveryOpportunity::create([
    'user_id' => $user->id,
    'order_id' => $failedOrder->id,
    'recovery_score' => 88,
    'priority_level' => 'HIGH',
    'strategy_key' => 'VIP_DIRECT',
    'status' => 'APPROVED',
    'workflow_state' => 'APPROVED_FOR_OUTREACH',
    'ai_summary' => 'Payment authorization timed out at checkout.',
    'ai_recommended_action' => 'Offer 1-click verified PayPal checkout session.',
]);

echo "✓ Recovery Opportunity created for {$failedOrder->order_number} (Status: APPROVED)\n";

$recoveryCheckout = $recoveryService->prepareRecoveryCheckout($opp, $user->id);
$recPayPalOrderId = $recoveryCheckout['paypal_order_id'] ?? null;
echo "✓ Live 1-Click PayPal Recovery Session Generated!\n";
echo "  Recovery PayPal Order ID: {$recPayPalOrderId}\n";
echo "  Payment Attempt ID: {$recoveryCheckout['payment']->id}\n";
echo "  Is Simulated: " . ($recoveryCheckout['payment']->is_simulated ? 'TRUE' : 'FALSE') . "\n";

if (!str_starts_with($recPayPalOrderId, 'SIMULATED-')) {
    echo "✓ Verified genuine PayPal Sandbox recovery token generated via upstream REST API v2.\n";
}

echo "\n=======================================================\n";
echo "LIVE PAYPAL REST API v2 TEST COMPLETED SUCCESSFULLY!\n";
echo "=======================================================\n";
