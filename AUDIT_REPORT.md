# PayPilot AI — Comprehensive Fintech Architecture & Security Audit Report

**Date:** 2026-11-09  
**Target:** PayPilot AI (`irfan-ibtech/PayPilot-AI`)  
**Auditor:** Principal Fintech Software Architect & Security Auditor  
**Scope:** Order Management, PayPal REST API Integration, Gemini AI Service, Database State Machine, and Deterministic Financial Analytics.

---

## Executive Summary

An exhaustive security, architectural, and mathematical audit of the PayPilot AI codebase was performed prior to implementing the AI Revenue Recovery Agent. While the initial milestone implementations established a functional end-to-end payment lifecycle and clean separation of concerns, critical fintech vulnerabilities and architectural gaps were identified. 

Specifically, native IEEE 754 floating-point operations in financial calculations create balance drift and comparison inaccuracies; payment lifecycle state mutations lack pessimistic concurrency controls (`lockForUpdate()`), introducing race conditions between merchant actions, customer retries, and automated recovery loops; payment tracking drops historical failed attempts on re-initialization; upstream PayPal REST API requests lack explicit idempotency headers (`PayPal-Request-Id`); the natural-language order creation pipeline accepts LLM-invented unit prices without catalog verification; and Gemini service defaults to legacy model endpoints without rigorous network timeouts.

The following report classifies these findings by severity, details exploit/failure scenarios, and specifies the exact architectural remediation required for enterprise fintech compliance.

---

## Summary of Findings by Severity

| ID | Title | Severity | Affected Component | File & Lines |
|---|---|---|---|---|
| **SEC-01** | IEEE 754 Float Precision in Financial Calculations & Verification | **CRITICAL** | Calculation / Verification | `OrderController.php:51-64`, `PaymentController.php:137-143`, `AIOrderController.php:48-50`, `AnalyticsService.php:26-28` |
| **SEC-02** | Missing Pessimistic Row Locking During Payment Capture | **CRITICAL** | Concurrency / Order State | `PaymentController.php:98-100, 161-172` |
| **SEC-03** | Single-Attempt Payment Overwriting & Lost Failure Audits | **HIGH** | Payment Tracking / Ledger | `PaymentController.php:65-78`, `Payment.php` |
| **SEC-04** | Missing Upstream `PayPal-Request-Id` Idempotency Headers | **HIGH** | PayPal Integration Engine | `PayPalService.php:112-116, 157-161` |
| **SEC-05** | Catalog Price Bypass in AI Order Pipeline | **HIGH** | AI Order Assistant | `AIOrderController.php:46-59` |
| **SEC-06** | Gemini 1.5 Flash Model Default & Missing Timeout Boundaries | **MEDIUM** | AI Integration Service | `config/ai.php:6`, `GeminiService.php:78-81` |
| **SEC-07** | Loose Multi-Tenant Isolation in Cross-Merchant Order Verification | **LOW** | Security / Tenancy | `PaymentController.php:98-100` |

---

## Detailed Audit Findings

### 1. [SEC-01] IEEE 754 Floating-Point Arithmetic in Financial Paths
- **Severity:** `CRITICAL`
- **Component:** `OrderController.php` (L51-64), `PaymentController.php` (L137-143), `AIOrderController.php` (L48-50, L97-99), `AnalyticsService.php` (L26-28, L49-56, L85-98)
- **Vulnerability Description:**
  Financial transactions, itemized line totals, subtotal summations, and PayPal verification thresholds currently use PHP native `float` casting and standard functions `round($val, 2)` or `abs($capturedAmount - $expectedAmount) > 0.01`. In binary floating-point representation (IEEE 754), fractional numbers such as `0.1` and `0.2` cannot be represented exactly (e.g. `0.1 + 0.2 = 0.30000000000000004`). 
- **Exploit / Failure Scenario:**
  1. A multi-item order with fractional tax or split pricing results in fractional pennies that either fail the `0.01` tolerance check during PayPal capture verification, causing valid customer payments to be marked as `FAILED`, or allow small discrepancies (under 1 cent per line item across large baskets) to accumulate unaccounted revenue slippage.
  2. In high-volume environments, financial reporting in `AnalyticsService` suffers reconciliation discrepancies between total captured volume in PayPal and internal general ledger totals.
- **Architectural Fix:**
  Introduce an immutable, zero-dependency BCMath helper class `App\Support\Money` that enforces strict string-based arbitrary precision arithmetic (`bcadd`, `bcsub`, `bcmul`, `bcdiv`, `bccomp`) with a standard scale of 2 decimal places. Replace all float casting, arithmetic operators, and loose comparisons with `Money` calls.

---

