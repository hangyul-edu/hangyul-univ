# Toss Payments — overseas card & USD multi-currency status

> **Superseded (V21, 2026-10-21; current state in REPORT §0.4).** This is the V17 review and is kept as a dated record. Its §4 conclusion that no `bill_*` configuration may buy a plan no longer holds: V21 **measured** that `bill_talkoab1` refuses billing-key issuance but approves `/v1/payments/key-in` in USD, so **plans are bought by foreign-card key-in on MID `bill_talkoab1`** through Hangyul's own card form (card number and expiry relayed by the server to Toss, not stored). Toss still runs in **TEST mode**; live keys and the overseas-card / USD contracts (§7 below) remain owner actions.

**Verified 2026-10-20** · V17, REPORT §152 · owner action required on four items.

This file exists because V17 changes two commercial facts at once — the product is priced in **USD** and
sells to students holding **overseas cards** — and neither is a code change. Both are *contracts*. What
follows separates what was verified from this machine, what the provider's documentation states, and what
only the owner can answer from the merchant admin.

---

## 1 · Status summary

| Item | Status | Basis |
|---|---|---|
| One-time payment MID (KRW) | **WORKING (test)** | `HANGYUL`, client key `test_ck_PBal…`. A KRW 결제창 renders and the secret key authenticates against the live test API (REPORT §142) |
| Foreign-card contract | **UNKNOWN — OWNER ACTION REQUIRED** | Requires merchant-admin or a sales confirmation. Not visible from the API with the supplied keys |
| Overseas-card card-company review | **UNKNOWN — OWNER ACTION REQUIRED** | Same. Toss states the review runs 10–14 business days *after* contract registration |
| USD multi-currency contract | **NOT IN PLACE** (evidenced) | A USD `requestPayment` on the supplied MID opens the window and **fails** — see §3 |
| USD settlement MID | **DOES NOT EXIST** | Toss: *"하나의 MID는 하나의 통화만 가질 수 있어요."* A USD MID is a different MID from `HANGYUL` |
| Live keys | **NOT ISSUED** | `HG_TOSS_ENV=test`; all four configurations are `test_` |

**Net effect:** Hangyul can advertise USD today and **cannot charge USD today.** V17's server refuses to open
a live USD checkout until the readiness flags in §5 are all true, and never substitutes a KRW order for a
USD price.

---

## 2 · What the provider's documentation states

Read 2026-10-20 from `docs.tosspayments.com/guides/v2/learn/foreign-payment` and the V2 SDK reference.

1. **Overseas card payment requires a separate contract.** Request it from the customer centre
   (1544-7772 / support@tosspayments.com). Registration completes in about **2 business days**.
2. **An additional card-company review follows registration**, stated as **영업일 10–14일** (10–14 business
   days), before overseas cards can actually be used.
3. **Overseas cards settle in KRW by default.** Multi-currency (USD, JPY …) needs **another separate
   contract**; the supported currencies and terms are a sales-team question.
4. **One MID holds exactly one currency** — *"하나의 MID는 하나의 통화만 가질 수 있어요."* A KRW MID takes
   domestic cards plus overseas cards billed in KRW; a **USD MID** takes overseas cards in USD. Foreign
   currency is configured under 이용서비스 → 외화결제.
5. The `결제창(구버전)` product that Hangyul's `test_ck_…` keys drive exposes `card.useInternationalCardOnly`
   (opens the multilingual overseas-card window) and `card.language` (`KO` / `EN` / `JA` / `ZH`). Its
   `requestPayment` reference states 일반결제 supports **KRW only**.

> **Is an additional review actually necessary?** Yes, per (2) — and it is a *second* review, after the
> contract is registered, not a re-run of the domestic one. It cannot be shortened by anything in this
> repository. Budget **≈ 2 + 10–14 business days** from the day the owner requests the contract.

---

## 3 · What was verified against the live provider

The product's own call was run against the live sandbox with only the currency changed.

