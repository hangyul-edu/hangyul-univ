"""Payment provider abstraction.

Real money is taken on exactly one rail: Toss Payments **billing keys** (`app/services/billing.py`,
`app/api/v1/billing.py`). This module holds what is shared around it — the provider switch, the two error
types, the development-only demo provider, and `sanitize()`.

There is deliberately no one-time payment adapter here any more: no `/v1/payments/confirm`, no 결제창, no
key-in. The owner's rule is billing-key-only, with no ordinary-payment fallback.

`sanitize()` keeps the handful of fields a human needs to reconcile a payment and drops everything else
Toss returns, including the masked card number — a PAN fragment is still cardholder data.
"""
import secrets
from dataclasses import dataclass
from typing import Protocol

from app.core.config import get_settings


@dataclass
class CheckoutSession:
    provider: str
    provider_ref: str | None
    redirect_url: str | None  # None = completes synchronously (demo) or needs no window (billing)
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


class TossBillingProvider:
    """Marks an order as one the billing-key rail will pay. It opens nothing and approves nothing.

    Creating an order makes no provider call: the order waits in PENDING until
    `POST /me/orders/{id}/pay` charges a registered payment method (`app/api/v1/billing.py`).
    """
    name = "toss"

    def create_checkout(self, *, order_id: str, amount_minor: int, currency: str, description: str,
                        language: str = "EN") -> CheckoutSession:
        return CheckoutSession(provider=self.name, provider_ref=None, redirect_url=None, status="PENDING", client=None)

    def verify(self, provider_ref: str, payload: dict | None = None) -> str:
        """The generic callback cannot move a billing order; only the charge and the reconciler can."""
        return "PENDING"


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


def get_provider() -> PaymentProvider:
    s = get_settings()
    if s.payment_provider == "stripe":
        return StripeProvider(s.stripe_secret_key)
    if s.payment_provider == "toss":
        return TossBillingProvider()
    if s.is_production:
        raise NotConfigured("The demo payment provider cannot be used in production.")
    return DemoProvider()
