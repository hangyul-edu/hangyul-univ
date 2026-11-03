"""V31 (REPORT §424): give the pre-V31 keyless task rows a title_key so readers see their own language.

    cd server && .venv/bin/python -m scripts.v31_key_legacy_tasks [--apply]

Dry by default. Only two shapes exist (measured 2026-11-01): university document-request tasks titled
"<University> asked for: <label>" and the seeded "Send the study plan feedback summary". Anything else is left alone.
"""
import re
import sys

from sqlalchemy import select

from app.core.db import SessionLocal
from app.models import Task, University

APPLY = "--apply" in sys.argv
with SessionLocal() as db:
    rows = db.scalars(select(Task).where(Task.title_key.is_(None))).all()
    names = {u.name_en: u for u in db.scalars(select(University)).all()}
    changed = 0
    for t in rows:
        m = re.match(r"^(.+?) asked for: (.+)$", t.title or "")
        if m and m.group(1) in names:
            u = names[m.group(1)]
            t.title_key, t.title_params = "task.universityRequestItem", {"university": u.name_en, "university_id": str(u.id), "item": m.group(2)}
            changed += 1
        elif t.title == "Send the study plan feedback summary":
            t.title_key, t.title_params = "task.sendStudyPlanFeedback", {}
            changed += 1
        else:
            print("left alone:", t.id, t.title)
    print(f"{len(rows)} keyless tasks, {changed} keyed", "(applied)" if APPLY else "(dry run)")
    if APPLY:
        db.commit()