| Request | Result |
|---|---|
| `amount: { value: 499000, currency: 'KRW' }` | The real 결제창 renders — All-in-One, 499,000원, 간편결제 and nine card issuers, Toss's own test badge (REPORT §142) |
| `amount: { value: 349, currency: 'USD' }`, `card.useInternationalCardOnly: true` | The window opens and **fails**: `일시적인 오류가 발생했습니다 / 처리 중 오류가 발생했습니다` |

Evidence: `docs/qa/v17/payment/toss-usd-refused-testmid.png`.

This is consistent with §2(4) — a KRW MID is contracted for one currency and USD is not it — rather than a
transient fault. **Sending `currency: 'USD'` from code does not create a USD merchant.**

Accordingly V17 does **not** claim a real Toss USD transaction anywhere. The state machine's USD path is
exercised against the provider boundary with a stub (`server/tests/test_v17_usd_refunds.py`), and that is
labelled as a stub in the report rather than as a provider result.

---

## 4 · Merchant configurations on file

| | MID | Contracted product | Used by plan purchase |
|---|---|---|---|
| D | `HANGYUL` | 일반 결제 (결제창), **KRW** | Yes — and only while `TOSS_USD_*` readiness is false, in which case live checkout is disabled rather than downgraded |
| A | `bill_talko18s0` | 자동결제 — domestic card billing key | **No** |
| B | `bill_talkoab1` | 자동결제 — foreign card billing key | **No** |
| C | `bill_talkspm0` | 자동결제 — easy-pay method registration | **No** |

The three `bill_*` configurations remain outside the purchase path (V16 §135, unchanged). Note that B is a
*billing-key* configuration for foreign cards — it is **not** an overseas one-time payment contract and
cannot substitute for one.

---

## 5 · Server-owned readiness flags

`server/app/core/config.py`. All four must be `true` before a **live** USD checkout can open; any one false
disables it. There is no KRW fallback — see §6.

| Flag | Means |
|---|---|
| `HG_TOSS_FOREIGN_CARD_CONTRACT_READY` | The overseas-card contract is registered with Toss |
| `HG_TOSS_CARD_REVIEW_READY` | The additional card-company review has passed |
| `HG_TOSS_USD_MULTICURRENCY_READY` | The multi-currency contract is in place **and** a USD MID has been issued |
| `HG_TOSS_LIVE_KEYS_READY` | Live `live_ck_` / `live_sk_` keys are configured for that USD MID |

`GET /me/payments/config` reports all four, and `npm run qa:v17` asserts that a live USD checkout is
impossible while any is false.

---

## 6 · Why there is no KRW fallback

If the public page says `$349` and the order is created in won at the day's rate, four things follow: the
student is charged an amount they were never quoted; the refund amount becomes a second FX question; the
difference is a dispute Hangyul loses; and support absorbs it. The brief rules it out and the reasoning is
the product's own. **The correct behaviour when USD is not contracted is to refuse to take the payment**,
which is what the server does.

---

## 7 · What Hangyul must request from Toss

1. **해외카드 결제 계약** for the merchant — and confirmation of the registration date, because the
   10–14 business-day review clock starts from it.
2. **다통화(USD) 결제 계약**, and the **USD MID** that comes with it. Ask explicitly whether USD *settlement*
   is included or only USD *display*; a public comparison lists Toss as KRW-settlement-only, which conflicts
   with the official service page, and only the sales team can resolve it.
3. **The client/secret key pair for that USD MID.** The existing `test_ck_PBal…` belongs to the KRW MID and
   will not work for USD.
4. **Written confirmation of the supported overseas card brands** (VISA / Mastercard / JCB are listed) and
   of whether `useInternationalCardOnly` is enabled on the contract.

Until 1–3 are answered, every row in §1 marked UNKNOWN stays UNKNOWN in this file. Nothing in this
repository can change that, and nothing in it pretends otherwise.
