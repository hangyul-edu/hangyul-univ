"""Canonical forms of the two identifiers Hangyul verifies (V22, REPORT §244 R2/R6).

Email: trimmed, Unicode-normalised, lower-cased as a whole. RFC 5321 lets a mailbox be case-sensitive; in
practice no provider students use is, and the product has lower-cased on login since V2, so the canonical form is
the one that already keys `users.email`.

Phone: parsed with `phonenumbers` against the chosen region and stored **only** as E.164. The display format is
the client's concern; the stored value is what Twilio, a university or an embassy can dial.
"""
from __future__ import annotations

import hashlib
import re
import unicodedata

import phonenumbers
from phonenumbers import NumberParseException, PhoneNumberType

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]{2,}$")


class IdentityError(ValueError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


def normalize_email(raw: str) -> str:
    v = unicodedata.normalize("NFKC", (raw or "")).strip().lower()
    if not v or not _EMAIL_RE.match(v) or ".." in v.split("@", 1)[0]:
        raise IdentityError("EMAIL_INVALID", "Enter a valid email address.")
    return v


def mask_email(email: str) -> str:
    local, _, domain = email.partition("@")
    keep = local[:2] if len(local) > 3 else local[:1]
    return f"{keep}{'•' * max(2, len(local) - len(keep))}@{domain}"


def normalize_phone(raw: str, region: str | None) -> str:
    """`raw` may be a local number for `region` or a full international number. Returns E.164 or raises."""
    text = unicodedata.normalize("NFKC", (raw or "")).strip()
    # Fullwidth plus and the "00" international prefix are what mobile keyboards actually produce.
    text = text.replace("＋", "+")
    if text.startswith("00"):
        text = "+" + text[2:]
    if not text:
        raise IdentityError("PHONE_INVALID", "Enter a mobile number.")
    try:
        num = phonenumbers.parse(text, (region or "").upper() or None)
    except NumberParseException as exc:
        raise IdentityError("PHONE_INVALID", "Enter a valid mobile number.") from exc
    if not phonenumbers.is_valid_number(num):
        raise IdentityError("PHONE_INVALID", "Enter a valid mobile number.")
    kind = phonenumbers.number_type(num)
    if kind not in (PhoneNumberType.MOBILE, PhoneNumberType.FIXED_LINE_OR_MOBILE, PhoneNumberType.UNKNOWN):
        raise IdentityError("PHONE_NOT_MOBILE", "Enter a mobile number that can receive text messages.")
    return phonenumbers.format_number(num, phonenumbers.PhoneNumberFormat.E164)


def mask_phone(e164: str) -> str:
    return f"{e164[:-6]}{'•' * 4}{e164[-2:]}" if len(e164) > 8 else "•" * len(e164)


def phone_region(e164: str) -> str | None:
    try:
        return phonenumbers.region_code_for_number(phonenumbers.parse(e164, None))
    except NumberParseException:
        return None


def target_hash(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()
