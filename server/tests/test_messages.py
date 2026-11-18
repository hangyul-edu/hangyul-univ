"""Identity message copy (app/services/messages.py): codes never in subjects, purpose-specific wording, safe HTML."""
import pytest

from app.core.config import get_settings
from app.services import messages, verification

CODE = "482913"
EMAIL_PURPOSES = ["SIGNUP_EMAIL", "CONTACT_EMAIL", "PASSWORD_RESET", "INVITE"]


@pytest.mark.parametrize("locale", ["en", "ko", "ko-KR", "vi", "ja"])
@pytest.mark.parametrize("purpose", EMAIL_PURPOSES)
@pytest.mark.parametrize("already", [False, True])
def test_code_never_in_subject_and_only_in_code_bodies(purpose, locale, already):
    if already and purpose not in ("SIGNUP_EMAIL", "CONTACT_EMAIL"):
        pytest.skip("only email verification can hit an existing account")
    subject, text, html = messages.email_content(purpose, CODE, locale, already, {"organization": "Lotus Agency"})
    assert CODE not in subject
    if already:  # the existing-account notice carries no code at all
        assert CODE not in text and CODE not in html
    else:
        assert CODE in text and CODE in html


def test_each_email_purpose_has_its_own_wording():
    seen = set()
    for lang in ("en", "ko"):
        for purpose in EMAIL_PURPOSES:
            seen.add((lang, messages.email_content(purpose, CODE, lang, False)[0]))
        for purpose in ("SIGNUP_EMAIL", "CONTACT_EMAIL"):
            seen.add((lang, messages.email_content(purpose, CODE, lang, True)[0]))
    assert len(seen) == 12  # 6 kinds x 2 languages, all distinct subjects


def test_invite_names_the_organisation_and_escapes_it():
    org = 'Lotus <b>"Agency"</b>'
    subject, text, html = messages.email_content("INVITE", CODE, "en", False, {"organization": org})
    assert org in subject and org in text
    assert "<b>" not in html and "&lt;b&gt;" in html
    subject, _, _ = messages.email_content("INVITE", CODE, "ko", False)
    assert "{org}" not in subject and subject.strip()


def test_existing_account_notice_links_only_when_configured(monkeypatch):
    s = get_settings()
    monkeypatch.setattr(s, "student_app_url", None)
    _, text, _ = messages.email_content("SIGNUP_EMAIL", CODE, "en", True)
    assert "http" not in text
    monkeypatch.setattr(s, "student_app_url", "https://app.example.com/")
    _, text, html = messages.email_content("SIGNUP_EMAIL", CODE, "en", True)
    assert "https://app.example.com/login" in text and "https://app.example.com/forgot" in html


@pytest.mark.parametrize("locale", messages.SMS_LOCALES)
def test_sms_per_purpose_and_locale(locale):
    signup = messages.sms_text("SIGNUP_PHONE", CODE, locale)
    change = messages.sms_text("CONTACT_PHONE", CODE, locale)
    assert signup != change
    for t in (signup, change):
        assert t.startswith("[Hangyul Univ]") and CODE in t and "{" not in t
        units = len(t.encode("utf-16-le")) // 2
        assert units <= 2 * 67 or t.isascii(), "keep every SMS within two segments"


def test_sms_falls_back_to_english():
    assert messages.sms_text("SIGNUP_PHONE", CODE, "xx-YY") == messages.sms_text("SIGNUP_PHONE", CODE, "en")
    assert messages.sms_text("SIGNUP_PHONE", CODE, "zh-Hans") != messages.sms_text("SIGNUP_PHONE", CODE, "en")


def test_verification_keeps_its_public_name():
    assert verification.email_content is messages.email_content
