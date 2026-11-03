"""V6 university console: what Hangyul's preparation means for an admissions office, measured — never asserted.

* ``preparation`` — of the documents students shared with the university on submitted applications, how many were verified
  by a reviewer before the university opened them; and how quickly the university's own document requests were answered.
* ``statements`` — the final, approved text of the personal statement / study plan attached to a submitted application,
  so the committee can read it in the console instead of downloading a file.

Rates follow the unified metrics service (``metrics.rate``): withheld below ``MIN_DENOMINATOR`` with numerator and denominator.
"""
from __future__ import annotations

import statistics

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Application, ApplicationDocument, Document, DocumentRequest, Essay
from app.models.enums import DocumentStatus, EssayStatus
from app.services.access import PRE_SUBMISSION, university_visible
from app.services.metrics import MIN_DENOMINATOR, rate

VERIFIED_DEFINITION = "Shared documents a Hangyul reviewer verified ÷ documents shared with your university on submitted applications."
TURNAROUND_DEFINITION = "Median days from your document request to the student's returned document (answered requests only)."


def preparation(db: Session, university_id) -> dict:
    submitted = select(Application.id).where(Application.university_id == university_id, university_visible())
    statuses = db.scalars(
        select(Document.status)
        .join(ApplicationDocument, ApplicationDocument.document_id == Document.id)
        .where(ApplicationDocument.application_id.in_(submitted), ApplicationDocument.shared_with_university.is_(True))
    ).all()
    verified = sum(1 for s in statuses if s == DocumentStatus.VERIFIED)

    reqs = db.execute(
        select(DocumentRequest.status, DocumentRequest.requested_at, DocumentRequest.fulfilled_at)
        .where(DocumentRequest.application_id.in_(submitted))
    ).all()
    days = [(r.fulfilled_at - r.requested_at).total_seconds() / 86_400 for r in reqs if r.status == "FULFILLED" and r.fulfilled_at and r.requested_at]
    enough = len(days) >= MIN_DENOMINATOR
    return {
        "documents_verified": {**rate(verified, len(statuses)), "definition": VERIFIED_DEFINITION},
        "requests": {
            "total": len(reqs),
            "answered": sum(1 for r in reqs if r.status == "FULFILLED"),
            "open": sum(1 for r in reqs if r.status == "OPEN"),
            "cancelled": sum(1 for r in reqs if r.status == "CANCELLED"),
            "median_days_to_answer": round(statistics.median(days), 1) if enough else None,
            "answered_n": len(days),
            "insufficient": not enough,
            "definition": TURNAROUND_DEFINITION,
        },
        "min_denominator": MIN_DENOMINATOR,
    }


def statements(db: Session, app: Application) -> list[dict]:
    """Approved statements only: drafts and reviewer comments stay with the student and their counselor."""
    if app.status in PRE_SUBMISSION:
        return []
    out = []
    for e in db.scalars(select(Essay).where(Essay.application_id == app.id, Essay.status == EssayStatus.APPROVED).order_by(Essay.essay_type)).all():
        v = next((x for x in e.versions if x.version == e.current_version), e.versions[-1] if e.versions else None)
        if v is None:
            continue
        out.append({
            "id": str(e.id), "essay_type": e.essay_type.value, "title": e.title, "prompt": e.prompt, "word_limit": e.word_limit,
            "body": v.body, "words": len(v.body.split()), "version": v.version,
            "approved_at": v.created_at.isoformat() if v.created_at else None,
        })
    return out


# ---------------------------------------------------------------- V9 U6: requirement impact preview
#
# "If we change TOPIK 3 → 4, how many prospective students who match this program today would stop meeting it?"
# Population ("currently matching prospective students"): students who saved this program, students with an active
# application to it that is not submitted yet, and students whose latest match snapshot for it is STRONG or COMPETITIVE.
# Students who already submitted to the program are applicants, judged on the rules at submission, and are not counted.
# The estimate is shown ONLY when every counted profile has the data each changed rule needs; otherwise the answer is
# "Not enough data to estimate" with how many profiles lack which field. Self-reported scores count (planned tests do not).

