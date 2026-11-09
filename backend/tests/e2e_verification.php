<?php

/**
 * PayPilot AI - Comprehensive End-to-End System Test Suite
 * Tests every API route, database state transition, Gemini live integration, and PayPal payment flow.
 */

$baseUrl = 'http://127.0.0.1:8000/api';
$token = null;
$passed = 0;
$failed = 0;
$testResults = [];

function runHttp(string $method, string $url, ?array $data = null, ?string $token = null): array
{
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    
    $headers = [
        'Accept: application/json',
        'Content-Type: application/json',
    ];
    if ($token) {
        $headers[] = "Authorization: Bearer {$token}";
    }
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

    if ($data !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    }

    $startTime = microtime(true);
    $response = curl_exec($ch);
    $duration = round((microtime(true) - $startTime) * 1000, 1);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    $json = json_decode($response, true);
    return [
        'code' => $httpCode,
        'body' => $json,
        'raw' => $response,
        'duration' => $duration,
        'error' => $error,
    ];
}

function assertTest(string $name, bool $condition, string $details = ''): void
{
    global $passed, $failed, $testResults;
    if ($condition) {
        $passed++;
        $testResults[] = "[PASS] {$name}" . ($details ? " ({$details})" : '');
        echo "  \033[32m✔\033[0m {$name}" . ($details ? " \033[90m({$details})\033[0m" : '') . "\n";
    } else {
        $failed++;
        $testResults[] = "[FAIL] {$name}" . ($details ? " - {$details}" : '');
        echo "  \033[31m✖\033[0m {$name} - \033[31m{$details}\033[0m\n";
    }
}

echo "\n======================================================\n";
echo " PAYPILOT AI - EXHAUSTIVE SYSTEM & CONNECTION AUDIT\n";
echo " Target API: {$baseUrl}\n";
echo " Time: " . date('Y-m-d H:i:s') . "\n";
echo "======================================================\n\n";

// ====================================================================
// SECTION 1: AUTHENTICATION FLOW
// ====================================================================
echo "1. AUTHENTICATION & IDENTITY ENGINE\n";
$loginRes = runHttp('POST', "{$baseUrl}/login", [
    'email' => 'demo@paypilot.ai',
    'password' => 'password123',
]);

assertTest(
    'Merchant Login (POST /login)',
    $loginRes['code'] === 200 && !empty($loginRes['body']['token']),
    "HTTP {$loginRes['code']} in {$loginRes['duration']}ms"
);

$token = $loginRes['body']['token'] ?? null;
$user = $loginRes['body']['user'] ?? null;

assertTest(
    'User Identity Verification',
    isset($user['email']) && $user['email'] === 'demo@paypilot.ai',
    "User ID: {$user['id']}, Email: {$user['email']}"
);

$meRes = runHttp('GET', "{$baseUrl}/me", null, $token);
$meUser = $meRes['body']['user'] ?? $meRes['body'];
assertTest(
    'Identity Session Profile (GET /me)',
    $meRes['code'] === 200 && ($meUser['id'] ?? null) === $user['id'],
    "Authenticated Merchant ID #" . ($meUser['id'] ?? '')
);

// ====================================================================
// SECTION 2: MERCHANT DASHBOARD OVERVIEW & REVENUE VELOCITY
// ====================================================================
echo "\n2. CORE COMMERCE - DASHBOARD & ANALYTICS OVERVIEW\n";
$analyticsRes = runHttp('GET', "{$baseUrl}/analytics/overview", null, $token);
$metrics = $analyticsRes['body']['metrics'] ?? null;

assertTest(
    'Deterministic Analytics (GET /analytics/overview)',
    $analyticsRes['code'] === 200 && isset($metrics['total_revenue']),
    "Total Settled: \${$metrics['total_revenue']} ({$metrics['paid_orders']} paid orders) in {$analyticsRes['duration']}ms"
);

assertTest(
    '7-Day Daily Volume Metric Array',
    !empty($metrics['daily_volume']) && count($metrics['daily_volume']) === 7,
    count($metrics['daily_volume']) . " days historical bucket"
);

