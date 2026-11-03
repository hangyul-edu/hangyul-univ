"""Universal dossier — the student prepares each fact/document ONCE; Hangyul works out where it can be reused.

Four jobs (see docs/DOCUMENT_AUTOMATION.md for the rules in plain words):

1. **Applicability** — for every document × every requirement of every active application (and, via
   ``applicability_for_requirement``, the visa): reusable as-is / near expiry / being checked / needs a fix /
   needs a newer copy (``DocumentRequirement.max_age_days``) / needs apostille or consular legalization (issuing
   country, time-versioned Apostille membership, ``LegalizationRule``) / needs translation / expired / missing.
2. **Document intelligence** — plain-language findings (expired, near expiry, wrong type, poor scan, missing pages,
   name / date mismatch, duplicate, translation, legalization, new issue date). Stored in ``DocumentFinding``;
   recomputed on every refresh; staff can resolve or dismiss (sticky per file version).
3. **Extraction suggestions** — ``services/extraction.py`` reads values; they are stored as SUGGESTED
   ``ExtractedField`` rows and written to the profile only by ``confirm_field`` (explicit confirmation).
4. **Package builder** — per application: N requirements · ready · waiting for the student · waiting for the counselor ·
   asked for by the university.

Everything is deterministic and labelled "Automatic check" in the UI — never "AI".
"""
from __future__ import annotations

import re
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import exists, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.storage import get_storage
from app.models import (
    AgencyAssignment,
    Application,
    ApplicationDocument,
    Country,
    Document,
    DocumentAnalysis,
    DocumentFinding,
    DocumentRequest,
    DocumentReview,
    DocumentVersion,
    DossierDocumentState,
    DossierReuseEvent,
    Essay,
    ExtractedField,
    LegalizationRule,
    Program,
    ProgramIntake,
    StudentLanguage,
    StudentProfile,
    University,
    User,
)
from app.models.base import utcnow
from app.models.enums import (
    ApplicationStatus as S,
)
from app.models.enums import (
    AssignmentStatus,
    DocumentStatus,
    EssayStatus,
    LanguageTest,
    LegalizationStatus,
)
from app.services import extraction as X
from app.services.readiness import legalization_for, requirements_for

# ----------------------------------------------------------------------------- vocabulary

PRE_SUBMISSION = {S.DRAFT, S.PROFILE_REVIEW, S.DOCUMENT_PREPARATION, S.READY}
# Applications whose admission documents still matter (prepared, sent, or possibly re-requested).
DOCUMENT_PHASE = PRE_SUBMISSION | {S.SUBMITTED, S.UNIVERSITY_REVIEW, S.ADDITIONAL_DOCUMENTS, S.INTERVIEW, S.WAITLISTED}

READY, NEAR_EXPIRY, IN_REVIEW, NEEDS_FIX = "READY", "NEAR_EXPIRY", "IN_REVIEW", "NEEDS_FIX"
NEEDS_NEW_VERSION, NEEDS_LEGALIZATION, NEEDS_TRANSLATION, EXPIRED, MISSING = (
    "NEEDS_NEW_VERSION", "NEEDS_LEGALIZATION", "NEEDS_TRANSLATION", "EXPIRED", "MISSING")
# Best first: used to pick the best of several copies for one requirement.
ORDER = [READY, NEAR_EXPIRY, IN_REVIEW, NEEDS_TRANSLATION, NEEDS_LEGALIZATION, NEEDS_FIX, NEEDS_NEW_VERSION, EXPIRED, MISSING]
RANK = {s: i for i, s in enumerate(ORDER)}
USABLE = {READY, NEAR_EXPIRY}
# Who has to act, per applicability status (the package builder's buckets).
BUCKET = {READY: "ready", NEAR_EXPIRY: "ready", IN_REVIEW: "counselor", NEEDS_FIX: "student", NEEDS_NEW_VERSION: "student",
          NEEDS_LEGALIZATION: "student", NEEDS_TRANSLATION: "student", EXPIRED: "student", MISSING: "student"}

ESSAY_BACKED = {"PERSONAL_STATEMENT", "STUDY_PLAN", "CV", "RECOMMENDATION"}
STUDENT_ESSAY = {EssayStatus.DRAFT, EssayStatus.CHANGES_REQUESTED, EssayStatus.STUDENT_REVISION}
TEAM_ESSAY = {EssayStatus.SUBMITTED, EssayStatus.AI_PRECHECK, EssayStatus.AGENCY_REVIEW, EssayStatus.FINAL_REVIEW}
NO_TRANSLATION = {"ko", "en"}
# Hangyul rule (not an official one): many embassies ask for ≥ 6 months of passport validity; we warn when the passport
# would expire within 6 months of the semester start.
PASSPORT_MARGIN_DAYS = 180
STAFF_FINDINGS = {"NAME_MISMATCH", "DOB_MISMATCH", "DATE_MISMATCH", "WRONG_TYPE", "POOR_SCAN", "UNREADABLE", "DUPLICATE", "MISSING_PAGES"}

# English wording for every reason / finding code. The apps translate by code (i18n namespace `dossier`) with the same
# params and fall back to this text.
TEXT = {
    # applicability reasons
    "READY": "Ready — can be used as it is.",
    "NEAR_EXPIRY_DATE": "Expires on {date} — before {university}'s deadline. Get a renewed copy soon.",
    "NEAR_TOO_OLD": "{university} needs it issued within {days} days — this copy is too old after {until}.",
    "PASSPORT_VALIDITY": "Your passport expires on {date}. Many embassies ask for at least 6 months of validity after you arrive.",
    "IN_REVIEW": "Your counselor is checking it.",
    "NEEDS_FIX": "Needs a change: {reason}",
    "TOO_OLD": "{university} needs a certificate issued within the last {days} days (yours is from {issued}).",
    "EXPIRED": "Expired on {date} — you need a newly issued copy.",
    "NEEDS_LEGALIZATION_APOSTILLE": "{university} needs it with an apostille from {country}.",
    "NEEDS_LEGALIZATION_CONSULAR_LEGALIZATION": "{university} needs it with consular legalization (Korean embassy/consulate in {country}).",
    "NEEDS_TRANSLATION": "{university} needs a certified Korean or English translation.",
    "MISSING": "Not uploaded yet.",
    # findings
    "F_EXPIRED": "This document expired on {date}. Upload a newly issued copy.",
    "F_NEAR_EXPIRY": "This document expires on {date}, before {until}. Renew it before you need it.",
    "F_NEW_ISSUE_NEEDED": "A copy issued within the last {days} days is needed for {universities}. Ask for a new one and upload it here.",
    "F_LEGALIZATION_NEEDED": "It needs {path} before universities can accept it.",
    "F_TRANSLATION_NEEDED": "It needs a certified Korean or English translation.",
    "F_TRANSLATION_CHECK": "Include a certified Korean or English translation. If it is already in the file, you don't need to do anything.",
    "F_POOR_SCAN": "The image is small ({width}×{height} pixels) — the text may be hard to read. Please upload a clearer scan or a PDF.",
    "F_SMALL_FILE": "The file is very small — it may be hard to read. Please upload a clearer scan or a PDF.",
    "F_UNREADABLE": "This PDF looks empty or unreadable. Please check the file and upload it again.",
    "F_WRONG_TYPE": "This looks like a {detected}, but it was uploaded as a {category}. Please check you chose the right file.",
    "F_MISSING_PAGES": "{university} asks for {required} pages; this file has {pages}.",
    "F_NAME_MISMATCH": "The name on this document ({found}) is different from your profile ({profile}). Your counselor will check it.",
    "F_DOB_MISMATCH": "The date of birth on this document ({found}) is different from your profile ({profile}).",
    "F_DATE_MISMATCH": "The graduation year on this document ({found}) is different from your education history ({profile}).",
    "F_DUPLICATE": "This is the same file as your {other} (uploaded {when}). You don't need to upload it twice.",
    "F_POSSIBLE_DUPLICATE": "This may be the same file as another {category} you uploaded. Keep one and remove the other if so.",
}
ACTIONS = {
    "EXPIRED": "UPLOAD_NEW", "NEAR_EXPIRY": "UPLOAD_NEW", "NEW_ISSUE_NEEDED": "UPLOAD_NEW", "LEGALIZATION_NEEDED": "LEGALIZE",
    "TRANSLATION_NEEDED": "ADD_TRANSLATION", "TRANSLATION_CHECK": None, "POOR_SCAN": "UPLOAD_CLEARER", "UNREADABLE": "UPLOAD_CLEARER",
    "WRONG_TYPE": "CHECK_FILE", "MISSING_PAGES": "UPLOAD_COMPLETE", "NAME_MISMATCH": None, "DOB_MISMATCH": "CHECK_PROFILE",
    "DATE_MISMATCH": "CHECK_PROFILE", "DUPLICATE": None, "POSSIBLE_DUPLICATE": None,
}
SEVERITY = {"EXPIRED": "BLOCKER", "UNREADABLE": "BLOCKER", "NEAR_EXPIRY": "WARNING", "NEW_ISSUE_NEEDED": "WARNING", "LEGALIZATION_NEEDED": "WARNING",
            "TRANSLATION_NEEDED": "WARNING", "POOR_SCAN": "WARNING", "WRONG_TYPE": "WARNING", "MISSING_PAGES": "WARNING",
            "NAME_MISMATCH": "WARNING", "DOB_MISMATCH": "WARNING", "DATE_MISMATCH": "WARNING", "TRANSLATION_CHECK": "INFO",
            "DUPLICATE": "INFO", "POSSIBLE_DUPLICATE": "INFO"}
