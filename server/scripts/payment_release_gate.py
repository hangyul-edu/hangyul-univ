"""PUBLIC LAUNCH gate for payments. Exits non-zero unless real billing-key charging is correctly switched on.

    HG_ENV=production .venv/bin/python scripts/payment_release_gate.py [--bundles ../apps/student-web/dist …]

Fails when:
  * the provider is not Toss, or HG_TOSS_ENV is not `live`;
  * any configured billing merchant carries a `test_` key, a non-live key, or a MID that is not the contracted one;
  * an expected live MID is missing;
  * HG_LIVE_PAYMENT_ENABLED is off;
  * no payment method is VERIFIED (capability validation missing), or one that is VERIFIED is still unavailable;
  * the billing-key envelope key is missing;
  * a Toss secret-shaped string, or any configured secret/security key, appears in a browser bundle;
  * the server still contains an ordinary-payment or raw-card call.

It prints MIDs and reasons only — never a key.
"""
from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

SECRET_SHAPE = re.compile(r"\b(?:live|test)_g?sk_[A-Za-z0-9]{8,}")
FORBIDDEN_CALLS = ('"/v1/payments/confirm"', "/v1/payments/key-in", "/v1/billing/authorizations/card", "requestPayment(")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--bundles", nargs="*", default=[], help="built web app directories to scan (dist/)")
    args = ap.parse_args()
    os.environ.setdefault("HG_ENV", "production")
    problems: list[str] = []
    try:
        from app.core.config import Settings
        from app.services import billing

        s = Settings()
    except Exception as exc:  # noqa: BLE001
        print(f"FAIL  configuration could not be loaded: {type(exc).__name__}")
        return 1

    if s.payment_provider != "toss":
        problems.append(f"HG_PAYMENT_PROVIDER is '{s.payment_provider}', not toss.")
    problems += billing.production_violations(s)
    for key, mid in billing.EXPECTED_LIVE_MIDS.items():
        if billing.merchant(key, s).mid != mid:
            problems.append(f"expected live MID {mid} ({key}) is not configured.")
    if not s.live_payment_enabled:
        problems.append("HG_LIVE_PAYMENT_ENABLED is off: live payment is disabled.")
    verified = [k for k in billing.METHOD_KINDS if billing.capability(k, s) == "VERIFIED"]
    if not verified:
        problems.append("no payment method has HG_TOSS_CAPABILITY_* = VERIFIED: provider capability validation is missing.")
    if s.payment_provider == "toss":
        for k in verified:
            try:
                av = billing.availability(k, s=s)
            except Exception:  # noqa: BLE001 - reported below
                continue
            if not av.available:
                problems.append(f"{k} is VERIFIED but unavailable ({av.reason}).")

    secrets = [v for m in billing.merchants(s) for v in (m.secret_key, m.security_key) if v] + (
        [s.payment_token_encryption_key] if s.payment_token_encryption_key else [])
    for d in args.bundles:
        root = Path(d)
        if not root.is_dir():
            problems.append(f"bundle directory not found: {d}")
            continue
        for f in root.rglob("*"):
            if f.suffix not in (".js", ".mjs", ".html", ".css", ".map", ".json") or not f.is_file():
                continue
            text = f.read_text(errors="ignore")
            if SECRET_SHAPE.search(text):
                problems.append(f"a Toss secret-key-shaped string is in the browser bundle: {f}")
            if any(v in text for v in secrets):
                problems.append(f"a configured payment secret is in the browser bundle: {f}")

    app_dir = Path(__file__).resolve().parents[1] / "app"
    source = "\n".join(p.read_text() for p in app_dir.rglob("*.py"))
    for needle in FORBIDDEN_CALLS:
        if needle in source:
            problems.append(f"the server contains a non-billing payment call: {needle}")

    for k in billing.METHOD_KINDS:
        try:
            av = billing.availability(k, s=s)
        except Exception as exc:  # noqa: BLE001 - the rest of the configuration is not production-valid either
            print(f"  {k:<14} capability={billing.capability(k, s):<10} could not be evaluated ({type(exc).__name__})")
            problems.append(f"{k}: availability could not be evaluated ({type(exc).__name__}) — the server configuration is not production-valid.")
            continue
        print(f"  {k:<14} capability={billing.capability(k, s):<10} available={str(av.available):<5} {av.reason or ''}")
    if problems:
        print("\nPAYMENT RELEASE GATE: FAIL")
        for p in dict.fromkeys(problems):
            print(f"  - {p}")
        return 1
    print("\nPAYMENT RELEASE GATE: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
