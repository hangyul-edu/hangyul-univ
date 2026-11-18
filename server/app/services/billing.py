"""Toss Payments **billing-key rail** — the only way this product takes real money.

Owner decision (final product pass, non-negotiable): every real purchase goes

    payment-method registration  →  billing key  →  ONE server-side charge  →  PAID  →  entitlement

Hangyul's products remain one-time purchases. A billing key is a payment-method token; nothing in this
module, or anywhere else in the server, schedules, renews or repeats a charge. There is no ordinary
payment rail to fall back to: no ``/v1/payments/confirm``, no 결제창 ``requestPayment`` and no raw-card
key-in. A method whose merchant cannot do billing is *unavailable*, never rerouted.

## What this module is

* ``merchants()`` — the three owner-provided 자동결제 configurations, one per kind of method.
* ``availability()`` — whether a kind may be offered right now, and the exact reason when it may not.
* ``BillingClient`` — the five Toss calls the product needs, each authenticated with the merchant's
  secret key: issue a billing key from the hosted registration's ``authKey``, charge it, delete it,
  look a payment up, cancel (refund) a payment.
* small helpers that keep credentials where they belong: opaque customer keys, the sealed billing
  key, its fingerprint.

## The rules it exists to keep

1. **Secrets never leave the server**, and are never logged: ``Authorization`` is built per request
   and no exception message carries a request body, an ``authKey`` or a billing key.
2. **Card data never reaches Hangyul.** Registration happens in Toss's hosted window; what comes back
   is Toss's own masked echo, of which only the brand, issuer and last four digits are kept.
3. **The amount is the server's.** ``charge`` takes the order's stored minor units.
4. **A billing key is not a payment.** Issuing one changes nothing about any order.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import re
import secrets
from dataclasses import dataclass

import httpx

from app.core import crypto
from app.core.config import Settings, get_settings
from app.services.payments import NotConfigured, ProviderError, sanitize

# --------------------------------------------------------------------------------------------- vocabulary

DOMESTIC_CARD = "DOMESTIC_CARD"
FOREIGN_CARD = "FOREIGN_CARD"
TOSS_PAY = "TOSS_PAY"
NAVER_PAY = "NAVER_PAY"
METHOD_KINDS = (DOMESTIC_CARD, FOREIGN_CARD, TOSS_PAY, NAVER_PAY)

#: kind → (merchant settings prefix, capability setting)
_KIND_MERCHANT = {
    DOMESTIC_CARD: ("domestic", "toss_capability_domestic_card"),
    FOREIGN_CARD: ("foreign", "toss_capability_foreign_card"),
    TOSS_PAY: ("easypay", "toss_capability_toss_pay"),
    NAVER_PAY: ("easypay", "toss_capability_naver_pay"),
}

#: The MIDs the owner contracted, by merchant. A live deployment configured with anything else is a
#: deployment pointed at somebody else's merchant, and the release gate refuses it.
EXPECTED_LIVE_MIDS = {"domestic": "bill_talko18s0", "foreign": "bill_talkoab1", "easypay": "bill_talkspm0"}

#: The order's payment state machine. ``Order.status`` stays the coarse commercial fact.
PAYMENT_STATES = (
    "PENDING",                  # created, nothing decided yet (demo provider / legacy rows)
    "PAYMENT_METHOD_REQUIRED",  # the student has no usable saved method for this order
    "BILLING_AUTH_PENDING",     # the hosted registration window is open
    "BILLING_KEY_READY",        # a usable method exists; nothing has been charged
    "CHARGING",                 # a charge was sent and its outcome is not yet known here
    "PAID",                     # one successful charge — the only state that activates anything
    "FAILED",                   # the last charge attempt was refused; the order can be retried
    "CANCELLED",
    "REFUNDED",
    "PARTIALLY_REFUNDED",
)

#: Toss documents up to 60 s for a billing approval. Timing out early is how a charge gets made twice.
APPROVAL_TIMEOUT = 65.0

#: How long a hosted registration may take before its return is refused.
REGISTRATION_TTL_SECONDS = 30 * 60

SDK_URL = "https://js.tosspayments.com/v2/standard"

#: Toss's `requestBillingAuth` method per kind. The v2 SDK documents exactly two: 신용·체크카드 (CARD)
#: and 계좌이체. It documents **no** registration method for Toss Pay or Naver Pay, so those kinds have
#: no entry here and stay unavailable until Toss supplies the integration contract for the easy-pay
#: billing MID — the alternative would be inventing an API.
_BILLING_AUTH_METHOD = {DOMESTIC_CARD: "CARD", FOREIGN_CARD: "CARD"}

_CAPABILITY_VALUES = ("UNVERIFIED", "VERIFIED", "BLOCKED")


@dataclass(frozen=True)
class Merchant:
    """One owner-provided 자동결제 configuration. ``repr`` never shows a key."""

    key: str                 # domestic | foreign | easypay
    mid: str | None
    client_key: str | None
    secret_key: str | None
    security_key: str | None
    currency: str

    @property
    def configured(self) -> bool:
        return bool(self.mid and self.client_key and self.secret_key)

    @property
    def is_test_keyed(self) -> bool:
        return (self.secret_key or "").startswith("test_") or (self.client_key or "").startswith("test_")

    @property
    def is_live_keyed(self) -> bool:
        return (self.secret_key or "").startswith("live_") and (self.client_key or "").startswith("live_")

    def __repr__(self) -> str:  # noqa: D105
        return f"Merchant(key={self.key!r}, mid={self.mid!r}, currency={self.currency!r}, configured={self.configured})"

    __str__ = __repr__


def merchant(key: str, s: Settings | None = None) -> Merchant:
    s = s or get_settings()
    return Merchant(
        key=key,
        mid=getattr(s, f"toss_{key}_billing_mid"),
        client_key=getattr(s, f"toss_{key}_billing_client_key"),
        secret_key=getattr(s, f"toss_{key}_billing_secret_key"),
        security_key=getattr(s, f"toss_{key}_billing_security_key"),
        currency=(getattr(s, f"toss_{key}_billing_currency") or "").upper(),
    )


def merchants(s: Settings | None = None) -> list[Merchant]:
    return [merchant(k, s) for k in ("domestic", "foreign", "easypay")]


def merchant_for_kind(kind: str, s: Settings | None = None) -> Merchant:
    if kind not in _KIND_MERCHANT:
        raise ValueError(f"unknown payment method kind: {kind}")
    return merchant(_KIND_MERCHANT[kind][0], s)


def merchant_by_mid(mid: str | None, s: Settings | None = None) -> Merchant | None:
    return next((m for m in merchants(s) if m.mid and m.mid == mid), None)


def capability(kind: str, s: Settings | None = None) -> str:
    s = s or get_settings()
    value = (getattr(s, _KIND_MERCHANT[kind][1]) or "UNVERIFIED").upper()
    return value if value in _CAPABILITY_VALUES else "UNVERIFIED"


# --------------------------------------------------------------------------------------------- availability

@dataclass(frozen=True)
class Availability:
    kind: str
    available: bool
    #: Why not, as a stable code. ``None`` when available.
    reason: str | None
    currency: str | None
    mode: str  # test | live


def availability(kind: str, *, currency: str | None = None, s: Settings | None = None) -> Availability:
    """May this kind of payment method be offered — for registration, and for an order in ``currency``?

    The order of the checks is the order in which a person would have to fix them.
    """
    s = s or get_settings()
    m = merchant_for_kind(kind, s)
    mode = "live" if s.toss_env == "live" else "test"

    def no(reason: str) -> Availability:
        return Availability(kind, False, reason, m.currency or None, mode)

    if s.payment_provider != "toss":
        return no("PROVIDER_NOT_TOSS")
    if not m.configured:
        return no("NOT_CONFIGURED")
    if not crypto.configured():
        # A billing key that cannot be sealed is one this product does not accept.
        return no("ENCRYPTION_NOT_CONFIGURED")
    if mode == "live":
        # Live means live keys, and nothing else: a `test_` key under HG_TOSS_ENV=live would take real
        # orders that are never charged.
        if not m.is_live_keyed:
            return no("MODE_MISMATCH")
        if not s.live_payment_enabled:
            return no("LIVE_PAYMENT_DISABLED")
    elif not m.is_test_keyed:
        # …and test means test keys. A live key under HG_TOSS_ENV=test would charge real money from a
        # build everybody believes is a sandbox.
        return no("MODE_MISMATCH")
    cap = capability(kind, s)
    if cap == "BLOCKED":
        return no("PROVIDER_CAPABILITY_BLOCKED")
    if kind not in _BILLING_AUTH_METHOD:
        return no("PROVIDER_SPEC_REQUIRED")
    if mode == "live" and cap != "VERIFIED":
        return no("CAPABILITY_UNVERIFIED")
    if currency and m.currency != currency.upper():
        return no("CURRENCY_MISMATCH")
    return Availability(kind, True, None, m.currency, mode)


def available_kinds(*, currency: str | None = None, s: Settings | None = None) -> list[str]:
    return [k for k in METHOD_KINDS if availability(k, currency=currency, s=s).available]


def production_violations(s: Settings) -> list[str]:
    """Why a production process configured for Toss may not start. Empty when it may."""
    out: list[str] = []
    if s.toss_env != "live":
        out.append("HG_TOSS_ENV must be live in production.")
    configured = [m for m in merchants(s) if m.mid or m.client_key or m.secret_key]
    if not any(m.configured for m in configured):
        out.append("No Toss billing merchant is configured (HG_TOSS_*_BILLING_MID / CLIENT_KEY / SECRET_KEY).")
    for m in configured:
        name = f"HG_TOSS_{m.key.upper()}_BILLING"
        if not m.configured:
            out.append(f"{name}_MID, _CLIENT_KEY and _SECRET_KEY must be set together.")
            continue
        if m.is_test_keyed or not m.is_live_keyed:
            out.append(f"{name} uses a key that is not a live key.")
        if m.mid != EXPECTED_LIVE_MIDS[m.key]:
            out.append(f"{name}_MID is not the contracted live MID for this merchant.")
        if not m.security_key:
            out.append(f"{name}_SECURITY_KEY is required in production (webhook verification).")
    if not _envelope_key_valid(s):
        out.append("HG_PAYMENT_TOKEN_ENCRYPTION_KEY (32 bytes, base64url) is required to store billing keys.")
    return out


def _envelope_key_valid(s: Settings) -> bool:
    """The billing-key envelope key, judged from *these* settings (not the process-wide cached ones)."""
    import os

    raw = os.environ.get(crypto.ENV_KEY) or s.payment_token_encryption_key or ""
    try:
        return len(base64.urlsafe_b64decode(raw + "=" * (-len(raw) % 4))) == 32 if raw else False
    except ValueError:
        return False


# --------------------------------------------------------------------------------------------- credentials

_CUSTOMER_KEY_RE = re.compile(r"^[A-Za-z0-9\-_=.@]{22,50}$")


def new_customer_key() -> str:
    """An opaque Toss ``customerKey``: 43 characters of CSPRNG output behind a fixed prefix.

    Toss requires 22–50 characters of ``[A-Za-z0-9-_=.@]`` with at least one special character; the
    prefix's underscore guarantees the last part. It is derived from nothing — not the e-mail, not the
    phone number, not the user id.
    """
    key = "hgc_" + secrets.token_urlsafe(32)
    assert _CUSTOMER_KEY_RE.match(key)
    return key


def fingerprint(billing_key: str) -> str:
    """A keyed digest of a billing key, for matching without decrypting. Useless without the envelope key."""
    raw = crypto._raw(crypto.ENV_KEY)  # noqa: SLF001 - the same key material that seals the credential
    if not raw:
        raise crypto.EncryptionNotConfigured("HG_PAYMENT_TOKEN_ENCRYPTION_KEY is not set.")
    return hmac.new(raw.encode("utf-8"), b"billing-key-fingerprint:" + billing_key.encode("utf-8"), hashlib.sha256).hexdigest()


# --------------------------------------------------------------------------------------------- provider results

@dataclass(frozen=True)
class IssuedKey:
    """What a successful billing-key issuance leaves behind. ``billing_key`` is sealed by the caller at once."""

    billing_key: str
    mid: str | None
    method: str | None
    last4: str | None
    brand: str | None
    issuer_code: str | None
    acquirer_code: str | None
    card_type: str | None
    owner_type: str | None
    easy_pay_provider: str | None

    def __repr__(self) -> str:  # noqa: D105 - never let a traceback print a credential
        return f"IssuedKey(mid={self.mid!r}, method={self.method!r}, last4={self.last4!r}, billing_key=<redacted>)"

    __str__ = __repr__


@dataclass(frozen=True)
class Charge:
    """The provider's view of one payment — all of it safe to store and to show."""

    payment_key: str | None
    provider_order_id: str | None
    status: str               # Toss status: DONE · CANCELED · PARTIAL_CANCELED · ABORTED · EXPIRED · …
    amount_minor: int
    balance_minor: int | None
    currency: str
    method: str | None
    approved_at: str | None
    receipt_url: str | None
    failure_code: str | None
    raw: dict

    @property
    def paid(self) -> bool:
        return self.status == "DONE"


