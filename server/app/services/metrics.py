"""Unified university metrics — one definition per metric, used by every screen and the native app.

Two populations, never mixed:

* **Pipeline** — this university's *submitted* Hangyul applications, optionally scoped to one intake (and nationality,
  program, degree, agency). Each application counts toward every funnel step it has reached. For open applications the
  current status decides progress; for closed ones (rejected / withdrawn) history tells how far they got.
* **Cohorts** — enrolled students (StudentEnrollment) grouped by entry cohort. Retention and graduation are cohort
  metrics and are never computed from the pipeline population.

Every rate carries numerator, denominator, population, period and definition, and is withheld (``insufficient``) when
the denominator is below ``MIN_DENOMINATOR``.
"""
from __future__ import annotations

import statistics
from collections import defaultdict
from dataclasses import dataclass
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    Application,
    ApplicationStatusHistory,
    ArrivalPlan,
    Program,
    ProgramIntake,
    StudentEnrollment,
    StudentTerm,
)
from app.models.base import utcnow
from app.models.enums import EnrollmentStatus

MIN_DENOMINATOR = 5

# Funnel steps, in order, for the pipeline population.
STEPS = ["SUBMITTED", "REVIEWED", "OFFERED", "ACCEPTED", "TUITION_PAID", "VISA_ISSUED", "ARRIVED", "ENROLLED"]
STEP_DEFINITIONS = {
    "SUBMITTED": "Applications submitted to your university.",
    "REVIEWED": "Submitted applications your team has opened for review or decided.",
    "OFFERED": "Applications that received an offer.",
    "ACCEPTED": "Offers the student accepted.",
    "TUITION_PAID": "Accepted offers whose tuition payment your team confirmed.",
    "VISA_ISSUED": "Students whose student visa was issued.",
    "ARRIVED": "Students who reported arriving in Korea (or enrolled).",
    "ENROLLED": "Students your team marked as enrolled.",
}
# Rank of each application status on the funnel (the step it has reached at least).
_RANK = {
    "SUBMITTED": 0,
    "UNIVERSITY_REVIEW": 1, "ADDITIONAL_DOCUMENTS": 1, "INTERVIEW": 1, "WAITLISTED": 1, "REJECTED": 1,
    "OFFERED": 2,
    "OFFER_ACCEPTED": 3, "TUITION_PENDING": 3,
    "TUITION_PAID": 4, "ADMISSION_CERTIFICATE_PENDING": 4, "ADMISSION_CERTIFICATE_ISSUED": 4, "VISA_PREPARATION": 4, "VISA_SUBMITTED": 4,
    "VISA_ISSUED": 5,
    "ENROLLED": 7,
}


@dataclass(frozen=True)
class MetricDef:
    key: str
    numerator: str
    denominator: str
    definition: str


PIPELINE_METRICS = [
    MetricDef("offer_rate", "OFFERED", "DECIDED", "Offers ÷ decided applications (offered + not admitted)."),
    MetricDef("acceptance_rate", "ACCEPTED", "OFFERED", "Offers accepted ÷ offers made."),
    MetricDef("yield", "ENROLLED", "OFFERED", "Enrolled ÷ offers made."),
    MetricDef("tuition_paid_rate", "TUITION_PAID", "ACCEPTED", "Tuition confirmed ÷ offers accepted."),
    MetricDef("visa_conversion", "VISA_ISSUED", "TUITION_PAID", "Visas issued ÷ tuition confirmed."),
    MetricDef("arrival_rate", "ARRIVED", "VISA_ISSUED", "Arrived in Korea ÷ visas issued."),
    MetricDef("enrollment_rate", "ENROLLED", "ARRIVED", "Enrolled ÷ arrived."),
]
COHORT_DEFINITIONS = {
    "retention": "Students still enrolled, on leave or graduated after their second term ÷ students who reached a second term.",
    "graduation": "Graduated ÷ students whose expected graduation date has passed.",
}
MEDIAN_DEFINITION = "Median days from submission to the first decision (offer, waitlist or not admitted)."

