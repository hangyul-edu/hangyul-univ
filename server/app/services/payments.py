"""Payment provider abstraction. Card data is handled only by provider-hosted checkout; we store references.

V16 made the Toss adapter real (REPORT §135). Three things about this file are deliberate:

* **The browser is never the authority.** `create_checkout` returns what the browser needs to *open* a
  payment window — an order id, the amount the server computed, and the **client** key. It does not return a
  status. Only `confirm()`, which runs here with the secret key, can turn an order into a paid one.
* **One merchant configuration per job.** Toss issues a client key per MID per product and the prefix is the
  product. Hangyul's plans are one-time purchases, so they use the 일반 결제 MID; the three `bill_*` MIDs are
  자동결제 (billing-key registration) and are deliberately unreachable from the purchase path. `billing_configs()`
  exists so the capability can be inspected and tested without a UI that invites misuse.
* **Nothing sensitive is stored.** `sanitize()` keeps the handful of fields a human needs to reconcile a
  payment and drops everything else Toss returns, including the masked card number — a PAN fragment is still
  cardholder data and nothing in this product needs it.
"""
import base64
import secrets
from dataclasses import dataclass
from typing import Protocol

import httpx

from app.core.config import get_settings


@dataclass
class CheckoutSession:
    provider: str
    provider_ref: str
    redirect_url: str | None  # None = completes synchronously (demo)
    status: str
    #: Everything the browser needs to open a provider-hosted window. Public values only.
    client: dict | None = None


@dataclass
class Approval:
    """The result of asking the provider to approve a payment, as this product needs it."""
    status: str                 # PAID | FAILED | CANCELLED | PENDING
    provider_ref: str | None
    amount_minor: int | None
    method: str | None
    approved_at: str | None
    receipt_url: str | None
    raw: dict
    failure: str | None = None  # a provider error code, for mapping to a human sentence


class PaymentProvider(Protocol):
    name: str

    def create_checkout(self, *, order_id: str, amount_minor: int, currency: str, description: str,
                        language: str = "EN") -> CheckoutSession: ...
    def verify(self, provider_ref: str, payload: dict | None = None) -> str: ...


class DemoProvider:
    """Development-only provider: approves immediately and clearly labels the transaction as a demo."""
    name = "demo"

    def create_checkout(self, *, order_id: str, amount_minor: int, currency: str, description: str,
                        language: str = "EN") -> CheckoutSession:
        # `language` is accepted and ignored: the demo provider renders no window, but every caller
        # passes it, and a provider that cannot be swapped in for another is not a provider.
        return CheckoutSession(self.name, f"demo_{secrets.token_hex(8)}", None, "PAID")

    def verify(self, provider_ref: str, payload: dict | None = None) -> str:
        return "PAID" if provider_ref.startswith("demo_") else "FAILED"


class NotConfigured(RuntimeError):
    pass


