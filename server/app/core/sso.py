"""Single sign-on providers for university and agency staff.

OIDC (authorization code + PKCE) is implemented generically and works with any standards-compliant IdP
(Microsoft Entra ID, Google Workspace, Okta, Keycloak, …). SAML 2.0 is defined as an interface only — see docs/SSO.md.

Secrets are never stored in the database: ``OrgSSOConfig.client_secret_ref`` names an environment variable (or a
secret-manager key resolved into the environment at deploy time) that holds the client secret.
"""
from __future__ import annotations

import base64
import hashlib
import os
import secrets
import time
from dataclasses import dataclass
from typing import Protocol
from urllib.parse import urlencode

import httpx
import jwt

HTTP_TIMEOUT = 10.0
_DISCOVERY_CACHE: dict[str, tuple[float, dict]] = {}
_JWKS_CACHE: dict[str, tuple[float, dict]] = {}
CACHE_SECONDS = 3600


class SSOError(Exception):
    """Raised for any failure the user should see as "Sign-in with your organisation failed"."""


@dataclass
class SSOIdentity:
    email: str
    name: str | None
    subject: str
    email_verified: bool


class SSOProvider(Protocol):
    def authorization_url(self, *, redirect_uri: str, state: str, nonce: str, code_challenge: str) -> str: ...

    def complete(self, *, code: str, redirect_uri: str, code_verifier: str, nonce: str) -> SSOIdentity: ...


def pkce_pair() -> tuple[str, str]:
    verifier = secrets.token_urlsafe(64)[:96]
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    return verifier, challenge


def resolve_secret(ref: str | None) -> str | None:
    """Look up a client secret by reference name. Returns None when the deployment has not provided it."""
    if not ref:
        return None
    return os.environ.get(ref)


def _cached_get(url: str, cache: dict) -> dict:
    hit = cache.get(url)
    if hit and time.time() - hit[0] < CACHE_SECONDS:
        return hit[1]
    try:
        r = httpx.get(url, timeout=HTTP_TIMEOUT)
        r.raise_for_status()
        data = r.json()
    except Exception as exc:  # network / JSON errors surface as a generic SSO failure
        raise SSOError(f"Could not reach the identity provider ({url}).") from exc
    cache[url] = (time.time(), data)
    return data


class OIDCProvider:
    def __init__(self, *, issuer: str, client_id: str, client_secret: str | None):
        self.issuer = issuer.rstrip("/")
        self.client_id = client_id
        self.client_secret = client_secret

    @property
    def discovery(self) -> dict:
        doc = _cached_get(f"{self.issuer}/.well-known/openid-configuration", _DISCOVERY_CACHE)
        if doc.get("issuer", "").rstrip("/") != self.issuer:
            raise SSOError("The identity provider's issuer does not match the configured issuer.")
        return doc

    def authorization_url(self, *, redirect_uri: str, state: str, nonce: str, code_challenge: str) -> str:
        q = {
            "response_type": "code", "client_id": self.client_id, "redirect_uri": redirect_uri, "scope": "openid email profile",
            "state": state, "nonce": nonce, "code_challenge": code_challenge, "code_challenge_method": "S256",
        }
        return f"{self.discovery['authorization_endpoint']}?{urlencode(q)}"

    def complete(self, *, code: str, redirect_uri: str, code_verifier: str, nonce: str) -> SSOIdentity:
        form = {"grant_type": "authorization_code", "code": code, "redirect_uri": redirect_uri, "client_id": self.client_id,
                "code_verifier": code_verifier}
        if self.client_secret:
            form["client_secret"] = self.client_secret
        try:
            r = httpx.post(self.discovery["token_endpoint"], data=form, timeout=HTTP_TIMEOUT)
            r.raise_for_status()
            tokens = r.json()
        except SSOError:
            raise
        except Exception as exc:
            raise SSOError("The identity provider rejected the sign-in.") from exc
        id_token = tokens.get("id_token")
        if not id_token:
            raise SSOError("The identity provider did not return an ID token.")
        claims = self.validate_id_token(id_token, nonce=nonce)
        email = (claims.get("email") or claims.get("preferred_username") or "").lower()
        if not email or "@" not in email:
            raise SSOError("The identity provider did not share an email address.")
        return SSOIdentity(email=email, name=claims.get("name"), subject=str(claims["sub"]), email_verified=bool(claims.get("email_verified", True)))

    def validate_id_token(self, token: str, *, nonce: str) -> dict:
        jwks = _cached_get(self.discovery["jwks_uri"], _JWKS_CACHE)
        try:
            header = jwt.get_unverified_header(token)
            key = next((k for k in jwks.get("keys", []) if k.get("kid") == header.get("kid")), None)
            if key is None:
                raise SSOError("Unknown signing key.")
            public = jwt.PyJWK.from_dict(key).key
            claims = jwt.decode(token, public, algorithms=["RS256", "ES256"], audience=self.client_id, issuer=self.discovery["issuer"],
                                options={"require": ["exp", "iat", "sub", "aud", "iss"]}, leeway=60)
        except SSOError:
            raise
        except jwt.PyJWTError as exc:
            raise SSOError("The ID token could not be verified.") from exc
        if not secrets.compare_digest(str(claims.get("nonce", "")), nonce):
            raise SSOError("The sign-in response did not match this request.")
        return claims


class SAMLProvider:
    """Interface placeholder. SAML 2.0 needs a signed-assertion library (e.g. python3-saml / pysaml2), SP metadata and
    certificate management — see docs/SSO.md. Selecting SAML fails clearly instead of pretending to work."""

    def authorization_url(self, **_) -> str:
        raise SSOError("SAML sign-in is not available yet for this organisation.")

    def complete(self, **_) -> SSOIdentity:
        raise SSOError("SAML sign-in is not available yet for this organisation.")


def provider_for(config) -> SSOProvider:
    if config.protocol == "OIDC":
        if not config.client_id:
            raise SSOError("SSO is not fully configured (missing client id).")
        return OIDCProvider(issuer=config.issuer, client_id=config.client_id, client_secret=resolve_secret(config.client_secret_ref))
    return SAMLProvider()