# ---------------------------------------------------------------- V8 glossary: one definition per university metric
PIPELINE_POP = "Submitted applications to your university (Hangyul applicants who reached submission, incl. later withdrawn)."
COHORT_POP = "Enrolled Hangyul students (enrolment records), grouped by entry cohort."
INTAKE_PIPELINE = "The intake selected on the screen; Overview defaults to the intake in admissions now. 'All intakes' when none is selected."
INTAKE_COHORT = "All entry cohorts (cohort = intake of enrolment); not affected by the intake filter."
RANGE_PIPELINE = "No date window: every application in the population counts, whenever it was submitted. The period shown is first → last submission."
RANGE_COHORT = "As of today."
SMALL = f"Rates with a denominator below {MIN_DENOMINATOR} are withheld and shown as 'Too few to rate · n of N'."


_CODES = {PIPELINE_POP: "pipeline", COHORT_POP: "cohort", INTAKE_PIPELINE: "pipeline", INTAKE_COHORT: "cohort", "All intakes.": "all",
          RANGE_PIPELINE: "pipeline", RANGE_COHORT: "today", SMALL: "rate"}


def _g(key, kind, numerator, denominator, definition, population=PIPELINE_POP, intake=INTAKE_PIPELINE, date_range=RANGE_PIPELINE, small=SMALL):
    # ``codes`` lets a client show the same definition in its own language (the English text stays the reference).
    codes = {"population": _CODES.get(population, key), "intake": _CODES.get(intake, key), "date_range": _CODES.get(date_range, key),
             "small_sample": _CODES.get(small, "count" if kind == "count" else key)}
    return {"key": key, "kind": kind, "numerator": numerator, "denominator": denominator, "population": population,
            "intake": intake, "date_range": date_range, "small_sample": small, "definition": definition, "codes": codes}


GLOSSARY = [
    *[_g(k.lower(), "count", k, None, STEP_DEFINITIONS[k], small="Counts are always shown; conversions below the minimum are withheld.") for k in STEPS],
    *[_g(m.key, "rate", m.numerator, m.denominator, m.definition) for m in PIPELINE_METRICS],
    _g("median_processing_days", "median", "Days from submission to the first decision", "Applications with a decision",
       MEDIAN_DEFINITION, small=f"Withheld when fewer than {MIN_DENOMINATOR} applications have a decision."),
    _g("complete_on_first_review", "rate", "Submitted applications with no university document request", "SUBMITTED",
       "Submitted applications the university reviewed without requesting any additional document ÷ submitted applications."),
    _g("additional_document_request_rate", "rate", "Submitted applications with at least one university document request", "SUBMITTED",
       "Submitted applications with at least one university document request ÷ submitted applications."),
    _g("no_show", "rate", "VISA_ISSUED − ARRIVED", "VISA_ISSUED", "Visa issued but no arrival reported ÷ visas issued."),
    _g("retention", "rate", "Still enrolled, on leave or graduated after the second term", "Students who reached a second term",
       COHORT_DEFINITIONS["retention"], population=COHORT_POP, intake=INTAKE_COHORT, date_range=RANGE_COHORT),
    _g("graduation", "rate", "Graduated", "Students whose expected graduation date has passed",
       COHORT_DEFINITIONS["graduation"], population=COHORT_POP, intake=INTAKE_COHORT, date_range=RANGE_COHORT),
    _g("visa_rate", "rate", "VISA_ISSUED", "ADMITTED (offered) in the same group", "Visas issued ÷ students admitted in the same group.",
       population="Admitted Hangyul applicants grouped by cohort, country, program or agency.", intake=INTAKE_COHORT, date_range=RANGE_COHORT),
    _g("documents_verified", "rate", "Shared documents a Hangyul reviewer verified", "Documents shared with your university on submitted applications",
       "Shared documents a Hangyul reviewer verified ÷ documents shared with your university on submitted applications.",
       intake="All intakes.", date_range=RANGE_COHORT),
    _g("request_turnaround", "median", "Days from a document request to the returned document", "Answered requests",
       "Median days from your document request to the student's returned document (answered requests only).",
       intake="All intakes.", date_range=RANGE_COHORT, small=f"Withheld when fewer than {MIN_DENOMINATOR} requests were answered."),
]
GLOSSARY_BY_KEY = {g["key"]: g for g in GLOSSARY}


def rate(num: int, den: int) -> dict:
    """Shape used everywhere: withheld below MIN_DENOMINATOR."""
    if den < MIN_DENOMINATOR:
        return {"value": None, "numerator": num, "denominator": den, "insufficient": True, "insufficient_data": True}
    return {"value": round(num / den, 4), "numerator": num, "denominator": den, "insufficient": False, "insufficient_data": False}


