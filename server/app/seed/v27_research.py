"""Load the V27 official-source research into the database (REPORT §355–§357).

Input: ``app/data/research/v27/facts/<slug>.json`` and ``guides/<slug>.json`` (contract: docs/qa/v27/research/BRIEF.md).
Every row written carries the source URL, the date it was read and ``verification_status``; nothing is defaulted
into existence — a field the evidence lacks stays null, and a file that is missing simply writes nothing.

Idempotent: each institution's V27 rows are replaced as a set, so re-running after a research refresh is the update.
The international facts and links are not written here; ``seed/institutions.load_enrichment`` merges them into the
institution's content record as ``intl`` so the directory, the detail page and the quick fit read one record.
"""

from __future__ import annotations

import json
import re
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models import (
    AdmissionGuide,
    AdmissionLanguageRule,
    DocumentRequirement,
    Institution,
    Scholarship,
    ScholarshipRule,
)
from app.models.enums import DocumentCategory, ScholarshipKind

ROOT = Path(__file__).resolve().parents[1] / "data" / "research" / "v27"
FACTS, GUIDES = ROOT / "facts", ROOT / "guides"

#: Research vocabulary → stored test code. "IELTS" in a guide means the academic module unless it says otherwise.
NO_REQUIREMENT = re.compile(r"no language (qualification|requirement|score)|not required|어학\s*(능력|성적)?\s*(기준|요건)?\s*(없음|불필요|미적용)", re.I)
RECOMMENDED = re.compile(r"recommended score|'recommended|recommended \d|권장", re.I)
TEST_ALIASES = {"IELTS": "IELTS_ACADEMIC", "TOEFL": "TOEFL_IBT", "TOPIK_PBT": "TOPIK", "SKA": "OTHER"}
#: Research category → DocumentCategory. A guide's 자기소개서 is the personal-statement document in the dossier.
CATEGORY = {
    "SELF_INTRODUCTION": "PERSONAL_STATEMENT", "ALIEN_REGISTRATION": "RESIDENCE_CARD",
    "EXPECTED_GRADUATION_CERTIFICATE": "EXPECTED_GRADUATION_CERTIFICATE",
}
LEVEL_FOR_TOPIK_DEFAULT = None


def _d(v: str | None) -> date | None:
    try:
        return date.fromisoformat(v[:10]) if v else None
    except ValueError:
        return None


def _num(v: Any) -> float | None:
    if v is None:
        return None
    m = re.search(r"\d+(?:\.\d+)?", str(v))
    return float(m.group()) if m else None


_ENGLISH_PATTERNS = (
    ("TOEFL_IBT", r"TOEFL(?:\s*i?BT)?\D{0,12}?(\d{2,3})"), ("IELTS_ACADEMIC", r"IELTS\D{0,12}?(\d(?:\.\d)?)"),
    ("NEW_TEPS", r"New\s*TEPS\D{0,12}?(\d{3})"), ("TEPS", r"(?<!New )TEPS\D{0,12}?(\d{3})"), ("TOEIC", r"TOEIC\D{0,12}?(\d{3})"),
)


def english_min(v: Any) -> dict | None:
    """``{"TOEFL_IBT": 80}`` as given, or parsed from the source's sentence (kept under ``text``). A sentence nothing
    can be parsed from stays as ``{"text": …}`` — an unknown condition, which the fit never counts as met."""
    if not v:
        return None
    if isinstance(v, dict):
        out = {TEST_ALIASES.get(k.upper(), k.upper()): _num(x) for k, x in v.items() if _num(x) is not None}
        return out or None
    text = str(v)
    out: dict = {}
    for code, pat in _ENGLISH_PATTERNS:
        m = re.search(pat, text, re.I)
        if m:
            out[code] = float(m.group(1))
    out["text"] = text[:300]
    return out


def _bool(v: Any) -> bool | None:
    if v is None or isinstance(v, bool):
        return v
    return bool(str(v).strip()) and str(v).strip().lower() not in ("no", "false", "없음", "미지원")


