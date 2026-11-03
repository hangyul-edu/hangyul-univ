"""The canonical refund policy as the server sees it (V22, REPORT §245 L4).

Read from ``shared/refund-policy.json`` (mirror of ``packages/types/src/refund-policy.ts``), so the Terms, the checkout
summary and any refund computation share one definition. ``stage_for(order)`` derives the service stage from the
real records; ``statement()`` returns only what may be said today — the commercial deduction schedule is
``OWNER_POLICY_REQUIRED`` and is never turned into a number here.
"""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

_SHARED = Path(__file__).resolve().parents[3] / "shared" / "refund-policy.json"


@lru_cache
def policy() -> dict:
    return json.loads(_SHARED.read_text(encoding="utf-8"))


def version() -> str:
    return policy()["version"]


def stage_for(*, consultation_done: bool, recommendation_started: bool, recommendation_done: bool, application_work_started: bool,
              document_review_delivered: bool, essay_review_delivered: bool, settlement_started: bool) -> str:
    """The furthest stage reached, in policy order."""
    order = ["SETTLEMENT_STARTED", "ESSAY_REVIEW_DELIVERED", "DOCUMENT_REVIEW_DELIVERED", "APPLICATION_WORK_STARTED",
             "RECOMMENDATION_DONE", "RECOMMENDATION_STARTED", "CONSULTATION_DONE"]
    flags = {"SETTLEMENT_STARTED": settlement_started, "ESSAY_REVIEW_DELIVERED": essay_review_delivered,
             "DOCUMENT_REVIEW_DELIVERED": document_review_delivered, "APPLICATION_WORK_STARTED": application_work_started,
             "RECOMMENDATION_DONE": recommendation_done, "RECOMMENDATION_STARTED": recommendation_started, "CONSULTATION_DONE": consultation_done}
    for k in order:
        if flags[k]:
            return k
    return "BEFORE_START"


def statement(stage_key: str) -> dict:
    p = policy()
    st = next(s for s in p["stages"] if s["key"] == stage_key)
    return {"stage": stage_key, "commenced": st["commenced"], "statutory": st["statutory"], "commercial": st["commercial"],
            "withdrawal_days": p["withdrawal_days"], "refund_business_days": p["refund_business_days"], "version": p["version"],
            "commercial_schedule_approved": p["commercial_schedule_approved"]}
