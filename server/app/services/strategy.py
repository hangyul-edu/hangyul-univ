"""Admission strategy layer (V5): "what still affects this application" and the student's portfolio.

Everything here is computed from REAL records only — the program's published minimums, the student's profile, the
document vault and checklist, essays, university document requests, intake dates, the budget service and scholarship
rules. There is NO score, NO percentage and NO probability. Each item says what, why, what to do and whose move it is.

Output per application::

    {application_id, scope: prep|review|closed, state: READY|IMPROVABLE|BLOCKED,
     items: [{code, severity: blocker|improve|info, title, why, params, owner: student|counselor|university,
              action: {code, label, link} | None, sample: bool}], fit: [reason codes], counts: {...}}

* ``blocker`` — must be resolved before the application can be submitted (or, after submission, before the
  university can continue).
* ``improve`` — the application can go ahead, but this would strengthen it or remove a risk.
* ``info`` — context worth knowing; never counted in "N things can still improve".

English ``title``/``why`` are fallbacks; clients translate ``success:item.<code>.title|why`` with ``params``.

Historical context (e.g. how applicants with a similar profile fared) is shown ONLY for a defined cohort with n ≥ 5
real (non-demo) decided applications — see ``historical_context``. In the demo dataset this is always withheld.
"""
from __future__ import annotations

from collections.abc import Callable
from datetime import date, timedelta
from types import SimpleNamespace

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.common import university_photo
from app.models import (
    Application,
    Document,
    DocumentRequest,
    Dormitory,
    Essay,
    LanguageRecommendation,
    Program,
    ProgramIntake,
    SavedUniversity,
    Scholarship,
    StudentProfile,
    University,
)
from app.models.base import utcnow
from app.models.enums import ApplicationStatus as S
from app.models.enums import DocumentCategory, EssayStatus, LanguageTest, LegalizationPath
from app.services.budget import first_year_range
from app.services.matching import best_score, match_program, scholarship_eligibility
from app.services.readiness import ESSAY_BACKED, application_readiness

PREP = {S.DRAFT, S.PROFILE_REVIEW, S.DOCUMENT_PREPARATION, S.READY}
REVIEW = {S.SUBMITTED, S.UNIVERSITY_REVIEW, S.ADDITIONAL_DOCUMENTS, S.INTERVIEW, S.WAITLISTED}
SEVERITY_RANK = {"blocker": 0, "improve": 1, "info": 2}
MIN_COHORT = 5

# Documented planning rule for deadline feasibility (working estimate, shown to users as such):
# days a student typically needs per open item before the deadline, plus the counselor's final check.
DAYS_NEEDED = {"LEGALIZE": 14, "RENEW": 7, "TOO_OLD": 7, "FIX": 3, "UPLOAD": 3, "ESSAY_WRITE": 7, "ESSAY_REVISE": 3, "ESSAY_REVIEW": 2}
FINAL_CHECK_DAYS = 2
PASSPORT_MARGIN_DAYS = 183  # passport should stay valid ~6 months past the semester start (visa applications)

# Writing workstream hook: fn(db, essay) -> list of extra items (same shape as below) or None.
EssayHook = Callable[[Session, Essay], "list[dict] | None"]
_ESSAY_HOOKS: list[EssayHook] = []


def register_essay_hook(fn: EssayHook) -> EssayHook:
    """Let the writing workstream add essay quality items (rubric / quality gate) without editing this module.
    Usable as a decorator. Hooks run for every essay attached to an application in scope."""
    if fn not in _ESSAY_HOOKS:
        _ESSAY_HOOKS.append(fn)
    return fn


def _item(code: str, severity: str, owner: str, title: str, why: str | None = None, *, params: dict | None = None,
          action: tuple[str, str, str | None] | None = None, sample: bool = False, rank: int = 50) -> dict:
    return {
        "code": code, "severity": severity, "owner": owner, "title": title, "why": why, "params": params or {},
        "action": {"code": action[0], "label": action[1], "link": action[2]} if action else None,
        "sample": sample, "_rank": rank,
    }


def _links(audience: str, app: Application) -> dict:
    """Deep links per product. Agency links open the student workspace tab that holds the item."""
    if audience == "agency":
        base = f"/students/{app.student_user_id}"
        return {"doc": lambda _d: f"{base}?tab=documents", "upload": lambda _c: f"{base}?tab=documents", "essay": lambda e: f"/essays/{e}",
                "profile": f"{base}", "budget": f"{base}?tab=portfolio", "scholarships": f"{base}?tab=portfolio",
                "app": f"{base}?tab=applications", "messages": f"{base}?tab=messages", "portfolio": f"{base}?tab=portfolio"}
    return {"doc": lambda d: f"/documents?doc={d}", "upload": lambda c: f"/documents?upload={c}", "essay": lambda e: f"/essays/{e}",
            "profile": "/profile", "budget": "/budget", "scholarships": "/scholarships", "app": f"/applications/{app.id}",
            "messages": "/messages", "portfolio": "/applications#portfolio"}


def _lc(label: str) -> str:
    first = label.split(" ", 1)[0]
    if len(first) < 2 or any(c.isupper() or c.isdigit() for c in first[1:]):
        return label
    return label[0].lower() + label[1:]


def scope_of(status: S) -> str:
    if status in PREP:
        return "prep"
    if status in REVIEW:
        return "review"
    return "closed"


def _match(db: Session, profile: StudentProfile, program: Program, university: University, intake: ProgramIntake, today: date):
    scholarships = db.scalars(select(Scholarship).where((Scholarship.university_id == university.id) | Scholarship.university_id.is_(None))
                              .options(selectinload(Scholarship.rules))).all()
    has_dorm = db.scalar(select(Dormitory.id).where(Dormitory.university_id == university.id).limit(1)) is not None
    # The application's own intake is the one that counts (even if it has since closed); evaluate as of its deadline
    # if that has already passed. Deadline feasibility is judged separately below, never through the match tier.
    as_of = min(today, intake.application_deadline)
    view = SimpleNamespace(id=intake.id, is_open=True, application_deadline=intake.application_deadline, year=intake.year, term=intake.term)
    return match_program(profile, program, university, [view], list(scholarships), has_dorm, as_of)


