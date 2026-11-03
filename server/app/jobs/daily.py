"""Daily automation job (cron / scheduler): python -m app.jobs.daily

1. Close intakes whose deadline passed and flag stale facts for review (freshness scan).
2. Regenerate the task & deadline engine for every active student (idempotent).
3. Rebuild analytics rollups so dashboards stay fast.
4. V5 writing review: flag reviews past their expected time (reviewer task + manager escalation) and link decided
   applications to their approved essays for internal outcome learning.
A production deployment would run this from a scheduler (e.g. Kubernetes CronJob / Cloud Scheduler);
per-event work already happens inline in the API."""
from sqlalchemy import select

from app.core.db import SessionLocal
from app.models import StudentProfile
from app.services.analytics import rollup
from app.services.freshness import run_freshness_scan
from app.services.tasks_engine import generate_for_student
from app.services.writing import record_outcomes, sla_sweep


def run(db) -> dict:
    """One idempotent pass; the V29 worker (`python -m app.worker`) calls this as its `daily` job."""
    reviews = run_freshness_scan(db)
    created = 0
    for (uid,) in db.execute(select(StudentProfile.user_id)):
        created += generate_for_student(db, uid)
    metrics = rollup(db)
    late = sla_sweep(db)
    outcomes = record_outcomes(db)
    db.commit()
    return {"freshness_reviews": reviews, "tasks_created": created, "metric_rows": metrics, "late_essay_reviews": late, "writing_outcomes": outcomes}


def main() -> None:
    with SessionLocal() as db:
        r = run(db)
    print(f"freshness reviews created: {r['freshness_reviews']} · tasks created: {r['tasks_created']} · metric rows: {r['metric_rows']} · "
          f"late essay reviews flagged: {r['late_essay_reviews']} · writing outcomes: {r['writing_outcomes']}")


if __name__ == "__main__":
    main()