def _src(doc: dict, sid: str | None) -> dict:
    for s in doc.get("sources") or []:
        if s.get("id") == sid:
            return s
    return {}


def _cut(v: Any, n: int = 300) -> str | None:
    return str(v)[:n] if v not in (None, "") else None


def _ts(doc: dict) -> datetime:
    d = _d(doc.get("researched_at")) or date.today()
    return datetime(d.year, d.month, d.day, tzinfo=timezone.utc)


def read_all(kind: str) -> dict[str, dict]:
    folder = FACTS if kind == "facts" else GUIDES
    if not folder.exists():
        return {}
    out = {}
    for p in sorted(folder.glob("*.json")):
        try:
            doc = json.loads(p.read_text(encoding="utf-8"))
        except ValueError:
            continue
        out[doc.get("slug") or p.stem] = doc
    return out


# ------------------------------------------------------------------------------------------- language rules

def _load_rules(db: Session, inst: Institution, doc: dict) -> int:
    db.execute(delete(AdmissionLanguageRule).where(AdmissionLanguageRule.institution_id == inst.id))
    n = 0
    for r in doc.get("language_rules") or []:
        test = TEST_ALIASES.get(str(r.get("test") or "").upper(), str(r.get("test") or "").upper())
        if not test or not r.get("degree") or not r.get("evidence"):
            continue
        src = _src(doc, r.get("source"))
        # "No language qualification required" is stated as a rule; it is stored as one, so the fit can say "met".
        # A score the guide calls *recommended* is not a minimum: the test is asked for, any result counts (KAIST, POSTECH).
        recommended = bool(RECOMMENDED.search(f"{r.get('note') or ''}")) and r.get("min") not in (None, "")
        if test == "OTHER" and r.get("min") in (None, "") and NO_REQUIREMENT.search(f"{r.get('note') or ''} {r.get('evidence') or ''}"):
            test = "NONE_REQUIRED"
        db.add(AdmissionLanguageRule(
            institution_id=inst.id, degree_level=r["degree"], track=r.get("track") or "ANY", group_key=str(r.get("group") or "A")[:8],
            test=test, min_value=None if recommended else _num(r.get("min")),
            min_text=None if recommended else (str(r["min"])[:80] if r.get("min") is not None else None),
            stage=r.get("stage") or "APPLICATION", note=r.get("note"), evidence=r.get("evidence"),
            source_url=src.get("url"), source_name=src.get("name"), verified_at=_ts(doc), verification_status="CURRENT",
        ))
        n += 1
    return n


# ------------------------------------------------------------------------------------------- scholarships