def _eligibility_items(m, profile: StudentProfile, program: Program, links: dict, rec: LanguageRecommendation | None) -> tuple[list[dict], list[str]]:
    items: list[dict] = []
    fit: list[str] = []
    for r in m.reasons:
        p = dict(r.params or {})
        if r.code == "EDUCATION_BELOW":
            items.append(_item("ELIG_EDUCATION", "blocker", "student", "The program needs a qualification you don't have yet",
                               "The published entry requirement is a completed {required} qualification.".format(required=str(p.get("required", "")).replace("_", " ").lower()),
                               params=p, action=("MESSAGE", "Talk to your counselor", links["messages"]), rank=1))
        elif r.code == "NATIONALITY_RESTRICTED":
            items.append(_item("ELIG_NATIONALITY", "blocker", "counselor", "This program is not open to your nationality",
                               "The university's published rules exclude applicants of your nationality.", params=p, action=("MESSAGE", "Talk to your counselor", links["messages"]), rank=1))
        elif r.code in ("GPA_BELOW", "GPA_SLIGHTLY_BELOW"):
            items.append(_item("ELIG_GPA", "blocker", "counselor", "Your GPA is below the published minimum",
                               f"You have {p.get('have')}%; the program asks for {p.get('min')}% (normalised).", params=p,
                               action=("MESSAGE", "Talk to your counselor", links["messages"]), rank=2))
        elif r.code in ("LANGUAGE_BELOW", "LANGUAGE_GAP_SMALL"):
            items.append(_item("ELIG_LANGUAGE", "blocker", "student", "Your language score is below the minimum",
                               "A retake before the deadline, or an accepted alternative test, would meet it.", params=p,
                               action=("PROFILE", "Update your test scores", links["profile"]), rank=2))
        elif r.code == "EDUCATION_UNKNOWN":
            items.append(_item("PROFILE_EDUCATION", "improve", "student", "Add your education history",
                               "Without it we can't confirm you meet the entry requirement.", action=("PROFILE", "Complete your profile", links["profile"]), rank=10))
        elif r.code == "GPA_UNKNOWN":
            items.append(_item("PROFILE_GPA", "improve", "student", "Add your GPA",
                               "The program publishes a minimum GPA; adding yours lets us check it.", action=("PROFILE", "Complete your profile", links["profile"]), rank=10))
        elif r.code == "EDUCATION_EXPECTED":
            items.append(_item("EDUCATION_EXPECTED", "info", "student", "Eligible once you graduate",
                               "Send your graduation certificate as soon as you receive it.", params=p, rank=60))
        elif r.code == "DEGREE_MISMATCH":
            items.append(_item("DEGREE_DIFFERENT", "info", "student", "This is a different degree level from your goal",
                               None, params=p, rank=70))
        elif r.kind == "met" and r.code in ("FIELD_MATCH", "WITHIN_BUDGET", "PREFERRED_REGION", "DORM_AVAILABLE", "TOPIK_MET", "TOPIK_EXCEEDS", "ENGLISH_MET", "GPA_MET", "EDUCATION_MET"):
            fit.append(r.code)
    # Program recommended language level (above the minimum) — only when stored; SAMPLE rows are labelled.
    if rec and rec.recommended_topik_level:
        topik = best_score(profile, LanguageTest.TOPIK)
        req = program.requirements[0] if program.requirements else None
        minimum = req.min_topik_level if req else None
        if topik is not None and topik < rec.recommended_topik_level and (minimum is None or topik >= minimum):
            items.append(_item("LANGUAGE_RECOMMENDED", "improve", "student",
                               f"TOPIK {int(topik)} meets the minimum; this program recommends {rec.recommended_topik_level}+",
                               "Classes are demanding in Korean — a higher level helps you keep up. Not required to apply.",
                               params={"have": int(topik), "min": minimum, "recommended": rec.recommended_topik_level, "basis": rec.basis},
                               sample=rec.basis == "SAMPLE", rank=30))
    planned = [lang for lang in profile.languages if lang.is_planned]
    if planned:
        lang = planned[0]
        items.append(_item("LANGUAGE_PLANNED", "info", "student", "You have a language test planned",
                           "Send the result as soon as you have it.", params={"test": lang.test.value, "date": lang.test_date.isoformat() if lang.test_date else None}, rank=65))
    if program.field not in set(profile.desired_fields or []) and profile.desired_fields:
        items.append(_item("FIELD_DIFFERENT", "info", "student", "This program's field isn't one you listed",
                           "That's fine if it's a deliberate choice — your study plan should explain why.", params={"field": program.field}, rank=75))
    return items, fit


