"""Remove development labels from an existing development database (V12, brief Part 1).

    server/.venv/bin/python -m scripts.v12_clean_dev_labels

A fresh `python -m app.seed.run --reset` already produces clean data: the seed modules no longer name anything
"fixture" or "development only". This script is for a database that was seeded before V12, where those strings
are stored in rows — and stored rows are exactly how the leak reached the agency Today queue and the deadline
timeline, where no amount of front-end care would have caught it.

What it changes, and nothing else:

  · the authorised-agency submission fixture programme, renamed to an ordinary programme name (it stays
    `is_active=False`, so it is still absent from the catalogue, the directory, matching and the public site);
  · submission-connector `provider` / `portal_name` labels that said "Development fixture";
  · task titles and title params that embedded the old programme name.

Idempotent. Reports what it did.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select  # noqa: E402

from app.core.db import SessionLocal  # noqa: E402
from app.models import Program, Task  # noqa: E402
from app.models.v5_success import SubmissionConnector  # noqa: E402
from app.seed.extra_60_submission_v6 import FIXTURE_PROGRAM, FIXTURE_PROGRAM_KO  # noqa: E402

OLD_PROGRAM_NAMES = [
    "Authorised-submission fixture (development only)",
    "Authorized-submission fixture (development only)",
]


def main() -> int:
    changed = {"programs": 0, "connectors": 0, "tasks": 0}
    with SessionLocal() as db:
        for old in OLD_PROGRAM_NAMES:
            for prog in db.scalars(select(Program).where(Program.name_en == old)).all():
                prog.name_en = FIXTURE_PROGRAM
                prog.name_ko = FIXTURE_PROGRAM_KO
                prog.description = (
                    "Exercises the authorised-agency submission flow. Inactive: never listed in the "
                    "catalogue, the directory, matches or the public site."
                )
                changed["programs"] += 1

        for conn in db.scalars(select(SubmissionConnector)).all():
            labels = (conn.provider or "", conn.portal_name or "")
            if any("fixture" in label.lower() or "development" in label.lower() for label in labels):
                conn.provider = None
                conn.portal_name = None
                changed["connectors"] += 1

        # Task titles are rendered from `title_key` + `title_params` where available and from `title` otherwise;
        # the old programme name can sit in either.
        for task in db.scalars(select(Task)).all():
            hit = False
            for old in OLD_PROGRAM_NAMES:
                if task.title and old in task.title:
                    task.title = task.title.replace(old, FIXTURE_PROGRAM)
                    hit = True
                if task.title_params and any(isinstance(v, str) and old in v for v in task.title_params.values()):
                    task.title_params = {
                        k: (v.replace(old, FIXTURE_PROGRAM) if isinstance(v, str) else v)
                        for k, v in task.title_params.items()
                    }
                    hit = True
            if hit:
                changed["tasks"] += 1

        db.commit()

    total = sum(changed.values())
    print(f"programs renamed: {changed['programs']}")
    print(f"connector labels cleared: {changed['connectors']}")
    print(f"task titles rewritten: {changed['tasks']}")
    print("nothing to do — this database is already clean" if total == 0 else f"{total} row(s) updated")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
