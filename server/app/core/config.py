import base64
import os
from functools import lru_cache
from pathlib import Path
from typing import Any

from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings, PydanticBaseSettingsSource, SettingsConfigDict

SERVER_DIR = Path(__file__).resolve().parents[2]

#: V29 — every setting that holds a credential. Each may instead be supplied as a file path in `<VAR>_FILE`
#: (`HG_JWT_SECRET_FILE=/run/secrets/jwt`), which is how Docker/Kubernetes secrets and secret-manager CSI mounts
#: deliver values without an `.env` on disk. The same list drives the log-redaction filter (`app/core/logs.py`)
#: and the bundle scan (`scripts/ops/scan-bundles-for-secrets.mjs`), so a new secret is added here once.
SECRET_FIELDS: tuple[str, ...] = (
    "database_url", "redis_url", "jwt_secret", "file_url_secret", "stripe_secret_key",
    "toss_normal_secret_key", "toss_normal_security_key", "toss_domestic_billing_secret_key", "toss_domestic_billing_security_key",
    "toss_foreign_billing_secret_key", "toss_foreign_billing_security_key", "toss_easypay_billing_secret_key",
    "toss_easypay_billing_security_key", "toss_secret_key", "payment_token_encryption_key",
    "sendgrid_api_key", "twilio_api_key_secret", "twilio_auth_token", "turnstile_secret_key",
    "mfa_encryption_key", "s3_access_key_id", "s3_secret_access_key", "alert_webhook_url",
)


def _env_names(field_name: str, field: Any) -> list[str]:
    """The variable names a field is read from: `HG_<NAME>`, plus any explicit alias (`SENDGRID_API_KEY`)."""
    alias = getattr(field, "validation_alias", None)
    choices = list(getattr(alias, "choices", []) or ([alias] if isinstance(alias, str) else []))
    return [str(c) for c in choices] or [f"HG_{field_name.upper()}"]