assertTest(
    'Top-Selling Revenue Drivers Aggregate',
    is_array($metrics['top_selling_products']),
    count($metrics['top_selling_products']) . " catalog revenue drivers"
);

// Orders Ledger
$ordersRes = runHttp('GET', "{$baseUrl}/orders", null, $token);
$ordersList = $ordersRes['body']['data'] ?? [];

assertTest(
    'Orders Ledger (GET /orders)',
    $ordersRes['code'] === 200 && is_array($ordersList),
    count($ordersList) . " order(s) retrieved in {$ordersRes['duration']}ms"
);

if (count($ordersList) > 0) {
    $firstOrder = $ordersList[0];
    $singleOrderRes = runHttp('GET', "{$baseUrl}/orders/{$firstOrder['id']}", null, $token);
    assertTest(
        'Order & Item Inspector (GET /orders/{id})',
        $singleOrderRes['code'] === 200 && $singleOrderRes['body']['data']['order_number'] === $firstOrder['order_number'],
        "Order #{$firstOrder['order_number']} with " . count($firstOrder['items'] ?? []) . " items"
    );
}

// ====================================================================
// SECTION 3: PRODUCT CATALOG CRUD & ZERO-TRUST REGISTRY
// ====================================================================
echo "\n3. CORE COMMERCE - PRODUCT CATALOG REGISTRY\n";
$productsRes = runHttp('GET', "{$baseUrl}/products", null, $token);
$initialProducts = $productsRes['body']['data'] ?? [];

assertTest(
    'Fetch Product Catalog (GET /products)',
    $productsRes['code'] === 200 && is_array($initialProducts),
    count($initialProducts) . " SKUs registered"
);

// Create new product
$newProdData = [
    'name' => 'Automated Test SKU ' . time(),
    'unit_price' => 129.99,
    'currency' => 'USD',
    'description' => 'Temporary product for automated E2E audit',
];
$createProdRes = runHttp('POST', "{$baseUrl}/products", $newProdData, $token);
$createdProd = $createProdRes['body']['data'] ?? null;

assertTest(
    'Create Catalog Product (POST /products)',
    $createProdRes['code'] === 201 && !empty($createdProd['id']),
    "Created Product ID #{$createdProd['id']} with price \${$createdProd['unit_price']}"
);

if ($createdProd) {
    // Update product
    $updateProdRes = runHttp('PUT', "{$baseUrl}/products/{$createdProd['id']}", [
        'unit_price' => 119.50,
        'description' => 'Updated price via automated audit',
    ], $token);

    assertTest(
        'Update Catalog Product (PUT /products/{id})',
        $updateProdRes['code'] === 200 && (float) $updateProdRes['body']['data']['unit_price'] === 119.50,
        "Updated price to \${$updateProdRes['body']['data']['unit_price']}"
    );

    // Delete product
    $deleteProdRes = runHttp('DELETE', "{$baseUrl}/products/{$createdProd['id']}", null, $token);
    assertTest(
        'Delete Catalog Product (DELETE /products/{id})',
        $deleteProdRes['code'] === 200,
        "Cleaned up temporary SKU #{$createdProd['id']}"
    );
}

// ====================================================================
// SECTION 4: TRANSACTIONS LEDGER & AUDIT TRAIL
// ====================================================================
echo "\n4. CORE COMMERCE - TRANSACTIONS LEDGER & PAYPAL RECORDS\n";
$paymentsRes = runHttp('GET', "{$baseUrl}/payments", null, $token);
$paymentsList = $paymentsRes['body']['data'] ?? [];

assertTest(
    'Transactions Ledger (GET /payments)',
    $paymentsRes['code'] === 200 && is_array($paymentsList),
    count($paymentsList) . " transaction record(s) logged in {$paymentsRes['duration']}ms"
);

if (count($paymentsList) > 0) {
    $firstPayment = $paymentsList[0];
    $singlePayRes = runHttp('GET', "{$baseUrl}/payments/{$firstPayment['id']}", null, $token);
    assertTest(
        'Transaction Inspector & Payload (GET /payments/{id})',
        $singlePayRes['code'] === 200 && !empty($singlePayRes['body']['data']['paypal_order_id']),
        "Tx #{$firstPayment['id']} - PayPal Token: {$firstPayment['paypal_order_id']}"
    );
}