def intake_label(key: str | None) -> str:
    if not key:
        return "all intakes"
    parts = str(key).split("-")
    if len(parts) != 2:
        return "one intake"
    y, t = parts
    return f"{t.title()} {y}"


def _filtered(db: Session, university_id, filters: dict):
    # Late import keeps analytics.py free to import this module.
    from app.services.access import university_visible
    from app.services.analytics import _app_filter

    # V8: the same population the university can list (an application sent back before submission leaves the funnel too),
    # so every funnel count equals its drill-down list.
    stmt = _app_filter(select(Application.id, Application.status, Application.student_user_id, Application.submitted_at, Application.intake_id,
                              Application.agency_org_id, Application.program_id, Application.readiness_percent),
                       university_id=university_id, filters=filters).where(university_visible())
    return db.execute(stmt).all()


def _context(db: Session, rows) -> dict:
    """Everything the funnel needs about a set of applications, fetched in four queries regardless of how the rows are
    grouped afterwards (V8: per-agency figures come from one pass instead of one request per agency)."""
    from app.models import DocumentRequest

    ids = [r.id for r in rows]
    reached: dict = {r.id: {r.status.value} for r in rows}
    first_at: dict = defaultdict(dict)
    if ids:
        for app_id, to, at in db.execute(
            select(ApplicationStatusHistory.application_id, ApplicationStatusHistory.to_status, ApplicationStatusHistory.created_at)
            .where(ApplicationStatusHistory.application_id.in_(ids))
        ).all():
            reached[app_id].add(to.value)
            prev = first_at[app_id].get(to.value)
            if prev is None or at < prev:
                first_at[app_id][to.value] = at
    visa_students = [r.student_user_id for r in rows if (_top(r, reached[r.id]) or 0) >= 5]
    arrived_students = set(db.scalars(select(ArrivalPlan.student_user_id).where(
        ArrivalPlan.student_user_id.in_(visa_students), ArrivalPlan.arrived_at.is_not(None))).all()) if visa_students else set()
    asked = set(db.scalars(select(DocumentRequest.application_id).where(DocumentRequest.application_id.in_(ids)).distinct()).all()) if ids else set()
    return {"reached": reached, "first_at": first_at, "arrived": arrived_students, "asked": asked}


def top_step(r, ctx: dict) -> int | None:
    """Index in STEPS of the furthest funnel step this application reached (None = never submitted)."""
    top = _top(r, ctx["reached"][r.id])
    if top is not None and top >= 5 and r.student_user_id in ctx["arrived"]:
        top = max(top, 6)
    return top


def _compute(rows, ctx: dict, f: dict) -> dict:
    reached = ctx["reached"]
    counts = dict.fromkeys(STEPS, 0)
    rejected = withdrawn = 0
    in_population = []
    proc_days = []
    for r in rows:
        top = top_step(r, ctx)
        if top is None:
            continue  # never submitted: stays private to the student and agency
        in_population.append(r)
        for i in range(top + 1):
            counts[STEPS[i]] += 1
        rejected += "REJECTED" in reached[r.id]
        withdrawn += "WITHDRAWN" in reached[r.id]
        h = ctx["first_at"][r.id]
        sub = h.get("SUBMITTED") or r.submitted_at
        decisions = [h[s] for s in ("OFFERED", "WAITLISTED", "REJECTED") if s in h]
        if sub and decisions:
            proc_days.append((min(decisions) - sub).days)

    counts["DECIDED"] = counts["OFFERED"] + rejected
    population = _population(f, in_population)
    steps = []
    for i, key in enumerate(STEPS):
        steps.append({
            "key": key, "count": counts[key], "definition": STEP_DEFINITIONS[key],
            "conversion": rate(counts[key], counts[STEPS[i - 1]]) if i else None,
        })
    metrics = {}
    for m in PIPELINE_METRICS:
        metrics[m.key] = {"key": m.key, **rate(counts[m.numerator], counts[m.denominator]), "numerator_label": m.numerator,
                          "denominator_label": m.denominator, "population": population["label"], "period": population["period"],
                          "definition": m.definition}
    enough = len(proc_days) >= MIN_DENOMINATOR
    metrics["median_processing_days"] = {
        "key": "median_processing_days", "value": statistics.median(proc_days) if enough else None, "numerator": None,
        "denominator": len(proc_days), "insufficient": not enough, "insufficient_data": not enough,
        "population": population["label"], "period": population["period"], "definition": MEDIAN_DEFINITION,
    }
    # V5: application quality as the university experiences it — submitted applications the university never had to
    # ask more documents for, and the share that needed at least one request (same population as the funnel).
    submitted_ids = [r.id for r in in_population]
    asked = [i for i in submitted_ids if i in ctx["asked"]]
    for key in ("complete_on_first_review", "additional_document_request_rate"):
        num = len(submitted_ids) - len(asked) if key == "complete_on_first_review" else len(asked)
        metrics[key] = {"key": key, **rate(num, len(submitted_ids)), "numerator_label": key, "denominator_label": "SUBMITTED",
                        "population": population["label"], "period": population["period"], "definition": GLOSSARY_BY_KEY[key]["definition"]}
    readiness = [r.readiness_percent for r in in_population if r.readiness_percent is not None]
    return {
        "population": population, "steps": steps, "metrics": metrics, "counts": counts,
        "closed": {"rejected": rejected, "withdrawn": withdrawn}, "min_denominator": MIN_DENOMINATOR,
        "avg_readiness_at_submission": round(sum(readiness) / len(readiness)) if readiness else None,
    }


