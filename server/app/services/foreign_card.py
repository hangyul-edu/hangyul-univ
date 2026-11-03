"""Toss Payments **foreign-card key-in** — the adapter the student plan purchase actually uses (V21).

## Why this exists, and why it is not `TossProvider`

`TossProvider` drives 일반 결제 on the `HANGYUL` MID: the browser opens Toss's 결제창, Toss redirects
back, the server confirms. Card data never touches Hangyul, and the MID settles KRW.

This is a different contract. `bill_talkoab1` accepts `POST /v1/payments/key-in` — the card's digits
go to **Hangyul's own form**, to Hangyul's backend, and from there to Toss over a server-to-server
call authenticated with the secret key. Measured against the sandbox (REPORT §229.3) it returns
`status: DONE` and `currency: "USD"` for a plain foreign Visa with no `cardPassword` and no
`customerIdentityNumber`. That is the owner's architecture and Hangyul's product in one call.

## The three rules this module exists to keep

1. **The secret key never leaves the server.** There is no client-side half of this flow at all.
2. **The card is never stored and never logged.** `_Card` holds the digits for the duration of one
   function call; nothing here writes them, returns them, or puts them in an exception. The request
   body is built inline and the only thing that survives is Toss's own masked echo.
3. **The amount is the server's.** The caller passes the Order's stored minor units; nothing from the
   browser reaches Toss.
"""

from __future__ import annotations

import base64
import re
from dataclasses import dataclass

import httpx

from app.core.config import get_settings
from app.services.payments import NotConfigured, ProviderError, sanitize

#: Toss documents 60 s for billing/approval. A card authorisation that is slow is not a card
#: authorisation that failed, and timing out early is how a charge gets made twice.
APPROVAL_TIMEOUT = 65.0

#: Fields Toss may echo that are safe to keep. Everything else about the card is dropped on the floor.
_SAFE_CARD_FIELDS = ("issuerCode", "acquirerCode", "cardType", "ownerType", "number")


@dataclass(frozen=True)
class CardInput:
    """Raw card data, alive for exactly one call.

    `__repr__` and `__str__` are overridden because the default dataclass repr is how a PAN ends up in
    a traceback, a log line and then a log aggregator. There is no code path that prints this object.
    """

    number: str
    expiry_year: str
    expiry_month: str
    holder_name: str | None = None

    def __repr__(self) -> str:  # noqa: D105
        return f"CardInput(number=<redacted {len(self.number)} digits>, exp=**/**, holder=<redacted>)"

    __str__ = __repr__


@dataclass(frozen=True)
class KeyInResult:
    """What a successful charge leaves behind — all of it safe to store and to show."""

    payment_key: str
    status: str
    amount_minor: int
    currency: str
    approved_at: str | None
    receipt_url: str | None
    masked_number: str | None
    last4: str | None
    issuer_code: str | None
    acquirer_code: str | None
    card_type: str | None
    owner_type: str | None
    raw: dict


def _digits(value: str) -> str:
    return re.sub(r"\D", "", value or "")


def configured() -> bool:
    return get_settings().foreign_billing_configured


def enabled() -> bool:
    return get_settings().foreign_billing_enabled