PATH_WORDS = {"APOSTILLE": "an apostille", "CONSULAR_LEGALIZATION": "consular legalization"}
ALPHA3 = {"VNM": "VN", "NPL": "NP", "MMR": "MM", "CHN": "CN", "UZB": "UZ", "MNG": "MN", "IDN": "ID", "THA": "TH", "KOR": "KR", "LKA": "LK",
          "KHM": "KH", "PHL": "PH", "JPN": "JP", "IND": "IN", "BGD": "BD", "PAK": "PK", "KAZ": "KZ", "KGZ": "KG", "USA": "US", "RUS": "RU"}


def _cat_words(cat: str) -> str:
    return cat.replace("_", " ").lower()


def _text(code: str, params: dict) -> str:
    try:
        return TEXT[code].format(**params)
    except (KeyError, IndexError):
        return TEXT.get(code, code)


def reason(code: str, **params) -> dict:
    clean = {k: (v.isoformat() if isinstance(v, date) else v) for k, v in params.items()}
    return {"code": code, "params": clean, "text": _text(code, clean)}


# ----------------------------------------------------------------------------- legalization route (time-aware)

def route_for(db: Session, issuing_country: str | None, category: str, today: date, cache: dict | None = None) -> dict:
    """Legalization route for a document issued in ``issuing_country`` as of ``today``.

    A ``LegalizationRule`` for the country wins (Nepal / Myanmar → consular). Otherwise the Country's time-versioned
    Hague Apostille membership decides: in force on ``today`` → APOSTILLE, joined with a future date or not a member →
    CONSULAR_LEGALIZATION (e.g. Viet Nam: consular before 2026-09-11, apostille from that date)."""
    key = (issuing_country, category, today)
    if cache is not None and key in cache:
        return cache[key]
    if not issuing_country:
        out = {"path": "UNKNOWN", "basis": "no_country"}
    elif issuing_country == "KR":
        out = {"path": "NONE", "basis": "korea"}
    else:
        has_rule = db.scalar(select(exists().where(LegalizationRule.issuing_country == issuing_country,
                                                   or_(LegalizationRule.document_category.is_(None), LegalizationRule.document_category == category))))
        if has_rule:
            info = legalization_for(db, issuing_country, category)
            out = {"path": info["path"], "basis": "rule", "note": info.get("note")}
        else:
            c = db.get(Country, issuing_country)
            if c is None or c.apostille_member is None:
                out = {"path": "UNKNOWN", "basis": "unverified"}
            else:
                in_force = bool(c.apostille_member) and (c.apostille_effective_from is None or c.apostille_effective_from <= today)
                out = {"path": "APOSTILLE" if in_force else "CONSULAR_LEGALIZATION", "basis": "apostille_convention",
                       "effective_from": c.apostille_effective_from.isoformat() if c.apostille_effective_from else None,
                       "country_name": c.name_en}
    if cache is not None:
        cache[key] = out
    return out


def _country_name(db: Session, cc: str | None) -> str:
    c = db.get(Country, cc) if cc else None
    return c.name_en if c else (cc or "")


# ----------------------------------------------------------------------------- per-document state

def translation_status(doc: Document, state: DossierDocumentState | None) -> str:
    """NOT_NEEDED (Korean/English) · PROVIDED (verified by Hangyul, or marked by staff) · NEEDED (marked by staff) ·
    CHECK (not verified yet — the counselor checks the translation is included) · UNKNOWN (language not given)."""
    if not doc.language:
        return "UNKNOWN"
    if doc.language in NO_TRANSLATION:
        return "NOT_NEEDED"
    if state and state.translation_status in ("PROVIDED", "NEEDED"):
        return state.translation_status
    if doc.status == DocumentStatus.VERIFIED:
        return "PROVIDED"
    return "CHECK"


@dataclass
class Req:
    """A requirement as the dossier sees it: from DocumentRequirement, a DocumentRequest, or the visa workstream."""
    category: str
    label: str
    university: str = ""
    university_id: object = None
    max_age_days: int | None = None
    legalization_required: bool = False
    translation_required: bool = False
    required: bool = True
    requirement_id: str | None = None
    notes: str | None = None
    extra: dict = field(default_factory=dict)


def req_from(obj, **overrides) -> Req:
    """Normalise a DocumentRequirement, a dict, or any object with the same attribute names."""
    get = (lambda k, d=None: obj.get(k, d)) if isinstance(obj, dict) else (lambda k, d=None: getattr(obj, k, d))
    cat = get("category")
    cat = getattr(cat, "value", cat)
    r = Req(category=str(cat), label=get("label") or _cat_words(str(cat)).capitalize(), university=get("university") or "",
            university_id=get("university_id"), max_age_days=get("max_age_days"), legalization_required=bool(get("legalization_required", False)),
            translation_required=bool(get("translation_required", False)), required=bool(get("is_required", get("required", True))),
            requirement_id=str(get("id")) if get("id") is not None and not isinstance(obj, dict) else get("requirement_id"), notes=get("notes"))
    for k, v in overrides.items():
        setattr(r, k, v)
    return r


def evaluate(db: Session, doc: Document | None, req: Req, *, today: date, ref_date: date | None = None, window_end: date | None = None,
             passport_until: date | None = None, ts: str | None = None, cache: dict | None = None) -> dict:
    """Applicability of ONE document for ONE requirement. ``ref_date`` = the date the document is judged at (today, or
    the submission date for an application already sent); ``window_end`` = the application deadline while preparing."""
    ref = ref_date or today
    uni = req.university or "This university"
    if doc is None:
        return {"status": MISSING, **reason("MISSING")}
    if doc.status == DocumentStatus.EXPIRED or (doc.expires_on and doc.expires_on < ref):
        return {"status": EXPIRED, **reason("EXPIRED", date=doc.expires_on or ref)}
    if req.max_age_days and doc.issue_date and (ref - doc.issue_date).days > req.max_age_days:
        return {"status": NEEDS_NEW_VERSION, **reason("TOO_OLD", university=uni, days=req.max_age_days, issued=doc.issue_date)}
    if doc.status == DocumentStatus.NEEDS_CORRECTION:
        return {"status": NEEDS_FIX, **reason("NEEDS_FIX", reason=doc.rejection_reason or "see your counselor's note")}
    if req.legalization_required and doc.issuing_country and doc.issuing_country != "KR":
        route = route_for(db, doc.issuing_country, req.category, today, cache)
        path = route["path"]
        if path in ("APOSTILLE", "CONSULAR_LEGALIZATION"):
            done = doc.legalization_status == LegalizationStatus.COMPLETED
            have = doc.legalization_path.value
            # A consular legalization completed before a country joined the Apostille Convention is generally still accepted.
            ok = done and (have == path or (have == "CONSULAR_LEGALIZATION" and path == "APOSTILLE"))
            if not ok:
                return {"status": NEEDS_LEGALIZATION, "path": path,
                        **reason(f"NEEDS_LEGALIZATION_{path}", university=uni, country=route.get("country_name") or _country_name(db, doc.issuing_country))}
    if req.translation_required and ts == "NEEDED":
        return {"status": NEEDS_TRANSLATION, **reason("NEEDS_TRANSLATION", university=uni)}
    if doc.status != DocumentStatus.VERIFIED:
        return {"status": IN_REVIEW, **reason("IN_REVIEW")}
    if window_end and window_end > ref:
        if doc.expires_on and doc.expires_on < window_end:
            return {"status": NEAR_EXPIRY, **reason("NEAR_EXPIRY_DATE", date=doc.expires_on, university=uni)}
        if req.max_age_days and doc.issue_date and (window_end - doc.issue_date).days > req.max_age_days:
            return {"status": NEAR_EXPIRY, **reason("NEAR_TOO_OLD", university=uni, days=req.max_age_days,
                                                     until=doc.issue_date + timedelta(days=req.max_age_days))}
    if req.category == "PASSPORT" and passport_until and doc.expires_on and doc.expires_on < passport_until:
        return {"status": NEAR_EXPIRY, **reason("PASSPORT_VALIDITY", date=doc.expires_on)}
    return {"status": READY, **reason("READY")}


