# PayPilot AI — API Integration & Testing Evidence (Sanitized)

> **Sanitization Notice:** In compliance with hackathon submission guidelines, all live client secrets, access tokens, webhook signing keys, internal credentials, and customer personal email addresses have been redacted or replaced with synthetic equivalents (`***REDACTED***`). All transaction IDs, PayPal order IDs, and automated test outputs represent genuine executed runs against the PayPal Sandbox and local test environments.
>
> **Video Demonstration Showcase:** This document features the primary live recovery demonstration showcased in the official submission video: **Order #PP-H08F2IBJ (Opportunity #17)**, scored at **98/100**, analyzed by **Gemini 3.1 Flash Lite**, and settled via PayPal Capture **#87533940633031840**.

---

## 1. Video Submission Showcase Case Study: Order #PP-H08F2IBJ (Opportunity #17)

### A. Telemetry & Scoring Overview
- **Order Identifier:** `#PP-H08F2IBJ` (Opportunity ID `#17`)
- **Cart Total:** `$147.00 USD` (2 Line Items: Wireless Headphones & Phone Case)
- **Status:** `Recovered & Paid` (Strategy: `FRESH_CHECKOUT`)
- **Recovery Priority Score:** `98 / 100` (`critical Priority`)
- **Drop-off Recency:** Detected 1 hour ago
- **Autonomous Reasoning Engine:** Google Gemini 3.1 Flash Lite (Confidence: `85%`)

### B. 4-Stage Autonomous Recovery Lifecycle
1. **Stage 1 (Detected):** Cart Abandoned during PayPal authorization step.
2. **Stage 2 (Analyzed):** Gemini 3.1 Flash Lite extracts behavioral telemetry.
3. **Stage 3 (Approved):** Zero-Trust Merchant Gate authorizes recovery intervention.
4. **Stage 4 (Settled):** PayPal Capture `#87533940633031840` executes server-side.

### C. Signal Vectors & Heuristic Score Breakdown (Score: 98/100)
- `Base Score`: 50
- `Cart Value Tier`: `high` ($147.00 USD) -> `+15 pts`
- `Drop-off Recency`: 1 hour elapsed (high intent window) -> `+25 pts`
- `Payment History`: 1 recorded transient attempt -> `+10 pts`
- `Merchant Historical Recovery Rate`: 100% -> `+10 pts`
- `Total Calculated Priority`: **98 / 100 (critical Priority)**

### D. Gemini 3.1 Flash Lite Autonomous Behavioral Diagnostic
- **Confidence:** `85%`
- **Root Cause Attribution:**
  > *"The customer abandoned a $147.00 order during the PayPal authorization step one hour ago. This indicates a high-intent buyer who likely encountered a technical friction point or second-guessed the payment method."*
- **Behavioral Reasoning:**
  > *"The drop-off occurred at the final payment authorization stage, which is a classic indicator of 'payment friction' rather than lack of interest. Since the user reached the checkout stage with multiple items, the intent to purchase is high. The single attempt suggests a transient issue, making this a prime candidate for a gentle recovery nudge."*
- **Recommended Recovery Strategy:**
  > *"Send a personalized recovery email immediately to capitalize on the one-hour window, emphasizing that their items are reserved and offering assistance with the PayPal checkout process."*

### E. Dynamically Bound Customer Payment Reminder Draft
- **Channel:** Email (287 characters)
- **Recipient:** `customer@paypilot.demo`
- **Subject:** `Complete your checkout for order #PP-H08F2IBJ`
- **Body:**
  > *"Hi there! We noticed you had a little trouble completing your order for your new headphones and phone case. We've saved your cart for you, and you can pick up right where you left off here: [RECOVERY_LINK]. If you're having any issues with PayPal, please let us know—we're happy to help!"*
- **Dynamic Binding:** The `[RECOVERY_LINK]` placeholder was dynamically bound to verified PayPal Sandbox session `7FC634873S0216408`.

### F. Application-Level Audit Event Timeline (4 Immutable Events)
```
1. RECOVERY_DETECTED       [AI_AGENT]        Nov 11, 11:19:19 PM
   AI Recovery Agent flagged Order #PP-H08F2IBJ for recovery (Score: 98, Strategy: FRESH_CHECKOUT).

2. RECOVERY_APPROVED       [MERCHANT_ACTION] Nov 11, 11:19:48 PM
   Merchant approved recovery intervention for Order #PP-H08F2IBJ.

3. CHECKOUT_PREPARED       [PAYPAL_API]      Nov 11, 11:20:03 PM
   Fresh PayPal recovery session 7FC634873S0216408 prepared.

4. RECOVERY_SETTLED        [AI_AGENT]        Nov 11, 11:20:23 PM
   Revenue successfully recovered via genuine PayPal Capture #87533940633031840.
```

