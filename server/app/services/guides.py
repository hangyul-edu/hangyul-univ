"""V27 — which official admission guide a checklist is built from (REPORT §357).

The rule this module exists to enforce: **a document checklist is generated only from the requirements of a VERIFIED
official guide.** Seeded sample requirements (``verification_status = 'DEMO'``) never build a checklist, and a
university with no verified guide for the level has none — its applications are ``ADMISSION_GUIDE_REVIEW_REQUIRED``
until Hangyul staff record the current guide.

States per application (``state_for``):

    CURRENT          a VERIFIED guide for exactly this intake (year + term)
    PREVIOUS_ROUND   the latest VERIFIED guide is for another round; the checklist uses it and says so, and the
                     guide is queued for review because the new round's guide may differ
    REVIEW_REQUIRED  no VERIFIED guide for this university and level (STALE / CONFLICT guides do not count)
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AdmissionGuide, Application, DocumentRequirement, Program, ProgramIntake

REVIEW_REQUIRED = "ADMISSION_GUIDE_REVIEW_REQUIRED"
#: Statuses at which an application is still being prepared — where a missing guide blocks the work.
PREPARING = ("DRAFT", "PROFILE_REVIEW", "DOCUMENT_PREPARATION", "READY")


def _level_key(program: Program) -> tuple[str, str]:
    level = program.degree_level.value if hasattr(program.degree_level, "value") else str(program.degree_level)
    return ("BACHELOR", "TRANSFER") if level == "TRANSFER" else (level, "FRESHMAN")


def verified_guide(db: Session, program: Program, memo: dict | None = None) -> AdmissionGuide | None:
    """The latest VERIFIED guide for the programme's university, level and applicant type."""
    level, applicant = _level_key(program)
    key = ("guide", program.university_id, level, applicant)
    if memo is not None and key in memo:
        return memo[key]
    rows = db.scalars(select(AdmissionGuide).where(AdmissionGuide.university_id == program.university_id,
                                                   AdmissionGuide.degree_level == level, AdmissionGuide.status == "VERIFIED")).all()
    rows = [g for g in rows if (g.applicant_type or "FRESHMAN") == applicant]
    order = {"SPRING": 1, "FALL": 2, "WINTER": 3, "SUMMER": 0}
    # Some guides are recorded once per track (Kyung Hee, Sogang). The document list is the student's checklist either
    # way; a track-neutral entry wins, then the Korean track — the route most applicants take (deterministic).
    track_pref = {None: 2, "ANY": 2, "KOREAN": 1}
    guide = max(rows, key=lambda g: (g.intake_year, order.get(g.term, 0), track_pref.get(g.track, 0)), default=None)
    if memo is not None:
        memo[key] = guide
    return guide


def guide_requirements(db: Session, guide: AdmissionGuide, memo: dict | None = None) -> list[DocumentRequirement]:
    key = ("guide_reqs", guide.id)
    if memo is not None and key in memo:
        return memo[key]
    rows = db.scalars(select(DocumentRequirement).where(DocumentRequirement.guide_id == guide.id)
                      .order_by(DocumentRequirement.sort_order)).all()
    if memo is not None:
        memo[key] = rows
    return rows


def applies(r: DocumentRequirement, nationality: str | None, facts: dict | None = None) -> bool | None:
    """True / False when the guide's condition can be decided from what we know, None when it cannot."""
    a = r.applies_to or {}
    facts = facts or {}
    if r.applies_to_nationalities and nationality and nationality not in r.applies_to_nationalities:
        return False
    if a.get("nationalities_not") and nationality in a["nationalities_not"]:
        return False
    undecided = False
    for key, fact in (("education_country", facts.get("education_country")), ("residence_country", facts.get("residence_country"))):
        want = a.get(key)
        if want is None:
            continue
        if fact is None:
            undecided = True
        elif fact not in (want if isinstance(want, list) else [want]):
            return False
    if a.get("education_country_not") and facts.get("education_country") in a["education_country_not"]:
        return False
    return None if undecided else True


def state_for(db: Session, app: Application, memo: dict | None = None) -> dict:
    program = db.get(Program, app.program_id)
    guide = verified_guide(db, program, memo) if program else None
    if guide is None:
        return {"state": "REVIEW_REQUIRED", "code": REVIEW_REQUIRED, "guide": None,
                "blocks": (app.status.value if hasattr(app.status, "value") else str(app.status)) in PREPARING}
    intake = db.get(ProgramIntake, app.intake_id) if getattr(app, "intake_id", None) else None
    same = intake is not None and intake.year == guide.intake_year and str(getattr(intake.term, "value", intake.term)) == guide.term
    return {"state": "CURRENT" if same else "PREVIOUS_ROUND", "code": None, "guide": ser_guide(guide), "blocks": False}