class ProviderError(RuntimeError):
    """The provider answered, and the answer was a refusal. ``code`` is the provider's own error code."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message
        if code in OPERATIONAL_ERROR_CODES:
            # V29: transport/shape failures are ours to look at; a card refusal is the buyer's and is not an alert.
            from app.services import monitoring

            monitoring.record("PAYMENT_ERROR", "payments.provider", f"payment provider error {code}", detail={"provider_code": code})


#: Provider errors that mean "the integration is unwell", as opposed to a refusal of this particular payment.
OPERATIONAL_ERROR_CODES = {"NETWORK", "BAD_RESPONSE", "UNKNOWN", "PROVIDER_ERROR", "FAILED_INTERNAL_SYSTEM_PROCESSING", "UNAUTHORIZED_KEY"}


class StripeProvider:
    """Stripe Checkout adapter. Requires HG_STRIPE_SECRET_KEY and the `stripe` package; webhooks confirm payment."""
    name = "stripe"

    def __init__(self, secret: str | None):
        if not secret:
            raise NotConfigured("Stripe is not configured (HG_STRIPE_SECRET_KEY).")
        self.secret = secret

    def create_checkout(self, **kw) -> CheckoutSession:  # pragma: no cover - requires live credentials
        raise NotConfigured("Stripe checkout is wired but not enabled in this environment.")

    def verify(self, provider_ref: str, payload: dict | None = None) -> str:  # pragma: no cover
        raise NotConfigured("Stripe verification requires webhook signing secret.")


# --------------------------------------------------------------------------------------------- Toss

#: What is kept out of `Payment.raw`. Toss returns the full card object including a masked PAN; a masked PAN
#: is still cardholder data, and no screen in this product shows one.
_DROP = {"card", "virtualAccount", "mobilePhone", "giftCertificate", "transfer", "cashReceipt", "cashReceipts",
         "easyPay", "metadata", "checkout", "failure", "cancels", "discount"}


class TossProvider:
    """Toss Payments 일반 결제 (one-time), v2 결제창 + ``/v1/payments/confirm``.

    The browser opens the window with the **client** key; this class holds the **secret** key and is the only
    thing that may ask Toss to approve anything. ``Authorization: Basic base64(secret + ":")`` — the colon is
    required, because Toss uses the secret as a username with an empty password.
    """
    name = "toss"

    def __init__(self, *, secret: str | None, client_key: str | None, mid: str | None,
                 api_base: str, return_origin: str, env: str):
        if not secret:
            raise NotConfigured("Toss Payments is not configured (HG_TOSS_NORMAL_SECRET_KEY).")
        if not client_key:
            raise NotConfigured("Toss Payments is not configured (HG_TOSS_NORMAL_CLIENT_KEY).")
        self.secret = secret
        self.client_key = client_key
        self.mid = mid
        self.api_base = api_base.rstrip("/")
        self.return_origin = return_origin.rstrip("/")
        self.env = env

    # -- headers -------------------------------------------------------------------------------------
    def _auth(self) -> str:
        return "Basic " + base64.b64encode(f"{self.secret}:".encode("utf-8")).decode("ascii")

    def _headers(self, idempotency_key: str | None = None) -> dict:
        h = {"Authorization": self._auth(), "Content-Type": "application/json"}
        if idempotency_key:
            # Toss honours this on every POST for 15 days and judges uniqueness by (key, URL, method), so an
            # order-derived key is safe and is what makes a double-submitted confirm return one approval.
            h["Idempotency-Key"] = idempotency_key[:300]
        return h

    # -- checkout ------------------------------------------------------------------------------------
    def create_checkout(self, *, order_id: str, amount_minor: int, currency: str, description: str,
                        language: str = "EN") -> CheckoutSession:
        """No network call. Toss's one-time flow is opened *by the browser*; what the server owes it is the
        order id, the canonical amount and the public client key — and a record that the order is PENDING."""
        return CheckoutSession(
            provider=self.name,
            provider_ref=f"toss_pending_{order_id}",
            redirect_url=None,
            status="PENDING",
            client={
                "sdk": "https://js.tosspayments.com/v2/standard",
                "client_key": self.client_key,
                "customer_key": "ANONYMOUS",
                "order_id": order_id,
                "order_name": description[:100],
                "amount": {"value": amount_minor, "currency": currency},
                "success_url": f"{self.return_origin}/services/payment/success",
                "fail_url": f"{self.return_origin}/services/payment/fail",
                "env": self.env,
                # V17: **overseas cards only** (brief §8). Hangyul's students are not in Korea and do not
                # hold Korean cards, so the window opens in its multilingual overseas-card mode and the
                # domestic card list, 토스페이, 네이버페이, 카카오페이, PAYCO, 계좌이체 and 가상계좌 are
                # never offered. A method the merchant is not contracted for must not be rendered at all.
                "card": {"useInternationalCardOnly": True, "flowMode": "DEFAULT", "useEscrow": False},
                # The window speaks the language the reader is already in, where Toss supports it.
                "language": language,
                "methods": ["CARD"],
            },
        )

    # -- approval ------------------------------------------------------------------------------------
    def confirm(self, *, payment_key: str, order_id: str, amount_minor: int) -> Approval:
        """결제 승인. ``amount_minor`` is the **server's** number, never the one from the redirect."""
        try:
            r = httpx.post(
                f"{self.api_base}/v1/payments/confirm",
                headers=self._headers(idempotency_key=f"hg-confirm-{order_id}"),
                json={"paymentKey": payment_key, "orderId": order_id, "amount": amount_minor},
                timeout=20.0,
            )
        except httpx.HTTPError as exc:  # pragma: no cover - network
            raise ProviderError("NETWORK", str(exc)) from exc
        return self._approval(r)

    def lookup(self, *, order_id: str) -> Approval | None:
        """What Toss thinks the state of this order is. The recovery path: a browser that died after the
        window approved leaves a PENDING order here and a DONE payment there."""
        try:
            r = httpx.get(f"{self.api_base}/v1/payments/orders/{order_id}", headers=self._headers(), timeout=15.0)
        except httpx.HTTPError:  # pragma: no cover - network
            return None
        if r.status_code == 404:
            return None
        return self._approval(r)

    def _approval(self, r: httpx.Response) -> Approval:
        try:
            body = r.json()
        except ValueError:  # pragma: no cover - provider returned non-JSON
            raise ProviderError("BAD_RESPONSE", f"Toss returned {r.status_code}") from None
        if r.status_code >= 400:
            raise ProviderError(str(body.get("code") or "UNKNOWN"), str(body.get("message") or "Payment failed."))
        status = {"DONE": "PAID", "CANCELED": "CANCELLED", "PARTIAL_CANCELED": "CANCELLED",
                  "ABORTED": "FAILED", "EXPIRED": "FAILED"}.get(body.get("status"), "PENDING")
        fail = body.get("failure") or {}
        return Approval(
            status=status,
            provider_ref=body.get("paymentKey"),
            amount_minor=body.get("totalAmount"),
            method=body.get("method"),
            approved_at=body.get("approvedAt"),
            receipt_url=(body.get("receipt") or {}).get("url"),
            raw=sanitize(body),
            failure=str(fail.get("code")) if fail.get("code") else None,
        )

    def cancel(self, *, payment_key: str, reason: str, amount_minor: int | None = None,
               idempotency_key: str | None = None) -> Approval:
        """결제 취소 — a full or partial refund of an approved payment (V17, REPORT §152).

        `amount_minor` omitted cancels the whole payment; supplied, it cancels that much of it. **This
        method does not decide how much** — the amount is the caller's, and the caller gets it from a person
        or from an approved policy, because Hangyul has no approved refund policy yet and inventing one in
        a payment adapter is the worst possible place to put it.

        The idempotency key is the caller's too, derived from the refund record rather than from the order,
        so a second *different* refund on the same order is not silently swallowed as a duplicate of the
        first — which is exactly what an order-derived key would do to a two-stage partial refund.
        """
        body: dict = {"cancelReason": reason[:200]}
        if amount_minor is not None:
            body["cancelAmount"] = amount_minor
        try:
            r = httpx.post(
                f"{self.api_base}/v1/payments/{payment_key}/cancel",
                headers=self._headers(idempotency_key=idempotency_key),
                json=body,
                timeout=30.0,
            )
        except httpx.HTTPError as exc:  # pragma: no cover - network
            raise ProviderError("NETWORK", str(exc)) from exc
        return self._approval(r)

    def verify(self, provider_ref: str, payload: dict | None = None) -> str:
        """The V9 callback contract. Toss's one-time flow confirms through `confirm()`; this exists so the
        generic `/payments/callback/{provider}` endpoint cannot be used to flip an order without asking Toss."""
        try:
            r = httpx.get(f"{self.api_base}/v1/payments/{provider_ref}", headers=self._headers(), timeout=15.0)
        except httpx.HTTPError:  # pragma: no cover - network
            return "PENDING"
        if r.status_code >= 400:
            return "FAILED"
        return self._approval(r).status


