"""Seed extension point.

Every module named ``app/seed/extra_*.py`` that defines ``seed(db, ctx)`` is run after the core demo dataset and
before derived state (readiness, engine tasks, analytics rollups) is computed. ``ctx`` carries the objects created by
``run.py`` (sources, unis, agencies, counselors, uni_orgs, staff, students, storage). Modules run in filename order, so
prefix with a number when order matters (``extra_10_personas.py``). This lets features add demo data without editing run.py.
"""
from __future__ import annotations

import importlib
import pkgutil
from typing import Any

from sqlalchemy.orm import Session

import app.seed as seed_pkg


def run_extras(db: Session, ctx: dict[str, Any]) -> None:
    names = sorted(m.name for m in pkgutil.iter_modules(seed_pkg.__path__) if m.name.startswith("extra_"))
    for name in names:
        mod = importlib.import_module(f"app.seed.{name}")
        fn = getattr(mod, "seed", None)
        if callable(fn):
            fn(db, ctx)
            db.flush()
