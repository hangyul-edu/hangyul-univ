"""SMS through Twilio Programmable Messaging (V22, brief §7–10).

Authentication is the **API key pair** (`Basic <KeySid>:<KeySecret>` against `/2010-04-01/Accounts/{AccountSid}`),
never the primary auth token, which this module reads for exactly one purpose: validating the signature Twilio
puts on its status callbacks (`twilio.request_validator.RequestValidator` — Twilio signs with the auth token).

The sender is the configured **Messaging Service** (`MessagingServiceSid`), not a hard-coded number, so sender
selection, geo-permissions and compliance live in the Twilio console rather than in code. Where the API supports
it the message is flagged as a verification, and every provider error is reduced to an internal code —
the student sees "인증문자를 보내지 못했어요", not error 30007.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass

import httpx

from app.core.config import get_settings

log = logging.getLogger("hangyul.sms")


class SmsError(Exception):
    def __init__(self, code: str, message: str = ""):
        super().__init__(message or code)
        self.code = code


@dataclass(frozen=True)
class SendResult:
    provider: str
    message_id: str | None
    status: str  # QUEUED | SENT | SKIPPED


TWILIO_STATUS_MAP = {
    "accepted": "QUEUED", "scheduled": "QUEUED", "queued": "QUEUED", "sending": "QUEUED",
    "sent": "SENT", "delivered": "DELIVERED",
    "undelivered": "UNDELIVERED", "failed": "FAILED", "canceled": "FAILED",
}


def send_sms(*, to_e164: str, body: str, status_callback: str | None = None) -> SendResult:
    s = get_settings()
    if not s.twilio_configured:
        if s.is_production:
            raise SmsError("SMS_NOT_CONFIGURED")
        log.info("sms[console] to=%s (body withheld)", to_e164[:-4] + "****")
        return SendResult("console", None, "SKIPPED")
    data = {"To": to_e164, "MessagingServiceSid": s.twilio_messaging_service_sid, "Body": body}
    if status_callback:
        data["StatusCallback"] = status_callback
    url = f"{s.twilio_api_base}/2010-04-01/Accounts/{s.twilio_account_sid}/Messages.json"
    try:
        r = httpx.post(url, data=data, auth=(s.twilio_api_key_sid or "", s.twilio_api_key_secret or ""), timeout=10.0)
    except httpx.HTTPError as exc:
        log.warning("twilio unreachable: %s", exc.__class__.__name__)
        raise SmsError("SMS_UNREACHABLE")
    try:
        body_json = r.json()
    except ValueError:
        body_json = {}
    if r.status_code >= 400:
        code = str(body_json.get("code") or r.status_code)
        log.warning("twilio refused: http=%s code=%s", r.status_code, code)
        raise SmsError(f"SMS_PROVIDER_{code}")
    return SendResult("twilio", body_json.get("sid"), TWILIO_STATUS_MAP.get(str(body_json.get("status")), "QUEUED"))


def validate_callback(url: str, form: dict, signature: str | None) -> bool:
    """Twilio's documented signature check via its SDK. False when unconfigured or unsigned."""
    s = get_settings()
    if not (s.twilio_auth_token and signature):
        return False
    from twilio.request_validator import RequestValidator

    return RequestValidator(s.twilio_auth_token).validate(url, form, signature)


