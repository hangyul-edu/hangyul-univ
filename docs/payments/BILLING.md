# Payments — billing-key rail

Canonical description of how Hangyul Univ takes money. Supersedes `TOSS_FOREIGN_CARD_REVIEW.md` (a dated V17/V21
record of the retired one-time and key-in routes, kept for history only).

No key of any kind appears in this file, and none may be added.

## 1. Owner decision

| | |
|---|---|
| Commercial model | **One-time purchases.** Plans and add-ons are bought once. No subscription, no renewal date, no scheduler. |
| Payment rail | **Billing key only.** Every real purchase is: register a payment method → Toss issues a billing key → the server charges that key **once** for the order amount → the order is PAID → the entitlement switches on. |
| Fallback | **None.** There is no `/v1/payments/confirm`, no 결제창 `requestPayment`, no raw-card key-in anywhere in the server or the apps. A method whose merchant cannot do billing is unavailable; it is never rerouted. |
| Upgrades | Still refused (`UPGRADE_POLICY_REQUIRED`) until the owner approves an upgrade pricing rule. |
| Refunds | Technically available (Toss cancel API against the billing charge's payment). **No refund schedule is approved**, so the amount is always entered by a person in Operations; students cannot name their own refund. |

A billing key is a payment-method token. It is charged only when its owner presses pay on a specific order.

## 2. Merchants

| Method (customer wording) | Kind | Merchant | Live MID | Settles |
|---|---|---|---|---|
| Korean card | `DOMESTIC_CARD` | domestic | `bill_talko18s0` | `HG_TOSS_DOMESTIC_BILLING_CURRENCY` (default KRW) |
| International card | `FOREIGN_CARD` | foreign | `bill_talkoab1` | `HG_TOSS_FOREIGN_BILLING_CURRENCY` (default USD) |
| Toss Pay / Naver Pay | `TOSS_PAY` / `NAVER_PAY` | easypay | `bill_talkspm0` | `HG_TOSS_EASYPAY_BILLING_CURRENCY` (default KRW) |

One MID settles one currency (Toss: "하나의 MID는 하나의 통화만 가질 수 있어요"). An order is charged only on a
merchant whose currency equals the order's own. Nothing is converted, and no price is invented.

## 3. Flow and state machine

```
POST /me/orders                               server prices the order           PAYMENT_METHOD_REQUIRED | BILLING_KEY_READY
POST /me/payment-methods/registrations        returns SDK url + client key + opaque customerKey   BILLING_AUTH_PENDING
   browser → Toss hosted registration (requestBillingAuth) → /services/payment-methods/return?authKey&customerKey
POST …/registrations/{id}/complete            server: POST /v1/billing/authorizations/issue, seals the key   BILLING_KEY_READY
POST /me/orders/{id}/pay                      server: POST /v1/billing/{billingKey} once          CHARGING → PAID | FAILED
```

`Order.status` stays the coarse fact (PENDING / PAID / FAILED / CANCELLED / REFUNDED); `Order.payment_state` is
one of `PENDING, PAYMENT_METHOD_REQUIRED, BILLING_AUTH_PENDING, BILLING_KEY_READY, CHARGING, PAID, FAILED,
CANCELLED, REFUNDED, PARTIALLY_REFUNDED`. **Issuing a billing key never activates anything; only a charge Toss
reports as DONE for exactly the stored amount and currency does.**

Rules enforced in `server/app/api/v1/billing.py` (tests: `server/tests/test_v33_billing.py`):

- **Amount.** The server derives plan, price, currency and catalogue version. The browser echoes the amount it
  displayed; a mismatch is refused (`AMOUNT_MISMATCH`) before the provider is asked. The figure charged is always
  the order's.
- **Consent.** `pay` requires `one_time_confirmed`; the screen shows service, amount, currency, "one-time payment",
  the selected method and the refund-terms link next to the button.
- **Idempotency / exactly once.** Row lock on the order; `CHARGING` committed *before* the network call; one
  provider order id (`<order hex>-<attempt>`) and one `Idempotency-Key` (`hg-charge-<order>-<attempt>`) per attempt;
  any attempt with an unknown outcome is settled by asking Toss before a new attempt is allowed. Double-click,
  reload, retry, timeout and worker retry converge on one charge and one entitlement.
- **Unknown outcome.** A timeout marks nothing: the order stays `CHARGING`, the client is told to wait (202), and
  the next request, the receipt poll (`GET /me/orders/{id}`), `/me/services`, the webhook or the worker sweep
  (`reconcile_all`) asks Toss.
- **Webhook** `POST /api/v1/payments/webhooks/toss`: deduplicated by body hash, signature checked when present
  (`tosspayments-webhook-signature`), and used only as a prompt to query Toss with the merchant's secret key. An
  event for a payment this server never started is recorded as `UNKNOWN_PAYMENT` and raises an ops event.
  `BILLING_DELETED` closes the saved method.
- **Deleting a method** deletes the billing key at Toss (`DELETE /v1/billing/{billingKey}`) and then locally; a
  revoked row has no ciphertext and cannot be charged.
- **Refund** `POST /api/v1/agency/orders/{id}/refund` (Operations): Toss cancel against the charge's payment key on
  the merchant that charged it; full or partial; refund-derived idempotency key; a full refund ends the engagement.

## 4. Credentials

- `customerKey`: `hgc_` + 43 characters of CSPRNG output, one per user (`payment_customers`), derived from nothing.
- Billing key: AES-256-GCM (`app/core/crypto.py`, `HG_PAYMENT_TOKEN_ENCRYPTION_KEY`), bound to the owning user id;
  never returned by any API, never logged. A keyed fingerprint allows matching without decryption.
- Secret and security keys: server environment / secret store only. The **client** key reaches a browser only from
  the registration endpoint, for the one merchant being registered with.
- Card data: never reaches Hangyul. There is no card form; registration happens on Toss's hosted page. Only the
  network, issuer code and last four digits echoed by Toss are stored.
- Logs: the redaction filter masks `Authorization`, Basic credentials, Toss key shapes, `authKey`, `billingKey`,
  `customerKey`, card-shaped numbers and the billing-key path segment; `httpx` request logging is raised to WARNING.

## 5. Modes and gates

| Setting | Meaning |
|---|---|
| `HG_TOSS_ENV=test\|live` | Never inferred. `test` requires `test_` keys, `live` requires `live_` keys; a mismatch makes the method unavailable (`MODE_MISMATCH`) — live never falls back to test. |
| `HG_LIVE_PAYMENT_ENABLED` | Master switch for charging real money. Live keys alone do not charge. |
| `HG_TOSS_CAPABILITY_<METHOD>` | `UNVERIFIED \| VERIFIED \| BLOCKED`. A live method is offered only when `VERIFIED`. |
| `HG_ENV=production` | Refuses to start with Toss unless env is live, every configured merchant has live keys, the contracted MID and a security key, and the envelope key exists. |

Tools:

- `npm run payments:probe` — per merchant, without charging: does the secret authenticate, and does the merchant
  accept a billing-key issuance request (a deliberately invalid `authKey`). Prints MIDs, HTTP statuses and Toss
  error codes only.
- `npm run release:payment-gate` — the public-launch gate. Fails on a test key in production config, live payment
  disabled, a missing expected live MID, missing capability verification, a secret in a browser bundle, or any
  non-billing payment call in the server.

**Setting a capability to VERIFIED** requires, on the production payment host, one controlled real transaction for
that method: registration → billing key issued → sealed credential stored → the smallest real catalogue amount
charged once → payment visible as LIVE in the Toss merchant console → order PAID → one entitlement → optional
refund. Record the non-secret evidence (date, MID, order reference, Toss status) in §6.

## 6. Live capability results

**Status 2026-11-28 (re-measured): no live capability is verified, and nothing is live.**

Measured on 2026-11-28, without charging:

- The production `/api` (Vercel rewrite → ngrok tunnel) answers from a server reporting `HG_ENV=development`
  (`/healthz` → `{"ok":true,"env":"development"}`) on a development machine — not a production payment host. The
  production start-up gate (live keys, contracted MIDs, envelope key) applies only under `HG_ENV=production`.
- On the release machine: `npm run payments:probe` → every method `PROVIDER_NOT_TOSS` (no Toss configuration);
  `npm run release:payment-gate` → **FAIL** (provider `demo`, `HG_TOSS_ENV` not live, no merchant configured, no
  `HG_PAYMENT_TOKEN_ENCRYPTION_KEY`, none of the three live MIDs configured, `HG_LIVE_PAYMENT_ENABLED` off, no
  `VERIFIED` capability). Its bundle-secret and non-billing-call checks found nothing.
- `server/tests/test_v33_billing.py` + `test_v17_usd_refunds.py`: **49 passed** (provider mocked): exactly-once
  charge and entitlement under double click, reload, timeout and unknown outcome; amount and consent checks;
  sealed keys; foreign `customerKey` refused; easy-pay refused by name; refunds.

Toss documentation read 2026-11-28 (`/guides/v2/billing/integration`, `/guides/v2/billing`, `/reference`,
`/guides/v2/learn/foreign-payment`, `/guides/v2/webhook`, `/reference/using-api/webhook-events`):

- "현재 자동결제 결제수단은 국내에서 발급한 카드만 지원합니다. 해외카드, 해외결제는 지원하지 않습니다."
- "네이버페이, 토스페이는 자동결제(빌링)를 지원해요. 단, 사용하려면 별도 심사가 필요해요." — the registration method for
  them is not in the public docs.
- `POST /v1/billing/{billingKey}` has **no currency field**: a billing charge settles in the MID's currency.
  "하나의 MID는 하나의 통화만 가질 수 있어요"; foreign multi-currency needs a separate contract.
- "자동결제는 리스크 검토 및 추가 계약 후 사용할 수 있습니다. **정기 구독형 서비스가 아니라면 정책적으로 자동결제 사용이
  제한되니 유의하세요.**" — the owner's model (one-time purchases charged through a billing key) must be accepted by
  Toss in the merchant contract. This is the first question for Toss.
- Billing approvals send **no** completion webhook (the server already settles every charge synchronously or by
  querying Toss); `BILLING_DELETED` is the billing webhook. Webhooks are registered per MID in the 개발자센터.

| Method | Live MID | Code | Provider contract | Live config | Live charge | Status |
|---|---|---|---|---|---|---|
| Korean card | `bill_talko18s0` | done | Korean-issued cards documented; billing for a one-time model needs Toss's acceptance; the MID settles KRW and the catalogue is **USD only** → `CURRENCY_MISMATCH` until KRW prices or a USD contract | not installed on any measured host | not done | **IMPLEMENTED, TEST ONLY** |
| International card | `bill_talkoab1` | done | Toss billing does not support overseas cards; no special contract has been shown | not installed | not done | **`PROVIDER_CONTRACT_BLOCKED`** |
| Toss Pay | `bill_talkspm0` | refused by design (`PROVIDER_SPEC_REQUIRED`) | supported only after Toss's separate screening; method spec not public | not installed | not done | **`PROVIDER_CONTRACT_BLOCKED`** |
| Naver Pay | `bill_talkspm0` | refused by design (`PROVIDER_SPEC_REQUIRED`) | same as Toss Pay | not installed | not done | **`PROVIDER_CONTRACT_BLOCKED`** |

"Test only" means the code path is proven with the provider mocked; no Toss test-key run was made from this machine.

## 7. What must happen before real customers are charged

1. Stand up the production payment backend (HTTPS, durable host, production PostgreSQL with backups, secret store,
   monitoring); run `npm run db:migrate` (migration `v33billing0001`).
2. Install the three live merchant configurations and `HG_PAYMENT_TOKEN_ENCRYPTION_KEY` into that host's secret
   store. Register the webhook URL in each Toss merchant console.
3. `npm run payments:probe` → record results in §6.
4. Decide KRW pricing (or confirm the settlement currency of the KRW MIDs) — otherwise only a USD-settling
   merchant can take an order.
5. Ask Toss, per MID: is billing approved for one-time purchases (policy restricts billing to subscriptions)?
   Does `bill_talkoab1` have any billing route for overseas cards? Screening and the integration spec for Toss Pay /
   Naver Pay billing on `bill_talkspm0`.
6. Per method: the controlled live transaction in §5, then `HG_TOSS_CAPABILITY_<METHOD>=VERIFIED`.
7. `HG_LIVE_PAYMENT_ENABLED=true`, then `npm run release:payment-gate` must pass.
8. Owner/counsel: refund schedule; upgrade pricing rule.
