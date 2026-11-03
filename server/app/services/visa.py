"""Data-driven visa guidance. Hangyul never issues visas; this produces a checklist from VisaRequirement rules."""
import re

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models import VisaCase, VisaRequirement
from app.models.enums import DegreeLevel, VisaType

DEGREE_TO_VISA = {
    DegreeLevel.LANGUAGE: (VisaType.D4_1, "Korean language programs at a university language institute are non-degree study, generally D-4-1 (Korean language trainee)."),
    DegreeLevel.ASSOCIATE: (VisaType.D2_1, "Associate degree study is generally covered by D-2-1."),
    DegreeLevel.BACHELOR: (VisaType.D2_2, "Undergraduate degree study is generally covered by D-2-2."),
    DegreeLevel.TRANSFER: (VisaType.D2_2, "Undergraduate transfer is degree study, generally D-2-2."),
    DegreeLevel.MASTER: (VisaType.D2_3, "Master's degree study is generally covered by D-2-3."),
    DegreeLevel.DOCTORATE: (VisaType.D2_4, "Doctoral study is generally covered by D-2-4."),
    DegreeLevel.COMBINED: (VisaType.D2_4, "Integrated master's–doctorate study is generally covered by D-2-3/D-2-4; the university will confirm."),
}


def infer_visa(degree: DegreeLevel | None) -> tuple[VisaType, str]:
    if degree is None:
        return VisaType.OTHER, "Choose a program first — the visa category depends on the type of study."
    return DEGREE_TO_VISA[degree]


# V4 student presentation: a short requirement NAME (what to get), separate from the sourced rule text (why / how much).
STEP_NAMES = [
    ("admission_certificate", "Standard admission letter"),
    ("passport", "Passport"),
    ("application_form", "Visa application form and photo"),
    ("tuition_receipt", "Tuition payment receipt"),
    ("financial_proof", "Bank balance certificate"),
    ("family_relation", "Family relationship certificate"),
    ("final_education", "Final education certificate"),
    ("visa_application", "Visa application"),
    ("visa_issued", "Your issued visa"),
    ("residence_card", "Residence card"),
]
_REPORTED = re.compile(r"per the (?P<who>.+?) \(reported: (?P<what>.+?) — confirm before applying\)", re.I)


def step_presentation(step_key: str, title: str) -> dict:
    """{name, name_key, rule}: the name a student recognises and the rule as an explanation. Never changes the rule's facts."""
    name_key = next((k for k, _ in STEP_NAMES if step_key == k or step_key.startswith(k + "_")), None)
    name = dict(STEP_NAMES).get(name_key, title) if name_key else title
    m = _REPORTED.search(title)
    if m:
        rule = f"The {m.group('who')} asks for about {m.group('what')} — your counselor confirms the current amount before you apply."
    else:
        rule = title if title != name else None
    return {"name": name, "name_key": name_key, "rule": rule}


def visa_checklist(db: Session, case: VisaCase, nationality: str | None, *, use_routes: bool = True) -> list[dict]:
    """V5: when a researched embassy route resolves for the student (docs/VISA_ROUTES.md), the checklist is that route's
    documents with their dossier reuse status. Otherwise the generic rule rows below stay the fallback."""
    if use_routes and getattr(case, "student_user_id", None) is not None:
        from app.services.visa_routes import route_checklist

        routed = route_checklist(db, case)
        if routed is not None:
            return routed
    rows = db.scalars(
        select(VisaRequirement)
        .where(
            VisaRequirement.visa_type == case.visa_type,
            or_(VisaRequirement.nationality.is_(None), VisaRequirement.nationality == nationality),
        )
        .order_by(VisaRequirement.sort_order)
    ).all()
    specific = [r for r in rows if r.nationality]
    replaced = {r.replaces_step_key for r in specific if r.replaces_step_key}
    # Dependencies on a replaced generic step point at the nationality-specific step that replaces it.
    replacement = {r.replaces_step_key: r.step_key for r in specific if r.replaces_step_key}
    done = set(case.completed_steps or [])
    items = []
    for r in rows:
        if r.nationality is None and r.step_key in replaced:
            continue
        deps = [replacement.get(d, d) for d in (r.depends_on or [])]
        items.append(
            {
                "key": r.step_key,
                "title": r.title,
                "detail": r.detail,
                "document_category": r.document_category,
                "required": r.is_required,
                "done": r.step_key in done,
                "blocked": any(d not in done for d in deps),
                "depends_on": deps,
                "country_specific": r.nationality is not None,
                "source_url": r.source_url,
                "verified_at": r.verified_at.isoformat() if r.verified_at else None,
                "verification_status": r.verification_status,
                **step_presentation(r.step_key, r.title),
            }
        )
    return items