def otp_text(code: str, locale: str) -> str:
    """Localised verification SMS. Code, brand and validity only — no email, no password, no name (brief §8)."""
    texts = {
        "ko": f"[Hangyul Univ] 인증번호는 {code}입니다.\n5분 안에 입력해 주세요.",
        "en": f"[Hangyul Univ] Your verification code is {code}.\nEnter it within 5 minutes.",
        "vi": f"[Hangyul Univ] Mã xác minh của bạn là {code}.\nNhập trong vòng 5 phút.",
        "ne": f"[Hangyul Univ] तपाईंको प्रमाणीकरण कोड {code} हो।\n५ मिनेटभित्र प्रविष्ट गर्नुहोस्।",
        "my": f"[Hangyul Univ] သင့်အတည်ပြုကုဒ်မှာ {code} ဖြစ်သည်။\n၅ မိနစ်အတွင်း ထည့်သွင်းပါ။",
        "uz": f"[Hangyul Univ] Tasdiqlash kodingiz: {code}.\n5 daqiqa ichida kiriting.",
        "mn": f"[Hangyul Univ] Таны баталгаажуулах код {code}.\n5 минутын дотор оруулна уу.",
        "zh-Hans": f"[Hangyul Univ] 您的验证码是 {code}。\n请在 5 分钟内输入。",
        "ja": f"[Hangyul Univ] 認証番号は {code} です。\n5分以内に入力してください。",
        "th": f"[Hangyul Univ] รหัสยืนยันของคุณคือ {code}\nกรุณากรอกภายใน 5 นาที",
        "id": f"[Hangyul Univ] Kode verifikasi Anda {code}.\nMasukkan dalam 5 menit.",
        "fil": f"[Hangyul Univ] Ang iyong verification code ay {code}.\nIlagay ito sa loob ng 5 minuto.",
        "hi": f"[Hangyul Univ] आपका सत्यापन कोड {code} है।\n5 मिनट के भीतर दर्ज करें।",
        "bn": f"[Hangyul Univ] আপনার যাচাইকরণ কোড {code}।\n৫ মিনিটের মধ্যে লিখুন।",
        "kk": f"[Hangyul Univ] Растау кодыңыз: {code}.\n5 минут ішінде енгізіңіз.",
        "ky": f"[Hangyul Univ] Ырастоо кодуңуз: {code}.\n5 мүнөттүн ичинде киргизиңиз.",
        "ar": f"[Hangyul Univ] رمز التحقق الخاص بك هو {code}.\nأدخله خلال 5 دقائق.",
        "tr": f"[Hangyul Univ] Doğrulama kodunuz {code}.\n5 dakika içinde girin.",
        "ru": f"[Hangyul Univ] Ваш код подтверждения: {code}.\nВведите его в течение 5 минут.",
        "uk": f"[Hangyul Univ] Ваш код підтвердження: {code}.\nВведіть його протягом 5 хвилин.",
        "pl": f"[Hangyul Univ] Twój kod weryfikacyjny: {code}.\nWpisz go w ciągu 5 minut.",
        "cs": f"[Hangyul Univ] Váš ověřovací kód je {code}.\nZadejte ho do 5 minut.",
        "hu": f"[Hangyul Univ] Az ellenőrző kódod: {code}.\nÍrd be 5 percen belül.",
        "ro": f"[Hangyul Univ] Codul tău de verificare este {code}.\nIntrodu-l în 5 minute.",
        "sr": f"[Hangyul Univ] Vaš verifikacioni kod je {code}.\nUnesite ga u roku od 5 minuta.",
        "el": f"[Hangyul Univ] Ο κωδικός επαλήθευσης είναι {code}.\nΕισαγάγετέ τον εντός 5 λεπτών.",
        "it": f"[Hangyul Univ] Il tuo codice di verifica è {code}.\nInseriscilo entro 5 minuti.",
        "es": f"[Hangyul Univ] Tu código de verificación es {code}.\nIntrodúcelo en 5 minutos.",
        "pt": f"[Hangyul Univ] O seu código de verificação é {code}.\nIntroduza-o em 5 minutos.",
        "fr": f"[Hangyul Univ] Votre code de vérification est {code}.\nSaisissez-le dans les 5 minutes.",
        "de": f"[Hangyul Univ] Dein Bestätigungscode lautet {code}.\nGib ihn innerhalb von 5 Minuten ein.",
        "nl": f"[Hangyul Univ] Je verificatiecode is {code}.\nVoer deze binnen 5 minuten in.",
        "sv": f"[Hangyul Univ] Din verifieringskod är {code}.\nAnge den inom 5 minuter.",
    }
    return texts.get(locale) or texts.get(locale.split("-")[0]) or texts["en"]