def best_of(results: list[tuple[Document, dict]]) -> tuple[Document | None, dict]:
    if not results:
        return None, {"status": MISSING, **reason("MISSING")}
    return min(results, key=lambda r: (RANK[r[1]["status"]], -(r[0].issue_date or date.min).toordinal(), -r[0].current_version))


# ----------------------------------------------------------------------------- context loading

@dataclass
class AppCtx:
    app: Application
    university: University
    program: Program
    intake: ProgramIntake
    reqs: list[Req]
    ref_date: date
    window_end: date | None
    passport_until: date | None
    links: dict  # requirement_id -> ApplicationDocument
    requests: list[DocumentRequest]
    essays: list[Essay]


@dataclass
class Ctx:
    student: User
    profile: StudentProfile | None
    docs: list[Document]
    by_cat: dict
    states: dict
    apps: list[AppCtx]
    today: date
    cache: dict = field(default_factory=dict)


def load(db: Session, student_user_id, today: date | None = None, *, app_ids: list | None = None) -> Ctx:
    today = today or date.today()
    student = db.get(User, student_user_id)
    profile = db.scalar(select(StudentProfile).where(StudentProfile.user_id == student_user_id).options(
        selectinload(StudentProfile.educations), selectinload(StudentProfile.languages)))
    docs = list(db.scalars(select(Document).where(Document.owner_user_id == student_user_id).options(selectinload(Document.versions))
                           .order_by(Document.created_at)).all())
    by_cat: dict[str, list[Document]] = defaultdict(list)
    for d in docs:
        by_cat[d.category.value].append(d)
    states = {s.document_id: s for s in db.scalars(select(DossierDocumentState).where(DossierDocumentState.document_id.in_([d.id for d in docs])))} if docs else {}
    q = select(Application).where(Application.student_user_id == student_user_id, Application.status.in_(DOCUMENT_PHASE)).order_by(Application.created_at)
    if app_ids is not None:
        q = select(Application).where(Application.id.in_(app_ids))
    apps = []
    nat = profile.nationality if profile else None
    for a in db.scalars(q).all():
        program, uni, intake = db.get(Program, a.program_id), db.get(University, a.university_id), db.get(ProgramIntake, a.intake_id)
        reqs = [req_from(r, university=uni.name_en, university_id=uni.id) for r in requirements_for(db, program, nat)]
        sent = a.status not in PRE_SUBMISSION
        ref = a.submitted_at.date() if sent and a.submitted_at else today
        window = intake.application_deadline if (not sent and intake.application_deadline and intake.application_deadline >= today) else None
        passport_until = intake.semester_start + timedelta(days=PASSPORT_MARGIN_DAYS) if intake.semester_start else None
        links = {str(l.requirement_id): l for l in db.scalars(select(ApplicationDocument).where(ApplicationDocument.application_id == a.id))}
        requests = list(db.scalars(select(DocumentRequest).where(DocumentRequest.application_id == a.id).order_by(DocumentRequest.requested_at)).all())
        essays = list(db.scalars(select(Essay).where(Essay.application_id == a.id)).all())
        apps.append(AppCtx(a, uni, program, intake, reqs, ref, window, passport_until, links, requests, essays))
    return Ctx(student, profile, docs, by_cat, states, apps, today)


def _eval(db: Session, ctx: Ctx, d: Document, req: Req, ac: AppCtx | None) -> dict:
    return evaluate(db, d, req, today=ctx.today, ref_date=ac.ref_date if ac else ctx.today, window_end=ac.window_end if ac else None,
                    passport_until=ac.passport_until if ac else None, ts=translation_status(d, ctx.states.get(d.id)), cache=ctx.cache)


def pick_for(db: Session, ctx: Ctx, req: Req, ac: AppCtx | None) -> tuple[Document | None, dict]:
    """The best document for one requirement; for an application already sent, the document it was sent with."""
    if ac and req.requirement_id and (link := ac.links.get(req.requirement_id)) and link.document_id and ac.app.status not in PRE_SUBMISSION:
        d = next((x for x in ctx.docs if x.id == link.document_id), None)
        if d is not None:
            return d, _eval(db, ctx, d, req, ac)
    return best_of([(d, _eval(db, ctx, d, req, ac)) for d in ctx.by_cat.get(req.category, [])])


# ----------------------------------------------------------------------------- serialisation helpers

def doc_brief(d: Document, ctx: Ctx | None = None, db: Session | None = None) -> dict:
    latest = d.versions[-1] if d.versions else None
    st = ctx.states.get(d.id) if ctx else None
    return {
        "id": str(d.id), "category": d.category.value, "title": d.title, "status": d.status.value,
        "issuing_country": d.issuing_country, "issue_date": d.issue_date.isoformat() if d.issue_date else None,
        "expires_on": d.expires_on.isoformat() if d.expires_on else None, "language": d.language,
        "current_version": d.current_version, "updated_at": d.updated_at.isoformat() if d.updated_at else None,
        "latest_file": {"filename": latest.original_filename, "uploaded_at": latest.created_at.isoformat(), "size_bytes": latest.size_bytes} if latest else None,
        "translation": translation_status(d, st),
        "legalization": {"path": d.legalization_path.value, "status": d.legalization_status.value},
        "rejection_reason": d.rejection_reason, "is_demo": d.is_demo,
    }


def _join(names: list[str]) -> str:
    names = list(dict.fromkeys(names))
    if len(names) <= 1:
        return "".join(names)
    return ", ".join(names[:-1]) + " and " + names[-1]


# ----------------------------------------------------------------------------- analysis + findings

def analyze_version(db: Session, d: Document, v: DocumentVersion, *, data: bytes | None = None) -> DocumentAnalysis:
    """Automatic check of one file version (runs once per version). Creates SUGGESTED extracted fields; never edits the profile."""
    existing = db.scalar(select(DocumentAnalysis).where(DocumentAnalysis.document_id == d.id, DocumentAnalysis.version == v.version))
    if existing:
        return existing
    a = DocumentAnalysis(document_id=d.id, version=v.version, mime_type=v.mime_type, size_bytes=v.size_bytes, is_demo=d.is_demo, file_findings=[])
    text = None
    try:
        data = data if data is not None else get_storage().get(v.storage_key)
    except Exception:  # noqa: BLE001 — a missing file is recorded, never fatal
        data = None
        a.error = "file_unavailable"
    if data is not None:
        if v.mime_type == "application/pdf":
            a.page_count = X.pdf_pages(data)
            text = X.pdf_text(data)
            a.text_chars = len(text.strip()) if text is not None else None
            if text is None:
                a.error = "pdf_text_failed"
        else:
            size = X.image_size(data)
            if size:
                a.width, a.height = size
            a.text_chars = 0
    mrz = X.parse_mrz(text) if text else None
    a.has_mrz = bool(mrz)
    a.detected_category, _basis = X.detect_category(text, v.original_filename, a.has_mrz)
    db.add(a)
    for f in X.extract_fields(text, v.original_filename, d.category.value):
        db.add(ExtractedField(document_id=d.id, student_user_id=d.owner_user_id, version=v.version, field=f["field"], value=f["value"],
                              confidence=f["confidence"], source=f["source"], status="SUGGESTED", is_demo=d.is_demo))
    db.flush()
    return a


def _file_findings(d: Document, a: DocumentAnalysis | None, reqs: list[tuple[Req, AppCtx]]) -> list[tuple[str, dict]]:
    out: list[tuple[str, dict]] = []
    if not a:
        return out
    if a.mime_type and a.mime_type.startswith("image/"):
        if a.width and a.height and (max(a.width, a.height) < 1000 or min(a.width, a.height) < 600):
            out.append(("POOR_SCAN", {"width": a.width, "height": a.height}))
        elif (a.size_bytes or 0) < 25_000:
            out.append(("POOR_SCAN", {"width": a.width or 0, "height": a.height or 0, "small_file": True}))
    elif a.mime_type == "application/pdf":
        if (a.text_chars or 0) == 0 and (a.size_bytes or 0) < 15_000 and not a.error:
            out.append(("UNREADABLE", {}))
    if a.detected_category and not X.compatible(a.detected_category, d.category.value):
        out.append(("WRONG_TYPE", {"detected": _cat_words(a.detected_category), "category": _cat_words(d.category.value), "detected_code": a.detected_category,
                                   "category_code": d.category.value}))
    if a.page_count:
        for r, ac in reqs:
            m = re.search(r"(\d+)\s*pages?", r.notes or "", re.I)
            if m and a.page_count < int(m.group(1)):
                out.append(("MISSING_PAGES", {"university": ac.university.name_en, "university_id": str(ac.university.id), "required": int(m.group(1)), "pages": a.page_count}))
                break
    return out