#: Currencies Toss handles in whole units rather than in minor units.
_MAJOR_UNIT = {"KRW", "JPY", "VND"}


def to_provider_amount(amount_minor: int, currency: str) -> float | int:
    if currency.upper() in _MAJOR_UNIT:
        return amount_minor
    return round(amount_minor / 100, 2)


def from_provider_amount(total, currency: str) -> int:
    if total is None:
        return 0
    if currency.upper() in _MAJOR_UNIT:
        return int(total)
    return int(round(float(total) * 100))


def _last4(masked: str | None) -> str | None:
    """The last four *digits* of Toss's masked echo (`########****###*` — the final character may be `*`)."""
    digits = re.sub(r"\D", "", masked or "")
    return digits[-4:] if len(digits) >= 4 else None


def _brand(masked: str | None) -> str | None:
    """The network, from the first digit of the provider's masked echo. Nothing more is inferable."""
    return {"4": "Visa", "5": "Mastercard", "3": "Amex/JCB", "6": "Discover/UnionPay", "9": "Local"}.get((masked or " ")[0])


# --------------------------------------------------------------------------------------------- the client

class BillingClient:
    """The Toss calls for one merchant. The secret is held privately and appears in no message."""

    def __init__(self, m: Merchant, *, api_base: str | None = None):
        if not m.configured:
            raise NotConfigured(f"Toss billing merchant '{m.key}' is not configured.")
        self.merchant = m
        self._secret = m.secret_key or ""
        self.api_base = (api_base or get_settings().toss_api_base).rstrip("/")

    # -- transport ------------------------------------------------------------------------------
    def _headers(self, idempotency_key: str | None = None) -> dict:
        # Toss uses the secret as a Basic username with an empty password; the colon is required.
        h = {
            "Authorization": "Basic " + base64.b64encode(f"{self._secret}:".encode()).decode("ascii"),
            "Content-Type": "application/json",
        }
        if idempotency_key:
            # Honoured on every POST for 15 days, judged by (key, API key, URL, method); max 300 chars.
            h["Idempotency-Key"] = idempotency_key[:300]
        return h

    def _request(self, method: str, path: str, *, json: dict | None = None, idempotency_key: str | None = None,
                 timeout: float = 30.0) -> httpx.Response:
        try:
            return httpx.request(method, f"{self.api_base}{path}", headers=self._headers(idempotency_key),
                                 json=json, timeout=timeout)
        except httpx.HTTPError as exc:
            # `exc` can carry the request (and with it the Authorization header and the path, which may
            # contain a billing key). Only the class name is propagated.
            raise ProviderError("NETWORK", f"Could not reach the payment provider ({type(exc).__name__}).") from None

    @staticmethod
    def _json(r: httpx.Response) -> dict:
        try:
            body = r.json()
        except ValueError:
            raise ProviderError("BAD_RESPONSE", f"The payment provider returned {r.status_code}.") from None
        return body if isinstance(body, dict) else {}

    def _ok(self, r: httpx.Response, fallback: str) -> dict:
        body = self._json(r)
        if r.status_code >= 400:
            err = ProviderError(str(body.get("code") or "UNKNOWN"), str(body.get("message") or fallback))
            err.http_status = r.status_code
            raise err
        return body

    # -- 1 · billing key from the hosted registration ------------------------------------------
    def issue(self, *, auth_key: str, customer_key: str) -> IssuedKey:
        """``POST /v1/billing/authorizations/issue`` — exchange the one-time ``authKey`` for a billing key."""
        body = self._ok(self._request("POST", "/v1/billing/authorizations/issue",
                                      json={"authKey": auth_key, "customerKey": customer_key},
                                      timeout=APPROVAL_TIMEOUT), "The payment method could not be registered.")
        key = body.get("billingKey")
        if not key:
            raise ProviderError("NO_BILLING_KEY", "The provider did not return a payment-method credential.")
        if body.get("customerKey") and body["customerKey"] != customer_key:
            raise ProviderError("NOT_MATCHES_CUSTOMER_KEY", "The registration does not belong to this customer.")
        card = body.get("card") or {}
        masked = card.get("number") or body.get("cardNumber")
        easy = body.get("easyPay") if isinstance(body.get("easyPay"), dict) else {}
        return IssuedKey(
            billing_key=key, mid=body.get("mId"), method=body.get("method"),
            last4=_last4(masked), brand=_brand(masked),
            issuer_code=card.get("issuerCode"), acquirer_code=card.get("acquirerCode"),
            card_type=card.get("cardType"), owner_type=card.get("ownerType"),
            easy_pay_provider=easy.get("provider"),
        )

    # -- 2 · one charge ------------------------------------------------------------------------
    def charge(self, *, billing_key: str, customer_key: str, provider_order_id: str, amount_minor: int,
               currency: str, order_name: str, idempotency_key: str,
               customer_email: str | None = None, customer_name: str | None = None) -> Charge:
        """``POST /v1/billing/{billingKey}`` — charge the order amount once.

        The merchant settles exactly one currency, so a currency that is not the merchant's is refused
        here rather than sent: Toss would either reject it or, worse, read the number in its own unit.
        ``currency`` is put on the wire only for a non-KRW (multi-currency) merchant; the KRW contracts
        take a bare ``amount``.
        """
        if currency.upper() != self.merchant.currency:
            raise ProviderError("CURRENCY_MISMATCH", "This payment method cannot be charged in the order's currency.")
        body: dict = {
            "customerKey": customer_key,
            "amount": to_provider_amount(amount_minor, currency),
            "orderId": provider_order_id,
            "orderName": order_name[:100],
        }
        if currency.upper() != "KRW":
            body["currency"] = currency.upper()
        if customer_email:
            body["customerEmail"] = customer_email[:100]
        if customer_name:
            body["customerName"] = customer_name[:100]
        r = self._request("POST", f"/v1/billing/{billing_key}", json=body,
                          idempotency_key=idempotency_key, timeout=APPROVAL_TIMEOUT)
        return self._charge(self._ok(r, "The payment was not approved."))

    # -- 3 · delete the credential -------------------------------------------------------------
    def revoke(self, *, billing_key: str) -> bool:
        """``DELETE /v1/billing/{billingKey}``. ``True`` if it is gone now, ``False`` if it already was."""
        r = self._request("DELETE", f"/v1/billing/{billing_key}")
        if r.status_code in (200, 204):
            return True
        if r.status_code == 404:
            return False
        body = self._json(r)
        raise ProviderError(str(body.get("code") or "UNKNOWN"), str(body.get("message") or "The payment method could not be removed."))

    # -- 4 · reconciliation --------------------------------------------------------------------
    def lookup_order(self, *, provider_order_id: str) -> Charge | None:
        """What Toss recorded for this attempt, or ``None`` if it never created a payment for it."""
        r = self._request("GET", f"/v1/payments/orders/{provider_order_id}", timeout=20.0)
        if r.status_code == 404:
            return None
        return self._charge(self._ok(r, "The payment could not be looked up."))

    def lookup_payment(self, *, payment_key: str) -> Charge | None:
        r = self._request("GET", f"/v1/payments/{payment_key}", timeout=20.0)
        if r.status_code == 404:
            return None
        return self._charge(self._ok(r, "The payment could not be looked up."))

    def probe_auth(self) -> tuple[int, str | None]:
        """Does this secret authenticate? A lookup of an order that cannot exist: 404 means yes."""
        r = self._request("GET", f"/v1/payments/orders/hg-probe-{secrets.token_hex(8)}", timeout=20.0)
        body = self._json(r) if r.content else {}
        return r.status_code, (str(body.get("code")) if body.get("code") else None)

    # -- 5 · refund ----------------------------------------------------------------------------
    def cancel(self, *, payment_key: str, reason: str, amount_minor: int | None, currency: str,
               idempotency_key: str) -> Charge:
        """``POST /v1/payments/{paymentKey}/cancel`` — a full (``amount_minor=None``) or partial refund.

        This method does not decide how much. The amount is the caller's, and the caller gets it from a
        person: Hangyul has no approved refund schedule and a payment adapter is no place to invent one.
        """
        body: dict = {"cancelReason": reason[:200]}
        if amount_minor is not None:
            body["cancelAmount"] = to_provider_amount(amount_minor, currency)
            if currency.upper() != "KRW":
                body["currency"] = currency.upper()
        r = self._request("POST", f"/v1/payments/{payment_key}/cancel", json=body, idempotency_key=idempotency_key)
        return self._charge(self._ok(r, "The refund was not accepted."))

    # -- shaping -------------------------------------------------------------------------------
    @staticmethod
    def _charge(body: dict) -> Charge:
        currency = str(body.get("currency") or "KRW").upper()
        fail = body.get("failure") if isinstance(body.get("failure"), dict) else {}
        balance = body.get("balanceAmount")
        return Charge(
            payment_key=body.get("paymentKey"),
            provider_order_id=body.get("orderId"),
            status=str(body.get("status") or "UNKNOWN"),
            amount_minor=from_provider_amount(body.get("totalAmount"), currency),
            balance_minor=from_provider_amount(balance, currency) if balance is not None else None,
            currency=currency,
            method=body.get("method"),
            approved_at=body.get("approvedAt"),
            receipt_url=(body.get("receipt") or {}).get("url") if isinstance(body.get("receipt"), dict) else None,
            failure_code=str(fail.get("code")) if fail.get("code") else None,
            raw={**sanitize(body), "mId": body.get("mId")},
        )


