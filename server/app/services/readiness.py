"""Profile completion, document checklists (with reuse across applications), legalization paths, readiness."""
from datetime import date

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from app.models import (
    Application,
    Country,
    Document,
    DocumentRequirement,
    Essay,
    LegalizationRule,
    Program,
    StudentProfile,
    University,
)
from app.models.enums import DocumentStatus, EssayStatus, LegalizationPath, LegalizationStatus

# Review target for a document waiting for its first check (same 48 h the agency review queue uses as its SLA).
REVIEW_TARGET_HOURS = 48

STATUS_RANK = {
    DocumentStatus.VERIFIED: 6,
    DocumentStatus.NEEDS_REVIEW: 5,
    DocumentStatus.PROCESSING: 4,
    DocumentStatus.UPLOADED: 4,
    DocumentStatus.NEEDS_CORRECTION: 2,
    DocumentStatus.EXPIRED: 1,
    DocumentStatus.MISSING: 0,
}


def profile_steps(profile: StudentProfile | None) -> list[dict]:
    p = profile
    steps = [
        ("basics", bool(p and p.nationality and p.residence_country and p.date_of_birth)),
        ("goals", bool(p and p.target_degree and p.target_intake_year and p.desired_fields)),
        ("education", bool(p and p.educations and any(e.gpa_percent is not None for e in p.educations))),
        ("language", bool(p and (p.languages or p.korean_self_level))),
        ("preferences", bool(p and p.annual_budget_krw and p.housing_preference)),
        ("passport", bool(p and p.has_passport is not None and (not p.has_passport or p.passport_expiry))),
        ("sponsor", bool(p and p.financial_sponsor)),
    ]
    return [{"key": k, "done": d} for k, d in steps]


def profile_percent(profile: StudentProfile | None) -> int:
    steps = profile_steps(profile)
    return round(100 * sum(s["done"] for s in steps) / len(steps))


# How long after an accession the product keeps explaining that the rule changed (V13, brief Part 17).
#
# This was 365 days, which is about how long a *consular-legalised document* stays in circulation — and that
# is not what the note is for. The note exists because applicants are advised by people who went through the
# process before the change: an older sibling, a cousin, an agent with a folder of printed checklists. That
# advice has a much longer half-life than a transcript.
#
# Measured against the fourteen priority markets on 2026-10-18, a 365-day window fired for Vietnam (37 days)
# and for nobody else, while Bangladesh (567 days), China (1,076) and Pakistan (1,319) are all recent enough
# that an applicant's informal advice reliably predates the change. Three years covers those three and stops
# short of accessions old enough that nobody remembers the other way (Indonesia 2022 and earlier).
APOSTILLE_NOTE_DAYS = 3 * 365


def _accession_note(country, today) -> tuple[str | None, str | None]:
    """"The rule changed on this date" — independent of which source decided the path (V13).

    This used to be computed only on the Country fallback branch, so a country with an explicit
    `LegalizationRule` row silently lost it. China is the case that exposed it: it has an explicit APOSTILLE
    rule *and* an accession date 1,076 days old, and it is the market in this product with the largest budgets
    and the most second-hand advice. Whether the path came from a verified rule or from Hague membership has
    nothing to do with whether an applicant has been told the old thing by their cousin.
    """
    if country is None or not country.apostille_member or not country.apostille_effective_from:
        return None, None
    eff = country.apostille_effective_from
    if eff > today:
        return (f"{country.name_en} joins the Apostille Convention on {eff.isoformat()}; "
                "until then documents need Korean consular confirmation."), "JOINS"
    if (today - eff).days < APOSTILLE_NOTE_DAYS:
        return (f"{country.name_en} joined the Apostille Convention on {eff.isoformat()}. "
                "Documents legalized by the consulate before that date are generally still accepted — "
                "confirm with your university."), "JOINED"
    return None, None