def _profile_findings(ctx: Ctx, d: Document, fields: list[ExtractedField]) -> list[tuple[str, dict]]:
    out = []
    p = ctx.profile
    for f in fields:
        if f.status == "REJECTED" or f.version != d.current_version:
            continue
        if f.field == "full_name" and d.category.value in X.PERSONAL_CATEGORIES and ctx.student and not X.names_match(f.value, ctx.student.full_name):
            out.append(("NAME_MISMATCH", {"found": f.value, "profile": ctx.student.full_name}))
        elif f.field == "date_of_birth" and p and p.date_of_birth and f.value != p.date_of_birth.isoformat():
            out.append(("DOB_MISMATCH", {"found": f.value, "profile": p.date_of_birth.isoformat()}))
        elif f.field == "graduation_date" and d.category.value in ("GRADUATION_CERTIFICATE", "TRANSCRIPT") and p and p.educations:
            years = {e.graduation_year for e in p.educations if e.graduation_year}
            if years and int(f.value[:4]) not in years:
                out.append(("DATE_MISMATCH", {"found": f.value[:4], "profile": ", ".join(str(y) for y in sorted(years))}))
    return out


def _duplicate_findings(ctx: Ctx, d: Document) -> list[tuple[str, dict]]:
    if not d.versions:
        return []
    cur = d.versions[-1]
    for other in ctx.docs:
        if other.id == d.id or not other.versions:
            continue
        for v in other.versions:
            if v.sha256 == cur.sha256 and other.created_at <= d.created_at:
                return [("DUPLICATE", {"other": _cat_words(other.category.value), "other_code": other.category.value, "other_id": str(other.id),
                                       "when": v.created_at.date().isoformat()})]
    for other in ctx.by_cat.get(d.category.value, []):
        if other.id != d.id and other.versions and other.versions[-1].size_bytes == cur.size_bytes and other.created_at <= d.created_at:
            return [("POSSIBLE_DUPLICATE", {"category": _cat_words(d.category.value), "category_code": d.category.value, "other_id": str(other.id)})]
    return []


def compute_findings(db: Session, ctx: Ctx, d: Document, evals: list[tuple[Req, AppCtx, dict]], analysis: DocumentAnalysis | None,
                     fields: list[ExtractedField]) -> list[tuple[str, dict]]:
    out: list[tuple[str, dict]] = []
    today = ctx.today
    if d.status == DocumentStatus.EXPIRED or (d.expires_on and d.expires_on < today):
        out.append(("EXPIRED", {"date": (d.expires_on or today).isoformat()}))
    else:
        near = [(e, ac) for _r, ac, e in evals if e["status"] == NEAR_EXPIRY and e["code"] in ("NEAR_EXPIRY_DATE", "PASSPORT_VALIDITY")]
        if near and d.expires_on:
            e, ac = near[0]
            until = ac.window_end if e["code"] == "NEAR_EXPIRY_DATE" and ac.window_end else ac.passport_until
            out.append(("NEAR_EXPIRY", {"date": d.expires_on.isoformat(), "until": until.isoformat() if until else None, "university": ac.university.name_en, "university_id": str(ac.university.id)}))
    too_old = [(r, ac) for r, ac, e in evals if e["status"] == NEEDS_NEW_VERSION]
    if too_old:
        out.append(("NEW_ISSUE_NEEDED", {"universities": _join([ac.university.name_en for _r, ac in too_old]), "days": min(r.max_age_days for r, _ in too_old)}))
    legal = [e for _r, _ac, e in evals if e["status"] == NEEDS_LEGALIZATION]
    if legal:
        out.append(("LEGALIZATION_NEEDED", {"path": PATH_WORDS.get(legal[0]["path"], legal[0]["path"]), "path_code": legal[0]["path"]}))
    ts = translation_status(d, ctx.states.get(d.id))
    needs_tr = any(r.translation_required for r, _ac, _e in evals)
    if needs_tr and ts == "NEEDED":
        out.append(("TRANSLATION_NEEDED", {}))
    elif needs_tr and ts == "CHECK":
        out.append(("TRANSLATION_CHECK", {}))
    out += _file_findings(d, analysis, [(r, ac) for r, ac, _e in evals])
    out += _profile_findings(ctx, d, fields)
    out += _duplicate_findings(ctx, d)
    return out


def sync_findings(db: Session, d: Document, computed: list[tuple[str, dict]], now: datetime) -> list[DocumentFinding]:
    """Upsert findings for the current version. Findings that no longer apply are auto-resolved (resolved_by = null) and
    may reopen; staff resolutions / dismissals are sticky for that version."""
    existing = list(db.scalars(select(DocumentFinding).where(DocumentFinding.document_id == d.id)).all())
    by_key = {(f.code, f.version): f for f in existing}
    seen = set()
    for code, params in computed:
        key = (code, d.current_version)
        if key in seen:
            continue
        seen.add(key)
        f = by_key.get(key)
        if f is None:
            f = DocumentFinding(document_id=d.id, student_user_id=d.owner_user_id, version=d.current_version, code=code, severity=SEVERITY.get(code, "INFO"),
                                params=params, status="OPEN", is_demo=d.is_demo)
            db.add(f)
            existing.append(f)
        else:
            f.params = params
            if f.status == "RESOLVED" and f.resolved_by_id is None:
                f.status, f.resolved_at = "OPEN", None
    for f in existing:
        if f.status == "OPEN" and (f.code, f.version) not in seen:
            f.status, f.resolved_at, f.resolved_by_id = "RESOLVED", now, None
    return existing


def ser_finding(f: DocumentFinding, *, staff: bool = False) -> dict:
    params = f.params or {}
    code = f"F_{f.code}" if f"F_{f.code}" in TEXT else f.code
    if f.code == "POOR_SCAN" and params.get("small_file"):
        code = "F_SMALL_FILE"
    out = {"id": str(f.id), "document_id": str(f.document_id), "code": f.code, "text_code": code.removeprefix("F_"), "severity": f.severity,
           "params": params, "explanation": _text(code, params), "action": ACTIONS.get(f.code), "status": f.status, "version": f.version}
    if staff:
        out.update({"note": f.note, "resolved_at": f.resolved_at.isoformat() if f.resolved_at else None,
                    "resolved_by_id": str(f.resolved_by_id) if f.resolved_by_id else None, "created_at": f.created_at.isoformat() if f.created_at else None})
    return out


# ----------------------------------------------------------------------------- extraction suggestions

FIELD_TARGET = {"date_of_birth": "profile.date_of_birth", "passport_expiry": "profile.passport_expiry", "passport_number": "profile.passport_number",
                "issue_date": "document.issue_date", "expiry_date": "document.expires_on", "graduation_date": "education.graduation_year",
                "gpa": "education.gpa", "test_score": "language.score", "school": "education.institution"}


def _target_education(p: StudentProfile | None):
    if not p or not p.educations:
        return None
    return max(p.educations, key=lambda e: (e.graduation_year or 0))


def _parse_gpa(v: str) -> tuple[float, float] | None:
    m = re.fullmatch(r"\s*(\d{1,2}(?:\.\d{1,2})?)\s*/\s*(\d{1,3}(?:\.\d)?)\s*", v or "")
    if not m:
        return None
    val, scale = float(m.group(1)), float(m.group(2))
    return (val, scale) if 0 < scale and 0 <= val <= scale else None


def _parse_score(v: str) -> tuple[LanguageTest, float] | None:
    m = re.fullmatch(r"\s*(TOPIK|IELTS|TOEFL)\s+(\d{1,3}(?:\.\d)?)\s*", v or "", re.I)
    if not m:
        return None
    test = m.group(1).upper()
    member = {"TOPIK": "TOPIK", "IELTS": "IELTS", "TOEFL": "TOEFL_IBT"}[test]
    lt = LanguageTest.__members__.get(member) or next((x for x in LanguageTest if x.value.startswith(test)), None)
    return (lt, float(m.group(2))) if lt else None


def profile_value(ctx: Ctx, d: Document, f: ExtractedField) -> str | None:
    p, fld = ctx.profile, f.field
    if fld == "full_name":
        return ctx.student.full_name if ctx.student else None
    if fld == "date_of_birth":
        return p.date_of_birth.isoformat() if p and p.date_of_birth else None
    if fld == "passport_expiry":
        return p.passport_expiry.isoformat() if p and p.passport_expiry else None
    if fld == "passport_number":
        return p.passport_number_masked if p else None
    if fld == "nationality":
        return p.nationality if p else None
    if fld == "issue_date":
        return d.issue_date.isoformat() if d.issue_date else None
    if fld == "expiry_date":
        return d.expires_on.isoformat() if d.expires_on else None
    e = _target_education(p)
    if fld == "graduation_date":
        return str(e.graduation_year) if e and e.graduation_year else None
    if fld == "gpa":
        return f"{e.gpa_value:g}/{e.gpa_scale_max:g}" if e and e.gpa_value is not None and e.gpa_scale_max else None
    if fld == "school":
        return e.institution if e and e.institution else None
    if fld == "test_score":
        parsed = _parse_score(f.value)
        if p and parsed:
            lang = next((l for l in p.languages if l.test == parsed[0] and not l.is_planned), None)
            return f"{parsed[0].value.split('_')[0]} {lang.score:g}" if lang else None
    return None