def _document_items(db: Session, app: Application, checklist: list[dict], essays: list[Essay], links: dict, today: date,
                    intake: ProgramIntake, university: University) -> tuple[list[dict], list[str]]:
    """Documents and essays, merged exactly like the workspace lanes (an essay-backed requirement is the essay until approved)."""
    items: list[dict] = []
    open_codes: list[str] = []
    by_type = {e.essay_type.value: e for e in essays}
    used: set = set()
    uni = university.name_en
    for c in checklist:
        if c["ready"] or not c["required"]:
            continue
        label = c["label"]
        essay = by_type.get(c["category"]) if c["category"] in ESSAY_BACKED else None
        if essay:
            used.add(essay.id)
        if essay and essay.status != EssayStatus.APPROVED and c["action_code"] in ("UPLOAD", None):
            items.append(_essay_item(essay, label, links))
            open_codes.append(items[-1]["code"])
            continue
        code = c["action_code"] or "UPLOAD"
        p = {"label": label, "category": c["category"], "university": uni}
        if code == "IN_REVIEW":
            late = bool(c.get("review_overdue"))
            items.append(_item("DOC_REVIEW_LATE" if late else "DOC_IN_REVIEW", "blocker", "counselor",
                               f"{label} is being checked", "It's taking longer than usual — flagged for your counselor." if late else "Usually within 2 working days — nothing to do.",
                               params=p, rank=40 if late else 45))
            continue
        if code == "FIX":
            items.append(_item("DOC_FIX", "blocker", "student", f"{label} needs a correction", c.get("action"), params={**p, "reason": c.get("action"), "reviewer_note": (c.get("action_params") or {}).get("reason")},
                               action=("FIX", "See what to fix", links["doc"](c["document_id"])), rank=1))
        elif code == "LEGALIZE":
            doc = db.get(Document, c["document_id"]) if c["document_id"] else None
            path = doc.legalization_path.value if doc else "APOSTILLE"
            what = "an apostille" if path == LegalizationPath.APOSTILLE.value else "consular legalization"
            items.append(_item("DOC_LEGALIZE", "blocker", "student", f"{label} still needs {what}",
                               f"{uni} only accepts it once it is legalized.", params={**p, "path": path},
                               action=("LEGALIZE", "See the steps", links["doc"](c["document_id"])), rank=3))
        elif code == "RENEW":
            items.append(_item("DOC_RENEW", "blocker", "student", f"{label} has expired", "Upload a current one.", params=p,
                               action=("RENEW", "Upload a new one", links["doc"](c["document_id"])), rank=3))
        elif code == "TOO_OLD":
            ap = c.get("action_params") or {}  # V5 i18n: days + issued let clients say it in the reader's language
            items.append(_item("DOC_TOO_OLD", "blocker", "student", f"{label} is too old for {uni}", c.get("action"),
                               params={**p, "days": ap.get("days"), "issued": ap.get("issued")},
                               action=("RENEW", "Upload a new one", links["doc"](c["document_id"])), rank=3))
        else:
            approved = essay is not None and essay.status == EssayStatus.APPROVED
            items.append(_item("DOC_UPLOAD_APPROVED" if approved else "DOC_MISSING", "blocker", "student",
                               f"Upload your approved {_lc(label)}" if approved else f"Upload your {_lc(label)}",
                               f"{uni} needs it with your application.", params=p,
                               action=("UPLOAD", "Upload", links["upload"](c["category"])), rank=4))
        open_codes.append(code)
    for e in essays:
        if e.id not in used and e.status != EssayStatus.APPROVED:
            items.append(_essay_item(e, e.essay_type.value.replace("_", " ").capitalize(), links))
            open_codes.append(items[-1]["code"])
    for e in essays:
        for hook in _ESSAY_HOOKS:
            try:
                extra = hook(db, e) or []
            except Exception:  # a hook must never break the application page
                extra = []
            for x in extra:
                items.append({"params": {}, "action": None, "sample": False, "why": None, "owner": "student", "_rank": 20, **x})
    # Passport validity through the start of studies (visa applications need a valid passport).
    passport = db.scalars(select(Document).where(Document.owner_user_id == app.student_user_id, Document.category == DocumentCategory.PASSPORT)
                          .order_by(Document.expires_on.desc().nulls_last())).first()
    if passport and passport.expires_on and intake.semester_start and passport.expires_on < intake.semester_start + timedelta(days=PASSPORT_MARGIN_DAYS) \
            and passport.expires_on >= today:
        items.append(_item("PASSPORT_EXPIRES", "improve", "student", "Your passport expires soon after you'd start",
                           "Renewing it before your visa application avoids a second round of paperwork.",
                           params={"date": passport.expires_on.isoformat()}, action=("RENEW", "Open your passport", links["doc"](str(passport.id))), rank=25))
    return items, open_codes


def _essay_item(e: Essay, label: str, links: dict) -> dict:
    p = {"label": label, "essay_type": e.essay_type.value}
    link = links["essay"](str(e.id))
    if e.status == EssayStatus.DRAFT:
        return _item("ESSAY_WRITE", "blocker", "student", f"Write your {_lc(label)}", "Your counselor reads it before it goes to the university.",
                     params=p, action=("OPEN_ESSAY", "Open", link), rank=5)
    if e.status in (EssayStatus.CHANGES_REQUESTED, EssayStatus.STUDENT_REVISION):
        return _item("ESSAY_REVISE", "blocker", "student", f"Revise your {_lc(label)}", "Your counselor asked for changes.",
                     params=p, action=("OPEN_ESSAY", "Open", link), rank=2)
    final = e.status == EssayStatus.FINAL_REVIEW
    return _item("ESSAY_REVIEW", "blocker", "counselor", f"{label} needs {'final ' if final else ''}counselor review",
                 "Nothing to do — your counselor is reading it.", params={**p, "final": final}, action=("OPEN_ESSAY", "Open", link), rank=41)


def _budget_items(db: Session, profile: StudentProfile, program: Program, university: University, links: dict) -> list[dict]:
    dorms = db.scalars(select(Dormitory).where(Dormitory.university_id == university.id)).all()
    r = first_year_range(program, university, list(dorms))
    budget = profile.annual_budget_krw
    sample = r.get("basis") == "SAMPLE"
    if not budget:
        return [_item("BUDGET_UNKNOWN", "info", "student", "Add your yearly budget", "Then we can compare it with this program's first-year cost.",
                      action=("PROFILE", "Add budget", links["profile"]), rank=80)]
    if r.get("low") is None:
        return []
    p = {"low": r["low"], "high": r["high"], "budget": budget}
    if r["low"] > budget:
        return [_item("BUDGET_OVER", "improve", "student", "The first-year cost starts above your budget",
                      "A scholarship or a different housing choice could close the gap — see the budget breakdown.", params=p, sample=sample,
                      action=("BUDGET", "See the budget", links["budget"]), rank=22)]
    if r["high"] and r["high"] > budget:
        return [_item("BUDGET_TIGHT", "info", "student", "The first-year cost may go above your budget", "It depends on housing and living costs.",
                      params=p, sample=sample, action=("BUDGET", "See the budget", links["budget"]), rank=55)]
    return []