def sanitize(body: dict) -> dict:
    """Everything a person needs to reconcile the payment, and nothing that is cardholder data."""
    out = {k: v for k, v in body.items() if k not in _DROP and not isinstance(v, (dict, list))}
    if isinstance(body.get("easyPay"), dict):
        # The brand name only ("토스페이"), which is a method, not an instrument.
        out["easyPayProvider"] = body["easyPay"].get("provider")
    if isinstance(body.get("card"), dict):
        out["cardIssuerCode"] = body["card"].get("issuerCode")
        out["cardInstallment"] = body["card"].get("installmentPlanMonths")
    if isinstance(body.get("receipt"), dict):
        out["receiptUrl"] = body["receipt"].get("url")
    return out


def billing_configs() -> list[dict]:
    """The `bill_*` merchant configurations, **described, not exercised** — except the foreign one.

    **V21 corrects a V16 premise.** This function used to assert that all three were 자동결제
    billing-key registration and that "no plan purchase may use one". Measured against the sandbox
    with the owner's own credentials, `bill_talkoab1` serves `POST /v1/payments/key-in` — a one-time
    foreign-card charge — and settles in USD (REPORT §229.3). It is now the configuration the plan
    purchase uses, and the client key it exposes is still never handed to a browser, because the
    key-in route has no browser half at all.

    The other two remain unused and are listed so `npm run qa:v16` can keep asserting that no browser
    code path reaches their credentials.
    """
    s = get_settings()
    return [
        {"key": "domestic_billing", "mid": s.toss_domestic_billing_mid, "product": "자동결제 (domestic card billing key)",
         "configured": bool(s.toss_domestic_billing_secret_key), "used_by_plan_purchase": False},
        {"key": "foreign_billing", "mid": s.toss_foreign_billing_mid, "product": "해외카드 키인 결제 (/v1/payments/key-in)",
         "configured": bool(s.toss_foreign_billing_secret_key), "used_by_plan_purchase": True},
        {"key": "easypay_billing", "mid": s.toss_easypay_billing_mid, "product": "자동결제 (easy-pay method registration)",
         "configured": bool(s.toss_easypay_billing_secret_key), "used_by_plan_purchase": False},
    ]


def get_toss() -> TossProvider:
    s = get_settings()
    return TossProvider(secret=s.toss_one_time_secret, client_key=s.toss_normal_client_key,
                        mid=s.toss_normal_mid, api_base=s.toss_api_base,
                        return_origin=s.toss_return_origin, env=s.toss_env)


def get_provider() -> PaymentProvider:
    s = get_settings()
    if s.payment_provider == "stripe":
        return StripeProvider(s.stripe_secret_key)
    if s.payment_provider == "toss":
        return get_toss()
    if s.is_production:
        raise NotConfigured("The demo payment provider cannot be used in production.")
    return DemoProvider()