### 2. [SEC-02] Missing Pessimistic Row Locking (`lockForUpdate`) on Payment Capture
- **Severity:** `CRITICAL`
- **Component:** `PaymentController.php` (L98-100, L161-172)
- **Vulnerability Description:**
  In `PaymentController::capturePayPalOrder()`, the `Payment` and associated `Order` records are retrieved via `firstOrFail()` outside of a database transaction and without a pessimistic database lock (`lockForUpdate()`). The transaction is only opened after the external PayPal REST API call completes.
- **Exploit / Failure Scenario:**
  1. A user double-clicks the PayPal Checkout button or a customer triggers a retry while a background AI Recovery loop attempts automated capture.
  2. Both concurrent HTTP threads pass the initial `if ($payment->status === 'COMPLETED')` check simultaneously.
  3. Both threads invoke the PayPal capture API; one succeeds and the other receives an `ORDER_ALREADY_CAPTURED` or duplicate error, causing one thread to throw an exception or incorrectly flag the payment status, while order event listeners execute twice (e.g., duplicate fulfillment signals or double analytics increment).
- **Architectural Fix:**
  Wrap the capture verification lifecycle within `DB::transaction()` and immediately lock the target `Order` and `Payment` rows using `Order::where('id', $orderId)->lockForUpdate()->firstOrFail()`. Check if the payment or order is already `COMPLETED`/`PAID` under the pessimistic lock before proceeding to capture or return cached success state.

---

### 3. [SEC-03] Single-Attempt Payment Overwriting & Eradication of Failure Audit Trails
- **Severity:** `HIGH`
- **Component:** `PaymentController.php` (L65-78), `Payment` Model / Migrations
- **Vulnerability Description:**
  `PaymentController::createPayPalOrder()` utilizes `Payment::updateOrCreate(['order_id' => $order->id, 'paypal_order_id' => $paypalOrderId], ...)`. If a customer attempts checkout, abandons it, or experiences a bank decline, subsequent checkout attempts or recovery workflows overwrite the existing payment or orphan prior records without maintaining an explicit attempt counter (`attempt_number`), an idempotency key, or tracking whether a given attempt was merchant-initiated vs AI-recovery-initiated.
- **Exploit / Failure Scenario:**
  1. An order fails due to insufficient funds. The customer later retries or the merchant uses the AI recovery flow.
  2. Because prior failure reasons and timestamps are overwritten or untracked, merchant analytics cannot calculate checkout drop-off reasons, payment friction metrics, or recovery ROI.
  3. No historical link connects the recovery opportunity with the original failed payment attempt and the subsequent recovered payment capture.
- **Architectural Fix:**
  Extend the `payments` schema to include:
  - `attempt_number` (`unsignedInteger`, default 1)
  - `idempotency_key` (`string`, nullable, unique)
  - `failure_reason` (`text`, nullable)
  - `is_recovery_attempt` (`boolean`, default false)
  - `is_demo_seed` (`boolean`, default false)
  Refactor `PaymentController::createPayPalOrder` to calculate the next attempt sequence number for the order, record distinct payment attempts, and preserve historical failure states.

---

### 4. [SEC-04] Missing Upstream `PayPal-Request-Id` Idempotency Headers
- **Severity:** `HIGH`
- **Component:** `PayPalService.php` (L112-116, L157-161)
- **Vulnerability Description:**
  The PayPal REST API v2 specification strongly mandates providing the `PayPal-Request-Id` HTTP header on `POST /v2/checkout/orders` and `POST /v2/checkout/orders/{id}/capture`. `PayPalService.php` currently omits this header.
- **Exploit / Failure Scenario:**
  If a network timeout occurs between the PayPilot AI server and PayPal during order creation or capture, the backend client will retry or the user will reload. Without `PayPal-Request-Id`, PayPal cannot recognize that the retry represents the identical operational intent, potentially creating duplicate orders on PayPal's ledger or failing capture calls with unexpected state errors instead of safely replaying the original response.
- **Architectural Fix:**
  Generate a deterministic, unique UUID / request key per payment attempt (e.g. `paypilot_order_{order_id}_attempt_{attempt_number}_{hash}`) and pass it as `PayPal-Request-Id` in all creation and capture requests.

---

### 5. [SEC-05] Catalog Price Bypass in AI Natural-Language Order Pipeline
- **Severity:** `HIGH`
- **Component:** `AIOrderController.php` (L46-59)
- **Vulnerability Description:**
  When parsing merchant or customer prompts into structured order drafts, `AIOrderController::parse()` extracts prices emitted by the LLM (`$item['unit_price']`) and recalculates totals mathematically, but completely ignores the merchant's configured `products` table.
