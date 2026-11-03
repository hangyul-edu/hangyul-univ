"""Applicant-vs-published-requirements summary for list rows (university console).

Batched for a page of applications: one query for requirements, one for educations, one for language scores.
Mirrors the applicant review table: GPA, TOPIK, IELTS, TOEFL — with "either language test" handled as alternatives.
Self-reported values count; unverified is surfaced on the detail page, not here.
"""
from __future__ import annotations

from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AdmissionRequirement, StudentEducation, StudentLanguage, StudentProfile


def summarize(db: Session, apps: list) -> dict:
    if not apps:
        return {}
    reqs = {r.program_id: r for r in db.scalars(select(AdmissionRequirement).where(AdmissionRequirement.program_id.in_({a.program_id for a in apps}))).all()}
    students = {a.student_user_id for a in apps}
    profiles = dict(db.execute(select(StudentProfile.user_id, StudentProfile.id).where(StudentProfile.user_id.in_(students))).all())
    pid_to_user = {v: k for k, v in profiles.items()}
    gpa: dict = defaultdict(lambda: None)
    for pid, g in db.execute(select(StudentEducation.profile_id, StudentEducation.gpa_percent).where(StudentEducation.profile_id.in_(profiles.values()))).all():
        uid = pid_to_user.get(pid)
        if g is not None and (gpa[uid] is None or g > gpa[uid]):
            gpa[uid] = g
    langs: dict = defaultdict(dict)
    for pid, test, score, planned in db.execute(select(StudentLanguage.profile_id, StudentLanguage.test, StudentLanguage.score, StudentLanguage.is_planned)
                                                .where(StudentLanguage.profile_id.in_(profiles.values()))).all():
        if planned:
            continue
        uid = pid_to_user.get(pid)
        k = test.value if hasattr(test, "value") else str(test)
        langs[uid][k] = max(score, langs[uid].get(k, 0))
    out = {}
    for a in apps:
        r = reqs.get(a.program_id)
        if r is None:
            out[a.id] = {"status": "UNKNOWN", "below": [], "unknown": []}
            continue
        below, unknown = [], []
        g = gpa[a.student_user_id]
        if r.min_gpa_percent:
            if g is None:
                unknown.append("GPA")
            elif g < r.min_gpa_percent:
                below.append("GPA")
        lang_checks = []
        s = langs[a.student_user_id]
        if r.min_topik_level:
            lang_checks.append(("TOPIK", s.get("TOPIK"), r.min_topik_level))
        if r.min_ielts:
            lang_checks.append(("IELTS", s.get("IELTS"), r.min_ielts))
        if r.min_toefl_ibt:
            lang_checks.append(("TOEFL", s.get("TOEFL_IBT"), r.min_toefl_ibt))
        if lang_checks:
            results = [("meets" if v is not None and v >= need else "unknown" if v is None else "below", k) for k, v, need in lang_checks]
            if r.language_alternative:
                if not any(x == "meets" for x, _ in results):
                    (below if any(x == "below" for x, _ in results) else unknown).append("LANGUAGE")
            else:
                below += [k for x, k in results if x == "below"]
                unknown += [k for x, k in results if x == "unknown"]
        status = "BELOW" if below else "TO_CHECK" if unknown else "MEETS"
        out[a.id] = {"status": status, "below": below, "unknown": unknown}
    return out
