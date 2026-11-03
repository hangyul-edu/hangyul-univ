"""Visa playbooks — REFERENCE data (V9 visa-data workstream; V32 moved it out of the test fixtures into the reference seed).

Loads the 2026-10-10 re-validated playbooks (docs/research/visa-playbooks.json, corrected by
scripts/v9_visa_research_apply.py) through the existing versioned loader ``visa_routes.load_playbooks``: a changed route
becomes a NEW version and the previous one is kept with ``is_current=False``.

Time-versioned rules: a route may carry ``scheduled_changes`` (e.g. Kyrgyzstan's KICB funds rule from 2027-01-01).
``materialize(routes, today)`` applies a change only when ``effective_from <= today``; before that date the stored
current values are untouched. Re-running the load on/after the date (``scripts/v9_visa_data.py``) produces the new
version. Arrival facts need no DB step: ``concierge.official_facts`` reads arrival-official.json /
post-arrival-official.json directly (cache keyed on the file's mtime).
"""
from __future__ import annotations

import copy
import json
from datetime import date
from typing import Any

from sqlalchemy.orm import Session

from app.services import visa_routes as vr

IN_FORCE = "IN_FORCE"


def _set(route: dict, path: str, value: Any) -> None:
    if path.startswith("documents:"):
        key, field = path[len("documents:"):].split(".", 1)
        doc = next((d for d in route.get("documents") or [] if d.get("key") == key), None)
        if doc is not None:
            doc[field] = value
        return
    head, _, field = path.partition(".")
    if field:
        route.setdefault(head, {})
        route[head][field] = value
    else:
        route[head] = value


def materialize(routes: list[dict], today: date) -> list[dict]:
    """Copy of ``routes`` with every scheduled change whose ``effective_from`` is on or before ``today`` applied.
    Changes not yet in force are left as stored data only (never applied early)."""
    out = copy.deepcopy(routes)
    for r in out:
        for sc in r.get("scheduled_changes") or []:
            if sc.get("status") == IN_FORCE or date.fromisoformat(sc["effective_from"]) > today:
                continue
            for ch in sc.get("changes") or []:
                _set(r, ch["path"], ch["value"])
            # The "announced, not in force" note no longer applies once the rule is in force.
            r["special_notes"] = [n for n in r.get("special_notes") or [] if not (n.startswith("Announced by the embassy") and sc["effective_from"] in n)]
            sc["status"] = IN_FORCE
    return out


def load_dataset() -> list[dict]:
    return json.loads((vr.REPO_ROOT / vr.DATASET).read_text(encoding="utf-8"))


def load(db: Session, today: date | None = None) -> dict:
    return vr.load_playbooks(db, data=materialize(load_dataset(), today or date.today()))