def _scholarship_items(db: Session, profile: StudentProfile, program: Program, university: University, links: dict, today: date) -> list[dict]:
    rows = db.scalars(select(Scholarship).where(Scholarship.university_id == university.id).options(selectinload(Scholarship.rules))).all()
    open_apply, automatic = [], []
    for s in rows:
        if s.degree_levels and program.degree_level.value not in s.degree_levels:
            continue
        res = scholarship_eligibility(s, profile, program)
        if res["status"] == "NOT_ELIGIBLE":
            continue
        if s.is_automatic:
            automatic.append(s)
        elif s.application_deadline and s.application_deadline >= today:
            open_apply.append(s)
    items = []
    if open_apply:
        s = min(open_apply, key=lambda x: x.application_deadline)
        items.append(_item("SCHOLARSHIP_APPLY", "improve", "student", f"Apply for {s.name}",
                           "It needs its own application — you appear to meet its published criteria.",
                           params={"name": s.name, "deadline": s.application_deadline.isoformat()}, sample=s.verification_status == "DEMO",
                           action=("SCHOLARSHIPS", "See scholarships", links["scholarships"]), rank=21))
    elif profile.needs_scholarship and not automatic:
        items.append(_item("SCHOLARSHIP_NONE", "info", "student", "No scholarship here matches your profile yet",
                           "You said you need one — ask your counselor about other options.", action=("MESSAGE", "Ask your counselor", links["messages"]), rank=58))
    return items


RULE_FIELDS = ("min_gpa_percent", "min_topik_level", "min_ielts", "min_toefl_ibt", "language_alternative", "min_prior_education", "requires_interview")


def _rule_change_items(db: Session, app: Application, program: Program, university: University, links: dict) -> list[dict]:
    """V9 reliability: the university published new admission rules for this program after the application was started.
    The application is never changed or invalidated by it; the student and counselor are told, and the counselor (owner)
    checks with the university whether the new rule applies to this applicant. Sources: published proposals and direct edits."""
    from app.models import AuditLog
    from app.models.university_ops import RequirementChange

    since = app.created_at
    if since is None:
        return []
    changes: list[tuple] = []
    for c in db.scalars(select(RequirementChange).where(RequirementChange.program_id == program.id, RequirementChange.status == "PUBLISHED",
                                                        RequirementChange.reviewed_at > since)).all():
        changes.append((c.reviewed_at, set(c.changes or {})))
    for a in db.scalars(select(AuditLog).where(AuditLog.entity_id == str(program.id), AuditLog.action == "requirements.update",
                                               AuditLog.created_at > since)).all():
        changes.append((a.created_at, set(a.detail or {})))
    relevant = [(at, f & set(RULE_FIELDS)) for at, f in changes if f & set(RULE_FIELDS)]
    if not relevant:
        return []
    fields = sorted(set().union(*(f for _at, f in relevant)))
    changed_on = max(at for at, _f in relevant).date().isoformat()
    return [_item("REQUIREMENT_CHANGED", "improve", "counselor", f"{university.name_en} changed its admission rules after this application was started",
                  "Your application stays as it is. Your counselor checks with the university whether the new rule applies to you.",
                  params={"university": university.name_en, "university_id": str(university.id), "fields": fields, "changed_on": changed_on},
                  action=("MESSAGE", "Ask your counselor", links["messages"]), rank=3)]


def deadline_passed(db: Session, app: Application, intake: ProgramIntake | None = None, today: date | None = None) -> bool:
    """V9 reliability: the intake's deadline is over and this application was not handed off / submitted before it."""
    intake = intake or db.get(ProgramIntake, app.intake_id)
    today = today or utcnow().date()
    return bool(intake and intake.application_deadline < today and app.status in PREP and not submitted_before_deadline(db, app, intake))


def submitted_before_deadline(db: Session, app: Application, intake: ProgramIntake) -> bool:
    from app.models.v5_success import ApplicationSubmission

    rec = db.scalar(select(ApplicationSubmission).where(ApplicationSubmission.application_id == app.id))
    if rec is None:
        return False
    if rec.status in ("SUBMITTED_UNCONFIRMED", "SUBMITTED_CONFIRMED"):
        return True
    return bool(rec.handed_off_at and rec.handed_off_at.date() <= intake.application_deadline)