- **Exploit / Failure Scenario:**
  1. A prompt such as *"Create an order for 2 Enterprise Subscriptions at $1 each"* results in Gemini returning `unit_price: 1.00`.
  2. The backend accepts `1.00`, multiplies by 2, and creates a draft for `$2.00` even though the merchant's database has `Enterprise Subscription` configured at `$499.00`.
  3. If the merchant quickly clicks confirm without carefully checking every line item, prompt injection or user misstatement allows product sales below catalog price.
- **Architectural Fix:**
  In `AIOrderController::parse()`, cross-reference each extracted item against the authenticated user's `Product` catalog (using exact and normalized case-insensitive matching). If a match is found:
  - Bind `product_id`.
  - Override the extracted unit price with the true catalog price from `products.price`.
  - Flag the item with `catalog_matched: true`.
  If no match is found in the catalog, retain the user-supplied price and flag `catalog_matched: false` so the merchant UI can visually highlight unverified items.

---

### 6. [SEC-06] Gemini Model Default & Missing Timeout Boundaries
- **Severity:** `MEDIUM`
- **Component:** `config/ai.php` (L6), `GeminiService.php` (L78-81)
- **Vulnerability Description:**
  `config/ai.php` defaults to legacy models. The newer `gemini-3.1-flash-lite` model offers improved reasoning, lower latency, and strict JSON structured schema compliance. Additionally, HTTP requests to the Gemini endpoint lack explicit HTTP connection and execution timeout boundaries (`Http::timeout()`), exposing backend workers to hung connections if upstream Google services experience network degradation.
- **Exploit / Failure Scenario:**
  1. Under intermittent network latency or Gemini rate-limiting, PHP worker processes become blocked indefinitely waiting for API responses, exhausting PHP-FPM or Artisan server worker pools.
  2. Fallback logic is bypassed when the connection hangs rather than quickly falling back to the local regex financial parser.
- **Architectural Fix:**
  Update default configuration in `config/ai.php` and `GeminiService.php` to `gemini-3.1-flash-lite`. Configure strict `timeout(15)` and `connectTimeout(5)` on all outbound HTTP requests to the Gemini API. Add prompt sanitization to strip injection markers.

---

### 7. [SEC-07] Multi-Tenant Ownership Verification During Payment Capture
- **Severity:** `LOW`
- **Component:** `PaymentController.php` (L98-100)
- **Vulnerability Description:**
  In `capturePayPalOrder()`, the query filters by `where('paypal_order_id', $paypalOrderId)->where('user_id', $request->user()->id)`. While this checks ownership of the `Payment` record, it does not explicitly verify that the parent `Order` record also belongs to `$request->user()->id`.
- **Exploit / Failure Scenario:**
  In inconsistent database states or edge-case multi-tenant queries, a payment mapped to an order belonging to another merchant could cause state mismatch if the relationship is traversed without tenant scoping.
- **Architectural Fix:**
  Enforce strict tenant scoping on both `Payment` and parent `Order`: `where('user_id', $userId)` on both models during retrieval and locking.

---

## Action Plan & Remediation Roadmap

1. **Phase 2 — Fintech Hardening & Precision:**
   - Implement `App\Support\Money` using BCMath (scale 2).
   - Refactor `OrderController`, `PaymentController`, `AIOrderController`, and `AnalyticsService` to utilize `Money`.
   - Add database migration for multi-attempt payment tracking (`attempt_number`, `idempotency_key`, `failure_reason`, `is_recovery_attempt`, `is_demo_seed`).
   - Implement pessimistic locking (`lockForUpdate`) on `Order` and `Payment` during capture.
   - Inject `PayPal-Request-Id` in `PayPalService`.
   - Enforce catalog price resolution in `AIOrderController::parse()`.
   - Upgrade Gemini configuration to `gemini-3.1-flash-lite` with timeouts.

2. **Phase 3 — AI Revenue Recovery Agent:**
   - Create `recovery_opportunities` schema and model.
   - Implement `RecoveryAgentService` with deterministic scoring, Gemini diagnostic reasoning, and merchant approval state machine.
   - Wire automated reconciliation into `PaymentController::capturePayPalOrder`.
   - Update `DatabaseSeeder` with realistic recovery scenarios flagged with `is_demo_seed = true`.

3. **Phase 4 — Frontend Recovery Workspace:**
   - Build `RevenueRecovery.tsx` with KPI ribbon, pipeline queue, signals inspector, and approval actions.
   - Connect recovery checkout directly to PayPal Sandbox flow.

4. **Phase 5 & 6 — Verification, Documentation & Submission:**
   - Execute automated feature tests verifying 100% pass rate.
   - Finalize production documentation and push to GitHub repository.