---

## 2. PayPal REST API v2 Integration Evidence

### A. OAuth 2.0 Server Authentication
- **Endpoint:** `POST https://api-m.sandbox.paypal.com/v1/oauth2/token`
- **Request Body:** `grant_type=client_credentials`
- **Response (Sanitized):**
```json
{
  "scope": "https://uri.paypal.com/services/invoicing https://uri.paypal.com/services/payments/realtimepayment https://uri.paypal.com/services/payments/payment/authcapture openid",
  "access_token": "A21AAK_***REDACTED_ACCESS_TOKEN***_cW94",
  "token_type": "Bearer",
  "app_id": "APP-5GR90667DK539853T",
  "expires_in": 32400
}
```

### B. Recovery Order Creation (`intent: CAPTURE`)
- **Endpoint:** `POST https://api-m.sandbox.paypal.com/v2/checkout/orders`
- **Order ID Generated:** `7FC634873S0216408`
- **Gross Amount:** `$147.00 USD` (itemized: 2 wireless headphones @ $45.00, 1 phone case @ $57.00)

### C. Live Server Capture Settlement
- **Capture ID:** `87533940633031840`
- **Status:** `COMPLETED`
- **Gross Settlement:** `$147.00 USD`
- **Multi-Currency Equivalent:** `₱8,719.78 PHP` (BCMath scale 4, half-up rounding)
- **Seller Protection:** `ELIGIBLE`
- **PayPal Fee:** `$5.11 USD`
- **Net Receivable:** `$141.89 USD`

---

## 3. Automated Test Suite Execution Evidence

### Test Summary:
- **Framework:** PHPUnit 12.5.43 / PHP 8.4
- **Total Tests:** 24
- **Total Assertions:** 117
- **Passed:** 24 (100%)
- **Failed:** 0
- **Duration:** 9.30 seconds

```
 ✔ The application returns a successful response
 ✔ That true is true
 ✔ Rejects tampered or mismatched payment amount on capture
 ✔ Idempotent capture returns cached success without duplicate processing
 ✔ Multi attempt ledger increments attempt number and records idempotency key
 ✔ Tenant isolation prevents capturing another merchant order
 ✔ Ai order catalog price resolution overrides untrusted prompt prices
 ✔ Buyer checkout cancellation marks abandoned and payment failed
 ✔ Missing credentials throws clear configuration error
 ✔ Invalid credentials throws clear authentication error
 ✔ Order creation throws exception on paypal error without silent simulation
 ✔ Genuine paypal capture sets is simulated false and marks order paid
 ✔ Simulated captures do not increment genuine recovered revenue
 ✔ Reconciliation queries paypal api and syncs completed state
 ✔ Network timeout during capture transitions to requires reconciliation
 ✔ Currency mismatch during capture is rejected
 ✔ Unapproved recovery checkout is strictly blocked
 ✔ Cross merchant recovery opportunity access is blocked
 ✔ Scan identifies unrecovered dropoffs and scores recovery potential
 ✔ Merchant can approve opportunity and record audit trail
 ✔ Merchant can reject opportunity
 ✔ Launch recovery checkout creates paypal order with recovery flag
 ✔ Capturing paypal order reconciles active recovery opportunity to recovered
 ✔ Recovery metrics endpoint aggregates deterministic pipeline totals
```

---

## 4. End-to-End System & Live Auditor Verification

### A. Independent Auditor Verification (9 Checks)
```
Operation                           | External API Called?            | HTTP | Result
-------------------------------------------------------------------------------------
PayPal OAuth2 Token Request         | YES (api-m.sandbox.paypal.com)  | 200  | PASS
PayPal v2 Order Creation            | YES (api-m.sandbox.paypal.com)  | 201  | PASS
PayPal v2 Order Inquiry             | YES (api-m.sandbox.paypal.com)  | 200  | PASS
Capture Unapproved Order (Advers.)  | YES (api-m.sandbox.paypal.com)  | 422  | PASS (REJECTED)
Concurrent In-Flight Lock Protection| NO (Local Backend/DB)           | 409  | PASS
Idempotent Second Capture Call      | NO (Local Backend/DB)           | 200  | PASS
Analytics Revenue Segregation       | NO (Local Backend/DB)           | 200  | PASS
Unapproved Recovery Checkout Block  | NO (Local Backend/DB)           | 422  | PASS
Approved Recovery PayPal v2 Session | YES (api-m.sandbox.paypal.com)  | 200  | PASS
```

### B. E2E System Audit Run
- **Total Checks:** 36 / 36 Assertions
- **Pass Rate:** 100%
- **BCMath Precision:** Verified across USD, EUR, JPY, BHD, KWD, and PHP with zero floating-point drift.