def application_strategy(db: Session, app: Application, profile: StudentProfile | None = None, today: date | None = None,
                         *, audience: str = "student", with_submission: bool = True) -> dict:
    """What still affects this application — ordered, explained, owned. No score, no percentage, no probability."""
    today = today or utcnow().date()
    profile = profile or db.scalar(select(StudentProfile).where(StudentProfile.user_id == app.student_user_id))
    program = db.scalar(select(Program).where(Program.id == app.program_id).options(selectinload(Program.requirements)))
    university = db.get(University, app.university_id)
    intake = db.get(ProgramIntake, app.intake_id)
    links = _links(audience, app)
    scope = scope_of(app.status)
    items: list[dict] = []
    fit: list[str] = []
    req = program.requirements[0] if program.requirements else None

    # University requests — always first; the university's exact note is the "why".
    for r in db.scalars(select(DocumentRequest).where(DocumentRequest.application_id == app.id, DocumentRequest.status == "OPEN")
                        .order_by(DocumentRequest.requested_at)).all():
        items.append(_item("REQUEST_OPEN", "blocker", "student", f"{university.name_en} asked for {_lc(r.label)}", r.note,
                           params={"label": r.label, "university": university.name_en, "university_id": str(university.id), "due": r.due_date.isoformat() if r.due_date else None},
                           action=("REQUEST", "Send it", links["app"]), rank=0))

    if scope == "prep" and profile is not None:
        _pct, checklist = application_readiness(db, app, profile, today)
        essays = db.scalars(select(Essay).where(Essay.application_id == app.id)).all()
        rec = db.scalar(select(LanguageRecommendation).where(LanguageRecommendation.program_id == program.id))
        m = _match(db, profile, program, university, intake, today)
        elig, fit = _eligibility_items(m, profile, program, links, rec)
        docs, open_codes = _document_items(db, app, checklist, list(essays), links, today, intake, university)
        items += elig + docs
        # Deadline feasibility: days left vs. what remains (documented planning rule, not a prediction).
        days_left = (intake.application_deadline - today).days
        # V9 reliability: a READY application whose deadline passed before it was submitted is blocked too (it used to
        # keep offering "Submit on the portal"); a hand-off before the deadline still counts as on time.
        if days_left < 0 and not submitted_before_deadline(db, app, intake):
            items.append(_item("DEADLINE_PASSED", "blocker", "counselor", "The application deadline has passed",
                               "Your counselor can check for a later round or intake.", params={"deadline": intake.application_deadline.isoformat()},
                               action=("MESSAGE", "Talk to your counselor", links["messages"]), rank=0))
        elif app.status != S.READY and days_left >= 0:
            needed = sum(DAYS_NEEDED.get(c, 3) for c in open_codes if c not in ("IN_REVIEW",)) + FINAL_CHECK_DAYS
            if open_codes and days_left < needed:
                items.append(_item("DEADLINE_TIGHT", "improve", "student", f"{len(open_codes)} items left and {days_left} days to the deadline",
                                   "Items like legalization take weeks — start the slowest one today.",
                                   params={"count": len(open_codes), "days": days_left, "needed": needed, "deadline": intake.application_deadline.isoformat()},
                                   rank=15))
        items += _budget_items(db, profile, program, university, links)
        items += _scholarship_items(db, profile, program, university, links, today)
        if req and req.requires_interview:
            items.append(_item("INTERVIEW_REQUIRED", "info", "counselor", "This program interviews applicants",
                               "Your counselor can run a practice interview with you before it.", action=("MESSAGE", "Ask for practice", links["messages"]), rank=62))
        if req and req.requires_portfolio:
            items.append(_item("PORTFOLIO_REQUIRED", "improve", "counselor", "This program asks for a portfolio",
                               "Your counselor confirms the format the university expects.", action=("MESSAGE", "Ask your counselor", links["messages"]), rank=26))
        if req and req.notes:
            items.append(_item("UNIVERSITY_NOTE", "info", "university", f"A note from {university.name_en}", req.notes,
                               params={"note": req.notes, "university": university.name_en, "university_id": str(university.id)}, rank=68))
        # Completeness: everything the student and reviewers do is finished, only the counselor's final check remains.
        student_open = [i for i in items if i["severity"] == "blocker"]
        if not student_open and app.status in (S.DRAFT, S.PROFILE_REVIEW, S.DOCUMENT_PREPARATION):
            items.append(_item("FINAL_CHECK", "improve", "counselor", "Everything is in — the final check is next",
                               "Your counselor checks the whole application once, then it's ready to submit.", rank=35))
    elif scope == "review" and app.status == S.INTERVIEW and app.interview_at:
        items.append(_item("INTERVIEW_SCHEDULED", "improve", "student", f"Prepare for your interview with {university.name_en}",
                           "A short practice with your counselor helps.", params={"when": app.interview_at.isoformat(), "university": university.name_en, "university_id": str(university.id)},
                           action=("MESSAGE", "Ask for practice", links["messages"]), rank=5))

    if scope in ("prep", "review"):
        items += _rule_change_items(db, app, program, university, links)

    if with_submission and scope in ("prep", "review"):
        from app.services import submission  # local: submission imports this module

        sub = submission.get_record(db, app.id)
        if sub and sub.status in ("HANDED_OFF", "SUBMITTED_UNCONFIRMED"):
            items.append(_item("SUBMISSION_CONFIRM", "improve", "student", f"Add your {university.name_en} confirmation",
                               "You told us you submitted — the confirmation number or receipt finishes it.",
                               params={"university": university.name_en, "university_id": str(university.id)}, action=("CONFIRM", "Add confirmation", links["app"]), rank=0))

    items.sort(key=lambda i: (SEVERITY_RANK[i["severity"]], i["_rank"]))
    for i in items:
        i.pop("_rank", None)
    blockers = sum(1 for i in items if i["severity"] == "blocker")
    improves = sum(1 for i in items if i["severity"] == "improve")
    state = "BLOCKED" if blockers else "IMPROVABLE" if improves else "READY"
    first_blocker = next((i for i in items if i["severity"] == "blocker"), None)
    return {
        "application_id": str(app.id), "status": app.status.value, "scope": scope, "state": state, "items": items, "fit": fit,
        "counts": {"blocker": blockers, "improve": improves, "info": len(items) - blockers - improves},
        "blocked_by": {"code": first_blocker["code"], "title": first_blocker["title"], "params": first_blocker["params"]} if first_blocker else None,
        "history": historical_context(db, program.id, intake),
        "engine": "rules-2026.09",
    }