def legalization_for(
    db: Session, issuing_country: str | None, category: str | None, university_id=None
) -> dict:
    """Most specific rule wins; falls back to Hague Apostille membership from the Country table."""
    if not issuing_country:
        return {"path": "UNKNOWN", "steps": [], "note": "Tell us which country issued this document.", "verified": False}
    if issuing_country == "KR":
        return {"path": LegalizationPath.NONE.value, "steps": [], "note": "Issued in Korea — no legalization needed.", "verified": True}
    rules = db.scalars(
        select(LegalizationRule).where(
            or_(LegalizationRule.issuing_country == issuing_country, LegalizationRule.issuing_country.is_(None))
        )
    ).all()

    def specificity(r: LegalizationRule) -> int:
        s = 0
        if r.issuing_country == issuing_country:
            s += 4
        if r.document_category and r.document_category == category:
            s += 2
        elif r.document_category:
            return -1
        if r.university_id and r.university_id == university_id:
            s += 1
        elif r.university_id:
            return -1
        return s

    ranked = sorted([r for r in rules if specificity(r) >= 0], key=specificity, reverse=True)
    if ranked and ranked[0].issuing_country == issuing_country:
        r = ranked[0]
        c = db.get(Country, issuing_country)
        # A verified rule's own note is richer than a membership date and must not be displaced by one. The
        # client renders `legalFlow.note.<code>` *instead of* `note` whenever a code is present, so a code is
        # only attached here when the rule has nothing of its own to say — otherwise setting it would throw
        # away the better sentence. China is the live example: its rule already explains the 2023 accession
        # and what universities still accept, in more detail than the generic note could.
        acc_note, acc_code = (None, None) if r.consulate_note else _accession_note(c, date.today())
        return {
            "path": r.path.value,
            "requires_notarization": r.requires_notarization,
            "requires_translation": r.requires_translation,
            "steps": r.steps,
            "note": r.consulate_note or acc_note,
            "note_code": acc_code,
            "note_params": {"country": c.code, "date": c.apostille_effective_from.isoformat()} if acc_code and c else {},
            "verified": r.verification_status.value == "CURRENT",
            "verification_status": r.verification_status.value,
            "verified_at": r.verified_at.isoformat() if r.verified_at else None,
        }
    country = db.get(Country, issuing_country)
    if country is None or country.apostille_member is None:
        return {"path": "UNKNOWN", "steps": [], "note": "We have not verified the legalization route for this country yet — your counselor will confirm.",
                "note_code": "UNVERIFIED", "note_params": {}, "verified": False}
    today = date.today()
    in_force = bool(country.apostille_member) and (country.apostille_effective_from is None or country.apostille_effective_from <= today)
    path = LegalizationPath.APOSTILLE if in_force else LegalizationPath.CONSULAR_LEGALIZATION
    # note_code + note_params: translatable form of the English note (V5 i18n); one source of truth (V13).
    note_params = {"country": country.code, "date": country.apostille_effective_from.isoformat() if country.apostille_effective_from else None}
    transition_note, note_code = _accession_note(country, today)
    steps = [
        {"key": "original", "title": "Get the official original (or certified copy) from the issuer"},
        {"key": "notarize", "title": "Notarize the copy if the issuing authority requires it"},
    ]
    if path == LegalizationPath.APOSTILLE:
        steps.append({"key": "apostille", "title": f"Obtain an apostille from the competent authority in {country.name_en}"})
    else:
        steps += [
            {"key": "mofa", "title": f"Authenticate at the Ministry of Foreign Affairs of {country.name_en}"},
            {"key": "consular", "title": f"Consular confirmation at the Korean embassy/consulate in {country.name_en}"},
        ]
    steps.append({"key": "translation", "title": "Certified translation into Korean or English if the document is in another language"})
    steps.append({"key": "verify", "title": "Upload for Hangyul verification"})
    return {
        "path": path.value,
        "requires_notarization": False,
        "requires_translation": True,
        "steps": steps,
        "note": transition_note,
        "note_code": note_code,
        "note_params": note_params if note_code else None,
        "effective_from": country.apostille_effective_from.isoformat() if country.apostille_effective_from else None,
        "verified": country.apostille_verified_at is not None,
        "verified_at": country.apostille_verified_at.isoformat() if country.apostille_verified_at else None,
        "source_url": country.apostille_source_url,
    }


