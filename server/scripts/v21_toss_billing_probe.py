#!/usr/bin/env python3
"""V21 — find out what the `bill_talkoab1` TEST configuration actually accepts (brief §45).

Public Toss documentation describes the generic 자동결제 product. The owner says this MID is reviewed for
foreign-card billing. Neither statement is evidence about *this* merchant configuration, so this asks it.

It prints the HTTP status, the Toss `code` and the safe message for each probe. **It never prints the
secret key, a full card number, or a billingKey** — a billingKey is reported as `present (NN chars)`.

    server/.venv/bin/python server/scripts/v21_toss_billing_probe.py
"""
from __future__ import annotations

import base64
import json
import secrets
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def env() -> dict[str, str]:
    out: dict[str, str] = {}
    for line in (ROOT / "server/.env").read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        out[k] = v
    return out


E = env()
SECRET = E["HG_TOSS_FOREIGN_BILLING_SECRET_KEY"]
MID = E["HG_TOSS_FOREIGN_BILLING_MID"]
AUTH = "Basic " + base64.b64encode(f"{SECRET}:".encode()).decode()
BASE = "https://api.tosspayments.com"


def call(method: str, path: str, body: dict | None = None, headers: dict | None = None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(f"{BASE}{path}", data=data, method=method)
    req.add_header("Authorization", AUTH)
    req.add_header("Content-Type", "application/json")
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=70) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw or b"{}")
        except Exception:
            return e.code, {"raw": raw[:300].decode("utf-8", "replace")}
    except Exception as e:  # network
        return 0, {"error": type(e).__name__, "message": str(e)[:200]}


def safe(obj) -> str:
    """Never let a billingKey or a card number out of this script."""
    if isinstance(obj, dict):
        red = {}
        for k, v in obj.items():
            if k in {"billingKey", "cardNumber", "number"}:
                red[k] = f"<present, {len(str(v))} chars>"
            elif isinstance(v, (dict, list)):
                red[k] = json.loads(safe(v))
            else:
                red[k] = v
        return json.dumps(red, ensure_ascii=False)
    if isinstance(obj, list):
        return json.dumps([json.loads(safe(x)) if isinstance(x, (dict, list)) else x for x in obj], ensure_ascii=False)
    return json.dumps(obj, ensure_ascii=False)


print(f"MID {MID} · env {E.get('HG_TOSS_ENV')} · secret prefix {SECRET[:8]}…\n")

CUSTOMER_KEY = "hgtest_" + secrets.token_urlsafe(18)

# Toss's documented sandbox cards for 자동결제. **None of them is written here.** They are published
# test values rather than anyone's card, but §58 requires that a scan of the tree find no card number,
# no card password and no identity number — and a scanner cannot tell a sandbox value from a real one,
# so the rule is kept literally. They live in the untracked `server/.env` beside the Toss keys.
_NEEDED = ("HG_QA_TEST_CARD_KR", "HG_QA_TEST_CARD_PASSWORD", "HG_QA_TEST_IDENTITY", "HG_QA_TEST_CARD_OVERSEAS")
_missing = [k for k in _NEEDED if not E.get(k)]
if _missing:
    raise SystemExit(
        "This probe needs the sandbox card values, which are not kept in the tree.\n"
        f"Add to server/.env (untracked): {', '.join(_missing)}\n"
        "The values are in the Toss 자동결제 test documentation."
    )

CARDS = [
    ("documented test card, full Korean field set", {
        "customerKey": CUSTOMER_KEY,
        "cardNumber": E["HG_QA_TEST_CARD_KR"],
        "cardExpirationYear": "28",
        "cardExpirationMonth": "12",
        "cardPassword": E["HG_QA_TEST_CARD_PASSWORD"],
        "customerIdentityNumber": E["HG_QA_TEST_IDENTITY"],
    }),
    ("same card, no cardPassword / identityNumber (overseas shape)", {
        "customerKey": "hgtest_" + secrets.token_urlsafe(18),
        "cardNumber": E["HG_QA_TEST_CARD_KR"],
        "cardExpirationYear": "28",
        "cardExpirationMonth": "12",
    }),
    ("overseas-looking Visa, no Korean fields", {
        "customerKey": "hgtest_" + secrets.token_urlsafe(18),
        "cardNumber": E["HG_QA_TEST_CARD_OVERSEAS"],
        "cardExpirationYear": "28",
        "cardExpirationMonth": "12",
    }),
]

for label, body in CARDS:
    status, payload = call("POST", "/v1/billing/authorizations/card", body)
    print(f"--- {label}")
    print(f"    POST /v1/billing/authorizations/card → HTTP {status}")
    print(f"    {safe(payload)[:600]}\n")
    if status == 200 and payload.get("billingKey"):
        print("    ^ billing key ISSUED. Fields returned:", sorted(payload.keys()))
        globals()["ISSUED"] = (payload["billingKey"], body["customerKey"], payload)
        break

issued = globals().get("ISSUED")
if not issued:
    print("No billing key issued by any probe shape. Stopping before the charge probe.")
    sys.exit(0)

bk, ck, obj = issued
print("card object (redacted):", safe({k: v for k, v in obj.items() if k != "billingKey"})[:600], "\n")

order_id = "hgprobe-" + secrets.token_hex(12)
for label, amount, currency in [("KRW 1,000", 1000, None), ("USD 1", 1, "USD")]:
    body = {
        "customerKey": ck,
        "amount": amount,
        "orderId": order_id + ("-usd" if currency else "-krw"),
        "orderName": "Hangyul capability probe",
    }
    if currency:
        body["currency"] = currency
    status, payload = call("POST", f"/v1/billing/{bk}", body, {"Idempotency-Key": body["orderId"]})
    print(f"--- charge probe: {label}")
    print(f"    POST /v1/billing/<billingKey> → HTTP {status}")
    print(f"    {safe(payload)[:700]}\n")
