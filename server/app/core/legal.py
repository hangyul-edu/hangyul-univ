"""The consent catalogue and the versions of the legal documents it points at (V22, REPORT §245).

This is the **only** place a consent key, its required/optional status or a document version is defined. The
registration endpoint validates the posted consents against it, the public endpoint publishes it to the signup
screen, and every `ConsentRecord` written carries the version and effective date read from here — so a record can
always be matched to the exact text the person saw.

The Korean text is canonical; translations are readable renderings of it (brief §71). The versions below are
the versions of the *documents as published by this repository* (`/terms`, `/privacy`); they are not a claim that
counsel has approved them — that remains OWNER_POLICY_REQUIRED (docs/LEGAL_DEPENDENCIES.md L12/L14).
"""
from dataclasses import asdict, dataclass

#: Document versions. Bumping one here invalidates nothing retroactively: old records keep the version they recorded.
TERMS_VERSION = "2026-10-23"
PRIVACY_VERSION = "2026-10-23"
CROSS_BORDER_NOTICE_VERSION = "2026-10-23"
MARKETING_VERSION = "2026-10-23"
#: V29: the checkout summary now states the service contract notes (이용 안내) and the purchase snapshots the catalogue.
PURCHASE_TERMS_VERSION = "2026-10-30"
#: 시행일 of the current published policy texts. Null until the owner sets an effective date (entity.ts mirrors this).
POLICY_EFFECTIVE_ON: str | None = None


@dataclass(frozen=True)
class ConsentItem:
    key: str
    required: bool
    version: str
    #: Which published document the item points at (path on the marketing site), or None for a notice rendered inline.
    document: str | None
    #: PIPA basis as the product understands it; informational for the audit, not legal advice.
    basis: str


SIGNUP_CONSENTS: tuple[ConsentItem, ...] = (
    ConsentItem("TERMS", True, TERMS_VERSION, "/terms", "contract — 약관의 규제에 관한 법률 §3 명시·설명"),
    ConsentItem("PRIVACY", True, PRIVACY_VERSION, "/privacy", "개인정보 보호법 §15①1 수집·이용 동의"),
    ConsentItem("CROSS_BORDER_VERIFICATION", True, CROSS_BORDER_NOTICE_VERSION, "/privacy#transfer",
                "개인정보 보호법 §28-8 국외 이전 — 본인확인(이메일·SMS·봇 차단) 처리위탁; 거부 시 가입 불가"),
    ConsentItem("MARKETING", False, MARKETING_VERSION, None, "개인정보 보호법 §22④ 선택 동의 / 정보통신망법 §50 수신 동의"),
)

REQUIRED_SIGNUP_KEYS = frozenset(c.key for c in SIGNUP_CONSENTS if c.required)
OPTIONAL_SIGNUP_KEYS = frozenset(c.key for c in SIGNUP_CONSENTS if not c.required)
ALL_SIGNUP_KEYS = REQUIRED_SIGNUP_KEYS | OPTIONAL_SIGNUP_KEYS

#: Recorded at checkout: the buyer saw the plan, price, one-time nature, service-start condition and refund link.
PURCHASE_CONSENT = ConsentItem("PURCHASE_TERMS", True, PURCHASE_TERMS_VERSION, "/terms#refunds",
                               "전자상거래 등에서의 소비자보호에 관한 법률 §13 고지 / §17③ 청약철회 제한 고지")


def consent_version(key: str) -> str:
    for c in (*SIGNUP_CONSENTS, PURCHASE_CONSENT):
        if c.key == key:
            return c.version
    raise KeyError(key)


def public_catalogue() -> dict:
    return {
        "items": [asdict(c) for c in SIGNUP_CONSENTS],
        "purchase": asdict(PURCHASE_CONSENT),
        "policy_effective_on": POLICY_EFFECTIVE_ON,
        "canonical_locale": "ko",
    }