#: What a guide must carry before Hangyul presents an application as one it can manage now (V29 §32).
MANAGED_FIELDS = ("current_intake", "checklist", "deadline", "submission_method", "source_url", "verified_date")


def managed_support(db: Session, app: Application, memo: dict | None = None) -> dict:
    """``SUPPORTED`` only when the guide for exactly this intake is verified and complete; else the review state.

    The directory (425 institutions) is the discovery set; this is the **managed-application set**. A paid plan
    promises "up to N managed applications", not that every intake of every Korean university is already supported —
    so an application outside this set is routed to ``ADMISSION_GUIDE_REVIEW_REQUIRED`` and Hangyul operations
    (``review_queue``), and no surface says "we can manage this now" for it.
    """
    st = state_for(db, app, memo)
    program = db.get(Program, app.program_id)
    guide = verified_guide(db, program, memo) if program else None
    missing = []
    if st["state"] != "CURRENT":
        missing.append("current_intake")
    if guide is None:
        missing += [f for f in MANAGED_FIELDS if f != "current_intake"]
    else:
        if not guide_requirements(db, guide, memo):
            missing.append("checklist")
        if not (guide.application_closes or guide.document_deadline):
            missing.append("deadline")
        if not (guide.submission_channel or "").strip():
            missing.append("submission_method")
        if not (guide.source_url or guide.source_page_url):
            missing.append("source_url")
        if not guide.verified_at:
            missing.append("verified_date")
    return {"state": "SUPPORTED" if not missing else REVIEW_REQUIRED, "missing": missing}


def managed_set(db: Session) -> list[dict]:
    """Every (university, level, intake) whose current guide passes ``managed_support`` — for the release gate and docs."""
    out = []
    for g in db.scalars(select(AdmissionGuide).where(AdmissionGuide.status == "VERIFIED")):
        reqs = guide_requirements(db, g)
        ok = bool(reqs) and bool(g.application_closes or g.document_deadline) and bool((g.submission_channel or "").strip()) \
            and bool(g.source_url or g.source_page_url) and bool(g.verified_at)
        out.append({"university_id": str(g.university_id) if g.university_id else None, "degree_level": g.degree_level,
                    "applicant_type": g.applicant_type, "intake_year": g.intake_year, "term": g.term, "complete": ok,
                    "requirements": len(reqs)})
    return out


def ser_guide(g: AdmissionGuide) -> dict:
    return {"id": str(g.id), "title": g.title, "intake_year": g.intake_year, "term": g.term, "degree_level": g.degree_level,
            "applicant_type": g.applicant_type, "status": g.status, "source_url": g.source_url, "source_page_url": g.source_page_url,
            "publication_date": g.publication_date.isoformat() if g.publication_date else None,
            "verified_at": g.verified_at.date().isoformat() if g.verified_at else None,
            "application_opens": g.application_opens.isoformat() if g.application_opens else None,
            "application_closes": g.application_closes.isoformat() if g.application_closes else None,
            "document_deadline": g.document_deadline.isoformat() if g.document_deadline else None}


def review_queue(db: Session) -> list[dict]:
    """For Hangyul staff: every university × level with preparing applications and no VERIFIED guide, plus every
    guide whose status is STALE / CONFLICT / REVIEW_REQUIRED. Ordered by how many students are waiting."""
    from collections import Counter

    from app.models import University

    waiting: Counter = Counter()
    memo: dict = {}
    for a in db.scalars(select(Application)).all():
        status = a.status.value if hasattr(a.status, "value") else str(a.status)
        if status not in PREPARING:
            continue
        program = db.get(Program, a.program_id)
        if program and verified_guide(db, program, memo) is None:
            waiting[(program.university_id, _level_key(program))] += 1
    out = []
    for (uid, (level, applicant)), n in waiting.most_common():
        u = db.get(University, uid)
        out.append({"kind": "MISSING_GUIDE", "university_id": str(uid), "university": u.name_en if u else None,
                    "university_ko": u.name_ko if u else None, "degree_level": level, "applicant_type": applicant, "applications": n})
    for g in db.scalars(select(AdmissionGuide)).all():
        if g.status in ("STALE", "CONFLICT", "REVIEW_REQUIRED"):
            out.append({"kind": g.status, "guide": ser_guide(g), "conflicts": g.conflicts, "reviewer_note": g.reviewer_note})
        elif g.conflicts:
            out.append({"kind": "CONFLICT", "guide": ser_guide(g), "conflicts": g.conflicts, "reviewer_note": g.reviewer_note})
        elif g.reviewer_note:
            out.append({"kind": "SPOT_CHECK", "guide": ser_guide(g), "conflicts": None, "reviewer_note": g.reviewer_note})
    return out
