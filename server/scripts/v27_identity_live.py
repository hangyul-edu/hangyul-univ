"""V27 live identity-delivery check (REPORT §358, brief §48) — `npm run qa:identity-live`.

Drives the product's **own** verification path (`services/verification.issue`) against the real providers and reports:

    SENDGRID  configured / missing (variable names only) · key scopes include mail.send · sender identity / domain
              authentication where the key may read them · one real verification email accepted (message id)
    TWILIO    configured / missing · Messaging Service exists · one real verification SMS accepted (message SID) ·
              delivery status by polling the Message resource (no public callback needed) · callback received, only
              when HG_PUBLIC_API_ORIGIN points at a public URL

Never printed: a secret, a code, a token, a message body. Targets come from QA_EMAIL_TARGET / QA_SMS_TARGET in
server/.env; recipients are shown masked.

Exit codes: 0 every configured check passed · 1 a provider refused or a check failed · 2 configuration missing
(BLOCKED). `--allow-blocked` turns 2 into 0 and prints EXTERNAL_BLOCKER, for hosts that are known to have no keys.
"""

from __future__ import annotations

import os
import sys
import time

import httpx
from dotenv import dotenv_values

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.models import VerificationChallenge
from app.services import ratelimit, verification
from app.services.identity import mask_email, mask_phone

ENV = dotenv_values(os.path.join(os.path.dirname(__file__), "..", ".env"))
ALLOW_BLOCKED = "--allow-blocked" in sys.argv
NEEDED = {
    "SENDGRID": ["SENDGRID_API_KEY"],
    "TWILIO": ["TWILIO_ACCOUNT_SID", "TWILIO_API_KEY_SID", "TWILIO_API_KEY_SECRET", "TWILIO_MESSAGING_SERVICE_SID"],
}
TARGETS = {"SENDGRID": "QA_EMAIL_TARGET", "TWILIO": "QA_SMS_TARGET"}
results: list[tuple[str, str, str]] = []  # (provider, check, verdict)


def have(name: str) -> bool:
    return bool(ENV.get(name) or ENV.get(f"HG_{name}") or os.environ.get(name) or os.environ.get(f"HG_{name}"))


def say(provider: str, check: str, verdict: str, detail: str = "") -> None:
    results.append((provider, check, verdict))
    print(f"  {provider:<8} {check:<34} {verdict}{('  ' + detail) if detail else ''}", flush=True)


def sendgrid(s) -> None:
    h = {"Authorization": f"Bearer {s.sendgrid_api_key}"}
    try:
        r = httpx.get(f"{s.sendgrid_api_base}/v3/scopes", headers=h, timeout=15)
    except httpx.HTTPError as exc:
        say("SENDGRID", "HTTPS reaches api.sendgrid.com", "FAIL", exc.__class__.__name__)
        return
    say("SENDGRID", "HTTPS reaches api.sendgrid.com", "OK")
    if r.status_code == 401:
        say("SENDGRID", "API key accepted", "FAIL", "401 — key rejected")
        return
    scopes = set((r.json() or {}).get("scopes") or []) if r.status_code == 200 else set()
    say("SENDGRID", "key has mail.send", "OK" if "mail.send" in scopes else "FAIL", f"http={r.status_code}")
    v = httpx.get(f"{s.sendgrid_api_base}/v3/verified_senders", headers=h, timeout=15)
    if v.status_code == 200:
        senders = [x for x in (v.json() or {}).get("results", []) if x.get("from_email", "").lower() == s.sendgrid_from_email.lower()]
        say("SENDGRID", f"sender {s.sendgrid_from_email}", "VERIFIED" if any(x.get("verified") for x in senders) else "NOT VERIFIED (single sender)")
    else:
        say("SENDGRID", "single-sender list", "NOT READABLE", f"http={v.status_code} (key lacks the scope; not a failure)")
    d = httpx.get(f"{s.sendgrid_api_base}/v3/whitelabel/domains", headers=h, timeout=15)
    if d.status_code == 200:
        dom = s.sendgrid_from_email.split("@")[-1]
        rows = [x for x in d.json() or [] if x.get("domain") == dom]
        say("SENDGRID", f"domain authentication {dom}", "VALID (SPF/DKIM)" if any(x.get("valid") for x in rows) else ("PRESENT, NOT VALID" if rows else "NOT SET UP"))
    else:
        say("SENDGRID", "domain authentication", "NOT READABLE", f"http={d.status_code} (scope)")