def review_is_overdue(waiting_since, now=None) -> bool:
    """True when a document has waited for its first review longer than REVIEW_TARGET_HOURS."""
    from app.models.base import utcnow  # local import keeps this module's import graph unchanged

    now = now or utcnow()
    return (now - waiting_since).total_seconds() > REVIEW_TARGET_HOURS * 3600


def requirements_for(db: Session, program: Program, nationality: str | None, memo: dict | None = None) -> list[DocumentRequirement]:
    """V27 (REPORT §357): the requirements of the latest VERIFIED official guide for this university and level, and
    nothing else. No verified guide → an empty list; the application is ADMISSION_GUIDE_REVIEW_REQUIRED
    (`services/guides.py`). Seeded sample rows never build a checklist again.

    V26 (REPORT §344): `memo` is a per-call cache a bulk caller (priority.collect) passes so the same programme's
    requirements, a student's documents and essays are read once, not once per application."""
    from app.services.guides import applies, guide_requirements, verified_guide

    key = ("reqs", program.id, nationality)
    if memo is not None and key in memo:
        return memo[key]
    guide = verified_guide(db, program, memo)
    out = [r for r in guide_requirements(db, guide, memo) if applies(r, nationality) is not False] if guide else []
    if memo is not None:
        memo[key] = out
    return out


def treatment(db: Session, r: DocumentRequirement, doc: Document | None, nationality: str | None, today: date, memo: dict | None = None) -> dict:
    """V27 (REPORT §357, brief §19): what this document needs before the university will take it, decided on the
    server. The guide says *whether* legalization applies; the issuing country and today's date decide *which*
    (`dossier.route_for`, time-aware Hague membership). Before upload the student's nationality stands in for the
    issuing country and the answer says so (`country_basis`)."""
    from app.services.dossier import route_for

    country = (doc.issuing_country if doc and doc.issuing_country else None) or nationality
    basis = "document" if doc and doc.issuing_country else ("nationality" if nationality else None)
    rule = r.legalization_rule or ("APOSTILLE_OR_CONSULAR" if r.legalization_required else None)
    legal = "NONE" if rule == "NOT_REQUIRED" else ("UNSPECIFIED" if rule is None else "STAFF_REVIEW")
    if rule in ("APOSTILLE_OR_CONSULAR", "CHINA_CHSI") and country:
        cache = memo.setdefault(("routes",), {}) if memo is not None else None
        path = route_for(db, country, r.category.value, today, cache)["path"]
        legal = {"APOSTILLE": "APOSTILLE", "CONSULAR_LEGALIZATION": "CONSULAR", "NONE": "NONE"}.get(path, "STAFF_REVIEW")
        if rule == "CHINA_CHSI" and legal != "NONE":
            legal = "CHINA_CHSI"
    done = bool(doc and doc.legalization_status == LegalizationStatus.COMPLETED)
    return {"legalization": legal, "legalization_done": done, "translation": bool(r.translation_required),
            "notarization": bool(r.notarization_required), "country": country, "country_basis": basis}


#: A guide asking for "a language certificate" is met by whichever language result the student uploaded.
LANGUAGE_DOCS = ("TOPIK", "IELTS", "TOEFL")


def profile_facts(profile: StudentProfile | None) -> dict:
    """What a guide's `applies_to` can be decided against. Unknown stays None — the item is then shown as conditional."""
    if profile is None:
        return {}
    edu = sorted(profile.educations or [], key=lambda e: (e.graduation_date or date.min) if hasattr(e, "graduation_date") else date.min)
    return {"education_country": edu[-1].country if edu else None, "residence_country": profile.residence_country}


