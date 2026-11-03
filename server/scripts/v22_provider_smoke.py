"""One controlled email and one controlled SMS to the configured QA targets (V22 §77). Prints provider, message id and
status; never the code, never a secret, never the body."""
from __future__ import annotations

from app.core.config import get_settings
from app.services import mail, sms


def main() -> None:
    s = get_settings()
    print("V22 provider smoke")
    print(f"  sendgrid from: {s.sendgrid_from_name} <{s.sendgrid_from_email}>")
    try:
        r = mail.send_email(to=s.qa_email_target, subject="[Hangyul Univ] QA verification email", text="This is a controlled QA message. No action is needed.", category="qa_smoke")
        print(f"  email   provider={r.provider} status={r.status} message_id={'present' if r.message_id else 'none'}")
    except mail.MailError as exc:
        print(f"  email   FAILED code={exc.code}")
    try:
        r = sms.send_sms(to_e164=s.qa_sms_target, body="[Hangyul Univ] QA test message. No action is needed.")
        print(f"  sms     provider={r.provider} status={r.status} message_sid={'present' if r.message_id else 'none'} messaging_service={'configured' if s.twilio_messaging_service_sid else 'missing'}")
    except sms.SmsError as exc:
        print(f"  sms     FAILED code={exc.code}")


if __name__ == "__main__":
    main()