IMPACT_KEYS = ("min_gpa_percent", "min_topik_level", "min_ielts", "min_toefl_ibt", "min_prior_education", "language_alternative")
LANG_TESTS = (("min_topik_level", "TOPIK"), ("min_ielts", "IELTS"), ("min_toefl_ibt", "TOEFL_IBT"))
EDU_RANK = {"HIGH_SCHOOL": 1, "ASSOCIATE": 2, "BACHELOR": 3, "MASTER": 4, "DOCTORATE": 5}
PRE_SUBMIT_ACTIVE = ("DRAFT", "PROFILE_REVIEW", "DOCUMENT_PREPARATION", "READY")
IMPACT_DEFINITION = ("Prospective students who match this program today (saved it, have an active application not yet submitted, or whose "
                     "latest match for it is Strong or Possible) and meet the current rule but would not meet the proposed one.")


def _and3(vals: list) -> bool | None:
    """Three-valued AND: any False → False; all True → True; otherwise unknown."""
    if any(v is False for v in vals):
        return False
    return True if all(v is True for v in vals) else None


def _or3(vals: list) -> bool | None:
    if any(v is True for v in vals):
        return True
    return False if all(v is False for v in vals) else None


def _dims(changes: dict) -> list[str]:
    out = []
    if "min_gpa_percent" in changes:
        out.append("GPA")
    if "min_prior_education" in changes:
        out.append("PRIOR_EDUCATION")
    if any(k in changes for k in ("min_topik_level", "min_ielts", "min_toefl_ibt", "language_alternative")):
        out.append("LANGUAGE")
    return out


def _eval(rule: dict, facts: dict, dims: list[str]) -> tuple[bool | None, set[str]]:
    """Whether a profile meets ``rule`` on the given dimensions, and which fields were missing for an unknown answer."""
    results, missing = [], set()
    if "GPA" in dims:
        need = rule.get("min_gpa_percent")
        if need is None:
            results.append(True)
        elif facts["gpa"] is None:
            results.append(None)
            missing.add("GPA")
        else:
            results.append(facts["gpa"] >= need)
    if "PRIOR_EDUCATION" in dims:
        need = EDU_RANK.get(rule.get("min_prior_education") or "", 0)
        if not need:
            results.append(True)
        elif facts["edu"] is None:
            results.append(None)
            missing.add("PRIOR_EDUCATION")
        else:
            results.append(facts["edu"] >= need)
    if "LANGUAGE" in dims:
        per = []
        for key, test in LANG_TESTS:
            need = rule.get(key)
            if not need:
                continue
            have = facts["scores"].get(test)
            if have is None:
                per.append((None, test))
            else:
                per.append((have >= need, test))
        if not per:
            results.append(True)
        else:
            vals = [v for v, _ in per]
            r = _or3(vals) if rule.get("language_alternative") else _and3(vals)
            results.append(r)
            if r is None:
                missing.update(test for v, test in per if v is None)
    r = _and3(results) if results else True
    return r, (missing if r is None else set())