class FileSecretsSource(PydanticBaseSettingsSource):
    """`<VAR>_FILE` → the file's contents (trailing newline stripped). Fails closed: a `_FILE` variable that points at
    a missing, unreadable or empty file stops start-up instead of silently falling back to a default."""

    def get_field_value(self, field, field_name):  # pragma: no cover - required by the ABC; __call__ does the work
        return None, field_name, False

    def __call__(self) -> dict[str, Any]:
        out: dict[str, Any] = {}
        for name in SECRET_FIELDS:
            field = self.settings_cls.model_fields.get(name)
            if field is None:
                continue
            names = _env_names(name, field)
            for var in names:
                path = os.environ.get(f"{var}_FILE")
                if not path:
                    continue
                try:
                    value = Path(path).read_text(encoding="utf-8").strip()
                except OSError:
                    raise RuntimeError(f"{var}_FILE points at a file that cannot be read.") from None
                if not value:
                    raise RuntimeError(f"{var}_FILE points at an empty file.")
                out[names[0] if getattr(field, "validation_alias", None) else name] = value
                break
        return out


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="HG_", env_file=SERVER_DIR / ".env", extra="ignore")

    @classmethod
    def settings_customise_sources(cls, settings_cls, init_settings, env_settings, dotenv_settings, file_secret_settings):
        # `_FILE` wins over a plain variable: an orchestrator that mounts a secret is the more deliberate source.
        return (init_settings, FileSecretsSource(settings_cls), env_settings, dotenv_settings, file_secret_settings)

    #: V23 — **fails closed.** An unset or misspelled environment is production: a host that forgets `HG_ENV` must
    #: not serve passwordless demo sign-in, the test paid-state action or the instant-approve demo payment provider
    #: (REPORT §268 P1). Development hosts say so explicitly (`server/.env`, `scripts/dev.mjs`, `scripts/api.mjs`,
    #: the test conftest). `prod`, `Production`, ` production ` all normalise to production.
    env: str = "production"
    database_url: str = "postgresql+psycopg://hangyul:hangyul_dev@localhost:5432/hangyul_univ"
    test_database_url: str = "postgresql+psycopg://hangyul:hangyul_dev@localhost:5432/hangyul_univ_test"
    redis_url: str = "redis://localhost:6379/5"

    jwt_secret: str = "dev-only-change-me-in-any-shared-environment-0123456789"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 15
    refresh_token_days: int = 14
    file_url_secret: str = "dev-only-file-url-secret-0123456789"
    file_url_ttl_seconds: int = 300

    cors_origins: str = "http://localhost:3100,http://localhost:3101,http://localhost:3102,http://localhost:3103"

    storage_backend: str = "local"
    storage_dir: str = "./var/uploads"
    max_upload_mb: int = 15

    payment_provider: str = "demo"
    push_provider: str = "none"  # none | expo
    stripe_secret_key: str | None = None

    # ---------------------------------------------------------------- Toss Payments (V16, REPORT §135)
    #
    # Four owner-provided merchant configurations, and they are not interchangeable. Toss issues one client
    # key per MID per product, and the key's prefix *is* the product: every key here is `test_ck_…`, the
    # "API 개별 연동" family, which drives 결제창(구버전) / 브랜드페이 / 자동결제. (The current payment-widget
    # product uses `test_gck_…` and `widgets()`; no gck key exists for this merchant.)
    #
    #   HANGYUL      일반 결제  → one-time card payment. **This is the plan-purchase MID.**
    #   bill_talko18s0 / bill_talkoab1 / bill_talkspm0
    #                자동결제  → billing-key registration. Charging a saved card later is a different
    #                product from buying a package once, and Hangyul's plans are one-time purchases
    #                (business plan §3). These are configured so the capability is recorded and testable;
    #                **nothing in the student journey may reach them.**
    #
    # The secret key is read here and never leaves the server; the client key is handed to the browser by
    # `POST /me/orders`, so exactly one place knows which configuration is in use. `toss_env` keeps a
    # production deployment from silently running on test credentials.
    toss_env: str = "test"  # test | live
    toss_api_base: str = "https://api.tosspayments.com"
    toss_normal_mid: str | None = None
    toss_normal_client_key: str | None = None
    toss_normal_secret_key: str | None = None
    toss_normal_security_key: str | None = None
    toss_domestic_billing_mid: str | None = None
    toss_domestic_billing_client_key: str | None = None
    toss_domestic_billing_secret_key: str | None = None
    toss_domestic_billing_security_key: str | None = None
    toss_foreign_billing_mid: str | None = None
    toss_foreign_billing_client_key: str | None = None
    toss_foreign_billing_secret_key: str | None = None
    toss_foreign_billing_security_key: str | None = None
    toss_easypay_billing_mid: str | None = None
    toss_easypay_billing_client_key: str | None = None
    toss_easypay_billing_secret_key: str | None = None
    toss_easypay_billing_security_key: str | None = None
    # ---------------------------------------------------------------- USD / overseas-card readiness (V17)
    #
    # Four contract facts, each of which is **outside this repository** and none of which code can verify.
    # `docs/payments/TOSS_FOREIGN_CARD_REVIEW.md` carries the evidence and what the owner must request.
    #
    # They gate a *live* USD checkout. The reason they are four flags and not one is that they are acquired
    # in sequence and each takes real time: the foreign-card contract registers in ~2 business days, the
    # card-company review that follows it takes 10–14 **business** days, the multi-currency contract is a
    # separate negotiation, and the USD MID's live keys arrive last. A single boolean would hide where the
    # process actually is.
    #
    # There is deliberately **no KRW fallback**. If the page says $349 and the order is created in won at
    # today's rate, the student is charged an amount nobody quoted them and the refund becomes a second FX
    # question. When USD is not contracted the correct behaviour is to refuse the payment.
    toss_foreign_card_contract_ready: bool = False
    toss_card_review_ready: bool = False
    toss_usd_multicurrency_ready: bool = False
    toss_live_keys_ready: bool = False

    #: V21 — the AES-256-GCM key for the stored payment-credential envelope (`app/core/crypto.py`).
    #: 32 bytes, base64url, from `server/.env` only. No default: a missing key must stop a credential
    #: being stored, not quietly store it in the clear.
    payment_token_encryption_key: str | None = None

    #: Where Toss sends the buyer back. The student app's origin; the paths are fixed by the product.
    toss_return_origin: str = "http://localhost:3101"
    #: Legacy single-key form, still honoured so an existing deployment keeps working.
    toss_secret_key: str | None = None

    malware_scanner: str = "noop"


    # ================================================================ V22 — identity, verification, abuse control
    #
    # Every value below is server-only configuration. The brief names these variables without the project's
    # `HG_` prefix, so each one is read under **both** spellings (`SENDGRID_API_KEY` or `HG_SENDGRID_API_KEY`);
    # nothing here has a default that could pass for a credential, and none of it is ever serialised to a
    # client. REPORT §244, §253.

    # --- Twilio SendGrid (email verification, password reset, invitations)
    sendgrid_api_key: str | None = Field(default=None, validation_alias=AliasChoices("HG_SENDGRID_API_KEY", "SENDGRID_API_KEY"))
    sendgrid_from_email: str = Field(default="support@talkhangyul.com", validation_alias=AliasChoices("HG_SENDGRID_FROM_EMAIL", "SENDGRID_FROM_EMAIL"))
    sendgrid_from_name: str = Field(default="Hangyul Univ", validation_alias=AliasChoices("HG_SENDGRID_FROM_NAME", "SENDGRID_FROM_NAME"))
    sendgrid_api_base: str = "https://api.sendgrid.com"

    # --- Twilio Programmable Messaging (SMS verification). The API-key pair authenticates normal traffic; the
    #     primary auth token is held only for webhook signature validation, which is what Twilio signs with.
    twilio_account_sid: str | None = Field(default=None, validation_alias=AliasChoices("HG_TWILIO_ACCOUNT_SID", "TWILIO_ACCOUNT_SID"))
    twilio_api_key_sid: str | None = Field(default=None, validation_alias=AliasChoices("HG_TWILIO_API_KEY_SID", "TWILIO_API_KEY_SID"))
    twilio_api_key_secret: str | None = Field(default=None, validation_alias=AliasChoices("HG_TWILIO_API_KEY_SECRET", "TWILIO_API_KEY_SECRET"))
    twilio_auth_token: str | None = Field(default=None, validation_alias=AliasChoices("HG_TWILIO_AUTH_TOKEN", "TWILIO_AUTH_TOKEN"))
    twilio_messaging_service_sid: str | None = Field(default=None, validation_alias=AliasChoices("HG_TWILIO_MESSAGING_SERVICE_SID", "TWILIO_MESSAGING_SERVICE_SID"))
    twilio_api_base: str = "https://api.twilio.com"
    #: Public origin of this API as Twilio reaches it (for the delivery-status callback). Empty = no callback requested.
    public_api_origin: str | None = Field(default=None, validation_alias=AliasChoices("HG_PUBLIC_API_ORIGIN", "PUBLIC_API_ORIGIN"))

    # --- Cloudflare Turnstile (automated-signup protection)
    turnstile_site_key: str | None = Field(default=None, validation_alias=AliasChoices("HG_TURNSTILE_SITE_KEY", "TURNSTILE_SITE_KEY"))
    turnstile_secret_key: str | None = Field(default=None, validation_alias=AliasChoices("HG_TURNSTILE_SECRET_KEY", "TURNSTILE_SECRET_KEY"))
    turnstile_verify_url: str = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

    # --- OTP policy (seconds / counts). Changing these is a policy decision; the defaults are the brief's.
    otp_ttl_seconds: int = 300
    otp_resend_cooldown_seconds: int = 60
    otp_max_attempts: int = 5
    otp_proof_ttl_seconds: int = 1800
    signup_session_ttl_seconds: int = 1800

    #: Multiplies every rate-limit ceiling. 1 in any real environment; the test suite raises it so that one
    #: TestClient address running 400 tests is not mistaken for an attacker, and the limiter tests set it back.
    ratelimit_scale: int = 1
    #: Whether a limited endpoint may proceed when Redis is unreachable. Never in production (the property).
    ratelimit_fail_open: bool = True

    # --- Controlled provider smoke targets (QA only; nothing else may receive a test message)
    qa_sms_target: str | None = Field(default=None, validation_alias=AliasChoices("HG_QA_SMS_TARGET", "QA_SMS_TARGET"))
    qa_email_target: str | None = Field(default=None, validation_alias=AliasChoices("HG_QA_EMAIL_TARGET", "QA_EMAIL_TARGET"))

    # Information older than this is flagged REVIEW_DUE by the freshness job.
    freshness_review_days: int = 180

    # ================================================================ V29 — production infrastructure (Phase E)
    #
    #: The public HTTPS origin the web apps are served from (`https://univ.talkhangyul.com`). Production refuses to
    #: start without an `https://` value: HSTS, secure cookies and the CSP all assume TLS terminates in front of us.
    public_origin: str | None = Field(default=None, validation_alias=AliasChoices("HG_PUBLIC_ORIGIN", "PUBLIC_ORIGIN"))

    # --- staff MFA (TOTP). `None` = the environment default: required in production, optional elsewhere so the
    #     demo personas and the existing suite keep signing in with a password.
    staff_mfa_required: bool | None = None
    #: AES-256-GCM key (32 bytes, base64url) for TOTP secrets at rest. Required in production; development derives a
    #: throwaway key from the JWT secret so a fresh checkout can enrol without configuration.
    mfa_encryption_key: str | None = None
    mfa_issuer: str = "Hangyul Univ"
    mfa_challenge_ttl_seconds: int = 300
    mfa_enrollment_ttl_seconds: int = 900

    # --- malware scanning: `noop` (development only) | `clamd`
    clamd_socket: str | None = None  # unix socket path, e.g. /run/clamav/clamd.ctl
    clamd_host: str | None = None
    clamd_port: int = 3310
    clamd_timeout_seconds: float = 30.0

    # --- private object storage (`HG_STORAGE_BACKEND=s3`; S3 or any S3-compatible service such as MinIO)
    s3_bucket: str | None = None
    s3_endpoint_url: str | None = None  # empty for AWS; http(s)://host:port for MinIO
    s3_region: str = "ap-northeast-2"
    s3_access_key_id: str | None = None  # empty = the default credential chain (instance role / IRSA)
    s3_secret_access_key: str | None = None
    s3_sse: str = "AES256"  # AES256 | aws:kms | none (none: never in production)
    s3_kms_key_id: str | None = None
    s3_key_prefix: str = ""

    # --- monitoring
    alert_webhook_url: str | None = None
    alert_min_interval_seconds: int = 300
    log_format: str | None = None  # json | text; default json in production

    # --- worker
    worker_poll_seconds: int = 30
    retention_policy_path: str | None = None  # default: app/data/retention_policy.json

    @property
    def staff_mfa_required_effective(self) -> bool:
        return self.is_production if self.staff_mfa_required is None else bool(self.staff_mfa_required)

    @property
    def log_json(self) -> bool:
        return (self.log_format or ("json" if self.is_production else "text")).lower() == "json"

    @property
    def https_public_origin(self) -> bool:
        return bool(self.public_origin and self.public_origin.strip().lower().startswith("https://"))

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def storage_path(self) -> Path:
        p = Path(self.storage_dir)
        return p if p.is_absolute() else (SERVER_DIR / p).resolve()

    @field_validator("env", mode="before")
    @classmethod
    def _normalise_env(cls, v: object) -> str:
        raw = str(v or "").strip().lower()
        if raw in ("development", "dev", "local"):
            return "development"
        if raw in ("test", "testing", "ci"):
            return "test"
        if raw in ("staging", "preview"):
            return raw
        return "production"  # anything else — including empty and typos — is treated as production

    @property
    def is_production(self) -> bool:
        return self.env == "production"


    # ------------------------------------------------------------------ V22 provider readiness (derived, never trusted)
    @property
    def sendgrid_configured(self) -> bool:
        return bool(self.sendgrid_api_key and self.sendgrid_from_email)

    @property
    def twilio_configured(self) -> bool:
        """The API-key pair and a Messaging Service. The account SID is required because API keys authenticate
        as `Basic <key_sid>:<secret>` against `/Accounts/{AccountSid}/…`."""
        return bool(self.twilio_account_sid and self.twilio_api_key_sid and self.twilio_api_key_secret and self.twilio_messaging_service_sid)

    @property
    def turnstile_configured(self) -> bool:
        return bool(self.turnstile_site_key and self.turnstile_secret_key)

    @property
    def captcha_required(self) -> bool:
        """Production always requires a verified CAPTCHA proof — an unconfigured production refuses signup rather
        than running open (brief §14). Elsewhere the requirement follows the configuration, so a developer with
        Cloudflare's documented test keys exercises the real path and one without them is not blocked."""
        return self.is_production or self.turnstile_configured

    @property
    def ratelimit_fail_open_effective(self) -> bool:
        return (not self.is_production) and self.ratelimit_fail_open

    @property
    def otp_delivery_mode(self) -> str:
        """`providers` when real delivery is possible, `console` in development/test without credentials (the code
        is retrievable through the dev-only peek endpoint, never printed), `blocked` in production without them."""
        if self.is_production:
            return "providers"
        return "providers" if (self.sendgrid_configured or self.twilio_configured) else "console"

    @property
    def toss_one_time_secret(self) -> str | None:
        """The secret for the **one-time payment** merchant configuration, and only that one.

        `toss_secret_key` is the pre-V16 single-key setting; it is accepted as a fallback so an existing
        deployment is not broken by the rename, and it is never preferred over the explicit one.
        """
        return self.toss_normal_secret_key or self.toss_secret_key

    @property
    def toss_configured(self) -> bool:
        return bool(self.toss_normal_client_key and self.toss_one_time_secret)

    @property
    def usd_readiness(self) -> dict[str, bool]:
        """Each contract fact, by name, so a status surface can say *which* one is missing."""
        return {
            "foreign_card_contract": self.toss_foreign_card_contract_ready,
            "card_review": self.toss_card_review_ready,
            "usd_multicurrency": self.toss_usd_multicurrency_ready,
            "live_keys": self.toss_live_keys_ready,
        }

    # ------------------------------------------------- V21: foreign-card billing, separately from live
    #
    # The four flags above gate a **live** USD payment through the `HANGYUL` 결제창. They are keyed to
    # `toss_env == "live"`, so under test they are false by construction and no test transaction of any
    # kind could run — which is the whole reason the owner could never reach a pay button (REPORT §230).
    #
    # `bill_talkoab1` is a different merchant configuration and a different route. Measured against the
    # sandbox with the owner's own TEST credentials (REPORT §229.3), it accepts
    # `POST /v1/payments/key-in` with a foreign card and settles in **USD**. Its readiness therefore has
    # nothing to do with the 결제창 contracts and is given its own two states.

    @property
    def foreign_billing_configured(self) -> bool:
        """The paired `bill_*` foreign-card triple is present."""
        return bool(
            self.toss_foreign_billing_mid
            and self.toss_foreign_billing_client_key
            and self.toss_foreign_billing_secret_key
        )

    @property
    def foreign_billing_test_ready(self) -> bool:
        """May a **test** foreign-card charge be attempted?

        Credentials paired, environment is test, and the credential envelope has a key — because a card
        payment that cannot store its result safely is one this product does not take.
        """
        from app.core import crypto  # local: keeps config importable without the crypto dependency

        return self.toss_env == "test" and self.foreign_billing_configured and crypto.configured()

    @property
    def foreign_billing_live_ready(self) -> bool:
        """May a **live** foreign-card charge be taken? Live keys, live environment, nothing inferred.

        `test_` prefixes are the thing that actually distinguishes the two, so they are checked rather
        than trusted to a boolean somebody could set by hand.
        """
        from app.core import crypto

        live_keys = bool(
            self.toss_foreign_billing_secret_key
            and not self.toss_foreign_billing_secret_key.startswith("test_")
            and self.toss_foreign_billing_client_key
            and not self.toss_foreign_billing_client_key.startswith("test_")
        )
        return self.toss_env == "live" and self.foreign_billing_configured and live_keys and crypto.configured()

    @property
    def foreign_billing_enabled(self) -> bool:
        """The one question the purchase path asks."""
        return self.foreign_billing_test_ready or self.foreign_billing_live_ready

    @property
    def live_usd_checkout_enabled(self) -> bool:
        """May a **live** USD payment be opened?

        All four contracts, and a live environment. In test the answer is always no for a different reason:
        the supplied test MID is a KRW MID and the provider refuses USD on it (REPORT §152), which is a
        verified provider result rather than a policy choice.
        """
        return self.toss_env == "live" and all(self.usd_readiness.values())