def checklist(db: Session, student_user_id, program: Program, university: University, nationality: str | None, today: date, memo: dict | None = None,
              facts: dict | None = None) -> list[dict]:
    from app.services.guides import applies

    reqs = requirements_for(db, program, nationality, memo)
    decided = {r.id: applies(r, nationality, facts) for r in reqs}
    reqs = [r for r in reqs if decided[r.id] is not False]
    if memo is not None and ("docs", student_user_id) in memo:
        docs = memo[("docs", student_user_id)]
    else:
        docs = db.scalars(select(Document).where(Document.owner_user_id == student_user_id)).all()
        if memo is not None:
            memo[("docs", student_user_id)] = docs
    by_cat: dict[str, list[Document]] = {}
    for d in docs:
        by_cat.setdefault(d.category.value, []).append(d)
    items = []
    for r in reqs:
        cats = LANGUAGE_DOCS if r.category.value == "LANGUAGE_CERTIFICATE" else (r.category.value,)
        pool = [d for c in cats for d in by_cat.get(c, [])]
        candidates = sorted(pool, key=lambda d: STATUS_RANK.get(d.status, 0), reverse=True)
        doc = candidates[0] if candidates else None
        status = doc.status if doc else DocumentStatus.MISSING
        if doc and doc.expires_on and doc.expires_on < today:
            status = DocumentStatus.EXPIRED
        action_code, action = None, None
        uni = university.name_en
        # V5 i18n: `action` stays the English fallback; clients translate from action_code + action_params.
        action_params: dict = {"university": uni}
        if status == DocumentStatus.MISSING:
            action_code, action = "UPLOAD", f"Upload your {r.label.lower()} for {uni}."
        elif status == DocumentStatus.EXPIRED:
            action_code, action = "RENEW", f"Your {r.label.lower()} has expired — upload a current one."
        elif status == DocumentStatus.NEEDS_CORRECTION:
            action_code, action = "FIX", doc.rejection_reason or f"Your {r.label.lower()} needs a correction."
            action_params["reason"] = doc.rejection_reason  # the reviewer's own words (user content)
        elif r.legalization_required and doc and doc.legalization_status not in (LegalizationStatus.COMPLETED, LegalizationStatus.NOT_REQUIRED):
            path = "an apostille" if doc.legalization_path == LegalizationPath.APOSTILLE else "consular legalization"
            action_code, action = "LEGALIZE", f"This {r.label.lower()} needs {path} before it can be used for {uni}'s application."
            action_params.update(path_code=doc.legalization_path.value if doc.legalization_path else None, country=doc.issuing_country)
        elif r.max_age_days and doc and doc.issue_date and (today - doc.issue_date).days > r.max_age_days:
            action_code, action = "TOO_OLD", f"{uni} needs this {r.label.lower()} to be issued within {r.max_age_days} days."
            action_params.update(days=r.max_age_days, issued=doc.issue_date.isoformat())
        elif status in (DocumentStatus.UPLOADED, DocumentStatus.NEEDS_REVIEW, DocumentStatus.PROCESSING):
            action_code, action = "IN_REVIEW", "Being reviewed — nothing to do right now."
        ready = status == DocumentStatus.VERIFIED and action_code is None
        # V4: time is information — a review past its target is said honestly, never "usually within 2 working days".
        review_since = review_overdue = None
        if action_code == "IN_REVIEW" and doc and doc.updated_at:
            review_since = doc.updated_at.isoformat()
            review_overdue = review_is_overdue(doc.updated_at)
        items.append(
            {
                "requirement_id": str(r.id),
                "category": r.category.value,
                "label": r.label,
                "required": r.is_required,
                "legalization_required": r.legalization_required,
                "translation_required": r.translation_required,
                "notes": r.notes,
                "document_id": str(doc.id) if doc else None,
                "status": status.value,
                "ready": ready,
                "reused": bool(doc and doc.reusable),
                "action_code": action_code,
                "action": action,
                "action_params": action_params if action_code else None,
                "verification_status": r.verification_status,
                # V27: what the official guide says, with its evidence — for the student's row and the agency drawer.
                "name_ko": r.name_ko,
                "condition": r.condition,
                # None = the guide's condition could not be decided from the profile (shown as "if this applies to you").
                "applies": decided[r.id],
                "original_or_copy": r.original_or_copy,
                "submission_method": r.submission_method,
                "notarization_required": r.notarization_required,
                "legalization_rule": r.legalization_rule,
                "max_age_days": r.max_age_days,
                "treatment": treatment(db, r, doc, nationality, today, memo),
                "source": {"url": r.source_url, "page": r.source_page, "evidence": r.evidence,
                           "verified_at": r.verified_at.date().isoformat() if r.verified_at else None} if r.guide_id else None,
                "review_since": review_since,
                "review_overdue": review_overdue,
            }
        )
    # V5 writing: an essay-backed requirement (personal statement, study plan…) is fulfilled by the essay's APPROVED
    # version — the application uses exactly that version (services/writing.py).
    from app.services.writing import apply_essay_versions  # local import: keeps this module's import graph unchanged

    return apply_essay_versions(db, student_user_id, program, items, memo)


