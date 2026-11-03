"""V5 writing review workflow (see docs/WRITING_REVIEW.md).

Hooks for the coordinator
- ``today_items(db, principal)``     → Agency Today rows: overdue reviews · due within 48 h · student revised.
- ``student_status(db, essay)``      → truthful review status for the student ("Assigned to … · expected by …").
- ``writing_metrics(db, org_id, period_days)`` → review turnaround (median h), revision rounds, SLA breaches.
- ``sla_sweep(db)`` / ``record_outcomes(db)`` → callable from the daily job (idempotent).
- ``apply_essay_versions(db, student_user_id, program, items)`` → essay-backed checklist items use the approved version
  (called from ``services/readiness.checklist``).
- ``approved_essays_for_application(db, application_id)`` → the approved versions a package/submission uses.

Honesty rules: automatic checks are labelled "Automatic check" (never AI) and never change text; SAMPLE prompts are
never presented as official; no numeric score or percentage for an essay; outcome patterns are internal, n<5 withheld.
"""
from __future__ import annotations

import hashlib
import statistics
import uuid
from datetime import datetime, timedelta

from fastapi import HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.audit import audit
from app.models import (
    AgencyAssignment,
    Application,
    Essay,
    EssayAttestation,
    EssayComment,
    EssayReview,
    EssaySuggestionDecision,
    EssayVersion,
    Order,
    Organization,
    OrganizationMember,
    Program,
    ProgramIntake,
    ReviewerProfile,
    ReviewRubric,
    RubricScore,
    ServiceProduct,
    StudentProfile,
    Task,
    University,
    User,
    WritingEvent,
    WritingFinding,
    WritingOutcome,
    WritingPolicy,
    WritingPrompt,
)
from app.models.base import utcnow
from app.models.enums import (
    ApplicationStatus,
    AssignmentStatus,
    EssayStatus,
    MessageVisibility,
    OrderStatus,
    OrgType,
    Role,
    TaskPriority,
    TaskStatus,
    TaskType,
)
from app.services import ai_provider, strategy
from app.services import writing_checks as wc
from app.services.notify import notify

E = EssayStatus
REVIEW_STATES = (E.SUBMITTED, E.AI_PRECHECK, E.AGENCY_REVIEW, E.FINAL_REVIEW)
STUDENT_STATES = (E.DRAFT, E.CHANGES_REQUESTED, E.STUDENT_REVISION)
TERMS = {"SPRING": 1, "SUMMER": 2, "FALL": 3, "WINTER": 4}
DEFAULT_HOURS = {"first": 48, "revision": 48, "final": 24}
MANAGER_ROLES = (Role.AGENCY_ADMIN, Role.HANGYUL_OPERATIONS, Role.HANGYUL_SUPER_ADMIN)  # V22
REVIEWER_ROLES = (Role.AGENCY_ADMIN, Role.HANGYUL_COUNSELOR, Role.HANGYUL_OPERATIONS, Role.HANGYUL_SUPER_ADMIN)
RATINGS = ("MEETS", "NEEDS_WORK", "NOT_ASSESSED")

# Default rubric (V6): dimension → quality-gate item it feeds. "QUALITY" dimensions are how good the writing is
# (specificity, authenticity, structure, logic, university fit, major fit, future plan, evidence, clarity); "ACCURACY"
# dimensions are rules the text must not break. Keys of V5 dimensions are kept so earlier ratings stay valid.
DEFAULT_DIMENSIONS: list[dict] = [
    {"key": "ANSWERS_PROMPT", "gate": "PROMPT_ANSWERED", "group": "QUALITY"},
    {"key": "GENERIC", "gate": "PROGRAM_MOTIVATION", "group": "QUALITY"},  # specificity
    {"key": "VOICE", "gate": "ORIGINALITY", "group": "QUALITY"},  # authenticity
    {"key": "STRUCTURE", "gate": "OTHER", "group": "QUALITY"},
    {"key": "LOGIC", "gate": "OTHER", "group": "QUALITY"},
    {"key": "MOTIVATION", "gate": "PROGRAM_MOTIVATION", "group": "QUALITY"},  # university fit
    {"key": "PROGRAM_CONNECTION", "gate": "PROGRAM_MOTIVATION", "group": "QUALITY"},  # major fit
    {"key": "FUTURE_PLAN", "gate": "FUTURE_PLAN", "group": "QUALITY"},
    {"key": "EVIDENCE", "gate": "OTHER", "group": "QUALITY"},
    {"key": "CLARITY", "gate": "OTHER", "group": "QUALITY"},
    {"key": "LIMIT", "gate": "WORD_LIMIT", "group": "ACCURACY"},
    {"key": "NAMES_CORRECT", "gate": "NAMES", "group": "ACCURACY"},
    {"key": "OTHER_UNIVERSITY", "gate": "NAMES", "group": "ACCURACY"},
    {"key": "FACTUAL_CONSISTENCY", "gate": "PROFILE_CONSISTENCY", "group": "ACCURACY"},
]
DIMENSION_GROUP = {d["key"]: d["group"] for d in DEFAULT_DIMENSIONS} | {
    "REPETITION": "QUALITY", "UNSUPPORTED_CLAIMS": "QUALITY", "TEMPLATE_LANGUAGE": "QUALITY", "PROFILE_CONTRADICTION": "ACCURACY"}
V5_DIMENSION_KEYS = ["ANSWERS_PROMPT", "MOTIVATION", "PROGRAM_CONNECTION", "FUTURE_PLAN", "EVIDENCE", "STRUCTURE", "REPETITION", "GENERIC",
                     "UNSUPPORTED_CLAIMS", "VOICE", "LIMIT", "NAMES_CORRECT", "PROFILE_CONTRADICTION", "OTHER_UNIVERSITY",
                     "TEMPLATE_LANGUAGE", "FACTUAL_CONSISTENCY"]
GATE_ORDER = ["PROMPT_ANSWERED", "PROGRAM_MOTIVATION", "FUTURE_PLAN", "WORD_LIMIT", "PROFILE_CONSISTENCY", "NAMES",
              "ORIGINALITY", "OTHER", "COMMENTS", "REVIEWER_APPROVAL"]
STAFF_ONLY_GATE = {"ORIGINALITY"}
FINDING_GATE = {"LIMIT": "WORD_LIMIT", "FACT": "PROFILE_CONSISTENCY", "OTHER_UNIVERSITY": "NAMES", "NAME": "NAMES",
                "SIMILARITY": "ORIGINALITY", "PROMPT": "PROMPT_ANSWERED", "CONSISTENCY": "PROFILE_CONSISTENCY"}

NATIONAL_LANGUAGE = {"VN": "vi", "UZ": "uz", "MN": "mn", "NP": "ne", "CN": "zh", "KZ": "kk", "KG": "ky", "TJ": "tg", "MM": "my",
                     "ID": "id", "PH": "tl", "TH": "th", "BD": "bn", "PK": "ur", "LK": "si", "IN": "hi", "JP": "ja", "TW": "zh",
                     "KH": "km", "LA": "lo", "MY": "ms", "RU": "ru"}
SHORT_ALIASES = {"seoul-national-university": ["SNU"], "yonsei-university": ["Yonsei"], "korea-university": ["Korea University"],
                 "hanyang-university": ["Hanyang"], "kyungpook-national-university": ["Kyungpook", "KNU"], "chung-ang-university": ["Chung-Ang", "CAU"],
                 "sogang-university": ["Sogang"], "sungkyunkwan-university": ["Sungkyunkwan", "SKKU"], "kyung-hee-university": ["Kyung Hee", "KHU"],
                 "pusan-national-university": ["Pusan National", "PNU"]}


def _now() -> datetime:
    return utcnow()


def _hours(a: datetime | None, b: datetime | None) -> float | None:
    return round((b - a).total_seconds() / 3600, 1) if a and b else None


def _iso(v) -> str | None:
    return v.isoformat() if v else None


# ============================================================ review record + prompt resolution

def review_for(db: Session, essay: Essay, create: bool = True) -> EssayReview | None:
    r = db.scalar(select(EssayReview).where(EssayReview.essay_id == essay.id))
    if r is None and create:
        r = EssayReview(essay_id=essay.id, review_round=0)
        db.add(r)
        db.flush()
    return r


def _intake_key(year: int | None, term: str | None) -> tuple[int, int]:
    return (year or 0, TERMS.get(term or "", 0))


def essay_target(db: Session, essay: Essay) -> dict:
    """University / program / intake the essay is written for."""
    app = db.get(Application, essay.application_id) if essay.application_id else None
    program = db.get(Program, essay.program_id or (app.program_id if app else None)) if (essay.program_id or app) else None
    uni = db.get(University, app.university_id if app else program.university_id) if (app or program) else None
    intake = db.get(ProgramIntake, app.intake_id) if app else None
    return {"application": app, "program": program, "university": uni, "intake": intake}


def resolve_prompt(db: Session, *, university_id, program_id, essay_type: str, intake_year: int | None, intake_term: str | None,
                   org_id=None) -> WritingPrompt | None:
    """Most specific prompt for this intake: program-specific beats university-wide; an exact-intake prompt beats an
    effective-from prompt; among effective-from prompts the latest one not after the intake wins."""
    q = select(WritingPrompt).where(WritingPrompt.university_id == university_id, WritingPrompt.essay_type == essay_type,
                                    or_(WritingPrompt.program_id == program_id, WritingPrompt.program_id.is_(None)),
                                    or_(WritingPrompt.organization_id.is_(None), WritingPrompt.organization_id == org_id) if org_id
                                    else WritingPrompt.organization_id.is_(None))
    rows = db.scalars(q).all()
    target = _intake_key(intake_year, intake_term)

    def rank(p: WritingPrompt):
        if p.intake_year:
            if _intake_key(p.intake_year, p.intake_term) != target and intake_year:
                return None
            exact = 1
        else:
            if p.effective_from_year and intake_year and _intake_key(p.effective_from_year, p.effective_from_term) > target:
                return None
            exact = 0
        return (1 if p.program_id else 0, exact, _intake_key(p.effective_from_year, p.effective_from_term), p.version, p.created_at or _now())

    ranked = [(rank(p), p) for p in rows]
    ranked = [x for x in ranked if x[0] is not None]
    return max(ranked, key=lambda x: x[0])[1] if ranked else None