def pipeline(db: Session, university_id, filters: dict | None = None) -> dict:
    """Funnel + rates for the submitted-application population."""
    f = {k: v for k, v in (filters or {}).items() if v}
    rows = _filtered(db, university_id, f)
    return _compute(rows, _context(db, rows), f)


def pipeline_by(db: Session, university_id, filters: dict | None, dim: str) -> dict:
    """The same pipeline, grouped by ``agency`` / ``program`` / ``nationality`` / ``intake`` — one pass, identical definitions."""
    f = {k: v for k, v in (filters or {}).items() if v}
    rows = _filtered(db, university_id, f)
    ctx = _context(db, rows)
    keyf = {"agency": lambda r: r.agency_org_id, "program": lambda r: r.program_id, "intake": lambda r: r.intake_id}.get(dim)
    if dim == "nationality":
        from app.models import StudentProfile

        nat = dict(db.execute(select(StudentProfile.user_id, StudentProfile.nationality).where(
            StudentProfile.user_id.in_({r.student_user_id for r in rows} or {None}))).all())
        keyf = lambda r: nat.get(r.student_user_id)  # noqa: E731
    if keyf is None:
        raise ValueError(dim)
    groups: dict = defaultdict(list)
    for r in rows:
        groups[keyf(r)].append(r)
    return {k: _compute(g, ctx, {**f, dim: k}) for k, g in groups.items()}


def reached_ids(db: Session, university_id, filters: dict | None, step: str) -> list:
    """Applications that reached ``step`` (or further) on the funnel — the exact records behind a funnel bar."""
    f = {k: v for k, v in (filters or {}).items() if v}
    idx = STEPS.index(step)
    rows = _filtered(db, university_id, f)
    ctx = _context(db, rows)
    tops = ((r.id, top_step(r, ctx)) for r in rows)
    return [i for i, top in tops if top is not None and top >= idx]  # top 0 = SUBMITTED is a real step (never `or -1`)


def _top(r, statuses: set[str]) -> int | None:
    ranks = [_RANK[s] for s in statuses if s in _RANK]
    if not ranks:
        return None
    cur = r.status.value
    return _RANK[cur] if cur in _RANK and cur != "REJECTED" else max(ranks)


def _population(f: dict, rows) -> dict:
    subs = [r.submitted_at for r in rows if r.submitted_at]
    return {
        "label": "Submitted applications · " + intake_label(f.get("intake")),
        "intake": f.get("intake") or None,
        "filters": {k: v for k, v in f.items() if k != "intake"},
        "size": len(rows),
        "period": {"from": min(subs).date().isoformat() if subs else None, "to": max(subs).date().isoformat() if subs else None},
    }