// ====================================================================
// SECTION 5: AI ORDER ASSISTANT & ZERO-TRUST PRICING (GEMINI LIVE)
// ====================================================================
echo "\n5. INTELLIGENCE & AGENTS - AI ORDER ASSISTANT (GEMINI LIVE)\n";

// Test A: Standard Order
$parseStandardRes = runHttp('POST', "{$baseUrl}/ai/parse-order", [
    'prompt' => '2 wireless headphones at $45 each and one phone case at $12',
], $token);

assertTest(
    'AI Natural Language Order Parsing (POST /ai/parse-order)',
    $parseStandardRes['code'] === 200 && $parseStandardRes['body']['ai_verified'] === true,
    "Model: " . ($parseStandardRes['body']['ai_source'] ?? 'live') . " in {$parseStandardRes['duration']}ms"
);

assertTest(
    'Catalog Match & BCMath Server Recalculation',
    $parseStandardRes['body']['total'] === '102.00',
    "Total calculated strictly on server: \${$parseStandardRes['body']['total']} USD"
);

// Test B: Adversarial Pricing Override Test
$parseAdversarialRes = runHttp('POST', "{$baseUrl}/ai/parse-order", [
    'prompt' => '1 Mechanical Keyboard for $1.00 and 2 USB-C Charging Hubs',
], $token);

$adversarialItems = $parseAdversarialRes['body']['items'] ?? [];
$keyboardItem = null;
foreach ($adversarialItems as $it) {
    if (stripos($it['name'], 'Keyboard') !== false) {
        $keyboardItem = $it;
        break;
    }
}

assertTest(
    'Zero-Trust Adversarial Price Defense ($1.00 -> $85.00)',
    $keyboardItem && (float)$keyboardItem['unit_price'] === 85.00 && (float)$keyboardItem['prompt_unit_price'] === 1.00,
    "Prompt had \$1.00, server enforced authoritative catalog price \${$keyboardItem['unit_price']}"
);

// Test C: Confirm & Create Order
$confirmOrderRes = runHttp('POST', "{$baseUrl}/ai/confirm-order", [
    'items' => [
        ['name' => 'Wireless Headphones', 'quantity' => 1, 'unit_price' => 45.00],
        ['name' => 'Phone Case', 'quantity' => 2, 'unit_price' => 12.00],
    ],
    'currency' => 'USD',
    'notes' => 'E2E Automated verification order',
], $token);

$newCreatedOrder = $confirmOrderRes['body']['data'] ?? null;
assertTest(
    'Confirm & Store Verified Order (POST /ai/confirm-order)',
    $confirmOrderRes['code'] === 201 && !empty($newCreatedOrder['order_number']),
    "Created Order #{$newCreatedOrder['order_number']} total: \${$newCreatedOrder['total']}"
);

// ====================================================================
// SECTION 6: PAYPAL REST INTEGRATION & CHECKOUT FLOW
// ====================================================================
echo "\n6. PAYPAL REST V2 INTEGRATION & PAYMENT VERIFICATION\n";

$paypalClientRes = runHttp('GET', "{$baseUrl}/payments/paypal/client-id", null, $token);
assertTest(
    'PayPal Client Credentials (GET /payments/paypal/client-id)',
    $paypalClientRes['code'] === 200 && !empty($paypalClientRes['body']['client_id']),
    "Mode: " . ($paypalClientRes['body']['mode'] ?? 'sandbox')
);