def client_for_kind(kind: str) -> BillingClient:
    return BillingClient(merchant_for_kind(kind))


def client_for_mid(mid: str | None) -> BillingClient:
    m = merchant_by_mid(mid)
    if m is None:
        raise NotConfigured("The merchant that took this payment is not configured on this server.")
    return BillingClient(m)


# --------------------------------------------------------------------------------------------- failures

#: Provider code → the customer-facing category. The raw code is audited server-side; the browser gets the
#: category and renders a sentence a student can act on.
FAILURE_CATEGORIES = {
    # registration
    "PAY_PROCESS_CANCELED": "AUTH_CANCELLED", "USER_CANCEL": "AUTH_CANCELLED", "USER_CANCELED": "AUTH_CANCELLED",
    "PAY_PROCESS_ABORTED": "AUTH_FAILED", "INVALID_AUTHORIZE_AUTH": "AUTH_FAILED", "EXPIRED_AUTH_KEY": "AUTH_FAILED",
    "INVALID_AUTH_KEY": "AUTH_FAILED", "NOT_FOUND_AUTH_KEY": "AUTH_FAILED", "REGISTRATION_EXPIRED": "AUTH_FAILED",
    "NO_BILLING_KEY": "KEY_ISSUE_FAILED", "NOT_MATCHES_CUSTOMER_KEY": "KEY_ISSUE_FAILED",
    "INVALID_BILL_KEY_REQUEST": "KEY_ISSUE_FAILED", "NOT_REGISTERED_BUSINESS": "METHOD_UNAVAILABLE",
    # capability / contract
    "NOT_SUPPORTED_METHOD": "METHOD_UNAVAILABLE", "NOT_SUPPORTED_CARD_TYPE": "METHOD_UNAVAILABLE",
    "NOT_AVAILABLE_PAYMENT": "METHOD_UNAVAILABLE", "FORBIDDEN_REQUEST": "METHOD_UNAVAILABLE",
    "UNAUTHORIZED_KEY": "METHOD_UNAVAILABLE", "INVALID_API_KEY": "METHOD_UNAVAILABLE",
    "NOT_ALLOWED_POINT_USE": "METHOD_UNAVAILABLE", "INVALID_CARD_COMPANY": "METHOD_UNAVAILABLE",
    "BELOW_MINIMUM_AMOUNT": "METHOD_UNAVAILABLE", "CURRENCY_MISMATCH": "CURRENCY_MISMATCH",
    "INVALID_CURRENCY": "CURRENCY_MISMATCH", "NOT_SUPPORTED_CURRENCY": "CURRENCY_MISMATCH",
    # the card said no
    "REJECT_CARD_COMPANY": "CARD_DECLINED", "INVALID_REJECT_CARD": "CARD_DECLINED", "REJECT_CARD_PAYMENT": "CARD_DECLINED",
    "RESTRICTED_CARD": "CARD_DECLINED", "INVALID_CARD_NUMBER": "CARD_DECLINED",
    "REJECT_ACCOUNT_PAYMENT": "INSUFFICIENT_FUNDS", "NOT_ENOUGH_BALANCE": "INSUFFICIENT_FUNDS",
    "EXCEED_MAX_AMOUNT": "LIMIT_EXCEEDED", "EXCEED_MAX_PAYMENT_AMOUNT": "LIMIT_EXCEEDED",
    "EXCEED_MAX_DAILY_PAYMENT_COUNT": "LIMIT_EXCEEDED", "EXCEED_MAX_ONE_DAY_AMOUNT": "LIMIT_EXCEEDED",
    "EXCEED_MAX_MONTHLY_PAYMENT_AMOUNT": "LIMIT_EXCEEDED", "EXCEED_MAX_CARD_INSTALLMENT_PLAN": "LIMIT_EXCEEDED",
    "INVALID_CARD_EXPIRATION": "EXPIRED_CARD",
    "INVALID_STOPPED_CARD": "SUSPENDED_CARD", "INVALID_CARD_LOST_OR_STOLEN": "SUSPENDED_CARD",
    "NOT_REGISTERED_CARD_COMPANY": "SUSPENDED_CARD",
    # not the student's fault, try again
    "NETWORK": "PROVIDER_TEMPORARY", "BAD_RESPONSE": "PROVIDER_TEMPORARY", "PROVIDER_ERROR": "PROVIDER_TEMPORARY",
    "FAILED_INTERNAL_SYSTEM_PROCESSING": "PROVIDER_TEMPORARY", "FAILED_CARD_COMPANY_RESPONSE": "PROVIDER_TEMPORARY",
    "FAILED_DB_PROCESSING": "PROVIDER_TEMPORARY", "CARD_PROCESSING_ERROR": "PROVIDER_TEMPORARY",
    "UNKNOWN_PAYMENT_ERROR": "PROVIDER_TEMPORARY", "UNKNOWN": "PROVIDER_TEMPORARY",
    # asked twice
    "IDEMPOTENT_REQUEST_PROCESSING": "DUPLICATE_REQUEST", "DUPLICATED_ORDER_ID": "DUPLICATE_REQUEST",
    "ALREADY_PROCESSED_PAYMENT": "DUPLICATE_REQUEST",
}