def _student_org(db: Session, student_user_id) -> uuid.UUID | None:
    a = db.scalar(select(AgencyAssignment).where(AgencyAssignment.student_user_id == student_user_id, AgencyAssignment.status == AssignmentStatus.ACTIVE))
    return a.organization_id if a else None


def ensure_prompt(db: Session, essay: Essay, review: EssayReview | None = None) -> WritingPrompt | None:
    """Link the essay to the prompt version for its university/program/intake the first time we know one."""
    review = review or review_for(db, essay)
    if review.prompt_id:
        return db.get(WritingPrompt, review.prompt_id)
    t = essay_target(db, essay)
    if not t["university"]:
        return None
    intake = t["intake"]
    p = resolve_prompt(db, university_id=t["university"].id, program_id=t["program"].id if t["program"] else None, essay_type=essay.essay_type.value,
                       intake_year=intake.year if intake else None, intake_term=intake.term.value if intake else None,
                       org_id=_student_org(db, essay.owner_user_id))
    if p:
        review.prompt_id = p.id
        if not essay.word_limit and p.word_limit:
            essay.word_limit = p.word_limit
    return p


def ser_prompt(db: Session, p: WritingPrompt | None, *, staff: bool) -> dict | None:
    if p is None:
        return None
    newer = db.get(WritingPrompt, p.superseded_by_id) if p.superseded_by_id else None
    org = db.get(Organization, p.organization_id) if p.organization_id else None
    d = {
        "id": str(p.id), "university_id": str(p.university_id), "program_id": str(p.program_id) if p.program_id else None,
        "essay_type": p.essay_type, "intake": {"year": p.intake_year, "term": p.intake_term} if p.intake_year else None,
        "effective_from": {"year": p.effective_from_year, "term": p.effective_from_term} if p.effective_from_year else None,
        "text": p.prompt_text, "language": p.prompt_language, "word_limit": p.word_limit, "char_limit": p.char_limit,
        "required_language": p.required_language, "source_url": p.source_url, "verified_at": _iso(p.verified_at),
        "verification_status": p.verification_status, "version": p.version,
        "superseded_by": {"id": str(newer.id), "version": newer.version} if newer else None,
        "entered_by_org": org.name if org else None, "note": p.note,
    }
    if staff:
        d["created_by"] = (db.get(User, p.created_by_id).full_name if p.created_by_id else None)
    return d


def create_prompt(db: Session, p, data: dict) -> WritingPrompt:
    """Reviewer enters / updates a prompt. A new wording for the same university+program+type+intake becomes a new
    version and supersedes the previous one; only Hangyul may mark a prompt VERIFIED (with a source URL)."""
    status = data.get("verification_status") or "COUNSELOR_ENTERED"
    if status == "VERIFIED" and not (p.is_hangyul and data.get("source_url")):
        raise HTTPException(422, "Only Hangyul can mark a prompt as verified, and only with its source link.")
    if status == "SAMPLE" and not p.is_hangyul:
        status = "COUNSELOR_ENTERED"
    org_id = None if p.is_hangyul else p.org_id
    same = db.scalars(select(WritingPrompt).where(
        WritingPrompt.university_id == data["university_id"], WritingPrompt.essay_type == data["essay_type"],
        WritingPrompt.program_id == data.get("program_id") if data.get("program_id") else WritingPrompt.program_id.is_(None),
        WritingPrompt.organization_id == org_id if org_id else WritingPrompt.organization_id.is_(None),
        WritingPrompt.superseded_by_id.is_(None))).all()
    version = max((s.version for s in same), default=0) + 1
    new = WritingPrompt(
        university_id=data["university_id"], program_id=data.get("program_id"), organization_id=org_id, essay_type=data["essay_type"],
        intake_year=data.get("intake_year"), intake_term=data.get("intake_term"), effective_from_year=data.get("effective_from_year"),
        effective_from_term=data.get("effective_from_term"), prompt_text=data["prompt_text"].strip(), prompt_language=data.get("prompt_language") or "en",
        word_limit=data.get("word_limit"), char_limit=data.get("char_limit"), required_language=data.get("required_language"),
        source_url=data.get("source_url"), verified_at=_now() if status == "VERIFIED" else None, verification_status=status,
        version=version, created_by_id=p.id, note=data.get("note"),
    )
    db.add(new)
    db.flush()
    new_key = _intake_key(new.intake_year or new.effective_from_year, new.intake_term or new.effective_from_term)
    for s in same:
        # A newer intake's wording supersedes the older one for later intakes; the same intake's old wording is replaced.
        if _intake_key(s.intake_year or s.effective_from_year, s.intake_term or s.effective_from_term) <= new_key:
            s.superseded_by_id = new.id
    audit(db, action="writing.prompt_created", entity_type="writing_prompt", entity_id=new.id, actor=p,
          detail={"version": version, "status": status, "university_id": str(new.university_id)})
    return new


def visible_prompt(p, prompt: WritingPrompt) -> bool:
    return prompt.organization_id is None or p.is_hangyul or prompt.organization_id == p.org_id


# ============================================================ profile / target for checks

def check_profile(db: Session, student_user_id) -> wc.Profile:
    prof = db.scalar(select(StudentProfile).where(StudentProfile.user_id == student_user_id))
    if not prof:
        return wc.Profile()
    langs: dict[str, float] = {}
    for lang in prof.languages:
        t = lang.test.value
        langs[t] = max(langs.get(t, 0), lang.score)
    return wc.Profile(
        nationality=prof.nationality, date_of_birth=prof.date_of_birth,
        educations=[wc.Education(e.level, e.institution or "", e.graduation_year, e.graduation_status, e.gpa_value, e.gpa_scale_max) for e in prof.educations],
        languages=langs,
    )


def _aliases(u: University) -> list[str]:
    out = [u.name_en, *(SHORT_ALIASES.get(u.slug, []))]
    if u.name_ko:
        out.append(u.name_ko)
    return out


def check_target(db: Session, essay: Essay) -> wc.Target:
    t = essay_target(db, essay)
    uni: University | None = t["university"]
    others = [(u.name_en, _aliases(u)) for u in db.scalars(select(University)).all() if not uni or u.id != uni.id]
    if not uni:
        return wc.Target(other_universities=[])  # no target → cannot say which university is "other"
    # Language-institute courses are a normal thing to mention ("after the Korean Language Program…") — not "other".
    other_programs = [n for (n, lvl) in db.execute(select(Program.name_en, Program.degree_level).where(Program.university_id == uni.id)).all()
                      if (not t["program"] or n != t["program"].name_en) and lvl.value != "LANGUAGE"]
    return wc.Target(university_name=uni.name_en, university_aliases=_aliases(uni)[1:],
                     program_name=t["program"].name_en if t["program"] else None, other_universities=others,
                     other_programs=other_programs)


def own_essays(db: Session, essay: Essay) -> list[wc.OwnEssay]:
    """The same student's other essays (current version), labelled by type and university — for the V6
    cross-application consistency check."""
    out = []
    for other in db.scalars(select(Essay).where(Essay.owner_user_id == essay.owner_user_id, Essay.id != essay.id)).all():
        body = latest_body(other)
        if not body.strip():
            continue
        uni = essay_target(db, other)["university"]
        out.append(wc.OwnEssay(text=body, essay_type=other.essay_type.value, university=uni.name_en if uni else None))
    return out


# ============================================================ automatic checks

def latest_body(essay: Essay) -> str:
    return essay.versions[-1].body if essay.versions else ""


def run_checks(db: Session, essay: Essay, review: EssayReview | None = None) -> list[WritingFinding]:
    """Run every automatic check on the current version and reconcile with stored findings (dismissals survive;
    findings that no longer occur are resolved automatically). Never changes the essay."""
    review = review or review_for(db, essay)
    prompt = ensure_prompt(db, essay, review)
    body = latest_body(essay)
    q = (select(EssayVersion.body).join(Essay, Essay.id == EssayVersion.essay_id)
         .where(Essay.owner_user_id != essay.owner_user_id, EssayVersion.version == Essay.current_version))
    # Synthetic seeded statements are generated from shared templates and are nobody's work: they never take part in the
    # "own words" comparison (production has no seeded rows; real essays are always compared with every real essay).
    q = q.join(User, User.id == Essay.owner_user_id).where(User.is_demo.is_(False))
    others = [b for (b,) in db.execute(q).all()]
    raw = wc.run_all(
        body, prompt=(prompt.prompt_text if prompt else essay.prompt), word_limit=(prompt.word_limit if prompt and prompt.word_limit else essay.word_limit),
        char_limit=prompt.char_limit if prompt else None, required_language=prompt.required_language if prompt else None,
        profile=check_profile(db, essay.owner_user_id), target=check_target(db, essay), others=others, today=_now().date(),
        own_essays=own_essays(db, essay),
    )
    now = _now()
    existing = {f.fingerprint: f for f in db.scalars(select(WritingFinding).where(WritingFinding.essay_id == essay.id))}
    current: set[str] = set()
    for f in raw:
        fp = f["fingerprint"]
        current.add(fp)
        row = existing.get(fp)
        if row is None:
            row = WritingFinding(essay_id=essay.id, fingerprint=fp, created_at=now, status="OPEN")
            db.add(row)
        elif row.status == "RESOLVED":
            row.status, row.resolved_at, row.resolved_note, row.resolved_by_id = "OPEN", None, None, None
        row.version, row.kind, row.code, row.severity = essay.current_version, f["kind"], f["code"], f["severity"]
        row.params, row.text, row.quote, row.anchor_start, row.anchor_end, row.staff_only = (
            f["params"], f["text"], f["quote"], f["anchor_start"], f["anchor_end"], f["staff_only"])
    for fp, row in existing.items():
        if fp not in current and row.status == "OPEN":
            row.status, row.resolved_at, row.resolved_note = "RESOLVED", now, "AUTO_NO_LONGER_FOUND"
    review.checks_version, review.checks_at, review.checks_provider = essay.current_version, now, ai_provider.status().active
    # Legacy field kept in sync for older clients (native app): the same results in the V4 shape.
    essay.precheck = [{"level": "error" if f["severity"] == "BLOCKER" else "warning" if f["severity"] == "WARNING" else "ok",
                       "code": f["code"], "text": f["text"]} for f in raw if not f["staff_only"]]
    db.flush()
    return db.scalars(select(WritingFinding).where(WritingFinding.essay_id == essay.id)).all()