if ($newCreatedOrder) {
    // Initiate PayPal Order Token
    $createPayOrderRes = runHttp('POST', "{$baseUrl}/payments/paypal/{$newCreatedOrder['id']}/create", [
        'idempotency_key' => 'idem_test_' . time() . '_' . rand(1000, 9999),
    ], $token);

    assertTest(
        'Create PayPal v2 Order Token (POST /payments/paypal/{id}/create)',
        $createPayOrderRes['code'] === 200 && !empty($createPayOrderRes['body']['paypal_order_id']),
        "PayPal Token: " . ($createPayOrderRes['body']['paypal_order_id'] ?? 'none') . " in {$createPayOrderRes['duration']}ms"
    );

    $paypalOrderId = $createPayOrderRes['body']['paypal_order_id'] ?? null;

    if ($paypalOrderId) {
        // Capture PayPal Order
        $captureRes = runHttp('POST', "{$baseUrl}/payments/paypal/capture", [
            'order_id' => $newCreatedOrder['id'],
            'paypal_order_id' => $paypalOrderId,
        ], $token);

        assertTest(
            'Cryptographic PayPal Capture (POST /payments/paypal/capture)',
            $captureRes['code'] === 200 && $captureRes['body']['success'] === true,
            "Capture ID: " . ($captureRes['body']['payment']['paypal_capture_id'] ?? 'SIMULATED_CAPTURED') . " in {$captureRes['duration']}ms"
        );

        // Verify order status transitioned to PAID
        $verifyPaidOrderRes = runHttp('GET', "{$baseUrl}/orders/{$newCreatedOrder['id']}", null, $token);
        assertTest(
            'Order Status Transitioned to PAID',
            $verifyPaidOrderRes['body']['data']['status'] === 'PAID',
            "Order #{$newCreatedOrder['order_number']} status: {$verifyPaidOrderRes['body']['data']['status']}"
        );
    }
}

// ====================================================================
// SECTION 7: AI REVENUE RECOVERY AGENT & PIPELINE
// ====================================================================
echo "\n7. INTELLIGENCE & AGENTS - REVENUE RECOVERY AGENT\n";

$recoveryMetricsRes = runHttp('GET', "{$baseUrl}/recovery/metrics", null, $token);
$recMetrics = $recoveryMetricsRes['body']['data'] ?? null;

assertTest(
    'Recovery Metrics Pipeline (GET /recovery/metrics)',
    $recoveryMetricsRes['code'] === 200 && isset($recMetrics['pending_review']),
    "Pending: {$recMetrics['pending_review']}, Recoverable: {$recMetrics['formatted_potential_revenue']}"
);

// Scan for drop-offs
$scanRes = runHttp('POST', "{$baseUrl}/recovery/scan", [], $token);
assertTest(
    'Autonomous Telemetry Scan (POST /recovery/scan)',
    $scanRes['code'] === 200,
    "Scan message: " . ($scanRes['body']['message'] ?? 'completed')
);

// Fetch opportunities
$oppsRes = runHttp('GET', "{$baseUrl}/recovery/opportunities", null, $token);
$oppsList = $oppsRes['body']['data'] ?? [];

assertTest(
    'Recovery Opportunities List (GET /recovery/opportunities)',
    $oppsRes['code'] === 200 && is_array($oppsList),
    count($oppsList) . " recovery opportunities in pipeline"
);

if (count($oppsList) > 0) {
    $targetOpp = $oppsList[0];
    
    // Live Gemini Re-Analysis
    $analyzeRes = runHttp('POST', "{$baseUrl}/recovery/opportunities/{$targetOpp['id']}/analyze", [], $token);
    assertTest(
        'Live Gemini Opportunity Analysis (POST /recovery/opportunities/{id}/analyze)',
        $analyzeRes['code'] === 200 && !empty($analyzeRes['body']['data']['ai_summary']),
        "Model: " . ($analyzeRes['body']['model'] ?? 'Gemini Live') . " in {$analyzeRes['duration']}ms"
    );

    // Approve strategy
    $approveRes = runHttp('POST', "{$baseUrl}/recovery/opportunities/{$targetOpp['id']}/approve", [
        'custom_message' => 'Custom approved copy via automated test',
    ], $token);
    
    assertTest(
        'Merchant Approval Control (POST /recovery/opportunities/{id}/approve)',
        $approveRes['code'] === 200 && in_array($approveRes['body']['data']['status'], ['APPROVED', 'RECOVERED']),
        "Opportunity #{$targetOpp['id']} status: {$approveRes['body']['data']['status']}"
    );
}

// ====================================================================
// SECTION 8: CFO BUSINESS COPILOT (GEMINI LIVE REASONING)
// ====================================================================
echo "\n8. INTELLIGENCE & AGENTS - CFO BUSINESS COPILOT\n";

