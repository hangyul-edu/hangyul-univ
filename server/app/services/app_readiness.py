"""One concise readiness state per application — and never a score (brief Part 10, REPORT §119).

The console already had the inputs: ``readiness.checklist`` knows which required documents are missing,
expired, wrong or under review; ``strategy`` knows which items block submission and whose move each is;
``caseload.applications_waiting`` knows who the application is waiting on. What it did not have was the one
sentence a counselor needs before promising a student anything: *can this be submitted?*

So this composes those three into a state and a list of **named blockers**. Deliberately not a number:

* a percentage invites "92 % is probably fine" and is unactionable;
* a probability ("87 % 합격확률") would be a prediction the business plan explicitly refuses to make (§8);
* a blocker is a task — 성적증명서 번역본 필요 is something a person can go and do.

Every blocker carries a code the UI translates and a ``detail`` string drawn from the record itself (a
document label, a reviewer's own words), so the sentence is specific without this module writing prose.
"""
from __future__ import annotations

from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Application, ApplicationStatus, DocumentRequest, Essay, EssayStatus, StudentProfile
from app.services.readiness import checklist

#: Statuses where the question "is this ready to submit?" no longer applies — the application is already
#: with the university or finished. The state then describes who we are waiting on instead.
_WITH_UNIVERSITY = {
    ApplicationStatus.SUBMITTED, ApplicationStatus.UNIVERSITY_REVIEW, ApplicationStatus.INTERVIEW,
    ApplicationStatus.WAITLISTED,
}
_CLOSED = {
    ApplicationStatus.OFFERED, ApplicationStatus.REJECTED, ApplicationStatus.OFFER_ACCEPTED,
    ApplicationStatus.TUITION_PENDING, ApplicationStatus.TUITION_PAID,
    ApplicationStatus.ADMISSION_CERTIFICATE_PENDING, ApplicationStatus.ADMISSION_CERTIFICATE_ISSUED,
    ApplicationStatus.VISA_PREPARATION, ApplicationStatus.VISA_SUBMITTED, ApplicationStatus.VISA_ISSUED,
    ApplicationStatus.ENROLLED, ApplicationStatus.WITHDRAWN,
}

#: checklist action codes → blocker codes, with whether the item stops a submission outright.
_FROM_ACTION = {
    "UPLOAD": ("document_missing", "BLOCKING"),
    "RENEW": ("document_expired", "BLOCKING"),
    "FIX": ("document_correction", "BLOCKING"),
    "LEGALIZE": ("document_legalization", "BLOCKING"),
    "TOO_OLD": ("document_too_old", "BLOCKING"),
    "IN_REVIEW": ("document_in_review", "ADVISORY"),
    "UNIVERSITY_REQUEST": ("university_request", "BLOCKING"),
}

_ESSAY_OPEN = {EssayStatus.DRAFT, EssayStatus.CHANGES_REQUESTED, EssayStatus.STUDENT_REVISION}


def readiness(db: Session, app: Application, profile: StudentProfile | None, today: date | None = None) -> dict:
    """``{state, blockers:[{key, detail, severity}]}`` for one application."""
    today = today or date.today()
    blockers: list[dict] = []

    open_requests = db.scalars(
        select(DocumentRequest).where(DocumentRequest.application_id == app.id, DocumentRequest.status == "OPEN")
    ).all()
    for r in open_requests:
        blockers.append({"key": "university_request", "detail": r.label, "severity": "BLOCKING"})

    if app.status in _CLOSED:
        return {"state": "SUBMITTED", "blockers": blockers}

    if app.status in _WITH_UNIVERSITY:
        # Nothing for us to prepare; the state is about who holds the case.
        state = "WAITING_UNIVERSITY" if not open_requests else "WAITING_STUDENT"
        return {"state": state, "blockers": blockers}

    from app.models import Program, University

    program = db.get(Program, app.program_id)
    university = db.get(University, app.university_id)
    if program is None or university is None:
        return {"state": "CHECKS_REQUIRED", "blockers": blockers}

    items = checklist(db, app.student_user_id, program, university, profile.nationality if profile else None, today)
    for i in items:
        if i["ready"] or not i["required"] or not i["action_code"]:
            continue
        code, severity = _FROM_ACTION.get(i["action_code"], ("document_missing", "BLOCKING"))
        if code == "university_request":
            continue  # already added above, from the request itself, with the university's own wording
        detail = i["label"]
        if code == "document_correction":
            # The reviewer's own words are the actionable part — "여권 영문명과 지원서 이름 불일치", not "passport".
            detail = (i.get("action_params") or {}).get("reason") or i["label"]
        # V28: the guide's own Korean name rides along so a Korean screen never shows the English label.
        blockers.append({"key": code, "detail": detail, "detail_ko": i.get("name_ko") if detail == i["label"] else None, "severity": severity})

    for e in db.scalars(select(Essay).where(Essay.application_id == app.id)).all():
        if e.status in _ESSAY_OPEN:
            key = "essay_revision" if e.status == EssayStatus.CHANGES_REQUESTED else "essay_draft"
            blockers.append({"key": key, "detail": e.title, "severity": "BLOCKING"})

    blocking = [b for b in blockers if b["severity"] == "BLOCKING"]
    if blocking:
        # Whose move is it? A correction or a missing upload is the student's; everything else is ours.
        student_side = {"document_missing", "document_expired", "document_correction", "essay_draft", "essay_revision", "university_request"}
        state = "WAITING_STUDENT" if all(b["key"] in student_side for b in blocking) else "CHECKS_REQUIRED"
        return {"state": state, "blockers": blockers}
    return {"state": "READY", "blockers": blockers}