def _load_scholarships(db: Session, inst: Institution, doc: dict) -> int:
    old = db.scalars(select(Scholarship).where(Scholarship.institution_id == inst.id)).all()
    for s in old:
        db.delete(s)
    rows = [s for s in doc.get("scholarships") or [] if s.get("name") and s.get("evidence")]
    if rows and inst.catalog_university_id:
        # The catalogue's seeded sample schemes for this university are retired the moment verified ones exist,
        # so no signed-in view mixes a sample scheme with a verified one (REPORT §355).
        for s in db.scalars(select(Scholarship).where(Scholarship.university_id == inst.catalog_university_id,
                                                      Scholarship.verification_status == "DEMO")).all():
            db.delete(s)
    db.flush()
    for s in rows:
        src = _src(doc, s.get("source"))
        eng = english_min(s.get("english"))
        row = Scholarship(
            institution_id=inst.id, university_id=inst.catalog_university_id,
            kind=ScholarshipKind.GOVERNMENT if s.get("category") == "GKS" else ScholarshipKind.UNIVERSITY,
            name=str(s["name"])[:200], name_en=s.get("name_en"),
            name_native=_cut(s.get("name_native")), name_official_en=_cut(s.get("name_official_en")),
            name_display_ko=_cut(s.get("name_display_ko")), display_is_description=_bool(s.get("display_is_description")), provider=(src.get("name") or inst.name_ko)[:200],
            description=None, coverage=None, category=s.get("category"), stage=s.get("stage"),
            international_only=_bool(s.get("international_only")), topik_min=int(_num(s["topik_min"])) if _num(s.get("topik_min")) else None,
            english_min=eng or None, gpa_requirement=_cut(s.get("gpa_requirement")), gpa_min_percent=_num(s.get("gpa_min_percent")),
            tuition_waiver_percent_min=int(_num(s["tuition_waiver_percent_min"])) if _num(s.get("tuition_waiver_percent_min")) is not None else None,
            tuition_waiver_percent_max=int(_num(s["tuition_waiver_percent_max"])) if _num(s.get("tuition_waiver_percent_max")) is not None else None,
            amount_krw=int(_num(s["amount_krw"])) if _num(s.get("amount_krw")) else None,
            degree_levels=s.get("degree_levels") or None, is_automatic=bool(s.get("automatic")),
            dormitory_support=_bool(s.get("dormitory_support")),
            living_allowance=(None if s.get("living_allowance") in (None, False) else ("yes" if s.get("living_allowance") is True else str(s["living_allowance"])[:300])),
            duration=_cut(s.get("duration")), renewal=_cut(s.get("renewal"), 500), application_period=_cut(s.get("application_period")),
            department_restriction=_cut(s.get("department_restriction")), nationality_restriction=_cut(s.get("nationality_restriction")),
            evidence=s.get("evidence"), source_url=src.get("url"), source_name=src.get("name"), verified_at=_ts(doc),
            verification_status="CURRENT",
        )
        db.add(row)
        db.flush()
        # The signed-in engine reads ScholarshipRule; write the same conditions there so both read one source.
        if row.topik_min:
            db.add(ScholarshipRule(scholarship_id=row.id, field="topik_level", operator="gte", value=str(row.topik_min),
                                   description=f"TOPIK {row.topik_min}+"))
        if row.gpa_min_percent is not None:
            db.add(ScholarshipRule(scholarship_id=row.id, field="gpa_percent", operator="gte", value=str(row.gpa_min_percent),
                                   description=f"GPA {row.gpa_min_percent}%+"))
        if row.degree_levels:
            db.add(ScholarshipRule(scholarship_id=row.id, field="degree_level", operator="in", value=json.dumps(row.degree_levels),
                                   description="Study level"))
    return len(rows)


# ------------------------------------------------------------------------------------------- admission guides

#: Submission method as stored (12 chars): UPLOAD · MAIL · IN_PERSON · ONLINE (a form filled on the application site,
#: including a recommender's online form) · UPLOAD_MAIL (upload now, post the original afterwards).
SUBMISSION = {"UPLOAD_THEN_MAIL_ORIGINAL": "UPLOAD_MAIL", "ONLINE_FORM": "ONLINE", "ONLINE_BY_RECOMMENDER": "ONLINE",
              "MAIL_TO_COLLEGE": "MAIL"}


def _submission(v: str | None) -> str | None:
    if not v:
        return None
    v = str(v).upper()
    v = SUBMISSION.get(v, v)
    for k in ("UPLOAD_MAIL", "IN_PERSON", "UPLOAD", "MAIL", "ONLINE"):
        if v.startswith(k):
            return k
    return None


def _category(c: str | None) -> str:
    c = (c or "OTHER").upper()
    c = CATEGORY.get(c, c)
    return c if c in DocumentCategory.__members__ else "OTHER"


