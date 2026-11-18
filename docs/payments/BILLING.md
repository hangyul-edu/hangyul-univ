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

**Status 2026-11-18: no live capability has been verified.** The live credentials are not installed on any host
this work was done from, there is no production payment host yet (the API runs on a development machine behind a
tunnel), and a live charge needs an owner-approved real payment method. `HG_LIVE_PAYMENT_ENABLED` is therefore off
and every capability is `UNVERIFIED`.

| Method | Live MID | Result | What is known |
|---|---|---|---|
| Korean card | `bill_talko18s0` | **NOT VERIFIED** | Toss v2 documents hosted card billing (`requestBillingAuth`, `method: CARD`). The MID settles KRW by default; the catalogue is priced in **USD only**, so with today's catalogue this method cannot pay any order (`CURRENCY_MISMATCH`) until the owner approves KRW prices or the contract is confirmed to settle USD. |
| International card | `bill_talkoab1` | **NOT VERIFIED** | Toss's billing guide states that billing supports cards issued in Korea only. On 2026-10-21 the **test** configuration of this MID refused billing-key issuance by card number and accepted only key-in. Whether the **live** contract issues billing keys for overseas cards through the hosted window must be confirmed with a live request; if Toss refuses, this method stays unavailable — it is not rerouted to key-in. |
| Toss Pay | `bill_talkspm0` | **BLOCKED — `PROVIDER_SPEC_REQUIRED`** | The v2 SDK documents billing registration for cards and account transfer only; there is no documented registration method for Toss Pay on the Toss Payments billing API. The integration contract for this MID must be obtained from Toss before code can be written against it. |
| Naver Pay | `bill_talkspm0` | **BLOCKED — `PROVIDER_SPEC_REQUIRED`** | Same as Toss Pay. |

Sources read 2026-11-18: `docs.tosspayments.com/guides/v2/billing/integration`, `/reference` (billing endpoints),
`/sdk/v2/js/payment` (`requestBillingAuth`), `/reference/using-api/authorization` (Idempotency-Key),
`/reference/using-api/webhook-events`.

## 7. What must happen before real customers are charged

1. Stand up the production payment backend (HTTPS, durable host, production PostgreSQL with backups, secret store,
   monitoring); run `npm run db:migrate` (migration `v33billing0001`).
2. Install the three live merchant configurations and `HG_PAYMENT_TOKEN_ENCRYPTION_KEY` into that host's secret
   store. Register the webhook URL in each Toss merchant console.
3. `npm run payments:probe` → record results in §6.
4. Decide KRW pricing (or confirm the settlement currency of the KRW MIDs) — otherwise only a USD-settling
   merchant can take an order.
5. Obtain Toss's easy-pay billing integration contract for `bill_talkspm0`.
6. Per method: the controlled live transaction in §5, then `HG_TOSS_CAPABILITY_<METHOD>=VERIFIED`.
7. `HG_LIVE_PAYMENT_ENABLED=true`, then `npm run release:payment-gate` must pass.
8. Owner/counsel: refund schedule; upgrade pricing rule.