def application_readiness(db: Session, app: Application, profile: StudentProfile | None, today: date, memo: dict | None = None) -> tuple[int, list[dict]]:
    program = db.get(Program, app.program_id)
    university = db.get(University, app.university_id)
    items = checklist(db, app.student_user_id, program, university, profile.nationality if profile else None, today, memo,
                      facts=profile_facts(profile))
    required = [i for i in items if i["required"]]
    # Documents a university has explicitly asked for count as required and not yet ready until fulfilled.
    from app.models import DocumentRequest  # local import: model module is newer than this service

    if memo is not None and ("open_requests", app.id) in memo:
        open_requests = memo[("open_requests", app.id)]
    else:
        open_requests = db.scalar(select(func.count()).select_from(DocumentRequest).where(DocumentRequest.application_id == app.id, DocumentRequest.status == "OPEN")) or 0
    denominator = len(required) + open_requests
    docs_ratio = (sum(i["ready"] for i in required) / denominator) if denominator else 1.0
    # V27: no verified guide → the document share is unknown, never "complete" (REPORT §357).
    if not items and program is not None:
        from app.services.guides import PREPARING, verified_guide

        status = app.status.value if hasattr(app.status, "value") else str(app.status)
        if status in PREPARING and verified_guide(db, program, memo) is None:
            docs_ratio = 0.0
    if memo is not None and ("app_essays", app.id) in memo:
        essays = memo[("app_essays", app.id)]
    else:
        essays = db.scalars(select(Essay).where(Essay.application_id == app.id)).all()
    essay_ratio = (sum(e.status == EssayStatus.APPROVED for e in essays) / len(essays)) if essays else 1.0
    pct = round(100 * (0.2 * profile_percent(profile) / 100 + 0.6 * docs_ratio + 0.2 * essay_ratio))
    return pct, items