def historical_context(db: Session, program_id, intake: ProgramIntake) -> dict | None:
    """Outcomes of earlier applicants to this program — ONLY for a defined cohort of ≥ MIN_COHORT real (non-demo)
    decided applications from previous intakes. Returns None otherwise (the UI then shows nothing at all)."""
    rows = db.execute(select(Application.status).join(ProgramIntake, ProgramIntake.id == Application.intake_id).where(
        Application.program_id == program_id, Application.is_demo.is_(False), ProgramIntake.application_deadline < intake.application_opens
        if intake.application_opens else ProgramIntake.year < intake.year,
        Application.status.in_([S.OFFERED, S.REJECTED, S.WAITLISTED, S.OFFER_ACCEPTED, S.TUITION_PENDING, S.TUITION_PAID, S.ENROLLED,
                                S.ADMISSION_CERTIFICATE_PENDING, S.ADMISSION_CERTIFICATE_ISSUED, S.VISA_PREPARATION, S.VISA_SUBMITTED, S.VISA_ISSUED]))).all()
    n = len(rows)
    if n < MIN_COHORT:
        return None
    offered = sum(1 for (s,) in rows if s not in (S.REJECTED, S.WAITLISTED))
    return {"cohort": "Earlier intakes of this program (Hangyul applicants, decided)", "n": n, "offered": offered,
            "population": "Hangyul applicants", "program_id": str(program_id)}


def strategies_for_student(db: Session, student_user_id, today: date | None = None, *, audience: str = "student") -> list[dict]:
    today = today or utcnow().date()
    profile = db.scalar(select(StudentProfile).where(StudentProfile.user_id == student_user_id))
    apps = db.scalars(select(Application).where(Application.student_user_id == student_user_id).order_by(Application.created_at)).all()
    return [application_strategy(db, a, profile, today, audience=audience) for a in apps]


def today_for_student(db: Session, user, today: date | None = None, limit: int = 3) -> list[dict]:
    """Coordinator hook — "What should I do today to improve my outcome?": the top student-owned improvements across
    all applications (submission hand-offs first, then blockers, then improvements; earliest deadline first)."""
    from app.services import submission

    today = today or utcnow().date()
    uid = getattr(user, "id", user)
    out = []
    for app in db.scalars(select(Application).where(Application.student_user_id == uid)).all():
        if scope_of(app.status) == "closed":
            continue
        uni = db.get(University, app.university_id)
        intake = db.get(ProgramIntake, app.intake_id)
        nxt = submission.next_step(db, app)
        if nxt:
            out.append({"application_id": str(app.id), "university": uni.name_en, "university_id": str(uni.id), "deadline": intake.application_deadline.isoformat(),
                        "sort": (0, 0, intake.application_deadline), **nxt})
        s = application_strategy(db, app, today=today, with_submission=nxt is None)
        for i in s["items"]:
            if i["owner"] != "student" or i["severity"] == "info":
                continue
            out.append({"application_id": str(app.id), "university": uni.name_en, "university_id": str(uni.id), "deadline": intake.application_deadline.isoformat(),
                        "sort": (1, SEVERITY_RANK[i["severity"]], intake.application_deadline), **i})
    out.sort(key=lambda x: x["sort"])
    seen, top = set(), []
    for x in out:
        # The same document (e.g. one transcript fix) counts once even when several applications need it.
        key = (x["code"], x["params"].get("category") or x["application_id"])
        if key in seen:
            continue
        seen.add(key)
        x.pop("sort", None)
        top.append(x)
        if len(top) >= limit:
            break
    return top


# ---------------------------------------------------------------------------------------------------------- portfolio

TIER_GROUP = {"STRONG": "strong", "COMPETITIVE": "possible", "REACH": "not_yet", "NOT_ELIGIBLE": "not_yet"}
PORTFOLIO_STATUSES = PREP | REVIEW
ADMITTED = {S.OFFER_ACCEPTED, S.TUITION_PENDING, S.TUITION_PAID, S.ADMISSION_CERTIFICATE_PENDING, S.ADMISSION_CERTIFICATE_ISSUED,
            S.VISA_PREPARATION, S.VISA_SUBMITTED, S.VISA_ISSUED, S.ENROLLED}
MANY_APPLICATIONS = 6
CONCENTRATION_WINDOW = 7
CONCENTRATION_MIN = 3


def _entry(db: Session, profile: StudentProfile, program: Program, intake: ProgramIntake | None, today: date, *, source: str, app: Application | None) -> dict:
    uni = db.get(University, program.university_id)
    sent = app is not None and app.status not in PREP
    if sent:
        tier = None  # already with the university: its decision, not our fit estimate, is what counts now
    elif intake is None:
        tier = "NOT_ELIGIBLE"
    else:
        tier = _match(db, profile, program, uni, intake, today).tier
    dorms = db.scalars(select(Dormitory).where(Dormitory.university_id == uni.id)).all()
    r = first_year_range(program, uni, list(dorms))
    return {
        "source": source, "application_id": str(app.id) if app else None, "status": app.status.value if app else None,
        "program": {"id": str(program.id), "name_en": program.name_en, "degree_level": program.degree_level.value, "field": program.field},
        "university": {"id": str(uni.id), "name_en": uni.name_en, "slug": uni.slug, "city": uni.city, "brand_color": uni.brand_color, "photo": university_photo(uni)},
        "tier": tier, "group": "sent" if sent else TIER_GROUP[tier],
        "deadline": intake.application_deadline.isoformat() if intake else None,
        "pre_submission": bool(app and app.status in PREP) or source == "saved",
        "first_year": {"low": r["low"], "high": r["high"], "basis": r["basis"]},
    }