class ForeignCardProvider:
    """The `bill_*` foreign-card configuration. One public method per thing the product does."""

    name = "toss-foreign-key-in"

    def __init__(self) -> None:
        s = get_settings()
        if not s.toss_foreign_billing_secret_key:
            raise NotConfigured("Foreign-card billing is not configured (HG_TOSS_FOREIGN_BILLING_SECRET_KEY).")
        self._secret = s.toss_foreign_billing_secret_key
        self.mid = s.toss_foreign_billing_mid
        self.api_base = s.toss_api_base.rstrip("/")
        self.env = s.toss_env

    def _headers(self, idempotency_key: str | None = None) -> dict:
        # Toss uses the secret as a Basic username with an empty password; the colon is required.
        h = {
            "Authorization": "Basic " + base64.b64encode(f"{self._secret}:".encode()).decode("ascii"),
            "Content-Type": "application/json",
        }
        if idempotency_key:
            h["Idempotency-Key"] = idempotency_key[:300]
        return h

    # -- the charge ----------------------------------------------------------------------------
    def charge(self, *, card: CardInput, order_id: str, amount_minor: int, currency: str,
               order_name: str, idempotency_key: str) -> KeyInResult:
        """Authorise and capture one payment with the card the student just typed.

        `amount_minor` is the Order's stored amount. For USD, Toss's `amount` is a **major-unit**
        decimal (the sandbox returned `totalAmount: 179.0` for `amount: 179`), so cents are converted
        here rather than at the call site, where the unit would be ambiguous.
        """
        body: dict = {
            "amount": _to_provider_amount(amount_minor, currency),
            "currency": currency,
            "orderId": order_id,
            "orderName": order_name[:100],
            "cardNumber": _digits(card.number),
            "cardExpirationYear": _digits(card.expiry_year)[-2:],
            "cardExpirationMonth": _digits(card.expiry_month).zfill(2)[-2:],
        }
        try:
            r = httpx.post(
                f"{self.api_base}/v1/payments/key-in",
                headers=self._headers(idempotency_key=idempotency_key),
                json=body,
                timeout=APPROVAL_TIMEOUT,
            )
        except httpx.HTTPError as exc:  # pragma: no cover - network
            # `exc` can carry the request; its body is the card. Only the class name is propagated.
            raise ProviderError("NETWORK", f"Could not reach the payment provider ({type(exc).__name__}).") from None
        finally:
            body.clear()  # the request dict held the PAN; it does not outlive the call
        return self._result(r)

    # -- the billing-key path, for the day this configuration is contracted for one -----------
    #
    # `POST /v1/billing/authorizations/card` is refused on `bill_talkoab1` today (REPORT §229.2), so
    # nothing calls `charge_with_billing_key` in production yet. It is written, tested and wired
    # because the alternative is discovering the shape of it under time pressure later, and because
    # `pay-with-saved-card` has to have something real to be refusing *on behalf of*.

    def issue_billing_key(self, *, card: CardInput, customer_key: str) -> tuple[str, dict]:
        """Exchange card data for a reusable credential. Returns `(billing_key, safe_card_echo)`."""
        body: dict = {
            "customerKey": customer_key,
            "cardNumber": _digits(card.number),
            "cardExpirationYear": _digits(card.expiry_year)[-2:],
            "cardExpirationMonth": _digits(card.expiry_month).zfill(2)[-2:],
        }
        try:
            r = httpx.post(f"{self.api_base}/v1/billing/authorizations/card",
                           headers=self._headers(), json=body, timeout=APPROVAL_TIMEOUT)
        except httpx.HTTPError as exc:  # pragma: no cover - network
            raise ProviderError("NETWORK", f"Could not reach the payment provider ({type(exc).__name__}).") from None
        finally:
            body.clear()
        data = _json(r)
        if r.status_code >= 400:
            raise ProviderError(str(data.get("code") or "UNKNOWN"), str(data.get("message") or "Card registration failed."))
        key = data.get("billingKey")
        if not key:
            raise ProviderError("NO_BILLING_KEY", "The provider did not return a credential.")
        c = data.get("card") or {}
        return key, {k: c.get(k) for k in _SAFE_CARD_FIELDS}

    def charge_with_billing_key(self, *, billing_key: str, customer_key: str, order_id: str,
                                amount_minor: int, currency: str, order_name: str,
                                idempotency_key: str) -> KeyInResult:
        """Charge a stored credential. The key is a parameter and is never held on the instance."""
        try:
            r = httpx.post(
                f"{self.api_base}/v1/billing/{billing_key}",
                headers=self._headers(idempotency_key=idempotency_key),
                json={
                    "customerKey": customer_key,
                    "amount": _to_provider_amount(amount_minor, currency),
                    "currency": currency,
                    "orderId": order_id,
                    "orderName": order_name[:100],
                },
                timeout=APPROVAL_TIMEOUT,
            )
        except httpx.HTTPError as exc:  # pragma: no cover - network
            raise ProviderError("NETWORK", f"Could not reach the payment provider ({type(exc).__name__}).") from None
        return self._result(r)

    def revoke_billing_key(self, *, billing_key: str) -> bool:
        """Delete the credential at Toss. `True` if it is gone, `False` if it already was."""
        try:
            r = httpx.delete(f"{self.api_base}/v1/billing/{billing_key}", headers=self._headers(), timeout=30.0)
        except httpx.HTTPError as exc:  # pragma: no cover - network
            raise ProviderError("NETWORK", f"Could not reach the payment provider ({type(exc).__name__}).") from None
        if r.status_code in (200, 204):
            return True
        if r.status_code == 404:
            return False
        body = _json(r)
        raise ProviderError(str(body.get("code") or "UNKNOWN"), str(body.get("message") or "Revoke failed."))

    def cancel(self, *, payment_key: str, reason: str, idempotency_key: str | None = None) -> dict:
        try:
            r = httpx.post(
                f"{self.api_base}/v1/payments/{payment_key}/cancel",
                headers=self._headers(idempotency_key=idempotency_key),
                json={"cancelReason": reason[:200]},
                timeout=30.0,
            )
        except httpx.HTTPError as exc:  # pragma: no cover - network
            raise ProviderError("NETWORK", f"Could not reach the payment provider ({type(exc).__name__}).") from None
        body = _json(r)
        if r.status_code >= 400:
            raise ProviderError(str(body.get("code") or "UNKNOWN"), str(body.get("message") or "Cancel failed."))
        return sanitize(body)

    def lookup(self, *, order_id: str) -> KeyInResult | None:
        """What Toss thinks happened to this order — the recovery path when a response is lost."""
        try:
            r = httpx.get(f"{self.api_base}/v1/payments/orders/{order_id}", headers=self._headers(), timeout=20.0)
        except httpx.HTTPError:  # pragma: no cover - network
            return None
        if r.status_code == 404:
            return None
        return self._result(r)

    # -- shaping -------------------------------------------------------------------------------
    def _result(self, r: httpx.Response) -> KeyInResult:
        body = _json(r)
        if r.status_code >= 400:
            raise ProviderError(str(body.get("code") or "UNKNOWN"), str(body.get("message") or "Payment failed."))
        card = body.get("card") or {}
        masked = card.get("number")
        return KeyInResult(
            payment_key=body.get("paymentKey"),
            status=body.get("status"),
            amount_minor=_from_provider_amount(body.get("totalAmount"), body.get("currency") or "USD"),
            currency=body.get("currency") or "USD",
            approved_at=body.get("approvedAt"),
            receipt_url=(body.get("receipt") or {}).get("url"),
            masked_number=masked,
            # Toss masks the middle; the trailing group is the only part that identifies the card to
            # its owner, and it is what every payment UI in the world shows.
            last4=_last4(masked),
            issuer_code=card.get("issuerCode"),
            acquirer_code=card.get("acquirerCode"),
            card_type=card.get("cardType"),
            owner_type=card.get("ownerType"),
            raw=sanitize(body),
        )


def _json(r: httpx.Response) -> dict:
    try:
        return r.json()
    except ValueError:  # pragma: no cover - provider returned non-JSON
        raise ProviderError("BAD_RESPONSE", f"The payment provider returned {r.status_code}.") from None


def _last4(masked: str | None) -> str | None:
    """The last four *digits* of Toss's masked echo, or nothing.

    Toss masks as `########****###*` — the final character can be a `*`, so the last four characters
    are not the last four digits. Taking the digits and then the tail is the difference between
    `•••• 4242` and `•••• 42*`.
    """
    if not masked:
        return None
    digits = _digits(masked)
    return digits[-4:] if len(digits) >= 4 else None


#: Currencies Toss settles in whole units rather than in minor units.
_MAJOR_UNIT = {"KRW", "JPY", "VND"}


def _to_provider_amount(amount_minor: int, currency: str) -> float | int:
    if currency.upper() in _MAJOR_UNIT:
        return amount_minor
    return round(amount_minor / 100, 2)


def _from_provider_amount(total, currency: str) -> int:
    if total is None:
        return 0
    if currency.upper() in _MAJOR_UNIT:
        return int(total)
    return int(round(float(total) * 100))


def get_foreign_card() -> ForeignCardProvider:
    return ForeignCardProvider()