def _load_guides(db: Session, inst: Institution, doc: dict) -> tuple[int, int]:
    for g in db.scalars(select(AdmissionGuide).where(AdmissionGuide.institution_id == inst.id)).all():
        db.execute(delete(DocumentRequirement).where(DocumentRequirement.guide_id == g.id))
        db.delete(g)
    db.flush()
    guides = reqs = 0
    for g in doc.get("guides") or []:
        if not g.get("intake_year") or not g.get("degree_level") or not g.get("source_url"):
            continue
        status = g.get("status") if g.get("status") in ("VERIFIED", "STALE", "REVIEW_REQUIRED", "CONFLICT") else "REVIEW_REQUIRED"
        # A recorded conflict does not withdraw the guide: the freshest official rule stays in use (the conflicting item
        # itself is left out by the research contract) and the conflict goes to the staff review queue (brief §16).
        row = AdmissionGuide(
            institution_id=inst.id, university_id=inst.catalog_university_id, intake_year=int(g["intake_year"]),
            term=(g.get("term") or "SPRING").upper(), degree_level=g["degree_level"], applicant_type=g.get("applicant_type") or "FRESHMAN",
            track=g.get("track"), status=status, title=g.get("title"), source_document=g.get("source_document"),
            source_page_url=g.get("source_page_url"), publication_date=_d(g.get("publication_date")),
            application_opens=_d(g.get("application_opens")), application_closes=_d(g.get("application_closes")),
            document_deadline=_d(g.get("document_deadline")), submission_channel=g.get("submission_channel"),
            notes=g.get("notes") or None, conflicts=g.get("conflicts") or None, language_rules=g.get("language_rules") or None,
            reviewer_note=g.get("reviewer_note"),
            source_url=g["source_url"], verified_at=_ts(doc), verification_status="CURRENT" if status == "VERIFIED" else status,
        )
        db.add(row)
        db.flush()
        guides += 1
        for n, r in enumerate(g.get("requirements") or []):
            if not r.get("evidence") or not (r.get("name") or r.get("name_en")):
                continue
            nat = (r.get("applies_to") or {}).get("nationalities")
            db.add(DocumentRequirement(
                university_id=inst.catalog_university_id, guide_id=row.id, degree_level=g["degree_level"],
                category=DocumentCategory(_category(r.get("category"))),
                label=(r.get("name_en") or r.get("name"))[:200], name_ko=r.get("name"),
                is_required=(r.get("required") or "REQUIRED") == "REQUIRED", condition=r.get("condition"),
                applies_to=r.get("applies_to") or None, applies_to_nationalities=nat or None,
                original_or_copy=r.get("original_or_copy"), submission_method=_submission(r.get("submission")),
                translation_required=bool(r.get("translation_required")), notarization_required=bool(r.get("notarization_required")),
                legalization_required=r.get("legalization") in ("APOSTILLE_OR_CONSULAR", "CHINA_CHSI"),
                legalization_rule=r.get("legalization"), max_age_days=int(_num(r["issuance_max_age_days"])) if _num(r.get("issuance_max_age_days")) else None,
                source_page=(str(r.get("source_page"))[:60] if r.get("source_page") else None), evidence=r.get("evidence"),
                source_url=g["source_url"], verified_at=_ts(doc), verification_status=row.verification_status, sort_order=n,
            ))
            reqs += 1
    return guides, reqs


def load(db: Session) -> dict:
    """Write every research file into its tables. Returns counts for the log and the report."""
    by_slug = {i.slug: i for i in db.scalars(select(Institution)).all()}
    out = {"rules": 0, "scholarships": 0, "guides": 0, "requirements": 0, "institutions": 0, "unknown_slugs": []}
    for slug, doc in read_all("facts").items():
        inst = by_slug.get(slug)
        if inst is None:
            out["unknown_slugs"].append(slug)
            continue
        out["institutions"] += 1
        out["rules"] += _load_rules(db, inst, doc)
        out["scholarships"] += _load_scholarships(db, inst, doc)
    for slug, doc in read_all("guides").items():
        inst = by_slug.get(slug)
        if inst is None:
            out["unknown_slugs"].append(slug)
            continue
        g, r = _load_guides(db, inst, doc)
        out["guides"] += g
        out["requirements"] += r
    db.flush()
    from app.services import fit

    fit.invalidate()
    return out