def ser_finding(f: WritingFinding) -> dict:
    return {"id": str(f.id), "kind": f.kind, "code": f.code, "severity": f.severity, "params": f.params or {}, "text": f.text,
            "quote": f.quote, "anchor_start": f.anchor_start, "anchor_end": f.anchor_end, "status": f.status, "version": f.version,
            "staff_only": f.staff_only, "resolved_note": f.resolved_note if f.resolved_note != "AUTO_NO_LONGER_FOUND" else None,
            "auto_resolved": f.resolved_note == "AUTO_NO_LONGER_FOUND", "source": "AUTOMATIC_CHECK"}


def dismiss_finding(db: Session, essay: Essay, finding_id: str, note: str, p) -> WritingFinding:
    f = db.scalar(select(WritingFinding).where(WritingFinding.id == uuid.UUID(finding_id), WritingFinding.essay_id == essay.id))
    if not f:
        raise HTTPException(404, "Finding not found")
    f.status, f.resolved_note, f.resolved_by_id, f.resolved_at = "DISMISSED", note.strip(), p.id, _now()
    audit(db, action="writing.finding_dismissed", entity_type="essay", entity_id=essay.id, actor=p, subject_user_id=essay.owner_user_id,
          detail={"finding": f.code, "note": note.strip()})
    return f


# ============================================================ rubric

def rubric_for(db: Session, essay: Essay) -> ReviewRubric | None:
    org = _student_org(db, essay.owner_user_id)
    r = db.scalar(select(ReviewRubric).where(ReviewRubric.organization_id == org, ReviewRubric.is_active.is_(True))) if org else None
    return r or db.scalar(select(ReviewRubric).where(ReviewRubric.organization_id.is_(None), ReviewRubric.is_active.is_(True)))


def rubric_dimensions(db: Session, essay: Essay) -> list[dict]:
    r = rubric_for(db, essay)
    return r.dimensions if r else DEFAULT_DIMENSIONS


def scores_for(db: Session, essay: Essay) -> dict[str, RubricScore]:
    return {s.dimension: s for s in db.scalars(select(RubricScore).where(RubricScore.essay_id == essay.id))}


def set_score(db: Session, essay: Essay, dimension: str, rating: str, note: str | None, p) -> RubricScore:
    dims = {d["key"] for d in rubric_dimensions(db, essay)}
    if dimension not in dims:
        raise HTTPException(422, "Unknown rubric dimension.")
    if rating not in RATINGS:
        raise HTTPException(422, "Rating must be MEETS, NEEDS_WORK or NOT_ASSESSED.")
    s = db.scalar(select(RubricScore).where(RubricScore.essay_id == essay.id, RubricScore.dimension == dimension))
    if s is None:
        s = RubricScore(essay_id=essay.id, dimension=dimension)
        db.add(s)
    s.rating, s.note, s.version, s.reviewer_user_id = rating, (note or "").strip() or None, essay.current_version, p.id
    db.flush()
    return s


# ============================================================ quality gate

def quality_gate(db: Session, essay: Essay, *, for_student: bool = False) -> dict:
    """Checklist before final approval. States: PASSED · BLOCKER · WAITING. Derived from the rubric, the automatic
    checks and unresolved comments. No total, no percentage."""
    review = review_for(db, essay)
    dims = rubric_dimensions(db, essay)
    scores = scores_for(db, essay)
    findings = [f for f in db.scalars(select(WritingFinding).where(WritingFinding.essay_id == essay.id, WritingFinding.status == "OPEN"))]
    prompt = db.get(WritingPrompt, review.prompt_id) if review.prompt_id else None
    by_gate: dict[str, list[tuple[str, str]]] = {}
    for d in dims:
        by_gate.setdefault(d.get("gate", "OTHER"), []).append((d["key"], scores[d["key"]].rating if d["key"] in scores else "NOT_ASSESSED"))
    open_findings: dict[str, list[WritingFinding]] = {}
    for f in findings:
        g = FINDING_GATE.get(f.kind)
        if g and f.severity in ("BLOCKER", "WARNING") and (f.kind != "LIMIT" or f.code.startswith("OVER")):
            open_findings.setdefault(g, []).append(f)
    open_comments = sum(1 for c in essay.comments if c.resolved_at is None and c.visibility == MessageVisibility.PARTICIPANTS)

    items = []
    for key in GATE_ORDER:
        rated = by_gate.get(key, [])
        needs = [k for k, r in rated if r == "NEEDS_WORK"]
        meets = [k for k, r in rated if r == "MEETS"]
        fnd = open_findings.get(key, [])
        state, reasons = "PASSED", []
        if key == "REVIEWER_APPROVAL":
            state = "PASSED" if essay.status == E.APPROVED else "WAITING"
        elif key == "COMMENTS":
            state = "BLOCKER" if open_comments else "PASSED"
            reasons = [{"code": "OPEN_COMMENTS", "count": open_comments}] if open_comments else []
        elif needs:
            state, reasons = "BLOCKER", [{"code": "RUBRIC_NEEDS_WORK", "dimension": k} for k in needs]
        elif key == "PROMPT_ANSWERED":
            if fnd and not meets:
                state, reasons = "BLOCKER", [{"code": "PROMPT_PART_MISSING", "count": len(fnd)}]
            elif meets:
                state = "PASSED"
            else:
                state, reasons = "WAITING", [{"code": "PROMPT_UNKNOWN" if not (prompt or essay.prompt) else "NOT_ASSESSED"}]
        elif key in ("PROGRAM_MOTIVATION", "FUTURE_PLAN"):
            if rated and len(meets) == len(rated):
                state = "PASSED"
            else:
                state, reasons = "WAITING", [{"code": "NOT_ASSESSED"}]
        elif key == "WORD_LIMIT":
            limit = (prompt.word_limit if prompt and prompt.word_limit else essay.word_limit) or (prompt.char_limit if prompt else None)
            if fnd:
                state, reasons = "BLOCKER", [{"code": fnd[0].code, **(fnd[0].params or {})}]
            elif not limit:
                reasons = [{"code": "NO_LIMIT"}]
        elif fnd:
            state = "BLOCKER"
            reasons = [{"code": f.code, "finding_id": str(f.id)} for f in fnd]
        if for_student and key in STAFF_ONLY_GATE:
            continue
        items.append({"key": key, "state": state, "reasons": reasons})
    blockers = [i["key"] for i in items if i["state"] == "BLOCKER"]
    return {"items": items, "blockers": blockers, "can_approve": not blockers,
            "override": {"reason": review.approval_override_reason, "blockers": review.approval_override_blockers} if review.approval_override_reason and not for_student else None}


def check_approval(db: Session, essay: Essay, p, override_reason: str | None) -> None:
    """Called before an essay moves to APPROVED. Blocks while a blocker is open unless a manager overrides with a reason."""
    gate = quality_gate(db, essay)
    review = review_for(db, essay)
    review.approval_override_reason, review.approval_override_blockers = None, None
    if not gate["blockers"]:
        return
    if not override_reason or len(override_reason.strip()) < 10:
        raise HTTPException(409, {"code": "QUALITY_GATE", "message": "The quality gate has open blockers.", "blockers": gate["blockers"]})
    if not p.has(*MANAGER_ROLES):
        raise HTTPException(403, "Only a manager can approve with open blockers.")
    review.approval_override_reason, review.approval_override_blockers = override_reason.strip(), gate["blockers"]
    audit(db, action="essay.approve_override", entity_type="essay", entity_id=essay.id, actor=p, subject_user_id=essay.owner_user_id,
          detail={"blockers": gate["blockers"], "reason": override_reason.strip()})


# ============================================================ authorship

def author_info(db: Session, user_id, essay: Essay, cache: dict | None = None) -> dict:
    """STUDENT · AGENCY (name + agency) · HANGYUL. Automatic checks are never comments; they are findings."""
    if user_id is None:
        return {"kind": "UNKNOWN", "name": None, "org": None}
    cache = cache if cache is not None else {}
    key = str(user_id)
    if key in cache:
        return cache[key]
    u = db.get(User, user_id)
    if user_id == essay.owner_user_id:
        info = {"kind": "STUDENT", "name": u.full_name if u else None, "org": None}
    else:
        rows = db.execute(select(Organization).join(OrganizationMember, OrganizationMember.organization_id == Organization.id)
                          .where(OrganizationMember.user_id == user_id, OrganizationMember.is_active.is_(True))).scalars().all()
        agency = next((o for o in rows if o.type == OrgType.AGENCY), None)
        hangyul = next((o for o in rows if o.type == OrgType.HANGYUL), None)
        if agency:
            info = {"kind": "AGENCY", "name": u.full_name if u else None, "org": agency.name}
        elif hangyul:
            info = {"kind": "HANGYUL", "name": u.full_name if u else None, "org": hangyul.name}
        else:
            info = {"kind": "STAFF", "name": u.full_name if u else None, "org": None}
    cache[key] = info
    return info


# ============================================================ reviewer matching

def _open_reviews(db: Session, user_id) -> int:
    return db.scalar(select(func.count()).select_from(Essay).where(Essay.reviewer_user_id == user_id, Essay.status.in_(REVIEW_STATES))) or 0


def _recent_breaches(db: Session, user_id) -> int:
    since = _now() - timedelta(days=30)
    return db.scalar(select(func.count()).select_from(WritingEvent).where(
        WritingEvent.kind == "OVERDUE", WritingEvent.actor_user_id == user_id, WritingEvent.at >= since)) or 0