def portfolio(db: Session, student_user_id, today: date | None = None) -> dict:
    """The student's set of options as decision support — never an automatic choice."""
    from app.models import PortfolioReview, User

    today = today or utcnow().date()
    profile = db.scalar(select(StudentProfile).where(StudentProfile.user_id == student_user_id).options(
        selectinload(StudentProfile.languages), selectinload(StudentProfile.educations)))
    apps = db.scalars(select(Application).where(Application.student_user_id == student_user_id)).all()
    entries: list[dict] = []
    applied_programs = {a.program_id for a in apps}
    offers = sum(1 for a in apps if a.status == S.OFFERED)
    admitted = next((a for a in apps if a.status in ADMITTED), None)
    if profile is not None:
        for a in apps:
            if a.status not in PORTFOLIO_STATUSES:
                continue
            prog = db.scalar(select(Program).where(Program.id == a.program_id).options(selectinload(Program.requirements)))
            entries.append(_entry(db, profile, prog, db.get(ProgramIntake, a.intake_id), today, source="application", app=a))
        for s in db.scalars(select(SavedUniversity).where(SavedUniversity.user_id == student_user_id, SavedUniversity.program_id.is_not(None))).all():
            if s.program_id in applied_programs:
                continue
            prog = db.scalar(select(Program).where(Program.id == s.program_id).options(selectinload(Program.requirements), selectinload(Program.intakes)))
            if not prog or not prog.is_active:
                continue
            open_intakes = sorted([i for i in prog.intakes if i.is_open and i.application_deadline >= today], key=lambda i: i.application_deadline)
            if profile.target_intake_year and profile.target_intake_term:
                open_intakes = [i for i in open_intakes if i.year == profile.target_intake_year and i.term == profile.target_intake_term] or open_intakes
            entries.append(_entry(db, profile, prog, open_intakes[0] if open_intakes else None, today, source="saved", app=None))

    applications = [e for e in entries if e["source"] == "application"]
    groups = {g: sum(1 for e in applications if e["group"] == g) for g in ("strong", "possible", "not_yet", "sent")}
    saved_groups = {g: sum(1 for e in entries if e["source"] == "saved" and e["group"] == g) for g in ("strong", "possible", "not_yet")}

    # Deadline concentration: applications still being prepared.
    upcoming = sorted(date.fromisoformat(e["deadline"]) for e in applications if e["pre_submission"] and e["deadline"] and date.fromisoformat(e["deadline"]) >= today)
    same_day: dict[date, int] = {}
    for d in upcoming:
        same_day[d] = same_day.get(d, 0) + 1
    cluster = None
    for i, d in enumerate(upcoming):
        window = [x for x in upcoming[i:] if (x - d).days < CONCENTRATION_WINDOW]
        if len(window) >= CONCENTRATION_MIN and (cluster is None or len(window) > cluster["count"]):
            cluster = {"count": len(window), "from": window[0].isoformat(), "to": window[-1].isoformat(), "days": CONCENTRATION_WINDOW}

    budget = profile.annual_budget_krw if profile else None
    lows = [e["first_year"]["low"] for e in applications if e["first_year"]["low"] is not None]
    highs = [e["first_year"]["high"] for e in applications if e["first_year"]["high"] is not None]
    over = [e for e in applications if budget and e["first_year"]["low"] is not None and e["first_year"]["low"] > budget]
    spread = {"low": min(lows) if lows else None, "high": max(highs) if highs else None, "budget": budget, "over_budget": len(over),
              "basis": "SAMPLE" if any(e["first_year"]["basis"] == "SAMPLE" for e in applications) else "ESTIMATE"}

    obs: list[dict] = []

    def add(code: str, severity: str, text: str, **params):
        obs.append({"code": code, "severity": severity, "text": text, "params": params})

    n = len(applications)
    tiered = [e for e in applications if e["group"] != "sent"]
    m = len(tiered)
    if n == 0 and offers == 0:
        add("NO_APPLICATIONS", "info", "You haven't started an application yet — your strong matches are a good place to begin.")
    elif n == 1 and offers == 0:
        add("FEW_OPTIONS", "improve", "You're applying to one program — a second realistic option protects you if it doesn't work out.", count=n)
    if m >= 2 and groups["strong"] == 0 and groups["possible"] == m:
        add("ALL_POSSIBLE", "improve", "All your applications are Possible matches — consider adding one Strong match.", count=m)
    if m >= 1 and groups["not_yet"] == m:
        add("ALL_NOT_YET", "improve", "None of your applications meets every published minimum yet — add an option you already qualify for.", count=m)
    elif groups["not_yet"]:
        names = [e["university"]["name_en"] for e in tiered if e["group"] == "not_yet"]
        add("SOME_NOT_YET", "info", f"{', '.join(names)}: a published minimum isn't met yet — check it's worth the effort.", count=len(names), universities=names)
    if n > MANY_APPLICATIONS:
        add("MANY_APPLICATIONS", "info", f"{n} applications in progress — each needs its own essays and checks.", count=n)
    for d, c in sorted(same_day.items()):
        if c >= 2:
            add("SAME_DAY_DEADLINES", "improve", f"{c} deadlines on {d.isoformat()}.", count=c, date=d.isoformat())
    if cluster:
        add("DEADLINES_CONCENTRATED", "improve", f"{cluster['count']} deadlines within {CONCENTRATION_WINDOW} days.", **cluster)
    if budget is None and n:
        add("NO_BUDGET", "info", "Add your yearly budget to compare costs across your applications.")
    elif over and len(over) == n:
        add("ALL_OVER_BUDGET", "improve", "Every application starts above your budget — plan the funding or add a lower-cost option.", count=len(over), budget=budget)
    elif over:
        add("SOME_OVER_BUDGET", "info", f"{len(over)} of your applications start above your budget.", count=len(over), budget=budget)
    saved_strong = [e for e in entries if e["source"] == "saved" and e["group"] == "strong"]
    if saved_strong and groups["strong"] == 0 and n:
        add("SAVED_STRONG_OPTION", "info", f"You saved {saved_strong[0]['university']['name_en']}, a Strong match you haven't applied to.",
            university=saved_strong[0]["university"]["name_en"], program=saved_strong[0]["program"]["name_en"])
    if offers >= 2:
        add("COMPARE_OFFERS", "info", f"You have {offers} offers — compare them side by side before you decide.", count=offers)

    if admitted is not None:
        # The choice is made: portfolio questions no longer apply (say so once, instead of "no applications yet").
        uni_name = db.get(University, admitted.university_id).name_en
        obs = [{"code": "ADMITTED", "severity": "info", "text": f"Accepted a place at {uni_name} — the plan is settled.", "params": {"university": uni_name}}]
    codes = {o["code"] for o in obs}
    questions = [
        {"key": "too_few", "flag": bool(codes & {"FEW_OPTIONS", "NO_APPLICATIONS"})},
        {"key": "too_difficult", "flag": bool(codes & {"ALL_NOT_YET", "ALL_POSSIBLE"})},
        {"key": "unnecessary", "flag": bool(codes & {"SOME_NOT_YET", "MANY_APPLICATIONS"})},
        {"key": "deadlines", "flag": bool(codes & {"SAME_DAY_DEADLINES", "DEADLINES_CONCENTRATED"})},
        {"key": "budget", "flag": bool(codes & {"ALL_OVER_BUDGET", "SOME_OVER_BUDGET", "NO_BUDGET"})},
        {"key": "realistic_option", "flag": bool(codes & {"FEW_OPTIONS", "ALL_NOT_YET", "ALL_POSSIBLE"}) and groups["strong"] == 0},
    ]
    last = db.scalars(select(PortfolioReview).where(PortfolioReview.student_user_id == student_user_id).order_by(PortfolioReview.reviewed_at.desc())).first()
    review = None
    if last:
        by = db.get(User, last.reviewed_by_user_id) if last.reviewed_by_user_id else None
        review = {"id": str(last.id), "decision": last.decision, "note": last.note, "reviewed_at": last.reviewed_at.isoformat(),
                  "reviewed_by": {"id": str(by.id), "full_name": by.full_name} if by else None, "observations": last.observations or [],
                  "stale": sorted(last.observations or []) != sorted(codes)}
    order = {"strong": 0, "possible": 1, "not_yet": 2, "sent": 3}
    entries.sort(key=lambda e: (e["source"] != "application", order[e["group"]], e["deadline"] or "9999"))
    return {"entries": entries, "groups": groups, "saved_groups": saved_groups, "offers": offers, "admitted": admitted is not None, "deadline_cluster": cluster,
            "budget": spread, "observations": obs, "questions": questions, "review": review}


