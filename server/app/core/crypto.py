"""Application-level authenticated encryption for stored payment credentials (V21, brief §32).

**What this is for.** The owner wants Hangyul to hold a reusable payment credential. A payment
credential in a database column is a credential one SQL injection, one leaked backup or one over-broad
read replica away from being someone else's. Column-level AES-256-GCM means the database alone is not
enough: an attacker needs the ciphertext *and* a key that lives only in the server's environment.

**Why GCM and not Fernet/CBC.** The threat here is not only confidentiality, it is substitution — an
attacker who can write to the column should not be able to swap one student's credential for another's.
GCM authenticates, and the *associated data* binds the ciphertext to the row it belongs to: decrypting
a credential under a different `student_id` fails rather than returning the wrong card.

**Key handling.** `HG_PAYMENT_TOKEN_ENCRYPTION_KEY` is 32 bytes, base64url, from the environment and
nowhere else — never a default, never a file in the tree, never derived from another secret. The stored
`key_version` is what makes rotation possible without a migration: a new key is added as version 2,
new writes use it, old rows decrypt under version 1 until they are re-wrapped.

Nothing in this module logs, and nothing in it returns plaintext in an exception message.
"""

from __future__ import annotations

import base64
import os
from dataclasses import dataclass

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

#: Env var holding the current key. Additional versions are `…_V2`, `…_V3`, and so on.
ENV_KEY = "HG_PAYMENT_TOKEN_ENCRYPTION_KEY"
CURRENT_VERSION = 1


class EncryptionNotConfigured(RuntimeError):
    """Raised instead of silently storing a credential in the clear."""


class DecryptionFailed(RuntimeError):
    """Wrong key, wrong row, or tampered ciphertext — the three are deliberately indistinguishable."""


@dataclass(frozen=True)
class Sealed:
    """What goes in the database: the ciphertext and the key version that can open it."""
    ciphertext: str
    key_version: int


def _raw(name: str) -> str:
    """The key material, from the process environment or from `server/.env` via settings.

    Both, because the two are used in different places: a container sets the real variable, while
    local development and the test suite load `server/.env` through pydantic-settings and never export
    it. Reading only one of them is how `foreign_billing_test_ready` silently stays false on a machine
    where the key is in fact configured.
    """
    from_env = os.environ.get(name)
    if from_env:
        return from_env
    if name != ENV_KEY:
        return ""
    from app.core.config import get_settings  # local import: config imports this module lazily too

    return get_settings().payment_token_encryption_key or ""


def _key(version: int) -> bytes:
    name = ENV_KEY if version == CURRENT_VERSION else f"{ENV_KEY}_V{version}"
    raw = _raw(name)
    if not raw:
        raise EncryptionNotConfigured(
            f"{name} is not set. A payment credential may not be stored without it."
        )
    try:
        key = base64.urlsafe_b64decode(raw + "=" * (-len(raw) % 4))
    except Exception:  # noqa: BLE001 - the value is a secret; do not echo it
        raise EncryptionNotConfigured(f"{name} is not valid base64url.") from None
    if len(key) != 32:
        raise EncryptionNotConfigured(f"{name} must decode to 32 bytes (AES-256), got {len(key)}.")
    return key


def configured() -> bool:
    """True when a credential *could* be stored. Used by readiness, never to decide whether to store."""
    try:
        _key(CURRENT_VERSION)
    except EncryptionNotConfigured:
        return False
    return True


def generate_key() -> str:
    """A fresh key, for `server/.env`. Printed by an operator, never by the application."""
    return base64.urlsafe_b64encode(os.urandom(32)).decode("ascii").rstrip("=")


def seal(plaintext: str, *, aad: str) -> Sealed:
    """Encrypt, binding the result to `aad` — in practice the row's own student id.

    The nonce is 12 random bytes prepended to the ciphertext, which is the standard GCM layout and
    means a row carries everything needed to open it except the key.
    """
    if not plaintext:
        raise ValueError("refusing to seal an empty credential")
    nonce = os.urandom(12)
    blob = AESGCM(_key(CURRENT_VERSION)).encrypt(nonce, plaintext.encode("utf-8"), aad.encode("utf-8"))
    return Sealed(base64.urlsafe_b64encode(nonce + blob).decode("ascii"), CURRENT_VERSION)


def open_sealed(ciphertext: str, *, key_version: int, aad: str) -> str:
    """Decrypt. Raises `DecryptionFailed` for a wrong key, a wrong `aad` or a modified ciphertext."""
    try:
        raw = base64.urlsafe_b64decode(ciphertext + "=" * (-len(ciphertext) % 4))
        nonce, blob = raw[:12], raw[12:]
        return AESGCM(_key(key_version)).decrypt(nonce, blob, aad.encode("utf-8")).decode("utf-8")
    except (InvalidTag, ValueError, IndexError):
        raise DecryptionFailed("the stored credential could not be opened") from None


# ------------------------------------------------------------------ V29: staff MFA secrets (same AES-256-GCM envelope)
#
# A TOTP secret is a credential like a payment token, so it is sealed the same way — but under its **own** key,
# `HG_MFA_ENCRYPTION_KEY`: rotating or losing the payment key must not lock every staff member out, and a leak of
# one key must not open the other's column. Production refuses to start without it (`config.v29_production_violations`).
# Development and test derive a throwaway key from the JWT secret (HKDF), so a fresh checkout can enrol without
# configuration; that derivation is refused in production.

MFA_ENV_KEY = "HG_MFA_ENCRYPTION_KEY"


def _mfa_key() -> bytes:
    from app.core.config import get_settings

    s = get_settings()
    raw = os.environ.get(MFA_ENV_KEY) or s.mfa_encryption_key or ""
    if raw:
        try:
            key = base64.urlsafe_b64decode(raw + "=" * (-len(raw) % 4))
        except Exception:  # noqa: BLE001 - never echo the value
            raise EncryptionNotConfigured(f"{MFA_ENV_KEY} is not valid base64url.") from None
        if len(key) != 32:
            raise EncryptionNotConfigured(f"{MFA_ENV_KEY} must decode to 32 bytes (AES-256).")
        return key
    if s.is_production:
        raise EncryptionNotConfigured(f"{MFA_ENV_KEY} is not set. An MFA secret may not be stored without it.")
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.kdf.hkdf import HKDF

    return HKDF(algorithm=hashes.SHA256(), length=32, salt=b"hangyul-dev-mfa", info=b"v29-mfa").derive(s.jwt_secret.encode())


def seal_mfa_secret(secret: str, *, user_id: str) -> Sealed:
    nonce = os.urandom(12)
    blob = AESGCM(_mfa_key()).encrypt(nonce, secret.encode("utf-8"), f"mfa:{user_id}".encode())
    return Sealed(base64.urlsafe_b64encode(nonce + blob).decode("ascii"), CURRENT_VERSION)


def open_mfa_secret(ciphertext: str, *, user_id: str) -> str:
    try:
        raw = base64.urlsafe_b64decode(ciphertext + "=" * (-len(ciphertext) % 4))
        return AESGCM(_mfa_key()).decrypt(raw[:12], raw[12:], f"mfa:{user_id}".encode()).decode("utf-8")
    except (InvalidTag, ValueError, IndexError):
        raise DecryptionFailed("the stored MFA secret could not be opened") from None