def _entitled_to_hangyul(db: Session, student_user_id) -> bool:
    return bool(db.scalar(select(Order.id).join(ServiceProduct, ServiceProduct.id == Order.product_id).where(
        Order.user_id == student_user_id, Order.status == OrderStatus.PAID, ServiceProduct.includes_essay_review.is_(True)).limit(1)))


def reviewer_candidates(db: Session, essay: Essay) -> list[dict]:
    """Everyone allowed to review this student's essay, scored with explainable reasons (points order the list; the UI
    shows the reasons, never a number). Agency: the student's own counselor + the agency's document reviewers
    (other counselors cannot open the student under the tenant rules). Hangyul counselors: when the student has an
    agency or bought a service that includes essay review."""
    student = db.get(User, essay.owner_user_id)
    assignment = db.scalar(select(AgencyAssignment).where(AgencyAssignment.student_user_id == essay.owner_user_id, AgencyAssignment.status == AssignmentStatus.ACTIVE))
    prof = db.scalar(select(StudentProfile).where(StudentProfile.user_id == essay.owner_user_id))
    t = essay_target(db, essay)
    program, uni = t["program"], t["university"]
    people: dict[uuid.UUID, tuple[User, Organization, Role]] = {}
    if assignment:
        org = db.get(Organization, assignment.organization_id)
        for m in db.scalars(select(OrganizationMember).where(OrganizationMember.organization_id == org.id, OrganizationMember.is_active.is_(True))):
            # V22: every agency admin is a reviewer candidate; the case owner is preferred by the caller's ordering.
            people[m.user_id] = (db.get(User, m.user_id), org, m.role)
    if assignment or _entitled_to_hangyul(db, essay.owner_user_id):
        for m, org in db.execute(select(OrganizationMember, Organization).join(Organization, Organization.id == OrganizationMember.organization_id)
                                 .where(Organization.type == OrgType.HANGYUL, OrganizationMember.role == Role.HANGYUL_COUNSELOR, OrganizationMember.is_active.is_(True))).all():
            people.setdefault(m.user_id, (db.get(User, m.user_id), org, m.role))
    student_langs = {x for x in (student.locale if student else None, NATIONAL_LANGUAGE.get(prof.nationality) if prof else None) if x and x != "en"}
    review = review_for(db, essay, create=False)
    prompt = db.get(WritingPrompt, review.prompt_id) if review and review.prompt_id else None
    essay_lang = (prompt.required_language if prompt and prompt.required_language else wc.essay_language(latest_body(essay)))
    previous = {e.actor_user_id for e in db.scalars(select(WritingEvent).where(WritingEvent.essay_id == essay.id, WritingEvent.kind.in_(("REVIEWED", "FINAL", "APPROVED"))))}
    out = []
    for uid, (u, org, role) in people.items():
        rp = db.scalar(select(ReviewerProfile).where(ReviewerProfile.user_id == uid, ReviewerProfile.is_active.is_(True)))
        member = db.scalar(select(OrganizationMember).where(OrganizationMember.user_id == uid, OrganizationMember.organization_id == org.id))
        langs = set((rp.languages if rp and rp.languages else None) or (member.languages if member and member.languages else []) or [])
        capacity = rp.capacity if rp else 12
        reasons, pts = [], 0
        shared = sorted(student_langs & langs)
        if shared:
            pts += 3
            reasons.append({"code": "LANGUAGE", "points": 3, "value": shared[0]})
        if essay_lang and langs and essay_lang not in langs:
            pts -= 3
            reasons.append({"code": "ESSAY_LANGUAGE_MISSING", "points": -3, "value": essay_lang})
        if rp and program and program.degree_level.value in (rp.degrees or []):
            pts += 2
            reasons.append({"code": "DEGREE", "points": 2, "value": program.degree_level.value})
        if rp and program and program.field in (rp.fields or []):
            pts += 2
            reasons.append({"code": "FIELD", "points": 2, "value": program.field})
        if rp and uni and str(uni.id) in (rp.university_ids or []):
            pts += 2
            reasons.append({"code": "UNIVERSITY", "points": 2, "value": uni.name_en})
        if rp and prof and prof.nationality in (rp.countries or []):
            pts += 2
            reasons.append({"code": "COUNTRY", "points": 2, "value": prof.nationality})
        if assignment and uid == assignment.counselor_user_id:
            pts += 2
            reasons.append({"code": "OWN_COUNSELOR", "points": 2})
        if uid in previous:
            pts += 2
            reasons.append({"code": "PREVIOUS_REVIEWER", "points": 2})
        open_n = _open_reviews(db, uid)
        if open_n >= 3:
            pts -= open_n // 3
            reasons.append({"code": "WORKLOAD", "points": -(open_n // 3), "value": open_n})
        breaches = _recent_breaches(db, uid)
        if breaches:
            pts -= min(3, breaches)
            reasons.append({"code": "SLA_BREACHES", "points": -min(3, breaches), "value": breaches})
        if assignment and org.type == OrgType.HANGYUL:  # the student's agency team first; Hangyul specialists are the overflow
            pts -= 3
            reasons.append({"code": "OUTSIDE_AGENCY", "points": -3})
        out.append({"user": {"id": str(uid), "full_name": u.full_name}, "organization": {"id": str(org.id), "name": org.name, "type": org.type.value},
                    "role": role.value, "points": pts, "reasons": reasons, "open_reviews": open_n, "capacity": capacity,
                    "at_capacity": open_n >= capacity})
    out.sort(key=lambda c: (c["at_capacity"], -c["points"], c["open_reviews"], c["user"]["full_name"]))
    return out


def auto_assign(db: Session, essay: Essay, review: EssayReview, actor=None) -> dict | None:
    cands = reviewer_candidates(db, essay)
    best = next((c for c in cands if not c["at_capacity"]), cands[0] if cands else None)
    if not best:
        return None
    prev = essay.reviewer_user_id
    essay.reviewer_user_id = uuid.UUID(best["user"]["id"])
    review.assigned_by, review.assignment_reasons, review.reviewer_assigned_at, review.override_reason = "ENGINE", best["reasons"], _now(), None
    _event(db, essay, "ASSIGNED", review, actor_user_id=essay.reviewer_user_id, detail={"from": str(prev) if prev else None, "reasons": best["reasons"]})
    audit(db, action="essay.reviewer_assigned", entity_type="essay", entity_id=essay.id, actor=actor, subject_user_id=essay.owner_user_id,
          detail={"reviewer": best["user"]["id"], "by": "ENGINE", "reasons": [r["code"] for r in best["reasons"]]})
    return best


def override_reviewer(db: Session, essay: Essay, user_id: str, reason: str, p) -> None:
    if not p.has(*MANAGER_ROLES):
        raise HTTPException(403, "Only a manager or Hangyul operations can reassign a review.")
    if not reason or len(reason.strip()) < 5:
        raise HTTPException(422, "Say why you are reassigning (it is recorded).")
    cands = {c["user"]["id"]: c for c in reviewer_candidates(db, essay)}
    if user_id not in cands:
        raise HTTPException(422, "This person cannot review this student's essay.")
    if not p.is_hangyul and cands[user_id]["organization"]["id"] != str(p.org_id) and cands[user_id]["organization"]["type"] != "HANGYUL":
        raise HTTPException(403, "You can only assign reviewers from your own organisation or Hangyul's writing team.")
    review = review_for(db, essay)
    prev = essay.reviewer_user_id
    essay.reviewer_user_id = uuid.UUID(user_id)
    review.assigned_by, review.assignment_reasons, review.reviewer_assigned_at = "OVERRIDE", cands[user_id]["reasons"], _now()
    review.override_reason = reason.strip()
    _event(db, essay, "REASSIGNED", review, actor_user_id=p.id, detail={"from": str(prev) if prev else None, "to": user_id, "reason": reason.strip()})
    audit(db, action="essay.reviewer_override", entity_type="essay", entity_id=essay.id, actor=p, subject_user_id=essay.owner_user_id,
          detail={"from": str(prev) if prev else None, "to": user_id, "reason": reason.strip()})
    # Open review tasks follow the essay to the new reviewer.
    for t in db.scalars(select(Task).where(Task.link == f"/essays/{essay.id}", Task.task_type == TaskType.ESSAY_REVIEW,
                                           Task.status.in_((TaskStatus.OPEN, TaskStatus.IN_PROGRESS)))):
        t.owner_user_id = essay.reviewer_user_id
    if essay.status in REVIEW_STATES:
        notify(db, essay.reviewer_user_id, "ESSAY_SUBMITTED", "notify.essaySubmitted", f"Essay ready for review: {essay.title}",
               params={"title": essay.title}, link=f"/essays/{essay.id}")


# ============================================================ SLA

def policy_hours(db: Session, org_id) -> dict:
    pol = (db.scalar(select(WritingPolicy).where(WritingPolicy.organization_id == org_id)) if org_id else None) or \
        db.scalar(select(WritingPolicy).where(WritingPolicy.organization_id.is_(None)))
    if not pol:
        return dict(DEFAULT_HOURS)
    return {"first": pol.first_review_hours, "revision": pol.revision_review_hours, "final": pol.final_review_hours}


def _event(db: Session, essay: Essay, kind: str, review: EssayReview, *, actor_user_id=None, due_at=None, detail=None, at=None) -> None:
    db.add(WritingEvent(essay_id=essay.id, kind=kind, round=review.review_round, version=essay.current_version, actor_user_id=actor_user_id,
                        organization_id=_student_org(db, essay.owner_user_id), due_at=due_at, detail=detail, at=at or _now()))


def _close_sla_tasks(db: Session, essay: Essay) -> None:
    now = _now()
    for t in db.scalars(select(Task).where(Task.source == "WRITING", Task.link == f"/essays/{essay.id}",
                                           Task.status.in_((TaskStatus.OPEN, TaskStatus.IN_PROGRESS)))):
        t.status, t.completed_at = TaskStatus.DONE, now


def on_submitted(db: Session, essay: Essay, actor) -> None:
    """Student submitted (first time or a revision): new review round, SLA clock, automatic checks, reviewer."""
    review = review_for(db, essay)
    now = _now()
    review.review_round += 1
    review.submitted_at = now
    review.first_submitted_at = review.first_submitted_at or now
    hours = policy_hours(db, _student_org(db, essay.owner_user_id))
    review.expected_review_by = now + timedelta(hours=hours["first"] if review.review_round == 1 else hours["revision"])
    review.overdue_flagged_at, review.escalated_to_id = None, None
    _close_sla_tasks(db, essay)
    run_checks(db, essay, review)
    if review.assigned_by is None or essay.reviewer_user_id is None:
        auto_assign(db, essay, review, actor)
    _event(db, essay, "SUBMITTED", review, actor_user_id=actor.id if actor else None, due_at=review.expected_review_by)


def on_staff_transition(db: Session, essay: Essay, from_status: EssayStatus, to_status: EssayStatus, p) -> None:
    # V29 analytics: a review round the team finished (returned or approved) — the type only, never the text.
    if to_status in (EssayStatus.CHANGES_REQUESTED, EssayStatus.APPROVED):
        from app.core.audit import track

        track(db, "essay_review_completed", user_id=essay.owner_user_id, properties={"essay_type": essay.essay_type.value, "outcome": to_status.value})
    review = review_for(db, essay)
    now = _now()
    if from_status in REVIEW_STATES:
        late = bool(review.expected_review_by and now > review.expected_review_by)
        if late and review.overdue_flagged_at is None:
            review.sla_breaches += 1
        kind = {E.CHANGES_REQUESTED: "REVIEWED", E.FINAL_REVIEW: "FINAL", E.APPROVED: "APPROVED"}.get(to_status, "REVIEWED")
        _event(db, essay, kind, review, actor_user_id=p.id, due_at=review.expected_review_by,
               detail={"hours": _hours(review.submitted_at, now), "late": late})
        review.last_reviewed_at = now
    _close_sla_tasks(db, essay)
    if to_status == E.FINAL_REVIEW:
        review.expected_review_by = now + timedelta(hours=policy_hours(db, _student_org(db, essay.owner_user_id))["final"])
        review.submitted_at = now
        review.overdue_flagged_at, review.escalated_to_id = None, None
    else:
        review.expected_review_by = None
    if to_status == E.APPROVED:
        review.approved_version, review.approved_at, review.approved_by_id = essay.current_version, now, p.id


def _manager_for(db: Session, essay: Essay) -> tuple[uuid.UUID | None, Organization | None]:
    org_id = _student_org(db, essay.owner_user_id)
    if org_id:
        org = db.get(Organization, org_id)
        # The person the late review escalates to is never the late reviewer themself.
        for role in (Role.AGENCY_ADMIN,):
            for m in db.scalars(select(OrganizationMember).where(OrganizationMember.organization_id == org_id, OrganizationMember.role == role,
                                                                 OrganizationMember.is_active.is_(True)).order_by(OrganizationMember.created_at)):
                if m.user_id != essay.reviewer_user_id:
                    return m.user_id, org
        return None, org
    m, org = db.execute(select(OrganizationMember, Organization).join(Organization, Organization.id == OrganizationMember.organization_id)
                        .where(Organization.type == OrgType.HANGYUL, OrganizationMember.role == Role.HANGYUL_OPERATIONS,
                               OrganizationMember.is_active.is_(True))).first() or (None, None)
    return (m.user_id if m else None), org


def _live_application():
    """V9 reliability: essays of a withdrawn or rejected application are not review work (no queue row, no overdue flag)."""
    from sqlalchemy import or_

    from app.models.enums import ApplicationStatus

    closed = select(Application.id).where(Application.status.in_([ApplicationStatus.WITHDRAWN, ApplicationStatus.REJECTED]))
    return or_(Essay.application_id.is_(None), Essay.application_id.not_in(closed))


def sla_sweep(db: Session, now: datetime | None = None, essay_ids: list | None = None) -> int:
    """Flag reviews past their expected time once per round: notify + task for the reviewer, escalation task for the
    agency manager (Hangyul operations when there is no agency). Idempotent (dedupe keys)."""
    now = now or _now()
    q = (select(EssayReview, Essay).join(Essay, Essay.id == EssayReview.essay_id)
         .where(Essay.status.in_(REVIEW_STATES), EssayReview.expected_review_by.is_not(None), EssayReview.expected_review_by < now,
                EssayReview.overdue_flagged_at.is_(None), _live_application()))
    if essay_ids is not None:
        q = q.where(Essay.id.in_(essay_ids))
    n = 0
    for review, essay in db.execute(q).all():
        n += 1
        review.overdue_flagged_at = now
        review.sla_breaches += 1
        student = db.get(User, essay.owner_user_id)
        org_id = _student_org(db, essay.owner_user_id)
        stamp = review.expected_review_by.strftime("%Y%m%d%H%M")
        et = essay.essay_type.value
        if essay.reviewer_user_id:
            notify(db, essay.reviewer_user_id, "WRITING_OVERDUE", "notify.writingOverdue", f"Essay review overdue: {essay.title}",
                   params={"title": essay.title, "student": student.full_name}, link=f"/essays/{essay.id}")
            key = f"writing-overdue:{essay.id}:{review.review_round}:{stamp}"
            if not db.scalar(select(Task.id).where(Task.dedupe_key == key)):
                db.add(Task(title=f"Overdue essay review: {essay.title} ({student.full_name})", title_key="task.writingOverdue",
                            title_params={"essayType": et, "student": student.full_name}, task_type=TaskType.ESSAY_REVIEW, priority=TaskPriority.URGENT,
                            due_at=review.expected_review_by, owner_user_id=essay.reviewer_user_id, owner_org_id=org_id,
                            student_user_id=essay.owner_user_id, source="WRITING", dedupe_key=key, link=f"/essays/{essay.id}"))
        manager_id, org = _manager_for(db, essay)
        if manager_id:
            review.escalated_to_id = manager_id
            reviewer = db.get(User, essay.reviewer_user_id) if essay.reviewer_user_id else None
            notify(db, manager_id, "WRITING_ESCALATION", "notify.writingEscalation", f"Late essay review escalated: {essay.title}",
                   params={"title": essay.title, "student": student.full_name, "reviewer": reviewer.full_name if reviewer else None}, link=f"/essays/{essay.id}")
            key = f"writing-escalate:{essay.id}:{review.review_round}:{stamp}"
            if not db.scalar(select(Task.id).where(Task.dedupe_key == key)):
                db.add(Task(title=f"Late essay review — reassign or unblock: {essay.title} ({student.full_name})", title_key="task.writingEscalation",
                            title_params={"essayType": et, "student": student.full_name, "reviewer": reviewer.full_name if reviewer else ""},
                            task_type=TaskType.SLA_FOLLOW_UP, priority=TaskPriority.HIGH, due_at=now + timedelta(hours=24), owner_user_id=manager_id,
                            owner_org_id=org_id, student_user_id=essay.owner_user_id, source="WRITING", dedupe_key=key, link=f"/essays/{essay.id}"))
        _event(db, essay, "OVERDUE", review, actor_user_id=essay.reviewer_user_id, due_at=review.expected_review_by)
        if manager_id:
            _event(db, essay, "ESCALATED", review, actor_user_id=manager_id, detail={"org": org.name if org else None})
    db.flush()
    return n


def student_status(db: Session, essay: Essay) -> dict:
    """Truthful review status for the student. Codes: DRAFT · WAITING_REVIEWER · REVIEWING · LATE_FLAGGED · LATE ·
    CHANGES · FINAL · READY. Times are ISO; the client formats them."""
    review = review_for(db, essay, create=False)
    reviewer = db.get(User, essay.reviewer_user_id) if essay.reviewer_user_id else None
    info = author_info(db, reviewer.id, essay) if reviewer else None
    # V22 (REPORT §246 A3): the student is served by the Hangyul team — never a reviewer's name.
    base = {"reviewer": {"name": "Hangyul Univ Team", "kind": info["kind"], "org": info["org"], "display": "team"} if reviewer else None,
            "submitted_at": _iso(review.submitted_at) if review else None, "expected_by": _iso(review.expected_review_by) if review else None,
            "round": review.review_round if review else 0}
    if essay.status == E.APPROVED:
        return {"code": "READY", **base, "approved_version": review.approved_version if review else essay.current_version,
                "approved_at": _iso(review.approved_at) if review else None}
    if essay.status in STUDENT_STATES:
        if essay.status == E.DRAFT:
            return {"code": "DRAFT", **base}
        return {"code": "CHANGES", **base}
    if not reviewer:
        return {"code": "WAITING_REVIEWER", **base}
    if review and review.expected_review_by and _now() > review.expected_review_by:
        if review.escalated_to_id:
            _, org = _manager_for(db, essay)
            return {"code": "LATE_FLAGGED", **base, "flagged_to": org.name if org else None,
                    "flagged_to_kind": org.type.value if org else None}
        return {"code": "LATE", **base}
    return {"code": "FINAL" if essay.status == E.FINAL_REVIEW else "REVIEWING", **base}


# ============================================================ serialization for the essay endpoints

def essay_block(db: Session, essay: Essay, p, *, full: bool) -> dict:
    """Additive "writing" block for GET /essays and /essays/{id}. Students never see staff-only findings, rubric
    notes, assignment reasons or override reasons."""
    staff = not p.is_student
    review = review_for(db, essay)
    prompt = ensure_prompt(db, essay, review)
    t = essay_target(db, essay)
    uni, program, intake = t["university"], t["program"], t["intake"]
    if prompt:
        prompt_status = "LINKED"
    elif essay.prompt:
        prompt_status = "STUDENT_COPY"
    else:
        prompt_status = "UNKNOWN"
    overdue = bool(essay.status in REVIEW_STATES and review.expected_review_by and _now() > review.expected_review_by)
    d = {
        "context": {"university": {"id": str(uni.id), "name": uni.name_en} if uni else None,
                    "program": {"id": str(program.id), "name": program.name_en, "degree_level": program.degree_level.value} if program else None,
                    "intake": {"year": intake.year, "term": intake.term.value, "deadline": _iso(intake.application_deadline)} if intake else None,
                    "application_id": str(essay.application_id) if essay.application_id else None},
        "prompt_status": prompt_status,
        "prompt": ser_prompt(db, prompt, staff=staff),
        "limits": {"word_limit": (prompt.word_limit if prompt and prompt.word_limit else essay.word_limit), "char_limit": prompt.char_limit if prompt else None},
        "review": {"round": review.review_round, "submitted_at": _iso(review.submitted_at), "first_submitted_at": _iso(review.first_submitted_at),
                   "expected_review_by": _iso(review.expected_review_by), "overdue": overdue, "escalated": review.escalated_to_id is not None,
                   "last_reviewed_at": _iso(review.last_reviewed_at)},
        "approved_version": review.approved_version if review.approved_version else (essay.current_version if essay.status == E.APPROVED else None),
        "approved_at": _iso(review.approved_at),
        "status_line": student_status(db, essay),
    }
    if staff:
        d["review"].update({"assigned_by": review.assigned_by, "assignment_reasons": review.assignment_reasons or [],
                            "override_reason": review.override_reason, "sla_breaches": review.sla_breaches,
                            "escalated_to": (db.get(User, review.escalated_to_id).full_name if review.escalated_to_id else None)})
    if full:
        findings = db.scalars(select(WritingFinding).where(WritingFinding.essay_id == essay.id).order_by(WritingFinding.created_at)).all()
        d["findings"] = [ser_finding(f) for f in findings if staff or not f.staff_only]
        d["checks"] = {"version": review.checks_version, "at": _iso(review.checks_at), "label": "AUTOMATIC_CHECK", "provider": review.checks_provider or "none"}
        show_gate = staff or essay.status in (E.FINAL_REVIEW, E.APPROVED)
        d["gate"] = quality_gate(db, essay, for_student=not staff) if show_gate else None
        cache: dict = {}
        d["authors"] = {str(uid): author_info(db, uid, essay, cache) for uid in
                        {c.author_user_id for c in essay.comments if c.author_user_id} | {v.author_user_id for v in essay.versions if v.author_user_id}
                        | ({essay.reviewer_user_id} if essay.reviewer_user_id else set())}
        if staff:
            dims = rubric_dimensions(db, essay)
            scores = scores_for(db, essay)
            d["rubric"] = {"dimensions": [{"key": x["key"], "label": x.get("label"), "gate": x.get("gate", "OTHER"),
                                           "group": x.get("group") or DIMENSION_GROUP.get(x["key"], "QUALITY")} for x in dims],
                           "scores": {k: {"rating": s.rating, "note": s.note, "version": s.version,
                                          "by": db.get(User, s.reviewer_user_id).full_name if s.reviewer_user_id else None} for k, s in scores.items()}}
            d["approval_override"] = {"reason": review.approval_override_reason, "blockers": review.approval_override_blockers} if review.approval_override_reason else None
        # V6: authorship statements per version, the application that uses the approved version, AI only when configured.
        d["attestations"] = {str(a.version): ser_attestation(a) for a in db.scalars(select(EssayAttestation).where(EssayAttestation.essay_id == essay.id))}
        d["used_by"] = used_by(db, essay, review)
        d["ai"] = ai_block()
    return d


# ============================================================ V6: suggestions, authorship, application use, AI

ATTESTATION_CODE = "OWN_WORDS_AND_FACTS_V1"
ATTESTATION_TEXT = ("These are my own words and facts. Reviewers gave feedback; any suggested wording I accepted was my "
                    "decision, and everything this text says about me is true.")
EDITABLE_BY_STUDENT = (E.DRAFT, E.CHANGES_REQUESTED, E.STUDENT_REVISION)


def decisions_for(db: Session, essay: Essay) -> dict[str, EssaySuggestionDecision]:
    return {str(x.comment_id): x for x in db.scalars(select(EssaySuggestionDecision).where(EssaySuggestionDecision.essay_id == essay.id))}


def suggestion_fields(c: EssayComment, decision: EssaySuggestionDecision | None, users: dict | None = None) -> dict:
    """What happened to a reviewer's suggested wording: PENDING (the student hasn't decided), ACCEPTED (applied by the
    student as a new version), REJECTED (declined), WITHDRAWN (resolved by staff without a student decision)."""
    if c.suggestion is None:
        return {"suggestion_state": None}
    if decision:
        return {"suggestion_state": decision.state, "decided_at": _iso(decision.decided_at), "decision_note": decision.note,
                "decision_version": decision.version_created}
    return {"suggestion_state": "WITHDRAWN" if c.resolved_at else "PENDING"}


def decide_suggestion(db: Session, essay: Essay, comment_id: str, decision: str, note: str | None, p) -> EssaySuggestionDecision:
    """The student accepts (applied as a new version authored by the student) or declines a suggested wording.
    Only the student decides; only while the text is with the student; the quoted text must still be there."""
    if not p.is_student or p.id != essay.owner_user_id:
        raise HTTPException(403, "Only the student decides on a suggested change — it's their essay.")
    c = next((x for x in essay.comments if str(x.id) == comment_id), None)
    if not c or c.visibility != MessageVisibility.PARTICIPANTS:
        raise HTTPException(404, "Comment not found")
    if c.suggestion is None:
        raise HTTPException(422, "This comment has no suggested wording.")
    if db.scalar(select(EssaySuggestionDecision.id).where(EssaySuggestionDecision.comment_id == c.id)):
        raise HTTPException(409, "You already decided on this suggestion.")
    if essay.status not in EDITABLE_BY_STUDENT:
        raise HTTPException(409, "This essay is being reviewed or is approved. Decide on suggestions when it's back with you.")
    now = _now()
    row = EssaySuggestionDecision(comment_id=c.id, essay_id=essay.id, state="ACCEPTED" if decision == "ACCEPT" else "REJECTED",
                                  decided_by_id=p.id, decided_at=now, note=(note or "").strip() or None)
    if decision == "ACCEPT":
        latest = essay.versions[-1]
        if not c.quote or c.quote not in latest.body:
            raise HTTPException(409, "The quoted text has changed; apply the suggestion manually.")
        start = c.anchor_start if c.anchor_start is not None and latest.body[c.anchor_start:c.anchor_start + len(c.quote)] == c.quote else latest.body.index(c.quote)
        essay.current_version += 1
        essay.versions.append(EssayVersion(version=essay.current_version, body=latest.body[:start] + c.suggestion + latest.body[start + len(c.quote):],
                                           author_user_id=p.id, note="Accepted reviewer suggestion", created_at=now))
        row.version_created = essay.current_version
    if essay.status == E.CHANGES_REQUESTED:
        essay.status = E.STUDENT_REVISION
    c.resolved_at, c.resolved_by_id = now, p.id
    essay.updated_at = now
    db.add(row)
    audit(db, action=f"essay.suggestion_{row.state.lower()}", entity_type="essay", entity_id=essay.id, actor=p, subject_user_id=essay.owner_user_id,
          detail={"comment": str(c.id), "version": row.version_created})
    db.flush()
    return row


def record_legacy_resolve(db: Session, essay: Essay, c: EssayComment, applied: bool, p) -> None:
    """Older clients resolve a suggestion through /comments/{id}/resolve: record the student's decision the same way."""
    if c.suggestion is None or not p.is_student or db.scalar(select(EssaySuggestionDecision.id).where(EssaySuggestionDecision.comment_id == c.id)):
        return
    db.add(EssaySuggestionDecision(comment_id=c.id, essay_id=essay.id, state="ACCEPTED" if applied else "REJECTED", decided_by_id=p.id,
                                   decided_at=_now(), version_created=essay.current_version if applied else None))


def ser_attestation(a: EssayAttestation) -> dict:
    return {"version": a.version, "attested_at": _iso(a.attested_at), "statement_code": a.statement_code, "locale": a.locale}


def attest(db: Session, essay: Essay, p, locale: str | None = None) -> EssayAttestation:
    """The student's authorship statement for the current version (idempotent per version). Stored with a hash of the
    exact text so a later edit is a new, unattested version."""
    if not p.is_student or p.id != essay.owner_user_id:
        raise HTTPException(403, "Only the student can confirm authorship.")
    body = latest_body(essay)
    if not body.strip():
        raise HTTPException(422, "There is no text to confirm yet.")
    digest = hashlib.sha256(body.encode("utf-8")).hexdigest()
    row = db.scalar(select(EssayAttestation).where(EssayAttestation.essay_id == essay.id, EssayAttestation.version == essay.current_version))
    if row and row.body_sha256 == digest:
        return row
    if row is None:
        row = EssayAttestation(essay_id=essay.id, version=essay.current_version, user_id=p.id)
        db.add(row)
    row.statement_code, row.statement_text, row.locale, row.body_sha256, row.attested_at = ATTESTATION_CODE, ATTESTATION_TEXT, (locale or "")[:10] or None, digest, _now()
    audit(db, action="essay.attested", entity_type="essay", entity_id=essay.id, actor=p, subject_user_id=essay.owner_user_id,
          detail={"version": essay.current_version, "statement": ATTESTATION_CODE})
    db.flush()
    return row


def used_by(db: Session, essay: Essay, review: EssayReview | None = None) -> list[dict]:
    """Which application uses which version of this essay (the approved one), for the student and the reviewer."""
    t = essay_target(db, essay)
    app = t["application"]
    if not app:
        return []
    ver = _approved_version(db, essay)
    return [{"application_id": str(app.id), "university": t["university"].name_en if t["university"] else None, "university_id": str(t["university"].id) if t["university"] else None,
             "program": t["program"].name_en if t["program"] else None, "application_status": app.status.value,
             "approved_version": ver, "newer_draft": bool(ver and essay.current_version > ver)}]


def ai_block() -> dict | None:
    """Nothing when no provider is configured (the UI then shows nothing AI-related). When one is, every item it
    produces is labelled "AI suggestion" and is advisory: humans review, nothing is applied to the text."""
    st = ai_provider.status()
    return {"provider": st.active, "label": "AI_SUGGESTION"} if st.active != "none" else None


# ============================================================ agency queue + Today

QUEUE_VIEWS = ("first", "revised", "final", "due48", "overdue", "mine", "team")


def _view_match(view: str, essay: Essay, review: EssayReview | None, p, now: datetime) -> bool:
    in_review = essay.status in REVIEW_STATES
    exp = review.expected_review_by if review else None
    rnd = review.review_round if review else 0
    if view == "first":
        return in_review and essay.status != E.FINAL_REVIEW and rnd <= 1
    if view == "revised":
        return in_review and essay.status != E.FINAL_REVIEW and rnd > 1
    if view == "final":
        return essay.status == E.FINAL_REVIEW
    if view == "due48":
        return in_review and exp is not None and now <= exp <= now + timedelta(hours=48)
    if view == "overdue":
        return in_review and exp is not None and exp < now
    if view == "mine":
        return in_review and essay.reviewer_user_id == p.id
    return in_review


def next_action(essay: Essay, review: EssayReview | None, now: datetime) -> str:
    if essay.status in REVIEW_STATES and review and review.expected_review_by and review.expected_review_by < now:
        return "OVERDUE"
    if essay.status == E.FINAL_REVIEW:
        return "FINAL_APPROVAL"
    if essay.status in REVIEW_STATES:
        return "REVIEW_REVISION" if review and review.review_round > 1 else "FIRST_REVIEW"
    if essay.status in STUDENT_STATES:
        return "WAITING_STUDENT"
    return "NONE"


def _scoped_essays(db: Session, p, only_review: bool = True) -> list[tuple[Essay, EssayReview | None]]:
    from app.services.access import scope_student_ids

    q = select(Essay, EssayReview).outerjoin(EssayReview, EssayReview.essay_id == Essay.id)
    if only_review:
        q = q.where(Essay.status.in_(REVIEW_STATES), _live_application())
    q = scope_student_ids(q, Essay.owner_user_id, p)
    return db.execute(q).all()


def queue(db: Session, p, view: str) -> dict:
    sla_sweep(db)
    now = _now()
    rows = _scoped_essays(db, p)
    counts = {v: sum(1 for e, r in rows if _view_match(v, e, r, p, now)) for v in QUEUE_VIEWS}
    sel = [(e, r) for e, r in rows if _view_match(view, e, r, p, now)]
    sel.sort(key=lambda er: (not (er[1] and er[1].expected_review_by and er[1].expected_review_by < now),
                             er[1].expected_review_by if er[1] and er[1].expected_review_by else now + timedelta(days=365)))
    items = []
    cache: dict = {}
    for e, r in sel:
        t = essay_target(db, e)
        student = db.get(User, e.owner_user_id)
        reviewer = db.get(User, e.reviewer_user_id) if e.reviewer_user_id else None
        items.append({
            "id": str(e.id), "title": e.title, "essay_type": e.essay_type.value, "status": e.status.value, "version": e.current_version,
            "student": {"id": str(student.id), "name": student.full_name},
            "university": t["university"].name_en if t["university"] else None, "university_id": str(t["university"].id) if t["university"] else None, "program": t["program"].name_en if t["program"] else None,
            "deadline": _iso(e.due_date), "submitted_at": _iso(r.submitted_at) if r else None,
            "review_age_hours": _hours(r.submitted_at, now) if r and r.submitted_at else None,
            "expected_review_by": _iso(r.expected_review_by) if r else None,
            "overdue": bool(r and r.expected_review_by and r.expected_review_by < now), "round": r.review_round if r else 0,
            "reviewer": {"id": str(reviewer.id), "full_name": reviewer.full_name, **author_info(db, reviewer.id, e, cache)} if reviewer else None,
            "next_action": next_action(e, r, now),
            "escalated": bool(r and r.escalated_to_id), "escalated_to": (db.get(User, r.escalated_to_id).full_name if r and r.escalated_to_id else None),
        })
    return {"view": view, "items": items, "total": len(items), "counts": counts}


def today_items(db: Session, principal) -> list[dict]:
    """For the coordinator's Agency Today: overdue reviews, reviews due within 48 h, and essays the student revised
    (round > 1, waiting for the reviewer). Scoped by the principal's tenant; sweeps the SLA first so it is truthful."""
    sla_sweep(db)
    now = _now()
    out = []
    for e, r in _scoped_essays(db, principal):
        if not r:
            continue
        kind = None
        if r.expected_review_by and r.expected_review_by < now:
            kind = "WRITING_OVERDUE"
        elif r.expected_review_by and r.expected_review_by <= now + timedelta(hours=48):
            kind = "WRITING_DUE_SOON"
        if r.review_round > 1 and e.status != E.FINAL_REVIEW and kind != "WRITING_OVERDUE":
            kind = kind or "WRITING_REVISED"
            if kind == "WRITING_DUE_SOON":
                out.append(_today_row(db, e, r, "WRITING_REVISED"))
        if kind:
            out.append(_today_row(db, e, r, kind))
    order = {"WRITING_OVERDUE": 0, "WRITING_DUE_SOON": 1, "WRITING_REVISED": 2}
    out.sort(key=lambda x: (order[x["kind"]], x["due_at"] or ""))
    return out


def _today_row(db: Session, e: Essay, r: EssayReview, kind: str) -> dict:
    t = essay_target(db, e)
    student = db.get(User, e.owner_user_id)
    reviewer = db.get(User, e.reviewer_user_id) if e.reviewer_user_id else None
    return {"kind": kind, "essay_id": str(e.id), "title": e.title, "essay_type": e.essay_type.value,
            "student": {"id": str(student.id), "name": student.full_name}, "university": t["university"].name_en if t["university"] else None, "university_id": str(t["university"].id) if t["university"] else None,
            "due_at": _iso(r.expected_review_by), "round": r.review_round, "reviewer": reviewer.full_name if reviewer else None,
            "link": f"/essays/{e.id}"}


def next_in_queue(db: Session, p, essay_id, view: str | None = None, pos: int | None = None) -> str | None:
    """The next essay after this one in the reviewer's queue. With ``view`` (the queue view the reviewer works in) it
    stays in that view; when this essay has just left the view (approved / sent back), ``pos`` — its former position —
    picks the essay that moved up into its place. Without ``view``: mine first, then team (V5)."""
    views = (view,) if view in QUEUE_VIEWS else ("mine", "team")
    for v in views:
        items = [i["id"] for i in queue(db, p, v)["items"]]
        others = [i for i in items if i != str(essay_id)]
        if not others:
            continue
        if str(essay_id) in items:
            idx = items.index(str(essay_id))
            after = items[idx + 1:] + items[:idx]
            return after[0] if after else None
        if pos is not None:
            return others[min(max(pos, 0), len(others) - 1)]
        return others[0]
    return None


# ============================================================ approved version → application

def _approved_version(db: Session, e: Essay, memo: dict | None = None) -> int | None:
    if memo is not None and ("approved", e.id) in memo:
        return memo[("approved", e.id)]
    out = _approved_version_uncached(db, e)
    if memo is not None:
        memo[("approved", e.id)] = out
    return out


def _approved_version_uncached(db: Session, e: Essay) -> int | None:
    r = review_for(db, e, create=False)
    if r and r.approved_version:
        return r.approved_version
    return e.current_version if e.status == E.APPROVED else None


def apply_essay_versions(db: Session, student_user_id, program: Program, items: list[dict], memo: dict | None = None) -> list[dict]:
    """Essay-backed requirements (personal statement, study plan, CV, recommendation): when the essay written for this
    program has an approved version, that version IS the document — the requirement is ready and names the version."""
    essay_cats = {"PERSONAL_STATEMENT", "STUDY_PLAN", "CV", "RECOMMENDATION"}
    if not any(i["category"] in essay_cats for i in items):
        return items
    ekey = ("essays", student_user_id, program.id)
    if memo is not None and ekey in memo:
        essays = memo[ekey]
    else:
        essays = db.scalars(select(Essay).where(Essay.owner_user_id == student_user_id, Essay.program_id == program.id)).all()
        if memo is not None:
            memo[ekey] = essays
    by_type: dict[str, Essay] = {}
    for e in essays:
        cur = by_type.get(e.essay_type.value)
        if cur is None or (_approved_version(db, e, memo) or 0) > (_approved_version(db, cur, memo) or 0):
            by_type[e.essay_type.value] = e
    for i in items:
        e = by_type.get(i["category"])
        if not e:
            continue
        ver = _approved_version(db, e, memo)
        i["essay_id"], i["essay_status"], i["essay_approved_version"] = str(e.id), e.status.value, ver
        if ver:
            i.update({"ready": True, "status": "VERIFIED", "action_code": None, "action": None, "source": "APPROVED_ESSAY",
                      "review_since": None, "review_overdue": None})
    return items


def approved_essays_for_application(db: Session, application_id) -> list[dict]:
    """What a package / submission uses: the approved version's exact text for each essay of the application."""
    out = []
    for e in db.scalars(select(Essay).where(Essay.application_id == application_id)).all():
        ver = _approved_version(db, e)
        if not ver:
            continue
        v = db.scalar(select(EssayVersion).where(EssayVersion.essay_id == e.id, EssayVersion.version == ver))
        r = review_for(db, e, create=False)
        out.append({"essay_id": str(e.id), "essay_type": e.essay_type.value, "title": e.title, "version": ver,
                    "approved_at": _iso(r.approved_at) if r else None, "word_count": wc.word_count(v.body) if v else 0,
                    "body": v.body if v else "", "newer_draft": e.current_version > ver})
    return out


# ============================================================ outcomes + metrics (internal)

OFFER_STATES = {ApplicationStatus.OFFERED, ApplicationStatus.OFFER_ACCEPTED, ApplicationStatus.TUITION_PENDING, ApplicationStatus.TUITION_PAID,
                ApplicationStatus.ADMISSION_CERTIFICATE_PENDING, ApplicationStatus.ADMISSION_CERTIFICATE_ISSUED, ApplicationStatus.VISA_PREPARATION,
                ApplicationStatus.VISA_SUBMITTED, ApplicationStatus.VISA_ISSUED, ApplicationStatus.ENROLLED}


def _decision(status: ApplicationStatus) -> str | None:
    if status in OFFER_STATES:
        return "OFFERED"
    if status == ApplicationStatus.REJECTED:
        return "REJECTED"
    if status == ApplicationStatus.WAITLISTED:
        return "WAITLISTED"
    return None


def record_outcomes(db: Session, application_ids: list | None = None) -> int:
    """Link each decided application's approved essays + review metrics to the decision (idempotent upsert).
    Call from the daily job or right after an application reaches a decision."""
    q = select(Application).where(Application.status.in_([*OFFER_STATES, ApplicationStatus.REJECTED, ApplicationStatus.WAITLISTED]))
    if application_ids is not None:
        q = q.where(Application.id.in_(application_ids))
    n = 0
    for app in db.scalars(q).all():
        dec = _decision(app.status)
        intake = db.get(ProgramIntake, app.intake_id)
        for e in db.scalars(select(Essay).where(Essay.application_id == app.id)).all():
            ver = _approved_version(db, e)
            if not ver:
                continue
            r = review_for(db, e, create=False)
            evs = db.scalars(select(WritingEvent).where(WritingEvent.essay_id == e.id).order_by(WritingEvent.at)).all()
            first_sub = next((x for x in evs if x.kind == "SUBMITTED"), None)
            first_rev = next((x for x in evs if x.kind in ("REVIEWED", "FINAL", "APPROVED") and first_sub and x.at >= first_sub.at), None)
            scores = scores_for(db, e)
            row = db.scalar(select(WritingOutcome).where(WritingOutcome.essay_id == e.id, WritingOutcome.application_id == app.id))
            if row is None:
                row = WritingOutcome(essay_id=e.id, application_id=app.id)
                db.add(row)
            row.organization_id, row.university_id, row.program_id = app.agency_org_id, app.university_id, app.program_id
            row.essay_type, row.intake_year, row.approved_version = e.essay_type.value, intake.year if intake else None, ver
            row.decision, row.decided_at = dec, app.decided_at
            row.review_rounds = r.review_round if r else sum(1 for x in evs if x.kind == "SUBMITTED")
            row.first_turnaround_hours = _hours(first_sub.at, first_rev.at) if first_sub and first_rev else None
            row.sla_breaches = r.sla_breaches if r else 0
            row.rubric_meets = sum(1 for s in scores.values() if s.rating == "MEETS")
            row.rubric_needs_work = sum(1 for s in scores.values() if s.rating == "NEEDS_WORK")
            row.override_used = bool(r and r.approval_override_reason)
            row.is_demo = bool(app.is_demo)
            n += 1
    db.flush()
    return n


def writing_metrics(db: Session, org_id=None, period_days: int = 90) -> dict:
    """Essay review turnaround (median hours from submission to the reviewer's response), revision rounds for essays
    approved in the period, and SLA breaches. ``org_id`` None = all organisations (Hangyul)."""
    since = _now() - timedelta(days=period_days)
    q = select(WritingEvent).where(WritingEvent.at >= since)
    if org_id:
        q = q.where(WritingEvent.organization_id == org_id)
    evs = db.scalars(q).all()
    turn = [x.detail["hours"] for x in evs if x.kind in ("REVIEWED", "FINAL", "APPROVED") and x.detail and x.detail.get("hours") is not None]
    approved = [x for x in evs if x.kind == "APPROVED"]
    rounds = []
    for x in approved:
        rounds.append(x.round or 1)
    reviewed = [x for x in evs if x.kind in ("REVIEWED", "FINAL", "APPROVED")]
    flagged = {(x.essay_id, x.round) for x in evs if x.kind == "OVERDUE"}
    late_unflagged = sum(1 for x in reviewed if x.detail and x.detail.get("late") and (x.essay_id, x.round) not in flagged)
    return {
        "period_days": period_days,
        "reviews": len(turn),
        "median_turnaround_hours": round(statistics.median(turn), 1) if turn else None,
        "approved_essays": len(approved),
        "median_revision_rounds": statistics.median(rounds) if rounds else None,
        "sla_breaches": len(flagged) + late_unflagged,
        "definition": "Turnaround = hours from the student's submission to the reviewer's response, per review round. "
                      "Revision rounds = submissions before approval. SLA breach = a review not answered by its expected time.",
    }


def outcome_patterns(db: Session, org_id=None) -> dict:
    """Internal patterns: n per group and the number of offers — never a rate for n < 5, never a causal claim."""
    q = select(WritingOutcome)
    if org_id:
        q = q.where(WritingOutcome.organization_id == org_id)
    rows = db.scalars(q).all()
    groups: dict[str, dict[str, list[WritingOutcome]]] = {"rounds": {}, "sla": {}, "override": {}}
    for r in rows:
        groups["rounds"].setdefault("1" if r.review_rounds <= 1 else "2" if r.review_rounds == 2 else "3+", []).append(r)
        groups["sla"].setdefault("breached" if r.sla_breaches else "on_time", []).append(r)
        groups["override"].setdefault("override" if r.override_used else "gate_clear", []).append(r)
    out = {}
    for dim, gs in groups.items():
        out[dim] = []
        for key, rs in sorted(gs.items()):
            n = len(rs)
            out[dim].append({"group": key, "n": n, "withheld": n < 5,
                             "offers": None if n < 5 else sum(1 for r in rs if r.decision == "OFFERED"),
                             "not_admitted": None if n < 5 else sum(1 for r in rs if r.decision == "REJECTED"),
                             "waitlisted": None if n < 5 else sum(1 for r in rs if r.decision == "WAITLISTED")})
    years = sorted({r.intake_year for r in rows if r.intake_year})
    return {"n": len(rows), "groups": out, "period": {"from": years[0], "to": years[-1]} if years else None,
            "population": "Essays with an approved version, linked to applications that received a decision (offer, not admitted, waitlisted).",
            "demo": any(r.is_demo for r in rows),
            "caveat": "Patterns only — counts per group, no causal claims. Groups with fewer than 5 essays are withheld."}


# ------------------------------------------------------------------------------------- Application quality hook
#
# V13, brief Part 7. `strategy.register_essay_hook` was built in V5 so the writing workstream could push its
# own findings onto an application's quality check without strategy.py having to know about essays, and
# `docs/ADMISSION_SUCCESS.md` has described it as the writing hook ever since — but **nothing ever registered
# a function**, so for eight passes the hook list was empty and every gate below stayed inside the essay
# editor. An application's quality check could say "Revise your study plan" and could not say *why*, even
# though the reason was already computed and stored.
#
# That mattered most for the checks the brief lists by name and this product already performs:
#
#   NAMES               the essay names a different university, or misspells this one
#   WORD_LIMIT          over the university's published word or character limit
#   PROMPT_ANSWERED     part of the prompt is not answered
#   PROFILE_CONSISTENCY the essay states something the profile and documents contradict
#
# A study plan addressed to the wrong university is one of the cheapest rejections there is to prevent, and it
# is invisible to a student who is looking at their application rather than at their draft.
#
# Only BLOCKER gates become items, and only for an essay attached to this application. WAITING gates ("not
# assessed yet") are not failures and are deliberately silent: an application page that lists everything not
# yet checked is a to-do list for the reviewer, not a quality check for the applicant.

GATE_ITEM = {
    # gate key            → (strategy code,            severity,  owner,       rank)
    "NAMES": ("ESSAY_WRONG_NAME", "blocker", "student", 6),
    "WORD_LIMIT": ("ESSAY_OVER_LIMIT", "blocker", "student", 8),
    "PROMPT_ANSWERED": ("ESSAY_PROMPT_GAP", "blocker", "student", 10),
    "PROFILE_CONSISTENCY": ("ESSAY_CONTRADICTS_PROFILE", "blocker", "student", 12),
}
# English fallbacks only; clients translate `success:item.<code>.*` like every other strategy item.
GATE_TITLE = {
    "ESSAY_WRONG_NAME": ("{label} names the wrong university",
                         "An essay addressed to another university is the most common avoidable rejection."),
    "ESSAY_OVER_LIMIT": ("{label} is over the length the university allows",
                         "Over-length essays are often cut off or returned unread."),
    "ESSAY_PROMPT_GAP": ("{label} does not answer part of the prompt", "The university scores each part of its question."),
    "ESSAY_CONTRADICTS_PROFILE": ("{label} says something your documents do not",
                                  "A reviewer who finds one contradiction re-checks everything else."),
}


def application_quality_items(db: Session, essay: Essay) -> list[dict]:
    """Essay quality-gate blockers, as application-quality items (`strategy.EssayHook`)."""
    if essay.status in (E.DRAFT,):
        # Nothing has been assessed yet; "write it" is already an item on the application.
        return []
    try:
        gate = quality_gate(db, essay, for_student=True)
    except Exception:  # never let a quality check break the application page
        return []
    label = essay.title or essay.essay_type.value.replace("_", " ").capitalize()
    out: list[dict] = []
    for g in gate["items"]:
        if g["state"] != "BLOCKER" or g["key"] not in GATE_ITEM:
            continue
        code, severity, owner, rank = GATE_ITEM[g["key"]]
        title, why = GATE_TITLE[code]
        out.append({
            "code": code, "severity": severity, "owner": owner, "_rank": rank,
            "title": title.format(label=label), "why": why,
            "params": {"label": label, "essay_id": str(essay.id), "gate": g["key"],
                       "reasons": [r.get("code") for r in g["reasons"] if r.get("code")]},
            "action": {"code": "OPEN_ESSAY", "label": "Open the draft", "link": f"/essays/{essay.id}"},
        })
    return out



strategy.register_essay_hook(application_quality_items)