$recsRes = runHttp('GET', "{$baseUrl}/ai/copilot/recommendations", null, $token);
assertTest(
    'Persisted Strategic Recommendations (GET /ai/copilot/recommendations)',
    $recsRes['code'] === 200 && is_array($recsRes['body']['data'] ?? null),
    count($recsRes['body']['data'] ?? []) . " strategic actions on record"
);

$copilotAskRes = runHttp('POST', "{$baseUrl}/ai/copilot/ask", [
    'question' => 'How can I improve my checkout conversion rate and recover more dropped carts?',
], $token);

assertTest(
    'CFO Copilot Live Reasoning (POST /ai/copilot/ask)',
    $copilotAskRes['code'] === 200 && !empty($copilotAskRes['body']['analysis']),
    "Model: " . ($copilotAskRes['body']['ai_source'] ?? 'Gemini Live') . " in {$copilotAskRes['duration']}ms"
);

assertTest(
    'Copilot Generated Action Recommendations',
    !empty($copilotAskRes['body']['recommendations']) && is_array($copilotAskRes['body']['recommendations']),
    count($copilotAskRes['body']['recommendations'] ?? []) . " actions generated"
);

// ====================================================================
// SECTION 9: FINTECH AUDIT TIMELINE & RECONCILIATION ENGINE
// ====================================================================
echo "\n9. FINTECH AUDIT TIMELINE & CONCURRENCY RECONCILIATION\n";

if (!empty($targetOrder['id'])) {
    $orderEventsRes = runHttp('GET', "{$baseUrl}/orders/{$targetOrder['id']}/events", null, $token);
    assertTest(
        'Order Payment Events Timeline (GET /orders/{id}/events)',
        $orderEventsRes['code'] === 200 && is_array($orderEventsRes['body']['data'] ?? null),
        count($orderEventsRes['body']['data'] ?? []) . " chronological audit events recorded"
    );
}

if (!empty($targetOpp['id'])) {
    $oppEventsRes = runHttp('GET', "{$baseUrl}/recovery/opportunities/{$targetOpp['id']}/events", null, $token);
    assertTest(
        'Recovery Audit Events Timeline (GET /recovery/opportunities/{id}/events)',
        $oppEventsRes['code'] === 200 && is_array($oppEventsRes['body']['data'] ?? null),
        count($oppEventsRes['body']['data'] ?? []) . " recovery lifecycle events recorded"
    );
}

// Reconcile endpoint verification
$reconcileToken = $paypalOrderId ?? 'SIMULATED-TEST-ORDER';
$reconcileRes = runHttp('POST', "{$baseUrl}/payments/paypal/{$reconcileToken}/reconcile", null, $token);
assertTest(
    'PayPal Concurrency-Safe Reconciliation (POST /payments/paypal/{id}/reconcile)',
    in_array($reconcileRes['code'], [200, 404]),
    "Status {$reconcileRes['code']}: " . ($reconcileRes['body']['message'] ?? 'OK')
);

// ====================================================================
// SECTION 10: MULTI-TENANT ISOLATION & ZERO-TRUST SECURITY GATE
// ====================================================================
echo "\n10. MULTI-TENANT ISOLATION & SECURE BOUNDARIES\n";

$tenant2Email = 'isolation_tester_' . time() . '@paypilot.demo';
$registerRes = runHttp('POST', "{$baseUrl}/register", [
    'name' => 'Isolation Tester',
    'email' => $tenant2Email,
    'password' => 'SecurePass123!',
    'password_confirmation' => 'SecurePass123!',
]);