def twilio(s) -> None:
    auth = (s.twilio_api_key_sid, s.twilio_api_key_secret)
    try:
        r = httpx.get(f"https://messaging.twilio.com/v1/Services/{s.twilio_messaging_service_sid}", auth=auth, timeout=15)
    except httpx.HTTPError as exc:
        say("TWILIO", "HTTPS reaches twilio.com", "FAIL", exc.__class__.__name__)
        return
    say("TWILIO", "HTTPS reaches twilio.com", "OK")
    if r.status_code == 401:
        say("TWILIO", "API key accepted", "FAIL", "401 — key SID/secret rejected or not for this account")
        return
    say("TWILIO", "Messaging Service exists", "OK" if r.status_code == 200 else "FAIL", f"http={r.status_code}")


def send(purpose: str, target: str, provider: str, s) -> None:
    ratelimit.reset_all()
    with SessionLocal() as db:
        try:
            out = verification.issue(db, purpose=purpose, target=target, locale="ko", ip="127.0.0.1")
        except Exception as exc:  # the product's own error, with its own code — never the body
            detail = getattr(exc, "detail", None)
            code = detail.get("code") if isinstance(detail, dict) else exc.__class__.__name__
            reason = detail.get("reason") if isinstance(detail, dict) else None
            say(provider, "real verification send", "REJECTED", f"{code} {reason or ''}".strip())
            db.rollback()
            return
        ch = db.get(VerificationChallenge, out["challenge_id"])
        mid = ch.provider_message_id
        say(provider, "real verification send", "ACCEPTED" if out["delivery"] == "sent" and mid else "NOT SENT",
            f"to={out['target_masked']} id={mid or '-'} status={ch.delivery_status}")
        if provider == "TWILIO" and mid:
            final = None
            for _ in range(20):  # up to ~60 s — the Message resource answers what the callback would have said
                m = httpx.get(f"{s.twilio_api_base}/2010-04-01/Accounts/{s.twilio_account_sid}/Messages/{mid}.json",
                              auth=(s.twilio_api_key_sid, s.twilio_api_key_secret), timeout=15)
                final = (m.json() or {}).get("status") if m.status_code == 200 else f"http={m.status_code}"
                if final in ("delivered", "undelivered", "failed"):
                    break
                time.sleep(3)
            err = (m.json() or {}).get("error_code") if m.status_code == 200 else None
            say("TWILIO", "delivery status (polled)", str(final).upper(), f"error_code={err}" if err else "")
            if s.public_api_origin:
                db.refresh(ch)
                say("TWILIO", "delivery callback received", "YES" if ch.delivery_updated_at else "NO",
                    f"origin={s.public_api_origin}")
            else:
                say("TWILIO", "delivery callback received", "N/A", "no public callback origin (localhost is not reachable by Twilio)")
        # The challenge carries a code hash for a real person's inbox: invalidate it so it cannot be used, and delete it
        # so QA leaves no residue in development data (V26 hygiene).
        db.delete(ch)
        db.commit()


def main() -> int:
    s = get_settings()
    print("V27 identity delivery — live providers", flush=True)
    missing = {p: [n for n in names if not have(n)] for p, names in NEEDED.items()}
    targets = {p: ENV.get(t) or os.environ.get(t) for p, t in TARGETS.items()}
    for p in NEEDED:
        state = "configured" if not missing[p] else f"MISSING: {', '.join(missing[p])}"
        tgt = targets[p]
        shown = (mask_email(tgt) if p == "SENDGRID" else mask_phone(tgt)) if tgt else f"MISSING: {TARGETS[p]}"
        print(f"  {p:<8} {'configuration':<34} {state}   target={shown}", flush=True)
    blocked = [p for p in NEEDED if missing[p] or not targets[p]]
    if not missing["SENDGRID"]:
        sendgrid(s)
        if targets["SENDGRID"]:
            send("SIGNUP_EMAIL", targets["SENDGRID"], "SENDGRID", s)
    if not missing["TWILIO"]:
        twilio(s)
        if targets["TWILIO"]:
            send("SIGNUP_PHONE", targets["TWILIO"], "TWILIO", s)
    failed = [r for r in results if r[2] in ("FAIL", "REJECTED", "NOT SENT", "UNDELIVERED", "FAILED")]
    if failed:
        print(f"RESULT: FAIL ({len(failed)} check(s))", flush=True)
        return 1
    if blocked:
        print(f"RESULT: BLOCKED — {', '.join(blocked)} not configured on this host" + (" (EXTERNAL_BLOCKER, allowed)" if ALLOW_BLOCKED else ""), flush=True)
        return 0 if ALLOW_BLOCKED else 2
    print("RESULT: PASS", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
