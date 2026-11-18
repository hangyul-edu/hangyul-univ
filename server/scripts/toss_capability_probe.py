"""Probe what each configured Toss billing merchant will actually do — without charging anything.

    HG_ENV=development .venv/bin/python scripts/toss_capability_probe.py            # prints a redacted table
    … --json docs/payments/capability-<date>.json                                   # also writes the evidence

For every merchant (domestic / foreign / easypay) this makes two calls with the merchant's own secret key:

  1. **authentication** — look up an order id that cannot exist. 404 NOT_FOUND_PAYMENT means the secret is
     accepted; 401 UNAUTHORIZED_KEY means it is not.
  2. **billing-key issuance contract** — `POST /v1/billing/authorizations/issue` with a deliberately invalid
     `authKey`. A merchant contracted for 자동결제 answers that the *auth key* is wrong; one that is not
     answers that the *product* is not available to it. No key is issued either way.

What this can NOT establish, and what therefore still needs one controlled real transaction per method
(docs/payments/BILLING.md): that a real card registers, that the charge is approved, and in which currency
the MID settles. A capability is set to VERIFIED only after that, never from this probe alone.

Nothing secret is printed or written: MIDs, HTTP statuses and Toss's own error codes only.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import UTC, datetime
from pathlib import Path

os.environ.setdefault("HG_ENV", "development")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import get_settings  # noqa: E402
from app.services import billing  # noqa: E402
from app.services.payments import ProviderError  # noqa: E402

#: Toss's answers to a bogus auth key that mean "this merchant may issue billing keys; that key is just wrong".
CONTRACT_OK = {"INVALID_AUTH_KEY", "NOT_FOUND_AUTH_KEY", "EXPIRED_AUTH_KEY", "INVALID_AUTHORIZE_AUTH", "INVALID_REQUEST",
               "NOT_FOUND", "NOT_FOUND_PAYMENT_SESSION", "INVALID_BILL_KEY_REQUEST"}


def probe(m: billing.Merchant) -> dict:
    row: dict = {"merchant": m.key, "mid": m.mid, "configured": m.configured, "contract_currency_setting": m.currency,
                 "key_mode": "live" if m.is_live_keyed else "test" if m.is_test_keyed else "unknown"}
    if not m.configured:
        return row
    client = billing.BillingClient(m)
    try:
        status, code = client.probe_auth()
        row["auth"] = {"http_status": status, "code": code, "authenticated": status == 404}
    except ProviderError as exc:
        row["auth"] = {"http_status": None, "code": exc.code, "authenticated": False}
        return row
    try:
        client.issue(auth_key="hg-capability-probe-not-a-real-auth-key", customer_key=billing.new_customer_key())
        row["billing_issue"] = {"http_status": 200, "code": None, "verdict": "UNEXPECTED_SUCCESS"}
    except ProviderError as exc:
        verdict = "CONTRACT_ACCEPTS_BILLING" if exc.code in CONTRACT_OK else (
            "CONTRACT_REFUSES_BILLING" if exc.code in billing.CAPABILITY_CODES else "INCONCLUSIVE")
        row["billing_issue"] = {"http_status": getattr(exc, "http_status", None), "code": exc.code, "verdict": verdict}
    return row


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", help="write the redacted evidence to this file")
    args = ap.parse_args()
    s = get_settings()
    rows = [probe(m) for m in billing.merchants(s)]
    kinds = {k: {"capability_setting": billing.capability(k, s), "available_now": billing.availability(k, s=s).available,
                 "reason": billing.availability(k, s=s).reason} for k in billing.METHOD_KINDS}
    out = {"probed_at": datetime.now(UTC).isoformat(timespec="seconds"), "toss_env": s.toss_env,
           "live_payment_enabled": s.live_payment_enabled, "merchants": rows, "methods": kinds,
           "note": "Probe only: no billing key issued, no charge made. VERIFIED requires a real registration + charge per method."}
    text = json.dumps(out, indent=2, ensure_ascii=False)
    for m in billing.merchants(s):  # belt and braces: a secret must never reach stdout or the evidence file
        for secret in (m.secret_key, m.security_key, m.client_key):
            assert not secret or secret not in text
    print(text)
    if args.json:
        Path(args.json).write_text(text + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