def requirement_impact(db: Session, program, current: dict, changes: dict) -> dict:
    """Impact of replacing ``current`` with ``current | changes`` on currently matching prospective students."""
    from collections import defaultdict as _dd

    from sqlalchemy import func as _f

    from app.models import MatchSnapshot, SavedUniversity, StudentEducation, StudentLanguage, StudentProfile

    changed = {k: v for k, v in changes.items() if k in IMPACT_KEYS and current.get(k) != v}
    dims = _dims(changed)
    if not dims:
        return {"applies": False, "dimensions": [], "definition": IMPACT_DEFINITION}
    proposed = {**current, **changed}

    saved = set(db.scalars(select(SavedUniversity.user_id).where(SavedUniversity.program_id == program.id)).all())
    active = set(db.scalars(select(Application.student_user_id).where(
        Application.program_id == program.id, Application.status.in_(PRE_SUBMIT_ACTIVE))).all())
    latest = (select(MatchSnapshot.user_id, _f.max(MatchSnapshot.created_at).label("at"))
              .where(MatchSnapshot.program_id == program.id).group_by(MatchSnapshot.user_id).subquery())
    matched = set(db.scalars(select(MatchSnapshot.user_id).join(latest, (latest.c.user_id == MatchSnapshot.user_id) & (latest.c.at == MatchSnapshot.created_at))
                             .where(MatchSnapshot.program_id == program.id, MatchSnapshot.tier.in_(("STRONG", "COMPETITIVE")))).all())
    submitted = set(db.scalars(select(Application.student_user_id).where(Application.program_id == program.id, university_visible())).all())
    people = (saved | active | matched) - submitted

    profiles = dict(db.execute(select(StudentProfile.user_id, StudentProfile.id).where(StudentProfile.user_id.in_(people or [None]))).all())
    by_profile = {v: k for k, v in profiles.items()}
    facts = {u: {"gpa": None, "edu": None, "scores": {}} for u in people}
    for pid, level, gpa in db.execute(select(StudentEducation.profile_id, StudentEducation.level, StudentEducation.gpa_percent)
                                      .where(StudentEducation.profile_id.in_(list(profiles.values()) or [None]))).all():
        f = facts[by_profile[pid]]
        if gpa is not None and (f["gpa"] is None or gpa > f["gpa"]):
            f["gpa"] = gpa
        rank = EDU_RANK.get(level, 0)
        if rank and (f["edu"] is None or rank > f["edu"]):
            f["edu"] = rank
    for pid, test, score, planned in db.execute(select(StudentLanguage.profile_id, StudentLanguage.test, StudentLanguage.score, StudentLanguage.is_planned)
                                                .where(StudentLanguage.profile_id.in_(list(profiles.values()) or [None]))).all():
        if planned:
            continue
        k = test.value if hasattr(test, "value") else str(test)
        s = facts[by_profile[pid]]["scores"]
        s[k] = max(score, s.get(k, score))

    stop = start = unknown = unknown_start = 0
    missing: dict = _dd(int)
    for u in people:
        cur, miss_c = _eval(current, facts[u], dims)
        new, miss_n = _eval(proposed, facts[u], dims)
        if cur is None or new is None:
            unknown_start += cur is None or cur is False
        if cur is None or (cur is True and new is None):
            unknown += 1
            for m in (miss_c | miss_n):
                missing[m] += 1
            continue
        stop += cur is True and new is False
        start += cur is False and new is True
    complete = unknown == 0
    return {
        "applies": True, "dimensions": dims, "definition": IMPACT_DEFINITION,
        "population": {"total": len(people), "saved": len(saved - submitted), "active_applications": len(active - submitted),
                       "strong_or_competitive": len(matched - submitted)},
        # would_start (a lowered minimum) is reported only when it is fully determinable too.
        "estimate": {"would_stop": stop, "would_start": start if unknown_start == 0 else None} if complete else None,
        "insufficient": None if complete else {"profiles": unknown, "of": len(people), "missing": dict(sorted(missing.items()))},
    }


# ---------------------------------------------------------------- V9 U7: partnership value (every number with cohort + n)

PARTNER_METRICS = [
    # key, source ("pipeline" | "cohort"), metric key in that source
    ("complete_on_first_review", "pipeline", "complete_on_first_review"),
    ("additional_document_request_rate", "pipeline", "additional_document_request_rate"),
    ("median_review_days", "pipeline", "median_processing_days"),
    ("offer_rate", "pipeline", "offer_rate"),
    ("acceptance_rate", "pipeline", "acceptance_rate"),
    ("tuition_paid_rate", "pipeline", "tuition_paid_rate"),
    ("visa_conversion", "pipeline", "visa_conversion"),
    ("arrival_rate", "pipeline", "arrival_rate"),
    ("enrollment_rate", "pipeline", "enrollment_rate"),
    ("retention", "cohort", "retention"),
    ("graduation", "cohort", "graduation"),
]
VISA_OUTCOME_DEFINITION = ("Visa refused ÷ visa decisions (issued + refused) for applications to your university from this agency, in the "
                           "selected intake. A refusal counts only when it was recorded on the student's visa case; unrecorded outcomes are "
                           "listed separately, never assumed.")