def matches(f: ExtractedField, current: str | None) -> bool:
    if current is None:
        return False
    v = f.confirmed_value or f.value
    if f.field == "full_name":
        return X.names_match(v, current)
    if f.field == "passport_number":
        return X.masked_tail(v) == X.masked_tail(current)
    if f.field == "nationality":
        return ALPHA3.get(v, v) == current
    if f.field == "graduation_date":
        return v[:4] == current[:4]
    if f.field == "school":
        return X.fold(v) == X.fold(current)
    if f.field == "gpa":
        a, b = _parse_gpa(v), _parse_gpa(current)
        return bool(a and b and abs(a[0] - b[0]) < 0.005 and abs(a[1] - b[1]) < 0.005)
    if f.field == "test_score":
        return X.fold(v) == X.fold(current)
    return v == current


def ser_field(ctx: Ctx, d: Document, f: ExtractedField) -> dict:
    cur = profile_value(ctx, d, f)
    return {"id": str(f.id), "document_id": str(d.id), "document_title": d.title, "category": d.category.value, "version": f.version,
            "field": f.field, "value": f.value, "confidence": f.confidence, "source": f.source, "status": f.status,
            "confirmed_value": f.confirmed_value, "current_value": cur, "matches_profile": matches(f, cur), "target": FIELD_TARGET.get(f.field),
            "applied": f.applied or []}


def apply_confirmation(db: Session, f: ExtractedField, value: str) -> list[str]:
    """Write ONE confirmed value to the profile / document. Called only from the explicit Confirm action."""
    d = db.get(Document, f.document_id)
    p = db.scalar(select(StudentProfile).where(StudentProfile.user_id == f.student_user_id).options(
        selectinload(StudentProfile.educations), selectinload(StudentProfile.languages)))
    applied: list[str] = []

    def as_date(v: str) -> date:
        try:
            return date.fromisoformat(v)
        except ValueError:
            raise HTTPException(422, "Enter the date as YYYY-MM-DD.") from None

    fld = f.field
    if fld == "date_of_birth" and p:
        p.date_of_birth = as_date(value)
        applied.append("profile.date_of_birth")
    elif fld == "passport_expiry":
        dt = as_date(value)
        if p:
            p.passport_expiry, p.has_passport = dt, True
            applied.append("profile.passport_expiry")
        if d and d.category.value == "PASSPORT":
            d.expires_on = dt
            applied.append("document.expires_on")
    elif fld == "passport_number" and p:
        tail = X.masked_tail(value)
        if not tail or len(tail) < 3:
            raise HTTPException(422, "Enter at least the last three characters of the passport number.")
        p.passport_number_masked = "•" * 6 + tail[-3:]  # never store the full number
        applied.append("profile.passport_number")
    elif fld == "issue_date" and d:
        d.issue_date = as_date(value)
        applied.append("document.issue_date")
    elif fld == "expiry_date" and d:
        d.expires_on = as_date(value)
        applied.append("document.expires_on")
    elif fld in ("graduation_date", "gpa", "school"):
        e = _target_education(p)
        if e is not None:
            if fld == "graduation_date":
                m = re.match(r"(\d{4})", value)
                if not m:
                    raise HTTPException(422, "Enter the graduation date as YYYY-MM-DD or a year.")
                e.graduation_year = int(m.group(1))
                applied.append("education.graduation_year")
            elif fld == "gpa":
                g = _parse_gpa(value)
                if not g:
                    raise HTTPException(422, "Enter the GPA as value/scale, e.g. 8.6/10.")
                e.gpa_value, e.gpa_scale_max = g
                lo = e.gpa_scale_min or 0
                e.gpa_percent = round((g[0] - lo) / (g[1] - lo) * 100, 1) if g[1] > lo else None
                applied.append("education.gpa")
            else:
                e.institution = value.strip()[:200]
                applied.append("education.institution")
    elif fld == "test_score" and p:
        s = _parse_score(value)
        if not s:
            raise HTTPException(422, "Enter the score as e.g. TOPIK 4 or IELTS 6.5.")
        lang = next((l for l in p.languages if l.test == s[0] and not l.is_planned), None)
        if lang:
            lang.score = s[1]
        else:
            db.add(StudentLanguage(profile_id=p.id, test=s[0], score=s[1], verified=False))
        applied.append("language.score")
    return applied


# ----------------------------------------------------------------------------- the dossier

def _essay_bucket(essay: Essay | None) -> tuple[str, str] | None:
    if essay is None:
        return None
    if essay.status in TEAM_ESSAY:
        return "counselor", "ESSAY_IN_REVIEW"
    if essay.status in STUDENT_ESSAY:
        return "student", "ESSAY_TO_WRITE" if essay.status == EssayStatus.DRAFT else "ESSAY_TO_REVISE"
    if essay.status == EssayStatus.APPROVED:
        return "student", "ESSAY_APPROVED_UPLOAD"
    return None


def package_items(db: Session, ctx: Ctx, ac: AppCtx) -> list[dict]:
    items = []
    for r in ac.requests:
        if r.status == "OPEN":
            items.append({"key": f"request:{r.id}", "kind": "request", "request_id": str(r.id), "label": r.label, "category": r.category,
                          "bucket": "request", "status": "REQUESTED", "document_id": None, "note": r.note,
                          "due_date": r.due_date.isoformat() if r.due_date else None, "reason": {"code": "REQUESTED", "params": {}, "text": r.note}})
        elif r.status == "FULFILLED":
            items.append({"key": f"request:{r.id}", "kind": "request", "request_id": str(r.id), "label": r.label, "category": r.category,
                          "bucket": "ready", "status": "SENT", "document_id": str(r.document_id) if r.document_id else None,
                          "reason": {"code": "SENT", "params": {}, "text": "Sent to the university."}})
    essays_by_type = {e.essay_type.value: e for e in ac.essays}
    for req in ac.reqs:
        if not req.required:
            continue
        d, ev = pick_for(db, ctx, req, ac)
        bucket = BUCKET[ev["status"]]
        status = ev["status"]
        why = {k: ev[k] for k in ("code", "params", "text")}
        if req.category in ESSAY_BACKED and ev["status"] not in USABLE and ev["status"] != IN_REVIEW:
            eb = _essay_bucket(essays_by_type.get(req.category))
            if eb:
                bucket, code = eb
                status, why = code, {"code": code, "params": {}, "text": ""}
        items.append({"key": req.requirement_id or req.category, "kind": "requirement", "requirement_id": req.requirement_id, "label": req.label,
                      "category": req.category, "bucket": bucket, "status": status, "document_id": str(d.id) if d else None, "reason": why,
                      "shared_with_university": bool((l := ac.links.get(req.requirement_id or "")) and l.shared_with_university)})
    order = {"request": 0, "student": 1, "counselor": 2, "ready": 3}
    return sorted(items, key=lambda i: order[i["bucket"]])


def package_summary(items: list[dict]) -> dict:
    c = {k: sum(1 for i in items if i["bucket"] == k) for k in ("ready", "student", "counselor", "request")}
    total = len(items)
    return {"total": total, **c, "complete": total > 0 and c["ready"] == total}


def ser_app(ac: AppCtx) -> dict:
    return {"id": str(ac.app.id), "status": ac.app.status.value, "university": ac.university.name_en, "university_id": str(ac.university.id),
            "program": ac.program.name_en, "deadline": ac.intake.application_deadline.isoformat() if ac.intake.application_deadline else None,
            "sent": ac.app.status not in PRE_SUBMISSION}


def request_suggestion(db: Session, ctx: Ctx, ac: AppCtx, r: DocumentRequest) -> dict:
    """For an open university request: can an existing dossier document answer it? ("Send your existing …")."""
    cat = r.category
    if not cat:
        cat, _ = X.detect_category(f"{r.label}\n{r.note}", None, False)
    base = next((q for q in ac.reqs if q.category == cat), None)
    max_age = None
    m = re.search(r"within (?:the )?(?:last |past )?(\d{1,3}) days", f"{r.label} {r.note}", re.I)
    if m:
        max_age = int(m.group(1))
    elif base:
        max_age = base.max_age_days
    req = Req(category=cat or "OTHER", label=r.label, university=ac.university.name_en, university_id=ac.university.id, max_age_days=max_age,
              legalization_required=bool(base and base.legalization_required), translation_required=bool(base and base.translation_required))
    d, ev = best_of([(x, evaluate(db, x, req, today=ctx.today, ts=translation_status(x, ctx.states.get(x.id)), cache=ctx.cache))
                     for x in ctx.by_cat.get(req.category, [])]) if cat else (None, {"status": MISSING, **reason("MISSING")})
    if ev["status"] in USABLE or ev["status"] == IN_REVIEW:
        action = "SEND_EXISTING"
    elif ev["status"] in (NEEDS_NEW_VERSION, EXPIRED):
        action = "UPLOAD_NEWER"
    elif ev["status"] == NEEDS_FIX:
        action = "FIX"
    elif ev["status"] == MISSING:
        action = "UPLOAD"
    else:
        action = "UPLOAD_NEWER" if d else "UPLOAD"
    return {"request_id": str(r.id), "application_id": str(ac.app.id), "university": ac.university.name_en, "university_id": str(ac.university.id), "label": r.label, "note": r.note,
            "category": cat, "max_age_days": max_age, "due_date": r.due_date.isoformat() if r.due_date else None,
            "document": doc_brief(d, ctx) if d else None, "status": ev["status"], "reason": {k: ev[k] for k in ("code", "params", "text")},
            "action": action}