# ------------------------------------------------------------------------------------------------------------ metrics


def success_metrics(db: Session, org_id=None, cohort: str | None = None, today: date | None = None) -> dict:
    """Coordinator hook — admission-success outcome metrics with definitions. ``org_id`` limits to one agency's
    applications; ``cohort`` is an intake label "YYYY-TERM". Values with n < MIN_COHORT are withheld (None)."""
    from statistics import median

    from app.models import ApplicationStatusHistory, ApplicationSubmission

    today = today or utcnow().date()
    stmt = select(Application, ProgramIntake).join(ProgramIntake, ProgramIntake.id == Application.intake_id)
    if org_id:
        stmt = stmt.where(Application.agency_org_id == org_id)
    if cohort:
        year, _, term = cohort.partition("-")
        stmt = stmt.where(ProgramIntake.year == int(year), ProgramIntake.term == term)
    rows = db.execute(stmt).all()
    ids = [a.id for a, _ in rows]
    first_ready: dict = {}
    if ids:
        for app_id, at in db.execute(select(ApplicationStatusHistory.application_id, ApplicationStatusHistory.created_at).where(
                ApplicationStatusHistory.application_id.in_(ids), ApplicationStatusHistory.to_status == S.READY).order_by(ApplicationStatusHistory.created_at)).all():
            first_ready.setdefault(app_id, at)
    days = [(first_ready[a.id] - a.created_at).total_seconds() / 86400 for a, _ in rows if a.id in first_ready and a.created_at]
    subs = {s.application_id: s for s in db.scalars(select(ApplicationSubmission).where(ApplicationSubmission.application_id.in_(ids)))} if ids else {}
    completeness = [s.completeness_at_submission for s in subs.values() if s.completeness_at_submission is not None]
    submitted = [a for a, _ in rows if a.submitted_at is not None]
    with_evidence = sum(1 for a in submitted if (s := subs.get(a.id)) and s.status == "SUBMITTED_CONFIRMED")
    past = [(a, i) for a, i in rows if i.application_deadline < today]
    missed = [a for a, i in past if a.status in PREP or ((s := subs.get(a.id)) and s.submitted_on and s.submitted_on > i.application_deadline)]

    def withheld(n: int, value):
        return value if n >= MIN_COHORT else None

    return {
        "scope": {"organization_id": str(org_id) if org_id else None, "cohort": cohort, "includes_demo": any(a.is_demo for a, _ in rows)},
        "min_n": MIN_COHORT,
        "time_to_ready_days": {"median": withheld(len(days), round(median(days), 1) if days else None), "n": len(days),
                               "definition": "Days from the application being started to its first move to READY (all documents verified, essays approved, counselor final check). Median over applications that reached READY."},
        "completeness_at_submission": {"mean": withheld(len(completeness), round(sum(completeness) / len(completeness), 3) if completeness else None), "n": len(completeness),
                                       "definition": "Share of required checklist items verified when the submission was recorded (from submission records; earlier submissions have no snapshot and are excluded)."},
        "submissions_with_evidence": {"count": with_evidence, "n": len(submitted),
                                      "definition": "Submitted applications whose submission is confirmed by a confirmation number or receipt."},
        "missed_deadlines": {"count": len(missed), "n": len(past),
                             "definition": "Applications whose deadline has passed while still in preparation, or recorded as submitted after the deadline. Denominator: applications whose deadline has passed."},
    }