def warm_memo(db: Session, apps: list[Application], profiles: dict, memo: dict) -> None:
    """V26 (REPORT §344): fills `memo` for many applications with a few bulk queries, so `application_readiness(…, memo)`
    inside a loop issues none. Each entry holds exactly what the per-application path would have read."""
    from app.models import DocumentRequest, EssayReview

    if not apps:
        return
    app_ids = [a.id for a in apps]
    sids = {a.student_user_id for a in apps}
    programs = {pid: db.get(Program, pid) for pid in {a.program_id for a in apps}}
    # documents per student
    by_owner: dict = {sid: [] for sid in sids}
    for d in db.scalars(select(Document).where(Document.owner_user_id.in_(sids))).all():
        by_owner.setdefault(d.owner_user_id, []).append(d)
    for sid, docs in by_owner.items():
        memo.setdefault(("docs", sid), docs)
    # requirements per (programme, nationality) — through requirements_for itself, whose guide lookups share this memo
    for a in apps:
        prof = profiles.get(a.student_user_id)
        requirements_for(db, programs[a.program_id], prof.nationality if prof else None, memo)
    # essays: per application, and per (student, programme) for the essay-backed requirements; approved version per essay
    essays = db.scalars(select(Essay).where(or_(Essay.application_id.in_(app_ids),
                                                and_(Essay.owner_user_id.in_(sids), Essay.program_id.in_(list(programs)))))).all()
    for a in apps:
        memo.setdefault(("app_essays", a.id), [])
        memo.setdefault(("essays", a.student_user_id, a.program_id), [])
    for e in essays:
        if ("app_essays", e.application_id) in memo:
            memo[("app_essays", e.application_id)].append(e)
        if ("essays", e.owner_user_id, e.program_id) in memo:
            memo[("essays", e.owner_user_id, e.program_id)].append(e)
    reviews = {r.essay_id: r for r in db.scalars(select(EssayReview).where(EssayReview.essay_id.in_([e.id for e in essays]))).all()} if essays else {}
    for e in essays:
        r = reviews.get(e.id)
        memo.setdefault(("approved", e.id), r.approved_version if r and r.approved_version else (e.current_version if e.status == EssayStatus.APPROVED else None))
    # open university requests per application
    counts = dict(db.execute(select(DocumentRequest.application_id, func.count()).where(DocumentRequest.application_id.in_(app_ids), DocumentRequest.status == "OPEN")
                             .group_by(DocumentRequest.application_id)).all())
    for a in apps:
        memo.setdefault(("open_requests", a.id), counts.get(a.id, 0))


ESSAY_BACKED = {"PERSONAL_STATEMENT", "STUDY_PLAN", "CV", "RECOMMENDATION"}
_STUDENT_ESSAY = {EssayStatus.DRAFT, EssayStatus.CHANGES_REQUESTED, EssayStatus.STUDENT_REVISION}


def workspace_next(db: Session, app: Application, items: list[dict]) -> dict | None:
    """The single next thing the student should do for one application — the same rule as the student workspace
    (apps/student-web/src/lib/workspace.ts): university request → fix → revise essay → legalize/renew → upload → write essay.
    Home and the application page must name the same item."""
    from app.models import DocumentRequest

    req = db.scalars(select(DocumentRequest).where(DocumentRequest.application_id == app.id, DocumentRequest.status == "OPEN")
                     .order_by(DocumentRequest.created_at)).first()
    if req:
        return {"item": "REQUEST", "label": req.label, "category": req.category, "rank": 0}
    essays = db.scalars(select(Essay).where(Essay.application_id == app.id)).all()
    by_type = {e.essay_type.value: e for e in essays}
    used: set = set()
    found: list[dict] = []
    for i in items:
        if i["ready"] or i["action_code"] == "UNIVERSITY_REQUEST":
            continue
        essay = by_type.get(i["category"]) if i["category"] in ESSAY_BACKED else None
        if essay:
            used.add(essay.id)
        if essay and essay.status != EssayStatus.APPROVED and i["action_code"] in ("UPLOAD", None):
            if essay.status in _STUDENT_ESSAY:
                changes = essay.status != EssayStatus.DRAFT
                found.append({"item": "REVISE_ESSAY" if changes else "WRITE_ESSAY", "label": i["label"], "category": i["category"], "essay_id": str(essay.id), "rank": 2 if changes else 5})
            continue
        code = i["action_code"] or "UPLOAD"
        if code == "IN_REVIEW":
            continue
        rank = 1 if code == "FIX" else 3 if code in ("LEGALIZE", "RENEW", "TOO_OLD") else 4
        found.append({"item": code, "label": i["label"], "category": i["category"], "document_id": i["document_id"], "rank": rank})
    for e in essays:
        if e.id not in used and e.status in _STUDENT_ESSAY:
            changes = e.status != EssayStatus.DRAFT
            found.append({"item": "REVISE_ESSAY" if changes else "WRITE_ESSAY", "label": e.essay_type.value.replace("_", " ").capitalize(),
                          "essay_type": e.essay_type.value, "essay_id": str(e.id), "rank": 2 if changes else 5})
    return min(found, key=lambda f: f["rank"]) if found else None