def build_dossier(db: Session, student_user_id, *, staff: bool = False, refresh: bool = True, today: date | None = None, analyze_limit: int = 12) -> dict:
    ctx = load(db, student_user_id, today)
    now = utcnow()
    # 1 · automatic check of file versions not analysed yet (bounded per call).
    analyses: dict = {}
    if ctx.docs:
        for a in db.scalars(select(DocumentAnalysis).where(DocumentAnalysis.document_id.in_([d.id for d in ctx.docs]))).all():
            analyses[(a.document_id, a.version)] = a
    if refresh:
        budget = analyze_limit
        for d in ctx.docs:
            if budget <= 0:
                break
            if d.versions and (d.id, d.current_version) not in analyses:
                v = next((x for x in d.versions if x.version == d.current_version), d.versions[-1])
                analyses[(d.id, d.current_version)] = analyze_version(db, d, v)
                budget -= 1
    fields_by_doc: dict = defaultdict(list)
    if ctx.docs:
        for f in db.scalars(select(ExtractedField).where(ExtractedField.document_id.in_([d.id for d in ctx.docs])).order_by(ExtractedField.created_at)).all():
            fields_by_doc[f.document_id].append(f)

    # 2 · applicability: every requirement of every active application.
    evals_by_doc: dict = defaultdict(list)  # doc_id -> [(req, ac, eval)]
    per_cat: dict = defaultdict(list)  # category -> [row per app requirement]
    optional: dict = defaultdict(set)  # category -> universities where it is optional
    for ac in ctx.apps:
        for req in ac.reqs:
            if not req.required:
                optional[req.category].add(ac.university.name_en)
                continue
            for d in ctx.by_cat.get(req.category, []):
                evals_by_doc[d.id].append((req, ac, _eval(db, ctx, d, req, ac)))
            d, ev = pick_for(db, ctx, req, ac)
            per_cat[req.category].append({"application_id": str(ac.app.id), "university": ac.university.name_en, "university_id": str(ac.university.id), "requirement_id": req.requirement_id,
                                          "label": req.label, "status": ev["status"], "document_id": str(d.id) if d else None,
                                          "reason": {k: ev[k] for k in ("code", "params", "text")}, "sent": ac.app.status not in PRE_SUBMISSION,
                                          "max_age_days": req.max_age_days})

    # 3 · findings (recomputed, stored, synced).
    findings_by_doc: dict = {}
    for d in ctx.docs:
        computed = compute_findings(db, ctx, d, evals_by_doc.get(d.id, []), analyses.get((d.id, d.current_version)), fields_by_doc.get(d.id, []))
        if refresh:
            findings_by_doc[d.id] = sync_findings(db, d, computed, now)
        else:
            findings_by_doc[d.id] = list(db.scalars(select(DocumentFinding).where(DocumentFinding.document_id == d.id)).all())

    # 4 · rows: one per category the student has or needs.
    rows = []
    cats = list(dict.fromkeys([c for ac in ctx.apps for c in (r.category for r in ac.reqs if r.required)] + [d.category.value for d in ctx.docs]
                              + [c for c in optional if c in ESSAY_BACKED and c in {e.essay_type.value for ac in ctx.apps for e in ac.essays}]))
    essay_types = {e.essay_type.value: e for ac in ctx.apps for e in ac.essays}
    for cat in cats:
        docs = ctx.by_cat.get(cat, [])
        uses = per_cat.get(cat, [])
        ready_for = [u for u in uses if u["status"] in USABLE]
        chosen_ids = {u["document_id"] for u in uses if u["document_id"]}
        canonical = None
        if docs:
            canonical = max(docs, key=lambda d: (sum(1 for u in uses if u["document_id"] == str(d.id) and u["status"] in USABLE),
                                                 -RANK.get(min((e["status"] for _r, _a, e in evals_by_doc.get(d.id, [])), key=lambda s: RANK[s], default=IN_REVIEW), 9),
                                                 d.status == DocumentStatus.VERIFIED, d.issue_date or date.min, d.updated_at or now))
        others = [d for d in docs if canonical is not None and d.id != canonical.id]
        # A different copy is shown when an application uses it (e.g. an older bank certificate already sent); others are superseded.
        different = [d for d in others if str(d.id) in chosen_ids]
        superseded = [d for d in others if str(d.id) not in chosen_ids]
        todo = [u for u in uses if BUCKET[u["status"]] == "student"]
        review = [u for u in uses if u["status"] == IN_REVIEW]
        if not uses:
            state = "extra"
        elif todo:
            state = "todo"
        elif review:
            state = "review"
        else:
            state = "ready"
        essay = essay_types.get(cat) if cat in ESSAY_BACKED else None
        if essay and state == "todo" and all(u["status"] == MISSING for u in todo):
            eb = _essay_bucket(essay)
            if eb and eb[0] == "counselor":
                state = "review"
        # Canonical copy first, then copies an application uses, then superseded copies (e.g. a duplicate upload).
        rank_doc = {getattr(canonical, "id", None): 0, **{d.id: 1 for d in different}}
        row_findings = [f for d in docs for f in findings_by_doc.get(d.id, []) if f.status == "OPEN" and f.version == d.current_version]
        row_findings.sort(key=lambda f: (rank_doc.get(f.document_id, 2), {"BLOCKER": 0, "WARNING": 1, "INFO": 2}[f.severity]))
        rows.append({
            "category": cat, "label": uses[0]["label"] if uses else _cat_words(cat).capitalize(), "state": state,
            "document": doc_brief(canonical, ctx) if canonical else None,
            "other_versions": [doc_brief(d, ctx) for d in different], "superseded": [doc_brief(d, ctx) for d in superseded],
            "applications": uses, "ready_count": len(ready_for), "needed_count": len({u["application_id"] for u in uses}),
            "summary": essay_summary(essay, uses) if (essay and canonical is None and uses and _essay_bucket(essay)) else
            row_summary(uses, canonical) if uses or not optional.get(cat) else
            {"code": "S_OPTIONAL", "params": {"universities": _join(sorted(optional[cat]))},
             "text": f"Optional for {_join(sorted(optional[cat]))} — it can still help your application."},
            "findings": [ser_finding(f, staff=staff) for f in row_findings],
            "essay": {"id": str(essay.id), "status": essay.status.value} if essay else None,
        })
    state_order = {"todo": 0, "review": 1, "ready": 2, "extra": 3}
    rows.sort(key=lambda r: state_order[r["state"]])

    # 5 · packages + open university requests with a reuse suggestion.
    packages, requests = [], []
    for ac in ctx.apps:
        items = package_items(db, ctx, ac)
        packages.append({"application": ser_app(ac), "summary": package_summary(items), "items": items})
        for r in ac.requests:
            if r.status == "OPEN":
                requests.append(request_suggestion(db, ctx, ac, r))

    # 6 · suggestions (only for the current version of each document).
    suggestions = []
    for d in ctx.docs:
        for f in fields_by_doc.get(d.id, []):
            # Students confirm values that have somewhere to go; name / nationality / document numbers are checked by staff.
            if f.version == d.current_version and (staff or (f.status == "SUGGESTED" and f.field in FIELD_TARGET)):
                suggestions.append(ser_field(ctx, d, f))

    p = ctx.profile
    facts = facts_of(ctx)
    if refresh:
        db.flush()
    return {
        "student": {"id": str(ctx.student.id), "full_name": ctx.student.full_name, "nationality": p.nationality if p else None},
        "facts": facts, "rows": rows, "packages": packages, "requests": requests,
        "suggestions": suggestions,
        "counts": {"documents": len(ctx.docs), "ready": sum(1 for r in rows if r["state"] == "ready"), "todo": sum(1 for r in rows if r["state"] == "todo"),
                   "review": sum(1 for r in rows if r["state"] == "review"), "applications": len(ctx.apps),
                   "suggestions": sum(1 for s in suggestions if s["status"] == "SUGGESTED" and not s["matches_profile"]),
                   "matching": sum(1 for s in suggestions if s["status"] == "SUGGESTED" and s["matches_profile"])},
        "method": "RULES", "ocr_available": False, "as_of": ctx.today.isoformat(),
    }