def visa_outcomes(db: Session, university_id, filters: dict | None = None) -> dict:
    """Per agency (and overall): visa issued / refused / no decision recorded yet, for applications that reached tuition paid."""
    from app.models import Organization, VisaCase
    from app.services import metrics as m

    f = {k: v for k, v in (filters or {}).items() if v}
    rows = m._filtered(db, university_id, f)
    ctx = m._context(db, rows)
    eligible = [r for r in rows if (m.top_step(r, ctx) or -1) >= m.STEPS.index("TUITION_PAID")]
    refused_ids = set(db.scalars(select(VisaCase.application_id).where(VisaCase.application_id.in_([r.id for r in eligible] or [None]),
                                                                      VisaCase.status == "REJECTED")).all())
    names = dict(db.execute(select(Organization.id, Organization.name)).all())
    groups: dict = {}
    for r in eligible:
        g = groups.setdefault(r.agency_org_id, {"issued": 0, "refused": 0, "pending": 0})
        if (m.top_step(r, ctx) or 0) >= m.STEPS.index("VISA_ISSUED"):
            g["issued"] += 1
        elif r.id in refused_ids:
            g["refused"] += 1
        else:
            g["pending"] += 1

    def row(key, g):
        decided = g["issued"] + g["refused"]
        return {"agency_id": str(key) if key else None, "agency": names.get(key) if key else None, **g, "decided": decided,
                "refusal_rate": rate(g["refused"], decided), "issued_rate": rate(g["issued"], decided)}

    total = {"issued": sum(g["issued"] for g in groups.values()), "refused": sum(g["refused"] for g in groups.values()),
             "pending": sum(g["pending"] for g in groups.values())}
    out = sorted((row(k, g) for k, g in groups.items()), key=lambda x: (-(x["decided"] + x["pending"]), x["agency"] or ""))
    return {"cohort": m._population(f, rows)["label"], "rows": out, "total": row(None, total), "definition": VISA_OUTCOME_DEFINITION,
            "min_denominator": MIN_DENOMINATOR}


def partnership_value(db: Session, university_id, intake: str | None = None) -> dict:
    """Is Hangyul a better channel than e-mail + agents? Every number: value, numerator, denominator, cohort, definition."""
    from app.services import metrics as m

    f = {"intake": intake} if intake else {}
    pipe = m.pipeline(db, university_id, f)
    coh = m.cohorts(db, university_id, {})
    out = []
    for key, src, mk in PARTNER_METRICS:
        if src == "pipeline":
            x = pipe["metrics"][mk]
            cohort = pipe["population"]["label"]
        else:
            x = coh["total"][mk]
            cohort = coh["population"]
        g = m.GLOSSARY_BY_KEY.get(mk) or m.GLOSSARY_BY_KEY.get(key) or {}
        out.append({"key": key, "kind": "median" if mk == "median_processing_days" else "rate", "value": x.get("value"),
                    "numerator": x.get("numerator"), "denominator": x.get("denominator"), "insufficient": bool(x.get("insufficient_data")),
                    "numerator_label": g.get("numerator"), "denominator_label": g.get("denominator"),
                    "cohort": cohort, "definition": x.get("definition") or g.get("definition")})
    return {"intake": intake, "population": pipe["population"], "metrics": out, "visa": visa_outcomes(db, university_id, f),
            "min_denominator": MIN_DENOMINATOR}