def failure_category(code: str | None) -> str:
    return FAILURE_CATEGORIES.get(code or "", "PAYMENT_FAILED")


#: Codes that say the *merchant* cannot do this, not that this card was refused. They are an operations
#: alert and a reason to stop offering the method — never a reason to try a different rail.
CAPABILITY_CODES = {"NOT_SUPPORTED_METHOD", "FORBIDDEN_REQUEST", "UNAUTHORIZED_KEY", "INVALID_API_KEY",
                    "NOT_REGISTERED_BUSINESS", "NOT_AVAILABLE_PAYMENT", "NOT_SUPPORTED_CARD_TYPE",
                    "INVALID_CURRENCY", "NOT_SUPPORTED_CURRENCY"}

#: Outcomes of a charge call that leave it unknown whether money moved. The order stays CHARGING and is
#: resolved by asking Toss, never by guessing.
INDETERMINATE_CODES = {"NETWORK", "BAD_RESPONSE", "IDEMPOTENT_REQUEST_PROCESSING"}


# --------------------------------------------------------------------------------------------- webhooks

def verify_webhook_signature(*, body: bytes, signature_header: str | None, transmission_time: str | None,
                             s: Settings | None = None) -> bool | None:
    """Check ``tosspayments-webhook-signature`` against every configured merchant.

    ``None`` when the delivery carries no signature (Toss does not sign every event type) — which is why
    the handler never acts on a body: it treats every delivery as a prompt to ask Toss with the secret
    key. ``True``/``False`` when a signature is present.
    """
    if not signature_header or not transmission_time:
        return None
    given: list[bytes] = []
    for part in signature_header.split(","):
        part = part.strip()
        if part.startswith("v1:"):
            try:
                given.append(base64.b64decode(part[3:] + "=" * (-len(part[3:]) % 4)))
            except ValueError:
                continue
    if not given:
        return False
    message = body + b":" + transmission_time.encode("utf-8")
    for m in merchants(s):
        for key in (m.security_key, m.secret_key):
            if not key:
                continue
            digest = hmac.new(key.encode("utf-8"), message, hashlib.sha256).digest()
            if any(hmac.compare_digest(digest, g) for g in given):
                return True
    return False