def essay_summary(essay: Essay, uses: list[dict]) -> dict:
    """An essay-backed requirement with no uploaded file yet: the essay's state is the truth."""
    _bucket, code = _essay_bucket(essay)
    text = {"ESSAY_IN_REVIEW": "Your counselor is reading your draft.", "ESSAY_TO_WRITE": "Write it in Writing first.",
            "ESSAY_TO_REVISE": "Your counselor asked for changes.", "ESSAY_APPROVED_UPLOAD": "Approved — upload the final version."}[code]
    return {"code": "S_BLOCKED", "params": {"reason": text, "reason_code": code, "reason_params": {}}, "text": text}


def row_summary(uses: list[dict], canonical: Document | None) -> dict:
    """"Ready for 3 of 3 applications" / "Can be used for A and B. C needs one issued within the last 30 days." """
    apps = list(dict.fromkeys(u["application_id"] for u in uses))
    if not uses:
        return {"code": "S_NOT_NEEDED", "params": {}, "text": "Not needed by your current applications — kept for later."}
    if canonical is None:
        return {"code": "S_MISSING", "params": {"count": len(apps)}, "text": f"Not uploaded yet — needed for {len(apps)} application{'s' if len(apps) != 1 else ''}."}
    ready = [u for u in uses if u["status"] in USABLE]
    ready_apps = list(dict.fromkeys(u["university"] for u in ready))
    if len(ready) == len(uses):
        return {"code": "S_READY_ALL", "params": {"ready": len(set(u["application_id"] for u in ready)), "total": len(apps)},
                "text": f"Ready for {len(apps)} of {len(apps)} applications."}
    blocked = [u for u in uses if u["status"] not in USABLE]
    first = blocked[0]
    if first["status"] == IN_REVIEW and all(u["status"] == IN_REVIEW for u in blocked):
        return {"code": "S_IN_REVIEW", "params": {"count": len(apps)}, "text": f"Being checked — then ready for {len(apps)} application{'s' if len(apps) != 1 else ''}."}
    if ready_apps:
        return {"code": "S_PARTIAL", "params": {"ready": _join(ready_apps), "blocked": first["university"], "reason": first["reason"]["text"],
                                                 "reason_code": first["reason"]["code"], "reason_params": first["reason"]["params"]},
                "text": f"Can be used for {_join(ready_apps)}. {first['reason']['text']}"}
    return {"code": "S_BLOCKED", "params": {"reason": first["reason"]["text"], "reason_code": first["reason"]["code"], "reason_params": first["reason"]["params"]},
            "text": first["reason"]["text"]}


def facts_of(ctx: Ctx) -> dict:
    p = ctx.profile
    today = ctx.today
    exp = p.passport_expiry if p else None
    passport_state = None
    if exp:
        passport_state = "expired" if exp < today else "near" if any(ac.passport_until and exp < ac.passport_until for ac in ctx.apps) else "ok"
    return {
        "full_name": ctx.student.full_name, "date_of_birth": p.date_of_birth.isoformat() if p and p.date_of_birth else None,
        "nationality": p.nationality if p else None,
        "passport": {"number_masked": p.passport_number_masked if p else None, "expiry": exp.isoformat() if exp else None,
                     "has_passport": p.has_passport if p else None, "state": passport_state},
        "education": [{"level": e.level, "institution": e.institution, "country": e.country, "graduation_year": e.graduation_year,
                       "graduation_status": e.graduation_status, "gpa": f"{e.gpa_value:g}/{e.gpa_scale_max:g}" if e.gpa_value is not None and e.gpa_scale_max else None}
                      for e in (p.educations if p else [])],
        "tests": [{"test": l.test.value, "score": l.score, "test_date": l.test_date.isoformat() if l.test_date else None,
                   "expires_on": l.expires_on.isoformat() if l.expires_on else None, "verified": l.verified, "planned": l.is_planned}
                  for l in (p.languages if p else [])],
        "sponsor": p.financial_sponsor if p else None,
    }


def package_for(db: Session, app: Application, *, university_view: bool = False) -> dict:
    ctx = load(db, app.student_user_id, app_ids=[app.id])
    ac = ctx.apps[0]
    items = package_items(db, ctx, ac)
    if university_view:
        # The university sees only what was shared with it and is verified — same rule as the document list today.
        shared = []
        for i in items:
            if i["kind"] == "requirement" and i.get("shared_with_university") and i["bucket"] == "ready" and i["document_id"]:
                shared.append({"label": i["label"], "category": i["category"], "document_id": i["document_id"]})
            elif i["kind"] == "request" and i["status"] == "SENT" and i["document_id"]:
                shared.append({"label": i["label"], "category": i["category"], "document_id": i["document_id"]})
        return {"application": ser_app(ac), "shared": shared, "summary": {"shared": len(shared)}}
    return {"application": ser_app(ac), "summary": package_summary(items), "items": items}


# ----------------------------------------------------------------------------- reuse (duplicate minimisation)

def reuse_check(db: Session, student_user_id, category: str, *, application_id=None, request_id=None) -> dict:
    """Before an upload: does the dossier already hold a document for this category, and where is it valid?"""
    ctx = load(db, student_user_id)
    if request_id:
        r = db.get(DocumentRequest, request_id)
        ac = next((a for a in ctx.apps if r and a.app.id == r.application_id), None)
        if not r or not ac:
            raise HTTPException(404, "Not found or not permitted.")
        return {"category": category, "request": request_suggestion(db, ctx, ac, r), "existing": []}
    existing = []
    for d in ctx.by_cat.get(category, []):
        used, needs = [], []
        for ac in ctx.apps:
            if application_id and str(ac.app.id) != str(application_id):
                continue
            for req in ac.reqs:
                if req.category != category or not req.required:
                    continue
                ev = _eval(db, ctx, d, req, ac)
                if ev["status"] in USABLE or ev["status"] == IN_REVIEW:
                    used.append(ac.university.name_en)
                else:
                    needs.append({"university": ac.university.name_en, "university_id": str(ac.university.id), "status": ev["status"], "reason": {k: ev[k] for k in ("code", "params", "text")}})
        existing.append({"document": doc_brief(d, ctx), "used_by": len(set(used)), "universities": list(dict.fromkeys(used)), "needs_new": needs})
    existing.sort(key=lambda e: (-e["used_by"], e["document"]["status"] != "VERIFIED"))
    return {"category": category, "existing": existing, "request": None}


def record_event(db: Session, *, student_user_id, kind: str, actor_id, document_id=None, application_id=None, request_id=None, category=None) -> DossierReuseEvent:
    ev = DossierReuseEvent(student_user_id=student_user_id, kind=kind, actor_user_id=actor_id, document_id=document_id, application_id=application_id,
                           request_id=request_id, category=category)
    db.add(ev)
    return ev


def send_existing(db: Session, r: DocumentRequest, app: Application, doc: Document, *, actor_id) -> DocumentRequest:
    """Answer a university request with a document already in the dossier (FLOW B). Refuses copies that cannot be used."""
    from app.services.document_requests import fulfill_request

    if doc.owner_user_id != app.student_user_id:
        raise HTTPException(404, "Document not found in this student's vault.")
    ctx = load(db, app.student_user_id, app_ids=[app.id])
    sug = request_suggestion(db, ctx, ctx.apps[0], r)
    ev = evaluate(db, doc, Req(category=sug["category"] or doc.category.value, label=r.label, university=ctx.apps[0].university.name_en,
                               max_age_days=sug["max_age_days"]), today=ctx.today, ts=translation_status(doc, ctx.states.get(doc.id)), cache=ctx.cache)
    if ev["status"] in (EXPIRED, NEEDS_NEW_VERSION, NEEDS_FIX):
        raise HTTPException(409, ev["text"])
    fulfill_request(db, r, app, actor_id=actor_id, document_id=doc.id)
    record_event(db, student_user_id=app.student_user_id, kind="SENT_EXISTING", actor_id=actor_id, document_id=doc.id, application_id=app.id,
                 request_id=r.id, category=doc.category.value)
    return r


# ----------------------------------------------------------------------------- visa hook

