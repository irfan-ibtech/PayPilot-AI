# PayPilot AI — API Integration & Testing Evidence (Sanitized)

> **Sanitization Notice:** In compliance with hackathon submission guidelines, all live client secrets, access tokens, webhook signing keys, internal credentials, and customer personal email addresses have been redacted or replaced with synthetic equivalents (`***REDACTED***`). All transaction IDs, PayPal order IDs, and automated test outputs represent genuine executed runs against the PayPal Sandbox and local test environments.

---

## 1. PayPal REST API v2 Integration Evidence

### A. OAuth 2.0 Client Authentication (Server-Side)
- **Endpoint:** `POST https://api-m.sandbox.paypal.com/v1/oauth2/token`
- **Headers:**
  - `Authorization: Basic [BASE64_ENCODED_CLIENT_ID_AND_SECRET_REDACTED]`
  - `Content-Type: application/x-www-form-urlencoded`
- **Request Body:** `grant_type=client_credentials`
- **Sanitized Response:**
```json
{
  "scope": "https://uri.paypal.com/services/invoicing https://uri.paypal.com/services/payments/realtimepayment https://uri.paypal.com/services/payments/payment/authcapture openid",
  "access_token": "A21AAK_***REDACTED_ACCESS_TOKEN***_cW94",
  "token_type": "Bearer",
  "app_id": "APP-5GR90667DK539853T",
  "expires_in": 32400,
  "nonce": "2026-11-11T19:23:54Z_***NONCE***"
}
```

---

### B. Genuine Order Creation (`intent: CAPTURE`)
- **Endpoint:** `POST https://api-m.sandbox.paypal.com/v2/checkout/orders`
- **Payload:**
```json
{
  "intent": "CAPTURE",
  "purchase_units": [
    {
      "reference_id": "PP-AUDIT-REC-EAC20615",
      "description": "PayPilot AI Verified Order #PP-FT7YIKED",
      "amount": {
        "currency_code": "USD",
        "value": "69.00",
        "breakdown": {
          "item_total": {
            "currency_code": "USD",
            "value": "69.00"
          }
        }
      },
      "items": [
        {
          "name": "Cloud FinOps Professional Suite",
          "unit_amount": {
            "currency_code": "USD",
            "value": "69.00"
          },
          "quantity": "1",
          "category": "DIGITAL_GOODS"
        }
      ]
    }
  ],
  "application_context": {
    "brand_name": "PayPilot AI Merchant Suite",
    "landing_page": "NO_PREFERENCE",
    "user_action": "PAY_NOW",
    "return_url": "http://127.0.0.1:5173/checkout/success",
    "cancel_url": "http://127.0.0.1:5173/checkout/cancel"
  }
}
```
- **Live Response (Sanitized):**
```json
{
  "id": "8UX81126AK7595001",
  "status": "CREATED",
  "links": [
    {
      "href": "https://api.sandbox.paypal.com/v2/checkout/orders/8UX81126AK7595001",
      "rel": "self",
      "method": "GET"
    },
    {
      "href": "https://www.sandbox.paypal.com/checkoutnow?token=8UX81126AK7595001",
      "rel": "approve",
      "method": "GET"
    },
    {
      "href": "https://api.sandbox.paypal.com/v2/checkout/orders/8UX81126AK7595001/capture",
      "rel": "capture",
      "method": "POST"
    }
  ]
}
```

---

### C. Live Capture & Multi-Currency Settlement
- **Capture ID:** `3FL64688SL0637948`
- **Status:** `COMPLETED`
- **Gross Settlement:** `$69.00 USD`
- **Multi-Currency Equivalent:** `₱4,092.96 PHP` (Calculated using BCMath scale 4, half-up rounding)
- **Seller Protection:** `ELIGIBLE`
- **PayPal Processing Fee:** `$2.40 USD`
- **Net Receivable:** `$66.60 USD`

---

### D. Buyer Checkout Cancellation Telemetry
- **Endpoint:** `POST /api/payments/paypal/{orderId}/cancel`
- **Payload:**
```json
{
  "cancellation_reason": "BUYER_DISMISSED_PAYPAL_MODAL",
  "abandoned_step": "APPROVAL_PROMPT",
  "client_timestamp": "2026-11-11T18:15:00Z"
}
```
- **State Machine Transition:**
  - `orders.status`: `PENDING` -> `ABANDONED`
  - `payments.status`: `PENDING` -> `FAILED`
  - `recovery_opportunities`: Created with initial score `82`, tagged for Gemini diagnostic analysis.

---

## 2. Google Gemini 2.5 Flash Autonomous Diagnostic Evidence

### A. Structured Diagnostic Request Prompt (Extract)
```text
You are the PayPilot AI Financial Recovery Engine.
Analyze the following checkout drop-off event:
Order ID: #PP-FT7YIKED
Order Total: $69.00 USD
Items: Cloud FinOps Professional Suite (Qty: 1)
Drop-off Reason: Card declined by issuing bank (3DS Authentication Timeout).
Customer History: 3 prior successful purchases; VIP tier.
Margin Floor: Maximum allowable recovery incentive is 12%.

Output strictly valid JSON matching the following schema:
{
  "root_cause_analysis": "string",
  "primary_friction_category": "PAYMENT_METHOD_FAILURE | PRICING_RESISTANCE | UX_FRICTION | TECHNICAL_ERROR",
  "recovery_probability_score": 0.00 to 1.00,
  "recommended_incentive_percent": 0 to 12,
  "incentive_justification": "string",
  "personalized_email_subject": "string",
  "personalized_email_body_html": "string",
  "recommended_action": "DISPATCH_INCENTIVIZED_RECOVERY_LINK | NOTIFY_CUSTOMER_SERVICE | SUPPRESS"
}
```

### B. Gemini 2.5 Flash Response (Sanitized)
```json
{
  "root_cause_analysis": "Payment instrument 3DS verification failed due to timeout on issuing bank ACS server. Customer exhibits strong intent and low price sensitivity.",
  "primary_friction_category": "PAYMENT_METHOD_FAILURE",
  "recovery_probability_score": 0.88,
  "recommended_incentive_percent": 8,
  "incentive_justification": "Customer has established loyalty; 8% courtesy concession overcomes checkout frustration while preserving 42% net gross margin.",
  "personalized_email_subject": "Complete your Cloud FinOps setup (8% courtesy credit applied)",
  "personalized_email_body_html": "<p>Hello,</p><p>We noticed your payment couldn't be completed due to a temporary bank verification delay. We have reserved your Cloud FinOps Suite and applied an 8% courtesy discount ($5.52 savings).</p><p><a href=\"https://paypilot.ai/recover/token_***REDACTED***\" style=\"background:#003087;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;\">Complete Checkout with 1-Click PayPal</a></p>",
  "recommended_action": "DISPATCH_INCENTIVIZED_RECOVERY_LINK"
}
```

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