def intakes(db: Session, university_id, today: date | None = None) -> list[dict]:
    """Intakes that have submitted applications, newest first, so screens can scope the pipeline explicitly.

    Exactly one intake is marked ``current`` (V4): the intake in admissions now — the one with the nearest application
    deadline that has not passed yet; when every deadline has passed, the latest intake. Screens default to it so a
    funnel never mixes cohorts silently.
    """
    from app.services.analytics import _app_filter

    today = today or utcnow().date()
    from app.services.access import university_visible

    stmt = _app_filter(select(ProgramIntake.year, ProgramIntake.term, Application.status, ProgramIntake.application_deadline)
                       .join(ProgramIntake, ProgramIntake.id == Application.intake_id), university_id=university_id).where(university_visible())
    counts: dict = defaultdict(int)
    for y, t, _st, _ in db.execute(stmt).all():
        counts[(y, t.value)] += 1
    # Nearest upcoming deadline per intake across all of the university's programs (not only the ones applied to).
    upcoming: dict = {}
    for y, t, dl in db.execute(select(ProgramIntake.year, ProgramIntake.term, ProgramIntake.application_deadline)
                               .join(Program, Program.id == ProgramIntake.program_id)
                               .where(Program.university_id == university_id, ProgramIntake.application_deadline >= today)).all():
        k = (y, t.value)
        if k in counts and (k not in upcoming or dl < upcoming[k]):
            upcoming[k] = dl
    order = {"SPRING": 0, "SUMMER": 1, "FALL": 2, "WINTER": 3}
    out = [{"key": f"{y}-{t}", "label": intake_label(f"{y}-{t}"), "submitted": n, "current": False,
            "next_deadline": upcoming[(y, t)].isoformat() if (y, t) in upcoming else None} for (y, t), n in counts.items()]
    out.sort(key=lambda x: (int(x["key"].split("-")[0]), order.get(x["key"].split("-")[1], 9)), reverse=True)
    if out:
        with_deadline = [x for x in out if x["next_deadline"]]
        pick = min(with_deadline, key=lambda x: x["next_deadline"]) if with_deadline else out[0]
        pick["current"] = True
    return out


def cohorts(db: Session, university_id, filters: dict | None = None) -> dict:
    """Longitudinal outcomes for enrolled students by entry cohort (separate population from the pipeline)."""
    f = filters or {}
    stmt = select(StudentEnrollment).where(StudentEnrollment.university_id == university_id)
    if f.get("nationality"):
        stmt = stmt.where(StudentEnrollment.nationality == f["nationality"])
    if f.get("program_id"):
        stmt = stmt.where(StudentEnrollment.program_id == f["program_id"])
    if f.get("agency_id"):
        stmt = stmt.where(StudentEnrollment.agency_org_id == f["agency_id"])
    enrollments = db.scalars(stmt).all()
    terms: dict = defaultdict(int)
    if enrollments:
        for eid, in db.execute(select(StudentTerm.enrollment_id).where(StudentTerm.enrollment_id.in_([e.id for e in enrollments]))).all():
            terms[eid] += 1
    today = utcnow().date()

    def summarize(es: list) -> dict:
        t2 = [e for e in es if terms[e.id] >= 2 or e.status == EnrollmentStatus.GRADUATED]
        kept = [e for e in t2 if e.status in (EnrollmentStatus.ENROLLED, EnrollmentStatus.GRADUATED, EnrollmentStatus.ON_LEAVE)]
        due = [e for e in es if e.expected_graduation and e.expected_graduation < today]
        grad = [e for e in due if e.status == EnrollmentStatus.GRADUATED]
        by_status: dict = defaultdict(int)
        for e in es:
            by_status[e.status.value] += 1
        return {
            "enrolled": len(es), "by_status": dict(by_status),
            "retention": {**rate(len(kept), len(t2)), "definition": COHORT_DEFINITIONS["retention"]},
            "graduation": {**rate(len(grad), len(due)), "definition": COHORT_DEFINITIONS["graduation"]},
        }

    groups: dict = defaultdict(list)
    for e in enrollments:
        groups[e.cohort_label].append(e)
    rows = [{"cohort": c, "label": intake_label(c), **summarize(es)} for c, es in groups.items()]
    rows.sort(key=lambda r: r["cohort"], reverse=True)
    return {"population": "Enrolled Hangyul students · by entry cohort", "total": summarize(enrollments), "cohorts": rows,
            "min_denominator": MIN_DENOMINATOR, "as_of": date.today().isoformat()}