def applicability_for_requirement(db: Session, student, requirement_like, *, today: date | None = None, window_end: date | None = None) -> dict:
    """Hook for the visa workstream: which dossier document answers this requirement, and is it usable?

    ``student`` — a User, a StudentProfile, or a user id. ``requirement_like`` — a dict or object with ``category`` and
    optionally ``label``, ``max_age_days``, ``legalization_required``, ``translation_required``, ``university``,
    ``window_end`` (e.g. the embassy appointment date: expiry / freshness are judged against it).
    Returns ``{status, document, reason: {code, params, text}, candidates: [...]}`` with the same statuses as the
    application dossier (READY, NEAR_EXPIRY, IN_REVIEW, NEEDS_FIX, NEEDS_NEW_VERSION, NEEDS_LEGALIZATION, NEEDS_TRANSLATION,
    EXPIRED, MISSING)."""
    uid = getattr(student, "user_id", None) or getattr(student, "id", None) or student
    ctx = load(db, uid, today, app_ids=[])
    req = req_from(requirement_like)
    if not req.university:
        req.university = "The embassy"
    get = (lambda k: requirement_like.get(k)) if isinstance(requirement_like, dict) else (lambda k: getattr(requirement_like, k, None))
    window = window_end or get("window_end")
    results = [(d, evaluate(db, d, req, today=ctx.today, window_end=window, ts=translation_status(d, ctx.states.get(d.id)), cache=ctx.cache))
               for d in ctx.by_cat.get(req.category, [])]
    d, ev = best_of(results)
    return {"status": ev["status"], "document": doc_brief(d, ctx) if d else None, "reason": {k: ev[k] for k in ("code", "params", "text")},
            "candidates": [{"document": doc_brief(x, ctx), "status": e["status"], "reason": {k: e[k] for k in ("code", "params", "text")}} for x, e in results]}


# ----------------------------------------------------------------------------- metrics + coordinator hooks

def dossier_metrics(db: Session, scope: dict | None = None) -> dict:
    """Outcome metrics. ``scope`` keys (all optional): ``student_ids`` (iterable), ``organization_id`` (agency: students with an
    active assignment), ``university_id``, ``since`` / ``until`` (dates; default: last 90 days)."""
    scope = scope or {}
    until = scope.get("until") or date.today()
    since = scope.get("since") or (until - timedelta(days=90))
    t0 = datetime.combine(since, datetime.min.time(), tzinfo=timezone.utc)
    t1 = datetime.combine(until + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc)
    students = None
    if scope.get("student_ids") is not None:
        students = list(scope["student_ids"])
    elif scope.get("organization_id"):
        students = list(db.scalars(select(AgencyAssignment.student_user_id).where(AgencyAssignment.organization_id == scope["organization_id"],
                                                                                  AgencyAssignment.status == AssignmentStatus.ACTIVE)).all())

    def scoped(q, col):
        return q.where(col.in_(students)) if students is not None else q

    ev = scoped(select(DossierReuseEvent.kind, func.count()).where(DossierReuseEvent.created_at >= t0, DossierReuseEvent.created_at < t1)
                .group_by(DossierReuseEvent.kind), DossierReuseEvent.student_user_id)
    kinds = dict(db.execute(ev).all())
    # Implicit reuse: every extra application that uses the same verified document is one upload the student didn't repeat.
    links = scoped(select(ApplicationDocument.document_id, func.count(func.distinct(ApplicationDocument.application_id)))
                   .join(Document, Document.id == ApplicationDocument.document_id).where(ApplicationDocument.document_id.is_not(None))
                   .group_by(ApplicationDocument.document_id), Document.owner_user_id)
    implicit = sum(max(n - 1, 0) for _d, n in db.execute(links).all())
    # First-pass acceptance: of documents whose FIRST human review happened in the period, how many were verified on version 1.
    first = select(DocumentReview.document_id, func.min(DocumentReview.created_at).label("at")).where(DocumentReview.decision.in_(["VERIFIED", "NEEDS_CORRECTION"])) \
        .group_by(DocumentReview.document_id).subquery()
    rows = db.execute(scoped(select(DocumentReview.document_id, DocumentReview.decision, DocumentReview.version)
                             .join(first, (first.c.document_id == DocumentReview.document_id) & (first.c.at == DocumentReview.created_at))
                             .join(Document, Document.id == DocumentReview.document_id)
                             .where(first.c.at >= t0, first.c.at < t1), Document.owner_user_id)).all()
    n = len(rows)
    accepted = sum(1 for _d, dec, v in rows if dec == "VERIFIED" and v == 1)
    apps_q = select(Application.id).where(Application.submitted_at.is_not(None), Application.submitted_at >= t0, Application.submitted_at < t1)
    if scope.get("university_id"):
        apps_q = apps_q.where(Application.university_id == scope["university_id"])
    apps = list(db.scalars(scoped(apps_q, Application.student_user_id)).all())
    req_count = db.scalar(select(func.count()).select_from(DocumentRequest).where(DocumentRequest.application_id.in_(apps))) if apps else 0
    return {
        "period": {"since": since.isoformat(), "until": until.isoformat()},
        "duplicate_uploads_avoided": {"value": kinds.get("SENT_EXISTING", 0) + kinds.get("KEPT_EXISTING", 0),
                                      "sent_existing": kinds.get("SENT_EXISTING", 0), "kept_existing": kinds.get("KEPT_EXISTING", 0),
                                      "new_versions": kinds.get("NEW_VERSION", 0), "implicit_reuse_all_time": implicit,
                                      "definition": "Requests answered with a document already in the dossier + uploads the student skipped because a valid copy existed (period). "
                                                    "implicit_reuse_all_time = extra applications using the same document."},
        "first_pass_acceptance": {"value": round(accepted / n, 3) if n >= 5 else None, "accepted": accepted, "n": n, "withheld": n < 5,
                                  "definition": "Share of documents whose first review in the period verified version 1 without a correction. Withheld when n < 5."},
        "documents_requested_per_application": {"value": round(req_count / len(apps), 2) if len(apps) >= 5 else None, "requests": req_count or 0,
                                                "applications": len(apps), "withheld": len(apps) < 5,
                                                "definition": "University document requests per application submitted in the period. Withheld when n < 5."},
    }


def today_items(db: Session, principal) -> list[dict]:
    """Agency Today hook: document findings that need a person (name/date mismatch, wrong type, poor scan, duplicate)."""
    from app.services.access import scope_student_ids

    q = scope_student_ids(select(DocumentFinding, Document, User).join(Document, Document.id == DocumentFinding.document_id)
                          .join(User, User.id == DocumentFinding.student_user_id)
                          .where(DocumentFinding.status == "OPEN", DocumentFinding.code.in_(STAFF_FINDINGS), DocumentFinding.version == Document.current_version),
                          DocumentFinding.student_user_id, principal).order_by(DocumentFinding.created_at).limit(50)
    out = []
    for f, d, u in db.execute(q).all():
        s = ser_finding(f, staff=True)
        out.append({"kind": "DOSSIER_FINDING", "id": s["id"], "student_id": str(u.id), "student_name": u.full_name, "document_id": str(d.id),
                    "category": d.category.value, "code": f.code, "severity": f.severity, "title": s["explanation"], "title_key": f"dossier:finding.{s['text_code']}",
                    "title_params": s["params"], "link": f"/students/{u.id}?tab=documents", "created_at": s["created_at"]})
    return out


def home_items(db: Session, student_user_id) -> list[dict]:
    """Student Home hook: at most two dossier nudges (details to check; a newer copy needed). Read-only.

    V13, brief Part 9 ("never display a count without explaining what kind of count it is"). This used to send
    only ``{"count": n}``, which the student read as *"We found 11 details in your documents — please check
    them"*. Eleven of what? It sounds like eleven problems and it is in fact eleven **facts we read out of
    their own documents and want them to confirm** — their name, their date of birth, their GPA. A number
    with no noun makes a routine confirmation look like a fault report, and V12's own hostile review named
    this sentence as the clearest surviving example of the category.

    So the nudge now carries the field names themselves, in priority order, and the client turns the codes
    into words with the labels it already has. The count stays, because "and 9 more" is useful; it is no
    longer the only thing said.
    """
    out = []
    rows = db.execute(select(ExtractedField.field).select_from(ExtractedField)
                      .join(Document, Document.id == ExtractedField.document_id)
                      .where(ExtractedField.student_user_id == student_user_id, ExtractedField.status == "SUGGESTED",
                             ExtractedField.version == Document.current_version)).all()
    n = len(rows)
    if n:
        # Identity first: a wrong name or date of birth is the mismatch that actually stops an application, so
        # it is the one worth naming when there is only room to name two.
        order = ["full_name", "date_of_birth", "passport_number", "passport_expiry", "nationality",
                 "school", "graduation_date", "gpa", "test_score"]
        seen = {f for (f,) in rows}
        named = [f for f in order if f in seen][:2] or sorted(seen)[:2]
        out.append({"code": "CHECK_DETAILS", "title_key": "dossier:home.checkDetails",
                    "params": {"count": n, "fields": named, "more": max(0, n - len(named))},
                    "link": "/documents#check"})
    f = db.scalar(select(DocumentFinding).join(Document, Document.id == DocumentFinding.document_id)
                  .where(DocumentFinding.student_user_id == student_user_id, DocumentFinding.status == "OPEN",
                         DocumentFinding.code.in_(["NEW_ISSUE_NEEDED", "EXPIRED"]), DocumentFinding.version == Document.current_version))
    if f:
        d = db.get(Document, f.document_id)
        out.append({"code": f.code, "title_key": f"dossier:home.{f.code}", "params": {**(f.params or {}), "category": d.category.value},
                    "link": f"/documents?doc={d.id}"})
    return out