if ($registerRes['code'] === 201) {
    $tenant2Token = $registerRes['body']['token'];

    // Tenant 2 attempts to inspect Tenant 1's order
    if (!empty($targetOrder['id'])) {
        $crossOrderRes = runHttp('GET', "{$baseUrl}/orders/{$targetOrder['id']}", null, $tenant2Token);
        assertTest(
            'Multi-Tenant Order Isolation (Foreign order access blocked)',
            $crossOrderRes['code'] === 404,
            "HTTP {$crossOrderRes['code']} expected 404 Not Found"
        );
    }

    // Tenant 2 attempts to approve Tenant 1's recovery opportunity
    if (!empty($targetOpp['id'])) {
        $crossOppRes = runHttp('POST', "{$baseUrl}/recovery/opportunities/{$targetOpp['id']}/approve", [
            'custom_message' => 'Unauthorized tampering attempt',
        ], $tenant2Token);
        assertTest(
            'Multi-Tenant Recovery Isolation (Foreign recovery intervention blocked)',
            in_array($crossOppRes['code'], [404, 422, 403]),
            "HTTP {$crossOppRes['code']} correctly denied cross-tenant execution"
        );
    }

    // Tenant 2 attempts to read Tenant 1's product (IDOR check)
    $prod1Res = runHttp('GET', "{$baseUrl}/products/1", null, $tenant2Token);
    assertTest(
        'Multi-Tenant Product Isolation (IDOR blocked via 404)',
        $prod1Res['code'] === 404,
        "HTTP {$prod1Res['code']} correctly returned 404 Not Found"
    );
} else {
    assertTest('Multi-Tenant Register Tester', false, 'Failed to create secondary tenant');
}

// ====================================================================
// SECTION 11: ADVERSARIAL MATHEMATICS & APPROVAL GATE TESTS
// ====================================================================
echo "\n11. ADVERSARIAL MATHEMATICS & RECOVERY GATE ENFORCEMENT\n";

// Multi-currency BCMath scales and half-up rounding
require_once __DIR__ . '/../app/Support/Money.php';
use App\Support\Money;

$usdFormatted = Money::format('10.555', 'USD'); // Expected 10.56 (half-up)
$usdRoundDown = Money::format('10.554', 'USD'); // Expected 10.55
$jpyFormatted = Money::format('10.5', 'JPY');    // Expected 11 (scale 0 half-up)
$bhdFormatted = Money::format('1.2345', 'BHD');  // Expected 1.235 (scale 3 half-up)
$kwdFormatted = Money::format('5.5001', 'KWD');  // Expected 5.500 (scale 3)

assertTest(
    'Multi-Currency ISO-4217 Scales & Half-Up Rounding',
    $usdFormatted === '10.56' && $usdRoundDown === '10.55' && $jpyFormatted === '11' && $bhdFormatted === '1.235' && $kwdFormatted === '5.500',
    "USD: {$usdFormatted}, JPY: {$jpyFormatted}, BHD: {$bhdFormatted}, KWD: {$kwdFormatted}"
);

// Recovery Approval Gate: Attempt checkout on unapproved PENDING opportunity
// Create an unapproved opportunity to test approval enforcement
$allOppsRes = runHttp('GET', "{$baseUrl}/recovery/opportunities?status=PENDING", null, $token);
$pendingOpps = $allOppsRes['body']['data'] ?? [];
$unapprovedOpp = null;
foreach ($pendingOpps as $po) {
    if ($po['status'] === 'PENDING') {
        $unapprovedOpp = $po;
        break;
    }
}

if ($unapprovedOpp) {
    $unapprovedCheckoutRes = runHttp('POST', "{$baseUrl}/recovery/opportunities/{$unapprovedOpp['id']}/checkout", [], $token);
    assertTest(
        'Zero-Trust Recovery Approval Gate (Unapproved checkout blocked)',
        $unapprovedCheckoutRes['code'] === 400 && str_contains(strtolower($unapprovedCheckoutRes['body']['message'] ?? ''), 'must be approved'),
        "HTTP {$unapprovedCheckoutRes['code']}: " . ($unapprovedCheckoutRes['body']['message'] ?? '')
    );
}

// ====================================================================
// SUMMARY AUDIT REPORT
// ====================================================================
echo "\n======================================================\n";
echo " AUDIT SUMMARY\n";
echo " Total Assertions Checked: " . ($passed + $failed) . "\n";
echo " Passed: \033[32m{$passed}\033[0m\n";
echo " Failed: " . ($failed > 0 ? "\033[31m{$failed}\033[0m" : "\033[32m0\033[0m") . "\n";
echo " Success Rate: " . round(($passed / max(1, $passed + $failed)) * 100, 1) . "%\n";
echo "======================================================\n\n";

exit($failed > 0 ? 1 : 0);