#: Substrings that mark a value as a placeholder rather than a credential (V29: extends V23's `dev-only` check).
DEV_SECRET_MARKERS = ("dev-only", "change-me", "changeme", "replace-me", "example", "placeholder", "dummy", "test-secret", "insecure", "secret123")


def looks_like_dev_secret(value: str | None, *, min_length: int = 32) -> bool:
    if not value:
        return True
    low = value.lower()
    return len(value) < min_length or any(m in low for m in DEV_SECRET_MARKERS)


def _valid_aes_key(raw: str | None) -> bool:
    if not raw:
        return False
    try:
        return len(base64.urlsafe_b64decode(raw + "=" * (-len(raw) % 4))) == 32
    except Exception:  # noqa: BLE001 - the value is a secret; never echo it
        return False


def v29_production_violations(s: Settings) -> list[str]:
    """What a production start-up refuses (V29). Returned as a list so the release gate can report every gap at once;
    the messages name settings, never values."""
    out: list[str] = []
    if looks_like_dev_secret(s.jwt_secret) or looks_like_dev_secret(s.file_url_secret):
        out.append("HG_JWT_SECRET / HG_FILE_URL_SECRET look like development or placeholder values (>= 32 random characters required).")
    if s.jwt_secret == s.file_url_secret:
        out.append("HG_JWT_SECRET and HG_FILE_URL_SECRET must be different secrets.")
    if not s.https_public_origin:
        out.append("HG_PUBLIC_ORIGIN must be an https:// origin.")
    if any(not o.lower().startswith("https://") for o in s.cors_origin_list):
        out.append("HG_CORS_ORIGINS must list https:// origins only.")
    if s.storage_backend != "s3":
        out.append("HG_STORAGE_BACKEND=local is not allowed in production (use s3).")
    elif not s.s3_bucket:
        out.append("HG_S3_BUCKET is required when HG_STORAGE_BACKEND=s3.")
    elif s.s3_sse not in ("AES256", "aws:kms"):
        out.append("HG_S3_SSE must be AES256 or aws:kms in production.")
    if s.malware_scanner != "clamd":
        out.append("HG_MALWARE_SCANNER must be clamd in production (the no-op scanner is development only).")
    elif not (s.clamd_socket or s.clamd_host):
        out.append("HG_CLAMD_SOCKET or HG_CLAMD_HOST is required when HG_MALWARE_SCANNER=clamd.")
    if not _valid_aes_key(s.mfa_encryption_key):
        out.append("HG_MFA_ENCRYPTION_KEY (32 bytes, base64url) is required in production.")
    return out


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    if s.is_production and ("dev-only" in s.jwt_secret or "dev-only" in s.file_url_secret):
        raise RuntimeError("Refusing to start in production with development secrets.")
    if s.is_production:
        violations = v29_production_violations(s)
        if violations:
            raise RuntimeError("Refusing to start in production: " + " ".join(violations))
    # A live deployment running on `test_` credentials takes real orders that are never charged. The
    # cheapest place to catch that is the moment the process starts.
    if s.is_production and s.payment_provider == "toss":
        if s.toss_env != "live":
            raise RuntimeError("Refusing to start in production with HG_TOSS_ENV != live.")
        if (s.toss_normal_client_key or "").startswith("test_") or (s.toss_one_time_secret or "").startswith("test_"):
            raise RuntimeError("Refusing to start in production with Toss test keys.")
    if s.is_production:
        if not s.turnstile_configured:
            raise RuntimeError("Refusing to start in production without Cloudflare Turnstile keys (signup would run unprotected).")
        if not s.sendgrid_configured or not s.twilio_configured:
            raise RuntimeError("Refusing to start in production without SendGrid and Twilio configuration (verification cannot be delivered).")
    return s
