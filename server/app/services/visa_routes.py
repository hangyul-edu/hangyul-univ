"""V5 visa concierge — route resolver, visa preparation and tracking (owned by the visa_routes workstream).

Rules (docs/VISA_ROUTES.md → Implementation):
* The route comes ONLY from the researched playbook for the student's nationality and visa type (``VisaRoute``). A country
  or level without a route is never inferred from another country: the student sees "we haven't verified the rules for
  {country} yet — your counselor confirms them" and the legacy generic checklist stays as a fallback.
* ``NEEDS_REVIEW`` routes are not shown as a checklist (only the embassy link). ``PARTIAL`` routes are shown with a visible
  "some details unconfirmed" caveat and the curated conflicts in plain language.
* e-visa / CCVI availability follows the MOJ national rules and the university's ``visa_certification`` tier
  (EXCELLENT | CERTIFIED | GENERAL | UNKNOWN). UNKNOWN never unlocks the e-visa — it becomes a caveat.
* "Easiest" = legally simplest: reuse what is ready, start slow items early, get time-limited items last, correct post,
  official channels only. Never a shortcut, never a category the student doesn't qualify for.
* Hangyul never submits or declares anything on an official form: the preparation form is the student's own check.
  A submission is recorded only with a reference number or receipt; an issued visa only with the visa / grant notice.

Coordinator hooks: ``today_items(db, principal)`` and ``home_step(db, student_user_id)``.
"""
from __future__ import annotations

import hashlib
import json
import re
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    AgencyAssignment,
    Application,
    ApplicationStatusHistory,
    Country,
    Document,
    Program,
    ProgramIntake,
    ServiceCase,
    StudentProfile,
    Task,
    University,
    User,
    VisaCase,
)
from app.models.enums import ApplicationStatus as S
from app.models.enums import AssignmentStatus, DegreeLevel, DocumentCategory, PipelineStage, TaskPriority, TaskStatus, TaskType, VisaStatus, VisaType
from app.models.v5_visa_routes import VisaCaseTrack, VisaEmbassyRequest, VisaRoute, VisaRouteAnswer, VisaRouteDocument
from app.services import concierge, dossier
from app.services.state_machine import reached

REPO_ROOT = Path(__file__).resolve().parents[3]
DATASET = "docs/research/visa-playbooks.json"
TASK_SOURCE = "VISA_ROUTE"

# ------------------------------------------------------------------------------------------------ vocabulary
LEVEL_OF = {DegreeLevel.LANGUAGE: "LANGUAGE", DegreeLevel.BACHELOR: "BACHELOR", DegreeLevel.TRANSFER: "BACHELOR", DegreeLevel.MASTER: "MASTER",
            DegreeLevel.DOCTORATE: "DOCTORAL", DegreeLevel.COMBINED: "DOCTORAL", DegreeLevel.ASSOCIATE: "ASSOCIATE"}
TIERS = ("EXCELLENT", "CERTIFIED", "GENERAL", "UNKNOWN")
# MOJ visa manual (2026-09-01): nationals excluded from the university-filed e-visa.
EVISA_EXCLUDED = {"CU", "SY", "MK", "XK"}
# MOJ visa manual: a CCVI (filed by the university) is REQUIRED for D-4-1 at general or lower-tier universities for these nationals.
CCVI_D41_COUNTRIES = {"CN", "VN", "MN", "UZ"}

# Route document key → dossier category it can reuse. Keys not listed are visa-only paper (TB certificate, application form…).
CATEGORY_OF = {
    "passport": "PASSPORT", "photo": "PHOTO", "admission_certificate": "ADMISSION_LETTER", "final_education_certificate": "GRADUATION_CERTIFICATE",
    "transcript": "TRANSCRIPT", "bank_balance_certificate": "BANK_STATEMENT", "other_bank_statement": "BANK_STATEMENT",
    "family_relation_certificate": "FAMILY_RELATION_CERTIFICATE", "sponsor_documents": "SPONSOR_DOCUMENT",
    "language_certificate": "TOPIK", "other_study_plan": "STUDY_PLAN", "other_self_intro_study_plan": "STUDY_PLAN",
    "other_nrc": "NATIONAL_ID", "other_id_copy": "NATIONAL_ID", "other_aadhaar": "NATIONAL_ID", "other_birth_certificate": "BIRTH_CERTIFICATE",
    "other_occupation_proof": "EMPLOYMENT_INCOME_PROOF", "other_income_tax_return": "EMPLOYMENT_INCOME_PROOF",
}
LANGUAGE_CATEGORIES = ("TOPIK", "IELTS", "TOEFL")
# MOJ national rule: final education proof needs an apostille or Korean consular confirmation.
LEGALIZE_KEYS = {"final_education_certificate", "transcript"}
# Validity text is applied as an "issued within N days" freshness rule only where it means the issue date.
NO_FRESHNESS = {"passport", "photo", "language_certificate", "final_education_certificate", "transcript"}
# Slow items to start early (VISA_ROUTES.md §4.2).
SLOW_KEYS = {"tb_test", "criminal_record", "final_education_certificate", "transcript", "other_polio_vaccination"}
WHO = {"student": "you", "university": "university", "bank": "bank", "sponsor": "sponsor", "authority": "authority"}
# Curated research conflicts (VISA_ROUTES.md §3 and §7), shown in plain language; the English reviewer note stays in a disclosure.
KNOWN_CONFLICTS: dict[tuple[str, str | None], list[str]] = {
    ("MM", None): ["LEGALIZATION_UNCLEAR"], ("BD", None): ["LEGALIZATION_UNCLEAR"], ("VN", None): ["APOSTILLE_TRANSITION"],
    ("KZ", None): ["DIPLOMA_APOSTILLE_POSTS", "TB_POST_CONFLICT"], ("IN", None): ["APOSTILLE_WORDING_POSTS"], ("KG", None): ["AMOUNTS_CONFLICT", "TB_VALIDITY_CONFLICT"],
    ("PK", None): ["FEE_TIME_CONFLICT"], ("PH", None): ["POST_SPLIT_UNVERIFIED", "STALE_LIST"], ("TH", None): ["FEE_EXEMPTION_UNCHECKED"],
    ("CN", "D-4-1"): ["FUNDS_PERIOD_CONFLICT"], ("UZ", None): ["FEES_MISSING"],
}
# V9: a curated conflict is dropped once the 2026-10-10 revalidation settled it (route ``v9_revalidation.changes`` whose
# path touches the field and whose verdict says resolved / settled / newly confirmed). Data-driven — no re-curation.
CONFLICT_FIELD = {"LEGALIZATION_UNCLEAR": "legalization", "FEE_TIME_CONFLICT": "fees", "FEE_EXEMPTION_UNCHECKED": "fees",
                  "AMOUNTS_CONFLICT": "financial.amount", "POST_SPLIT_UNVERIFIED": "jurisdiction", "FEES_MISSING": "fees"}
_SETTLED = re.compile(r"resolved|settled|newly confirmed", re.I)
# Post / route specifics of HOW to apply, as translatable codes (the embassy's exact English stays in a disclosure).
METHOD_NOTES: dict[tuple[str, str | None], str] = {
    ("MM", "D-2"): "WAITING_NUMBER", ("MM", "D-4-1"): "ONLINE_SLOTS", ("NP", None): "INTAKE_WINDOWS", ("UZ", None): "ACCREDITED_ONLY",
    ("MN", None): "KVAC_OR_AGENCIES", ("KG", None): "WALK_IN_TUE_THU", ("BD", None): "VISA_CENTRE_DHAKA", ("TH", None): "OR_AGENCY",
    ("VN", "da-nang"): "G4K_BOOKING", ("IN", "mumbai"): "AGENCIES_ONLY_FROM_OCT", ("PK", None): "IN_PERSON_ONLY",
}
# Student-facing statuses (plain language, en/ko/my in the visaroute namespace).
DISPLAY = {
    VisaStatus.NOT_STARTED: "PREPARING", VisaStatus.ELIGIBILITY_CHECK: "PREPARING", VisaStatus.WAITING_FOR_ADMISSION: "PREPARING",
    VisaStatus.DOCUMENT_PREPARATION: "PREPARING", VisaStatus.READY_TO_APPLY: "READY", VisaStatus.SUBMITTED: "SUBMITTED",
    VisaStatus.ADDITIONAL_DOCUMENTS: "EMBASSY_REQUEST", VisaStatus.APPROVED: "APPROVED", VisaStatus.ISSUED: "ISSUED", VisaStatus.REJECTED: "NEEDS_ATTENTION",
}
FORM_SECTIONS = ["personal", "passport", "address", "school", "sponsor", "stay"]
SPONSORS = {"SELF", "PARENTS", "RELATIVE", "SCHOLARSHIP", "EMPLOYER"}
EVISA_URL = "https://www.visa.go.kr"

# ------------------------------------------------------------------------------------------------ VISA_SUPPORT service cases
St = concierge.St
SUPPORT_TABLE = {
    "OPEN": St("team", "open", ("IN_PROGRESS", "WAITING_STUDENT", "WAITING_EMBASSY", "RESOLVED", "CANCELLED")),
    "IN_PROGRESS": St("team", "open", ("WAITING_STUDENT", "WAITING_EMBASSY", "RESOLVED", "CANCELLED")),
    "WAITING_STUDENT": St("student", "open", ("IN_PROGRESS", "WAITING_EMBASSY", "RESOLVED", "CANCELLED")),
    "WAITING_EMBASSY": St("external", "open", ("IN_PROGRESS", "WAITING_STUDENT", "RESOLVED", "CANCELLED")),
    "RESOLVED": St("none", "done", ("IN_PROGRESS",)),
    "CANCELLED": St("none", "cancelled", ("OPEN",)),
}
# Same entry status as the generic table ("OPEN") so help requests created before this registration stay valid.
concierge.register_case_type("VISA_SUPPORT", SUPPORT_TABLE, "OPEN", sla_hours=24)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(v) -> str | None:
    return v.isoformat() if v else None


# ================================================================================================ 1. DATA (playbooks)
def parse_validity_days(text: str | None) -> int | None:
    """"issued within 30 days" → 30, "2 weeks" → 14, "3 months" → 90. Coverage periods ("last 6 months") are not freshness."""
    if not text:
        return None
    t = text.lower()
    if re.search(r"(last|covering)\s+\d+\s+months?", t) and "within" not in t:
        return None
    m = (re.search(r"(?:within|no more than|not older than|stricter)\s+(?:the\s+last\s+)?(\d+)\s*(day|week|month|year)s?", t)
         or re.search(r"^(\d+)\s*(day|week|month|year)s?\b", t) or re.search(r"(\d+)\s*(day|week|month|year)s?\s+from\s+(?:issue|the visa)", t))
    if not m:
        return None
    n, unit = int(m.group(1)), m.group(2)
    return n * {"day": 1, "week": 7, "month": 30, "year": 365}[unit]


def _route_hash(r: dict) -> str:
    return hashlib.sha256(json.dumps(r, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def _max_verified(r: dict) -> date | None:
    ds = [s.get("verified_at") for s in r.get("sources") or [] if s.get("verified_at")]
    return date.fromisoformat(max(ds)) if ds else None


def load_playbooks(db: Session, path: str | Path | None = None, *, data: list[dict] | None = None) -> dict:
    """Idempotent, versioned load. Same content → nothing changes; changed content → a new version becomes current and the
    old one is kept (is_current=False) so cases can show which version they were prepared with."""
    if data is None:
        data = json.loads((REPO_ROOT / (path or DATASET)).read_text(encoding="utf-8"))
    created = updated = unchanged = 0
    for r in data:
        h = _route_hash(r)
        cur = db.scalar(select(VisaRoute).where(VisaRoute.country == r["country"], VisaRoute.visa_type == r["visa_type"], VisaRoute.is_current.is_(True)))
        if cur is not None and cur.content_hash == h:
            unchanged += 1
            continue
        version = 1
        if cur is not None:
            cur.is_current = False
            version = cur.version + 1
            updated += 1
        else:
            created += 1
        verified = _max_verified(r)
        route = VisaRoute(country=r["country"], country_name=r.get("country_name") or r["country"], visa_type=r["visa_type"],
                          degree_levels=r.get("degree_levels") or [], jurisdiction=r.get("jurisdiction") or [],
                          application_method=r.get("application_method") or {}, e_visa_available=bool(r.get("e_visa_available")),
                          e_visa_condition=r.get("e_visa_condition"), financial=r.get("financial"), fees=r.get("fees"),
                          processing_time=r.get("processing_time"), special_notes=r.get("special_notes") or [], reviewer_notes=r.get("reviewer_notes"),
                          sources=r.get("sources") or [], verification_status=r.get("verification_status") or "NEEDS_REVIEW",
                          verified_at=verified, effective_from=verified, version=version, is_current=True, content_hash=h, dataset=DATASET)
        db.add(route)
        db.flush()
        primary = (r.get("sources") or [{}])[0].get("url")
        for i, d in enumerate(r.get("documents") or []):
            req = d.get("required")
            requirement = "REQUIRED" if req is True else "CONDITIONAL" if req == "conditional" else "OPTIONAL"
            db.add(VisaRouteDocument(route_id=route.id, key=d["key"], name=d.get("name") or d["key"], requirement=requirement, condition=d.get("condition"),
                                     validity_text=d.get("validity"), validity_days=None if d["key"] in NO_FRESHNESS else parse_validity_days(d.get("validity")),
                                     legalization=d.get("legalization"), translation=d.get("translation"), provided_by=d.get("provided_by"),
                                     notes=d.get("notes"), document_category=CATEGORY_OF.get(d["key"]), source_url=primary, sort_order=i))
    db.flush()
    return {"created": created, "updated": updated, "unchanged": unchanged, "total": len(data)}


# ------------------------------------------------------------------------------------------------ V9 research extras
# The research JSON carries per-route ``v9_revalidation`` (provenance of the 2026-10-10 corrections) and ``scheduled_changes``
# (rules announced with an effective date). They are not DB columns: read at request time (mtime-keyed cache) so a rule
# takes effect on its date without a re-run, and resolved conflicts drop out as soon as the research says so.
_EXTRA_CACHE: dict = {"mtime": None, "data": {}}


def research_extra(country: str, visa_type: str) -> dict:
    path = REPO_ROOT / DATASET
    try:
        mtime = path.stat().st_mtime
    except OSError:
        return {}
    if _EXTRA_CACHE["mtime"] != mtime:
        try:
            rows = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            rows = []
        _EXTRA_CACHE["data"] = {(r["country"], r["visa_type"]): {"v9_revalidation": r.get("v9_revalidation") or {},
                                                                 "scheduled_changes": r.get("scheduled_changes") or [],
                                                                 "fees": r.get("fees")} for r in rows}
        _EXTRA_CACHE["mtime"] = mtime
    return _EXTRA_CACHE["data"].get((country, visa_type), {})


def _in_force(sc: dict, today: date) -> bool:
    try:
        return date.fromisoformat(sc["effective_from"]) <= today
    except (KeyError, ValueError):
        return False


def effective_financial(route: VisaRoute, today: date | None = None) -> dict | None:
    """The route's financial rule as it applies ``today``: scheduled ``financial.*`` changes are applied on/after their date."""
    today = today or date.today()
    fin = dict(route.financial) if isinstance(route.financial, dict) else route.financial
    for sc in research_extra(route.country, route.visa_type).get("scheduled_changes") or []:
        if not _in_force(sc, today) or not isinstance(fin, dict):
            continue
        for ch in sc.get("changes") or []:
            if ch.get("path", "").startswith("financial."):
                fin[ch["path"].split(".", 1)[1]] = ch["value"]
    return fin


def scheduled_announced(route: VisaRoute, today: date | None = None) -> list[dict]:
    """Rules announced with a future date — shown only as "announced, not yet in force"."""
    today = today or date.today()
    out = []
    for sc in research_extra(route.country, route.visa_type).get("scheduled_changes") or []:
        if _in_force(sc, today):
            continue
        out.append({"effective_from": sc.get("effective_from"), "announced": sc.get("announced"), "status": "ANNOUNCED_NOT_IN_FORCE",
                    "fields": sorted({ch.get("path", "").split(".")[0].split(":")[0] for ch in sc.get("changes") or []}),
                    "changes_en": [ch.get("value") for ch in sc.get("changes") or []],
                    "source_url": ((sc.get("sources") or [{}])[0]).get("url")})
    return out


def conflict_settled(route: VisaRoute, code: str) -> bool:
    field = CONFLICT_FIELD.get(code)
    if not field:
        return False
    for ch in research_extra(route.country, route.visa_type).get("v9_revalidation", {}).get("changes") or []:
        if field in (ch.get("path") or "") and _SETTLED.search(ch.get("verdict") or ""):
            return True
    return False


def fee_free(route: VisaRoute) -> bool:
    """True when the embassy's fee table marks this route's nationals as fee-exempt (e.g. Thai nationals: FREE)."""
    fees = route.fees if isinstance(route.fees, dict) else {}
    if fees.get("amount") == 0:
        return True
    return any(k.endswith("_nationals") and str(v).upper() == "FREE" for k, v in fees.items())


def route_documents(db: Session, route: VisaRoute) -> list[VisaRouteDocument]:
    return list(db.scalars(select(VisaRouteDocument).where(VisaRouteDocument.route_id == route.id).order_by(VisaRouteDocument.sort_order)).all())


# ================================================================================================ 2. RESOLVER
def visa_type_for(level: DegreeLevel | None) -> str | None:
    return {DegreeLevel.LANGUAGE: "D-4-1", DegreeLevel.ASSOCIATE: "D-2-1", DegreeLevel.BACHELOR: "D-2-2", DegreeLevel.TRANSFER: "D-2-2",
            DegreeLevel.MASTER: "D-2-3", DegreeLevel.DOCTORATE: "D-2-4", DegreeLevel.COMBINED: "D-2-4"}.get(level) if level else None


def find_route(db: Session, country: str | None, visa_type: str | None, level: DegreeLevel | None) -> VisaRoute | None:
    """Exact (country, visa type) first; otherwise a route of the SAME country whose embassy list covers this level
    (e.g. Nepal D-2-3 covers doctoral study; Thailand publishes one D-2 list). Never another country."""
    if not country or not visa_type:
        return None
    routes = list(db.scalars(select(VisaRoute).where(VisaRoute.country == country, VisaRoute.is_current.is_(True))).all())
    exact = next((r for r in routes if r.visa_type == visa_type), None)
    if exact:
        return exact
    lv = LEVEL_OF.get(level) if level else None
    if lv and lv != "ASSOCIATE":
        same_family = [r for r in routes if lv in (r.degree_levels or []) and r.visa_type.startswith(visa_type[:3])]
        return same_family[0] if same_family else None
    return None


def _slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:60]


def _split_regions(cov) -> list[str]:
    if cov is None:
        return []
    if isinstance(cov, str):
        return [cov]
    out = []
    for x in cov:
        x = re.sub(r"\s*\([^)]*\)\s*$", "", x).strip()
        if x.upper().startswith("UT:"):
            out += [y.strip() for y in x[3:].split(",") if y.strip()]
        else:
            out.append(x)
    return out


def posts_of(route: VisaRoute) -> list[dict]:
    out = []
    for j in route.jurisdiction or []:
        name = j.get("post_name") or ""
        city = (j.get("city") or "").strip()
        centre = bool(re.search(r"visa application cent", name, re.I)) and not re.search(r"embassy|consulate", name.split("(")[0], re.I)
        cov = j.get("covers_regions")
        regions = _split_regions(cov)
        if route.country == "KZ" and isinstance(cov, str):
            regions = [x.strip() for x in cov.split(",") if x.strip()]
        head = name.split("(")[0]
        kind = ("centre" if centre else "office" if re.search(r"office", name.split(" of ")[0], re.I)
                else "embassy" if re.search(r"embassy", head, re.I) else "consulate")
        out.append({"key": _slug(city.split("(")[0]) or _slug(name), "name_en": name, "city": city.split("(")[0].strip(), "url": j.get("url"),
                    "kind": kind, "regions": regions, "covers_text": cov if isinstance(cov, str) else None})
    return out


QUESTION_KIND = {"CN": "hukou", "IN": "passport_place", "VN": "residence_region", "PK": "residence_region", "KZ": "residence_region"}


def jurisdiction(route: VisaRoute) -> dict:
    """{mode: single|centre|regional|unverified, posts, question}. Only a regional split asks the student anything."""
    posts = posts_of(route)
    regional = [p for p in posts if p["regions"]]
    if len(posts) == 1:
        return {"mode": "single", "posts": posts, "question": None}
    if not regional:
        centres = [p for p in posts if p["kind"] == "centre"]
        if centres and len(posts) - len(centres) == 1:
            return {"mode": "centre", "posts": posts, "question": None}
        return {"mode": "unverified", "posts": posts, "question": None}
    options = []
    for p in regional:
        if QUESTION_KIND.get(route.country) == "residence_region" and route.country != "KZ":
            options.append({"value": p["key"], "label": p["regions"][0], "post_key": p["key"]})
        else:
            options += [{"value": f"{p['key']}|{r}", "label": r, "post_key": p["key"]} for r in p["regions"]]
    return {"mode": "regional", "posts": posts, "question": {"kind": QUESTION_KIND.get(route.country, "residence_region"), "options": options}}


def post_method(route: VisaRoute, post: dict | None) -> str:
    """How this post takes student visa applications: IN_PERSON | VISA_CENTRE | APPOINTMENT | AGENCY."""
    kind = (route.application_method or {}).get("kind") or "IN_PERSON"
    details = ((route.application_method or {}).get("details") or "").lower()
    if kind == "MIXED" and post:
        name = post["name_en"].lower()
        if "travel agenc" in name:
            return "AGENCY"
        if re.search(r"kvac|vfs|visa application cent", name):
            return "VISA_CENTRE"
        if route.country == "VN" and post["key"] == "da-nang":
            return "APPOINTMENT"
        return "IN_PERSON"
    if kind == "VISA_CENTER":
        return "AGENCY" if "only through" in details and "agenc" in details else "VISA_CENTRE"
    return {"IN_PERSON": "IN_PERSON", "APPOINTMENT": "APPOINTMENT"}.get(kind, "IN_PERSON")


def national_method(route_e_visa: bool, nationality: str | None, visa_type: str, tier: str) -> tuple[bool, bool]:
    """MOJ visa manual (2026-09-01) → (university-filed e-visa possible, CCVI required).
    e-visa: excellent-certified university → any D-2; certified → D-2-3/D-2-4 only; never D-4-1; excluded nationalities.
    CCVI required: D-4-1 for CN/VN/MN/UZ nationals at a general (or lower-tier) university. UNKNOWN tier unlocks nothing."""
    evisa = bool(route_e_visa and nationality not in EVISA_EXCLUDED and visa_type.startswith("D-2")
                 and (tier == "EXCELLENT" or (tier == "CERTIFIED" and visa_type in ("D-2-3", "D-2-4"))))
    ccvi = visa_type == "D-4-1" and nationality in CCVI_D41_COUNTRIES and tier == "GENERAL"
    return evisa, ccvi


def _age(dob: date | None, on: date) -> int | None:
    if not dob:
        return None
    return on.year - dob.year - ((on.month, on.day) < (dob.month, dob.day))


def _applies(d: VisaRouteDocument, c: dict) -> tuple[str, str | None]:
    """Does a document apply to THIS student? → (yes|no|maybe, condition code). Unknown conditions stay "maybe" (the
    counselor confirms) — never silently dropped."""
    if d.requirement == "REQUIRED":
        return "yes", None
    cond = (d.condition or "").lower()
    key = d.key
    sponsor, tier, visa_type = c["sponsor"], c["tier"], c["visa_type"]
    # Post-specific checklists ("Mumbai checklist", "Karachi Office: …").
    mentioned = [p["key"] for p in c["posts"] if p["city"] and p["city"].split()[0].lower() in cond]
    if mentioned:
        if c["post"] is None:
            return "maybe", "POST_SPECIFIC"
        return ("yes" if c["post"]["key"] in mentioned else "no"), "POST_SPECIFIC"
    if key == "other_scholarship_certificate" or (cond.startswith("if holding a scholarship")):
        return ("yes" if sponsor == "SCHOLARSHIP" else "no" if sponsor else "maybe"), "SCHOLARSHIP"
    if "exchange" in cond and "d-2-6" in cond:
        return "no", "EXCHANGE_ONLY"
    if "thai nationals" in cond:
        return ("yes" if c["nationality"] == "TH" else "no"), "NATIONALITY"
    if "18+" in cond or "age 18" in cond:
        age = c["age"]
        if age is None:
            return "maybe", "ADULT"
        first = not c["previous_visa"]
        return ("yes" if age >= 18 and first else "no"), "ADULT"
    if "under 18" in cond:
        age = c["age"]
        return ("maybe" if age is None else "yes" if age < 18 else "no"), "MINOR"
    if key in ("family_relation_certificate", "sponsor_documents") and re.search(r"parent|guarantor|family guarantee|sibling|self-fund", cond):
        if not sponsor:
            return "maybe", "PARENT_SPONSOR"
        return ("yes" if sponsor in ("PARENTS", "RELATIVE") else "no"), "PARENT_SPONSOR"
    if key == "sponsor_documents" and "scholarship" in cond:
        return ("no" if sponsor in ("SELF", "SCHOLARSHIP") else "yes" if sponsor else "maybe"), "PARENT_SPONSOR"
    if re.search(r"excellent-certified|43 universities|gks", cond) and re.search(r"not required|waived|exempt|not listed", cond):
        d41_always = "always required for d-4-1" in cond and visa_type == "D-4-1"
        if tier == "EXCELLENT" and not d41_always and "43 universities" not in cond:
            return "no", "EXCELLENT_WAIVER"
        return "yes", "EXCELLENT_WAIVER"
    if re.search(r"lower-tier|consulting|visa-restricted|certain universities|language requirements apply", cond):
        return ("no" if tier in ("EXCELLENT", "CERTIFIED", "GENERAL") else "maybe"), "LOWER_TIER"
    if "if already paid" in cond:
        return ("yes" if c["tuition_paid"] else "maybe"), "TUITION_PAID"
    if "agency handles" in cond:
        return "maybe", "AGENCY_ONLY"
    if cond.startswith("if any"):
        return "maybe", "IF_ANY"
    return "maybe", None


def _student_ctx(db: Session, student_user_id) -> dict:
    user = db.get(User, student_user_id)
    prof = db.scalar(select(StudentProfile).where(StudentProfile.user_id == student_user_id))
    case = db.scalar(select(VisaCase).where(VisaCase.student_user_id == student_user_id).order_by(VisaCase.created_at.desc()))
    app = db.get(Application, case.application_id) if case and case.application_id else None
    if app is None:
        # Before admission: the most advanced live application (preview of the route).
        apps = [a for a in db.scalars(select(Application).where(Application.student_user_id == student_user_id)).all() if a.status not in (S.WITHDRAWN, S.REJECTED)]
        order = list(S)
        apps.sort(key=lambda a: order.index(a.status), reverse=True)
        app = apps[0] if apps else None
    program = db.get(Program, app.program_id) if app else None
    uni = db.get(University, app.university_id) if app else None
    intake = db.get(ProgramIntake, app.intake_id) if app else None
    answers = db.scalar(select(VisaRouteAnswer).where(VisaRouteAnswer.student_user_id == student_user_id))
    track = db.scalar(select(VisaCaseTrack).where(VisaCaseTrack.visa_case_id == case.id)) if case else None
    return {"user": user, "profile": prof, "case": case, "app": app, "program": program, "university": uni, "intake": intake,
            "answers": dict(answers.answers or {}) if answers else {}, "track": track}


def _admitted(app: Application | None, case: VisaCase | None) -> bool:
    if case is not None:
        return True
    return bool(app and reached(app.status, S.ADMISSION_CERTIFICATE_ISSUED) and app.status != S.WITHDRAWN)


def _doc_status(db: Session, student_user_id, d: VisaRouteDocument, *, category: str | None, linked: Document | None, today: date,
                window_end: date | None, legalize: bool, translate: bool, university: str | None) -> dict:
    """Reuse status of one visa document via the dossier hook (same statuses as applications)."""
    req = {"category": category or "OTHER", "label": d.key, "max_age_days": d.validity_days, "legalization_required": legalize,
           "translation_required": translate, "university": "The embassy"}
    if linked is not None:
        ctx = dossier.load(db, student_user_id, today, app_ids=[])
        ev = dossier.evaluate(db, linked, dossier.req_from(req), today=today, window_end=window_end,
                              ts=dossier.translation_status(linked, ctx.states.get(linked.id)), cache=ctx.cache)
        return {"status": ev["status"], "document": linked, "reason": {k: ev[k] for k in ("code", "params")}}
    if category is None:
        return {"status": "MISSING", "document": None, "reason": {"code": "MISSING", "params": {}}}
    cats = LANGUAGE_CATEGORIES if d.key == "language_certificate" else (category,)
    best = None
    for cat in cats:
        r = dossier.applicability_for_requirement(db, student_user_id, {**req, "category": cat}, today=today, window_end=window_end)
        if best is None or dossier.RANK[r["status"]] < dossier.RANK[best["status"]]:
            best = r
    doc = db.get(Document, uuid.UUID(best["document"]["id"])) if best and best.get("document") else None
    return {"status": best["status"], "document": doc, "reason": {k: best["reason"][k] for k in ("code", "params")}}


def resolve(db: Session, student_user_id, *, today: date | None = None, staff: bool = False) -> dict:
    """The whole plan for one student: route, post, method, ordered steps, documents with reuse status, timing, caveats."""
    today = today or date.today()
    c = _student_ctx(db, student_user_id)
    prof, case, app, program, uni, track = c["profile"], c["case"], c["app"], c["program"], c["university"], c["track"]
    nationality = prof.nationality if prof else None
    residence = prof.residence_country if prof else None
    level = program.degree_level if program else (prof.target_degree if prof else None)
    visa_type = case.visa_type.value if case and case.visa_type != VisaType.OTHER else visa_type_for(level)
    tier = (uni.visa_certification or "UNKNOWN") if uni else "UNKNOWN"
    sponsor = c["answers"].get("sponsor") or (prof.financial_sponsor if prof else None)
    appt = track.appointment_on if track else None
    age = _age(prof.date_of_birth if prof else None, appt or today)
    admitted = _admitted(app, case)
    country = db.get(Country, nationality) if nationality else None
    inputs = {
        "nationality": nationality, "country_name": country.name_en if country else nationality, "residence_country": residence,
        "in_korea": bool(prof and (prof.in_korea_now or residence == "KR")), "current_korean_visa": prof.current_korean_visa if prof else None,
        "degree_level": level.value if level else None, "visa_type": visa_type, "sponsor": sponsor, "age": age, "admitted": admitted,
        "university": {"id": str(uni.id), "name_en": uni.name_en, "name_ko": uni.name_ko, "region": uni.region, "tier": tier,
                       "tier_verified_at": _iso(uni.visa_certification_verified_at)} if uni else None,
        "program": {"id": str(program.id), "name_en": program.name_en} if program else None,
        "semester_start": _iso(c["intake"].semester_start) if c["intake"] else None,
        "application_status": app.status.value if app else None,
    }
    out: dict[str, Any] = {"inputs": inputs, "route": None, "post": None, "method": None, "question": None, "answer": c["answers"],
                           "steps": [], "documents": [], "timing": [], "caveats": [], "pack": None, "preview": not admitted}

    def stop(status: str, **extra) -> dict:
        out.update({"status": status, **extra})
        return out

    if not nationality:
        return stop("NEEDS_PROFILE")
    if not visa_type:
        return stop("NEEDS_PROGRAM")
    if inputs["in_korea"] or inputs["current_korean_visa"]:
        # Already in Korea: a change of status at the immigration office — not an embassy route. A human handles it.
        return stop("IN_KOREA")
    if residence and residence != nationality:
        # MOJ: apply at the post for the country of residence (or last school). Not researched → no inference.
        return stop("OTHER_RESIDENCE", residence_name=(db.get(Country, residence).name_en if db.get(Country, residence) else residence))
    route = find_route(db, nationality, visa_type, level)
    # V9 reliability: a post chosen under another route (e.g. before the student changed nationality) is not carried
    # over — it would name another country's embassy. Kept on record, ignored until it belongs to the current route.
    valid_posts = {p_["key"] for p_ in posts_of(route)} if route is not None else set()
    if c["answers"].get("post_key") and c["answers"]["post_key"] not in valid_posts:
        for k in ("post_key", "region_label", "question_kind"):
            c["answers"].pop(k, None)
        out["answer"] = c["answers"]
    if route is None:
        return stop("NO_ROUTE")
    out["route"] = ser_route(route, staff=staff)
    if route.verification_status == "NEEDS_REVIEW":
        # Do not show as a checklist: only "we have not verified this route; contact the embassy" + the jurisdiction link.
        return stop("NOT_VERIFIED", posts=posts_of(route))

    # ---- jurisdiction
    j = jurisdiction(route)
    post = None
    if j["mode"] in ("single", "centre"):
        post = next(p for p in j["posts"] if p["kind"] != "centre")
    elif j["mode"] == "regional":
        ans = c["answers"].get("post_key")
        post = next((p for p in j["posts"] if p["key"] == ans), None)
        if post is None:
            out["question"] = j["question"]
    centre = next((p for p in j["posts"] if p["kind"] == "centre"), None)
    out["post"] = post
    out["centre"] = centre
    out["jurisdiction_mode"] = j["mode"]
    out["posts"] = j["posts"]
    if j["mode"] == "unverified":
        out["caveats"].append({"code": "POST_UNRESOLVED", "params": {}})

    # ---- method (national rules first, then the post)
    evisa, ccvi_required = national_method(route.e_visa_available, nationality, visa_type, tier)
    if evisa:
        method = "E_VISA_UNIVERSITY"
    elif ccvi_required:
        method = "CCVI"
    else:
        method = post_method(route, post) if post or j["mode"] != "regional" else None
    details = (route.application_method or {}).get("details") or ""
    out["method"] = {"code": method, "post_method": post_method(route, post) if (post or j["mode"] != "regional") else None,
                     "accredited_agencies": bool(re.search(r"accredited agenc|designated (travel )?agenc", details, re.I)),
                     "official_url": EVISA_URL if method == "E_VISA_UNIVERSITY" else (route.application_method or {}).get("url") or (post or {}).get("url"),
                     "status_url": EVISA_URL, "details_en": details, "processing_time_en": route.processing_time,
                     "fees": route.fees, "fee_free": fee_free(route), "e_visa_condition_en": route.e_visa_condition}
    if method not in ("E_VISA_UNIVERSITY", None):
        fam = "D-4-1" if route.visa_type == "D-4-1" else "D-2"
        out["method"]["note_code"] = (METHOD_NOTES.get((route.country, (post or {}).get("key"))) or METHOD_NOTES.get((route.country, fam))
                                      or METHOD_NOTES.get((route.country, None)))
    why = []
    if method == "E_VISA_UNIVERSITY":
        why.append({"code": "EVISA_TIER", "params": {"tier": tier, "university": uni.name_en if uni else "", "university_id": str(uni.id) if uni else None}})
    elif method == "CCVI":
        why.append({"code": "CCVI_REQUIRED", "params": {"university": uni.name_en if uni else "", "university_id": str(uni.id) if uni else None}})
    else:
        if post:
            why.append({"code": "POST_BY_REGION" if j["mode"] == "regional" else "POST_FOR_COUNTRY", "params": {"city": post["city"], "country": inputs["country_name"]}})
        if route.e_visa_available and visa_type.startswith("D-2") and tier == "UNKNOWN" and uni:
            out["caveats"].append({"code": "EVISA_TIER_UNKNOWN", "params": {"university": uni.name_en, "university_id": str(uni.id)}})
        if route.e_visa_available and tier in ("CERTIFIED", "GENERAL") and not evisa and visa_type.startswith("D-2"):
            why.append({"code": "NO_EVISA_TIER", "params": {"university": uni.name_en if uni else "", "university_id": str(uni.id) if uni else None}})
        if visa_type == "D-4-1":
            why.append({"code": "NO_EVISA_D41", "params": {}})
        if visa_type == "D-4-1" and nationality in CCVI_D41_COUNTRIES and tier == "UNKNOWN":
            out["caveats"].append({"code": "CCVI_TIER_UNKNOWN", "params": {"university": uni.name_en if uni else "", "university_id": str(uni.id) if uni else None}})
    if tier == "EXCELLENT" and method != "E_VISA_UNIVERSITY":
        why.append({"code": "CCVI_POSSIBLE", "params": {}})
    out["why"] = why

    # ---- caveats from the research status
    if route.verification_status == "PARTIAL":
        out["caveats"].insert(0, {"code": "ROUTE_PARTIAL", "params": {}, "note_en": route.reviewer_notes})
    for key in ((route.country, route.visa_type), (route.country, None)):
        for code in KNOWN_CONFLICTS.get(key, []):
            if code == "APOSTILLE_WORDING_POSTS" and post and post["key"] != "mumbai":
                continue
            if code == "TB_POST_CONFLICT" and post and "almaty" not in post["key"]:
                continue
            if conflict_settled(route, code):
                continue
            out["caveats"].append({"code": code, "params": {}})
    out["scheduled"] = scheduled_announced(route, today)
    for sc in out["scheduled"]:
        out["caveats"].append({"code": "SCHEDULED_CHANGE", "params": {"date": sc["effective_from"]}})
    if route.verified_at and (today - route.verified_at).days > 90:
        out["caveats"].append({"code": "STALE_VERIFICATION", "params": {"date": route.verified_at.isoformat()}})

    # ---- documents
    cond_ctx = {"sponsor": sponsor, "tier": tier, "visa_type": visa_type, "posts": j["posts"], "post": post, "nationality": nationality, "age": age,
                "previous_visa": bool(prof and prof.previous_korean_visa), "tuition_paid": bool(app and reached(app.status, S.TUITION_PAID))}
    linked_ids = (track.item_documents or {}) if track else {}
    marks = set((track.item_marks or {}).keys()) if track else set()
    marks |= set((case.completed_steps or [])) if case else set()
    form_done = _form_confirmed(track)
    docs_out = []
    for d in route_documents(db, route):
        applies, cond_code = _applies(d, cond_ctx)
        category = d.document_category
        linked = db.get(Document, uuid.UUID(linked_ids[d.key])) if d.key in linked_ids else None
        if linked is not None and linked.owner_user_id != student_user_id:
            linked = None
        # V9: the post's own rule wins — an explicit NONE (e.g. Myanmar: notarised English translation only) is respected;
        # the MOJ national default applies only when the research left it unknown.
        legalize = d.legalization in ("APOSTILLE", "CONSULAR") or (d.key in LEGALIZE_KEYS and d.legalization is None)
        translate = bool(d.translation)
        item = {"key": d.key, "name_en": d.name, "category": category, "requirement": d.requirement, "applies": applies, "condition_code": cond_code,
                "condition_en": d.condition, "provided_by": d.provided_by, "who": WHO.get(d.provided_by or "student", "you"),
                "validity_days": d.validity_days, "validity_en": d.validity_text, "legalization": d.legalization, "translation_en": d.translation,
                "notes_en": d.notes, "slow": d.key in SLOW_KEYS, "document": None, "reused": False, "timing": None}
        if applies == "no":
            item.update(status="NOT_NEEDED", reason={"code": "NOT_NEEDED", "params": {}})
        elif method == "E_VISA_UNIVERSITY" and d.key == "tb_test":
            item.update(status="AT_REGISTRATION", reason={"code": "TB_AT_REGISTRATION", "params": {}})
        elif d.key == "application_form":
            item.update(status="READY" if form_done else "FORM", reason={"code": "FORM_DONE" if form_done else "FORM", "params": {}})
        else:
            st = _doc_status(db, student_user_id, d, category=category, linked=linked, today=today, window_end=appt,
                             legalize=legalize, translate=translate, university=uni.name_en if uni else None)
            status, reason = st["status"], st["reason"]
            doc = st["document"]
            if status == "MISSING" and d.provided_by == "university":
                if d.key in marks:
                    status, reason = "READY", {"code": "RECEIVED", "params": {}}
                else:
                    status, reason = "WAITING_UNIVERSITY", {"code": "WAITING_UNIVERSITY", "params": {"university": uni.name_en if uni else "", "university_id": str(uni.id) if uni else None}}
            if status in ("NEEDS_NEW_VERSION",) or (status == "NEAR_EXPIRY" and reason["code"] == "NEAR_TOO_OLD"):
                status = "NEW_FOR_VISA"
                reason = {"code": "NEW_FOR_VISA", "params": {"days": d.validity_days}}
            if status == "MISSING" and d.validity_days and d.key not in NO_FRESHNESS:
                status = "NEW_FOR_VISA" if linked is None else status
                reason = {"code": "NEW_FOR_VISA", "params": {"days": d.validity_days}}
            if status == "MISSING" and category is None and d.provided_by in ("authority", "student", "bank", "sponsor"):
                reason = {"code": "VISA_ONLY", "params": {}}
            if status == "NEEDS_LEGALIZATION":
                reason = {"code": "NEEDS_LEGALIZATION", "params": {"path": st["reason"]["code"].replace("NEEDS_LEGALIZATION_", "")}}
            # Timing: a certificate that must be fresh on the appointment day.
            if d.validity_days and d.key not in NO_FRESHNESS:
                if appt:
                    get_after = appt - timedelta(days=d.validity_days)
                    item["timing"] = {"get_after": get_after.isoformat(), "valid_on": appt.isoformat(), "days": d.validity_days}
                    if status == "NEW_FOR_VISA" and today < get_after:
                        status, reason = "GET_LATER", {"code": "GET_LATER", "params": {"date": get_after.isoformat(), "appointment": appt.isoformat()}}
                else:
                    item["timing"] = {"get_after": None, "valid_on": None, "days": d.validity_days}
            item.update(status=status, reason=reason)
            if doc is not None:
                item["document"] = {"id": str(doc.id), "title": doc.title, "category": doc.category.value, "issue_date": _iso(doc.issue_date),
                                    "expires_on": _iso(doc.expires_on), "status": doc.status.value}
                item["reused"] = status in ("READY", "NEAR_EXPIRY") and linked is None
        docs_out.append(item)
    order = {"NEEDS_FIX": 0, "EXPIRED": 1, "NEEDS_LEGALIZATION": 2, "NEEDS_TRANSLATION": 3, "NEW_FOR_VISA": 4, "MISSING": 5, "FORM": 6, "IN_REVIEW": 7,
             "WAITING_UNIVERSITY": 8, "GET_LATER": 9, "NEAR_EXPIRY": 10, "READY": 11, "AT_REGISTRATION": 12, "NOT_NEEDED": 13}
    docs_out.sort(key=lambda x: (x["applies"] == "no", x["applies"] == "maybe", order.get(x["status"], 5), -x["slow"]))
    out["documents"] = docs_out
    needed = [x for x in docs_out if x["applies"] == "yes" and x["status"] not in ("AT_REGISTRATION", "NOT_NEEDED")]
    ready = [x for x in needed if x["status"] in ("READY", "NEAR_EXPIRY")]
    out["pack"] = {"needed": len(needed), "ready": len(ready), "all_ready": bool(needed) and len(ready) == len(needed) and out["question"] is None,
                   "maybe": sum(1 for x in docs_out if x["applies"] == "maybe"), "reused": sum(1 for x in docs_out if x["reused"]),
                   "valid_on": appt.isoformat() if appt else None, "form_confirmed": form_done,
                   "reviewed_at": _iso(track.pack_reviewed_at) if track else None}
    out["timing"] = [{"key": x["key"], **x["timing"]} for x in docs_out if x["timing"] and x["applies"] != "no"]
    out["financial"] = _financial(route, effective_financial(route, today))
    # V9 S6: the same rule as translatable codes + params (amount for the university's region, period, whose name,
    # certificate age); the English research text stays in ``financial`` for the "as published" disclosure only.
    from app.services import money

    funds = money.parse_funds(effective_financial(route, today), route.visa_type)
    out["funds"] = {"funds": funds, "amount": money.pick_amount(funds, uni.region if uni else None),
                    "region_kind": (("CAPITAL" if uni.region in money.CAPITAL_REGIONS else "OTHER") if uni else None),
                    "waived_here": bool(funds and funds["waived_if_excellent"] and tier == "EXCELLENT"),
                    "genuine": money.GENUINE_FUNDS, "announced": money.ANNOUNCED[:2]} if funds else None
    out["steps"] = _steps(out, case, track)
    out["status"] = "NEEDS_ANSWER" if out["question"] else "RESOLVED"
    return out


def _financial(route: VisaRoute, fin: dict | None = None) -> dict | None:
    f = fin if fin is not None else route.financial
    if not f:
        return None
    amount = f.get("amount")
    tokens = re.findall(r"(?:KRW|USD|CNY|NPR|PHP|Rp|UZS)\s?[\d,]+(?:\.\d+)?", amount or "")
    return {"amount_en": amount, "amounts": tokens, "stated": bool(amount), "currency": f.get("currency"), "holding_period_en": f.get("holding_period"),
            "sponsor_rules_en": f.get("sponsor_rules"), "source_url": f.get("source_url")}


def _form_confirmed(track: VisaCaseTrack | None) -> bool:
    form = (track.form or {}) if track else {}
    return all((form.get(s) or {}).get("confirmed_at") for s in FORM_SECTIONS)


def _steps(plan: dict, case: VisaCase | None, track: VisaCaseTrack | None) -> list[dict]:
    """Ordered steps, each with a why-code. State: done | current | todo."""
    method = (plan["method"] or {}).get("code")
    docs = [d for d in plan["documents"] if d["applies"] == "yes"]
    status = case.status if case else None
    after_submit = status in (VisaStatus.SUBMITTED, VisaStatus.ADDITIONAL_DOCUMENTS, VisaStatus.APPROVED, VisaStatus.ISSUED, VisaStatus.REJECTED)
    steps = []
    if plan["question"] is not None or plan.get("answer", {}).get("post_key"):
        steps.append({"key": "choose_post", "why": "POST", "who": "you", "done": plan["question"] is None})
    slow = [d["key"] for d in docs if d["slow"] and d["status"] not in ("READY", "NEAR_EXPIRY", "AT_REGISTRATION", "NOT_NEEDED")]
    steps.append({"key": "slow_items", "why": "SLOW", "who": "you", "done": not slow, "items": slow})
    uni_items = [d["key"] for d in docs if d["provided_by"] == "university" and d["status"] not in ("READY", "NEAR_EXPIRY")]
    steps.append({"key": "university_papers", "why": "UNIVERSITY", "who": "university", "done": not uni_items, "items": uni_items})
    other = [d["key"] for d in docs if not d["slow"] and d["provided_by"] != "university" and d["key"] != "application_form"
             and not (d["validity_days"] and d["key"] not in NO_FRESHNESS)
             and d["status"] not in ("READY", "NEAR_EXPIRY", "AT_REGISTRATION", "NOT_NEEDED")]
    steps.append({"key": "documents", "why": "REUSE", "who": "you", "done": not other, "items": other})
    steps.append({"key": "form", "why": "FORM", "who": "you", "done": plan["pack"]["form_confirmed"]})
    if method == "E_VISA_UNIVERSITY":
        steps.append({"key": "university_files_evisa", "why": "EVISA", "who": "university", "done": after_submit})
    elif method == "CCVI":
        steps.append({"key": "university_files_ccvi", "why": "CCVI", "who": "university", "done": after_submit or bool(track and track.appointment_on)})
        steps.append({"key": "book", "why": "BOOK", "who": "you", "done": after_submit or bool(track and track.appointment_status == "BOOKED")})
    else:
        steps.append({"key": "book", "why": "BOOK", "who": "you", "done": after_submit or bool(track and track.appointment_status == "BOOKED")})
    fresh = [d["key"] for d in docs if d["validity_days"] and d["key"] not in NO_FRESHNESS and d["status"] not in ("READY", "NEAR_EXPIRY", "AT_REGISTRATION", "NOT_NEEDED")]
    steps.append({"key": "fresh_items", "why": "FRESH", "who": "you", "done": not fresh and bool(docs), "items": fresh})
    steps.append({"key": "apply", "why": "APPLY", "who": "university" if method == "E_VISA_UNIVERSITY" else "you", "done": after_submit})
    steps.append({"key": "decision", "why": "DECISION", "who": "embassy", "done": status in (VisaStatus.APPROVED, VisaStatus.ISSUED)})
    cur = next((s for s in steps if not s["done"]), None)
    for s in steps:
        s["state"] = "done" if s["done"] else "current" if s is cur else "todo"
    return steps


def ser_route(r: VisaRoute, *, staff: bool = False) -> dict:
    return {"id": str(r.id), "country": r.country, "country_name": r.country_name, "visa_type": r.visa_type, "degree_levels": r.degree_levels,
            "verification_status": r.verification_status, "verified_at": _iso(r.verified_at), "version": r.version,
            "sources": [{"url": s.get("url"), "title": s.get("title"), "verified_at": s.get("verified_at"), "page_date": s.get("page_date")} for s in r.sources or []],
            "primary_source": (r.sources or [{}])[0].get("url"), "special_notes_en": r.special_notes or [], "reviewer_notes_en": r.reviewer_notes,
            "processing_time_en": r.processing_time, "fees": r.fees, "e_visa_available": r.e_visa_available}


# ================================================================================================ 3. PREPARATION + TRACKING
def ensure_track(db: Session, case: VisaCase) -> VisaCaseTrack:
    t = db.scalar(select(VisaCaseTrack).where(VisaCaseTrack.visa_case_id == case.id))
    if t is None:
        t = VisaCaseTrack(visa_case_id=case.id, student_user_id=case.student_user_id, form={}, item_documents={}, item_marks={})
        db.add(t)
        db.flush()
    return t


def current_case(db: Session, student_user_id) -> VisaCase | None:
    return db.scalar(select(VisaCase).where(VisaCase.student_user_id == student_user_id).order_by(VisaCase.created_at.desc()))


def require_case(db: Session, student_user_id) -> VisaCase:
    case = current_case(db, student_user_id)
    if case is None:
        raise HTTPException(409, "Your visa preparation opens when your university issues your admission letter.")
    return case


def prefill_form(db: Session, student_user_id, plan: dict | None = None) -> dict:
    """Sections for the student's own preparation. Values come from the profile / passport / admission / sponsor; the
    student reviews each section. Corrections are stored here only (the profile is never silently overwritten)."""
    c = _student_ctx(db, student_user_id)
    u, prof, app, program, uni, intake, track = c["user"], c["profile"], c["app"], c["program"], c["university"], c["intake"], c["track"]
    passport = db.scalar(select(Document).where(Document.owner_user_id == student_user_id, Document.category == DocumentCategory.PASSPORT).order_by(Document.created_at.desc()))
    post = (plan or {}).get("post")

    def f(field: str, value, source: str) -> dict:
        v = value.isoformat() if isinstance(value, date) else value
        return {"field": field, "value": v, "source": source if v not in (None, "") else "missing"}

    sections = {
        "personal": [f("full_name", u.full_name if u else None, "profile"), f("date_of_birth", prof.date_of_birth if prof else None, "profile"),
                     f("gender", prof.gender if prof else None, "profile"), f("nationality", prof.nationality if prof else None, "profile")],
        "passport": [f("passport_number", prof.passport_number_masked if prof else None, "profile"),
                     f("passport_expiry", (passport.expires_on if passport and passport.expires_on else prof.passport_expiry if prof else None), "passport" if passport and passport.expires_on else "profile"),
                     f("passport_issuing_country", (passport.issuing_country if passport else None), "passport")],
        "address": [f("residence_country", prof.residence_country if prof else None, "profile"),
                    f("jurisdiction_area", (c["answers"].get("region_label") or (post or {}).get("city")), "route"),
                    f("home_address", None, "official_form")],
        "school": [f("university", uni.name_en if uni else None, "application"), f("program", program.name_en if program else None, "application"),
                   f("degree_level", program.degree_level.value if program else None, "application"),
                   f("visa_type", (plan or {}).get("inputs", {}).get("visa_type"), "route"),
                   f("admission_letter", "ISSUED" if app and reached(app.status, S.ADMISSION_CERTIFICATE_ISSUED) else None, "application")],
        "sponsor": [f("sponsor", c["answers"].get("sponsor") or (prof.financial_sponsor if prof else None), "profile")],
        "stay": [f("semester_start", intake.semester_start if intake else None, "application"),
                 f("intended_entry", c["case"].target_entry_date if c["case"] else None, "visa"),
                 f("korea_address", None, "official_form")],
    }
    saved = (track.form or {}) if track else {}
    out = []
    for key in FORM_SECTIONS:
        s = saved.get(key) or {}
        fields = sections[key]
        corrected = s.get("values") or {}
        for fl in fields:
            if fl["field"] in corrected:
                fl["value"], fl["source"], fl["corrected"] = corrected[fl["field"]], "you", True
        out.append({"key": key, "fields": fields, "confirmed_at": s.get("confirmed_at"),
                    "missing": [fl["field"] for fl in fields if fl["source"] == "missing"]})
    return {"sections": out, "all_confirmed": _form_confirmed(track), "declarations": False}


EDITABLE_FIELDS = {"personal": {"full_name", "gender"}, "passport": {"passport_issuing_country"}, "address": {"jurisdiction_area"},
                   "school": set(), "sponsor": {"sponsor"}, "stay": {"intended_entry"}}


def confirm_section(db: Session, case: VisaCase, section: str, values: dict | None, *, actor) -> VisaCaseTrack:
    if section not in FORM_SECTIONS:
        raise HTTPException(422, "Unknown section.")
    if not actor.is_student:
        # The confirmation is the student's own check of their details; staff can't confirm on their behalf.
        raise HTTPException(403, "Only the student confirms their own details.")
    bad = set(values or {}) - EDITABLE_FIELDS[section]
    if bad:
        raise HTTPException(422, f"These details can't be changed here: {', '.join(sorted(bad))}.")
    if section == "sponsor" and values and values.get("sponsor") not in SPONSORS:
        raise HTTPException(422, "Choose who pays for your studies.")
    t = ensure_track(db, case)
    form = dict(t.form or {})
    form[section] = {"confirmed_at": _now().isoformat(), "values": {k: str(v)[:200] for k, v in (values or {}).items()}}
    t.form = form
    if section == "sponsor" and values and values.get("sponsor"):
        set_answers(db, case.student_user_id, {"sponsor": values["sponsor"]})
    return t


def unconfirm_section(db: Session, case: VisaCase, section: str) -> None:
    t = ensure_track(db, case)
    form = dict(t.form or {})
    if section in form:
        form[section] = {**form[section], "confirmed_at": None}
    t.form = form


def set_answers(db: Session, student_user_id, data: dict) -> VisaRouteAnswer:
    a = db.scalar(select(VisaRouteAnswer).where(VisaRouteAnswer.student_user_id == student_user_id))
    if a is None:
        a = VisaRouteAnswer(student_user_id=student_user_id, answers={})
        db.add(a)
    merged = dict(a.answers or {})
    for k, v in data.items():
        if v is None:
            merged.pop(k, None)
        else:
            merged[k] = v
    a.answers = merged
    db.flush()
    return a


def answer_question(db: Session, student_user_id, value: str) -> dict:
    c = _student_ctx(db, student_user_id)
    prof, program = c["profile"], c["program"]
    level = program.degree_level if program else (prof.target_degree if prof else None)
    vt = c["case"].visa_type.value if c["case"] and c["case"].visa_type != VisaType.OTHER else visa_type_for(level)
    route = find_route(db, prof.nationality if prof else None, vt, level)
    if route is None:
        raise HTTPException(409, "There is no verified route to choose a post for.")
    q = jurisdiction(route)["question"]
    opt = next((o for o in (q or {}).get("options", []) if o["value"] == value), None)
    if opt is None:
        raise HTTPException(422, "Choose one of the listed areas.")
    set_answers(db, student_user_id, {"post_key": opt["post_key"], "region_label": opt["label"], "question_kind": q["kind"]})
    t = c["track"]
    if t is not None:
        t.post_key = opt["post_key"]
    return opt


def link_item(db: Session, case: VisaCase, key: str, *, document_id: str | None, received: bool | None) -> VisaCaseTrack:
    t = ensure_track(db, case)
    if document_id is not None:
        docs = dict(t.item_documents or {})
        if document_id == "":
            docs.pop(key, None)
        else:
            doc = db.get(Document, uuid.UUID(document_id))
            if doc is None or doc.owner_user_id != case.student_user_id:
                raise HTTPException(404, "Not found or not permitted.")
            docs[key] = str(doc.id)
        t.item_documents = docs
    if received is not None:
        marks = dict(t.item_marks or {})
        if received:
            marks[key] = {"received_at": _now().isoformat()}
        else:
            marks.pop(key, None)
            if case.completed_steps and key in case.completed_steps:
                case.completed_steps = [k for k in case.completed_steps if k != key]
        t.item_marks = marks
    return t


def set_appointment(db: Session, case: VisaCase, *, on: date | None, status: str | None, reference: str | None, post_key: str | None) -> VisaCaseTrack:
    if case.status in (VisaStatus.SUBMITTED, VisaStatus.ADDITIONAL_DOCUMENTS, VisaStatus.APPROVED, VisaStatus.ISSUED):
        raise HTTPException(409, "Your application has already been submitted.")
    if status not in (None, "PLANNED", "BOOKED"):
        raise HTTPException(422, "Unknown appointment status.")
    if on and on < date.today() - timedelta(days=1):
        raise HTTPException(422, "Choose a date from today onwards.")
    t = ensure_track(db, case)
    t.appointment_on = on
    t.appointment_status = status if on else None
    t.appointment_reference = (reference or "").strip()[:120] or None
    t.appointment_post = post_key or t.post_key
    return t


def _advance_application(db: Session, case: VisaCase, to: S, actor) -> None:
    app = db.get(Application, case.application_id) if case.application_id else None
    if app is None or app.status == to:
        return
    allowed = {S.VISA_SUBMITTED: {S.VISA_PREPARATION, S.ADMISSION_CERTIFICATE_ISSUED}, S.VISA_ISSUED: {S.VISA_SUBMITTED, S.VISA_PREPARATION}}
    if app.status not in allowed.get(to, set()):
        return
    steps = [S.VISA_PREPARATION, S.VISA_SUBMITTED, S.VISA_ISSUED] if app.status == S.ADMISSION_CERTIFICATE_ISSUED else [S.VISA_SUBMITTED, S.VISA_ISSUED] if app.status == S.VISA_PREPARATION else [S.VISA_ISSUED]
    kind = "STUDENT" if actor.is_student else "AGENCY"
    for nxt in steps:
        db.add(ApplicationStatusHistory(application_id=app.id, from_status=app.status, to_status=nxt, actor_user_id=actor.id, actor_org_type=kind,
                                        note="Recorded from the visa preparation", created_at=_now()))
        app.status = nxt
        if nxt == to:
            break
    prof = db.scalar(select(StudentProfile).where(StudentProfile.user_id == case.student_user_id))
    if prof:
        prof.pipeline_stage = {S.VISA_SUBMITTED: PipelineStage.VISA_PREPARATION, S.VISA_ISSUED: PipelineStage.VISA_ISSUED}.get(to, prof.pipeline_stage)


def _own_doc(db: Session, case: VisaCase, document_id: str | None) -> Document | None:
    if not document_id:
        return None
    doc = db.get(Document, uuid.UUID(document_id))
    if doc is None or doc.owner_user_id != case.student_user_id:
        raise HTTPException(404, "Not found or not permitted.")
    return doc


def record_handoff(db: Session, case: VisaCase) -> VisaCaseTrack:
    t = ensure_track(db, case)
    t.handoff_opened_at = _now()
    return t


def record_submission(db: Session, case: VisaCase, *, submitted_on: date, reference: str | None, document_id: str | None, actor) -> VisaCaseTrack:
    """Never 'submitted' without evidence: a reference / receipt number or an uploaded receipt is required."""
    ref = (reference or "").strip()
    doc = _own_doc(db, case, document_id)
    if not ref and doc is None:
        raise HTTPException(422, "Add the receipt or reference number the embassy gave you (or upload the receipt).")
    if case.status not in (VisaStatus.DOCUMENT_PREPARATION, VisaStatus.READY_TO_APPLY, VisaStatus.NOT_STARTED, VisaStatus.ELIGIBILITY_CHECK):
        raise HTTPException(409, "This visa application is already past submission.")
    if submitted_on > date.today():
        raise HTTPException(422, "The submission date can't be in the future.")
    t = ensure_track(db, case)
    t.submission_reference = ref[:120] or None
    t.submission_document_id = doc.id if doc else None
    case.status = VisaStatus.SUBMITTED
    case.submitted_on = submitted_on
    _advance_application(db, case, S.VISA_SUBMITTED, actor)
    return t


def add_embassy_request(db: Session, case: VisaCase, *, note: str, due_on: date | None, actor) -> VisaEmbassyRequest:
    if case.status not in (VisaStatus.SUBMITTED, VisaStatus.ADDITIONAL_DOCUMENTS):
        raise HTTPException(409, "Record the submission first — the embassy asks for things after you apply.")
    note = (note or "").strip()
    if len(note) < 3:
        raise HTTPException(422, "Write what the embassy asked for.")
    r = VisaEmbassyRequest(visa_case_id=case.id, student_user_id=case.student_user_id, note=note[:2000], due_on=due_on, status="OPEN", created_by_id=actor.id)
    db.add(r)
    db.flush()
    case.status = VisaStatus.ADDITIONAL_DOCUMENTS
    _sync_request_task(db, case, r)
    escalate(db, case, "EMBASSY_REQUEST", message=note, actor=actor, priority="HIGH", due_on=due_on)
    return r


def _sync_request_task(db: Session, case: VisaCase, r: VisaEmbassyRequest) -> None:
    key = f"visaroute:req:{r.id}"
    t = db.scalar(select(Task).where(Task.dedupe_key == key))
    a = db.scalar(select(AgencyAssignment).where(AgencyAssignment.student_user_id == case.student_user_id, AgencyAssignment.status == AssignmentStatus.ACTIVE))
    due = datetime.combine(r.due_on, datetime.min.time(), tzinfo=timezone.utc) if r.due_on else None
    if r.status == "OPEN":
        if t is None:
            db.add(Task(student_user_id=case.student_user_id, source=TASK_SOURCE, dedupe_key=key, title="Send the embassy what it asked for",
                        title_key="task.visaroute.embassyRequest", title_params={}, description=r.note, task_type=TaskType.VISA_STEP,
                        priority=TaskPriority.HIGH, due_at=due, owner_user_id=case.student_user_id, owner_org_id=a.organization_id if a else None,
                        visible_to_student=True, link="/visa#embassy", application_id=case.application_id))
        else:
            t.status, t.completed_at, t.due_at, t.description = TaskStatus.OPEN, None, due, r.note
    elif t is not None and t.status in (TaskStatus.OPEN, TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED):
        t.status, t.completed_at = TaskStatus.DONE, _now()
    db.flush()


def request_sent(db: Session, case: VisaCase, r: VisaEmbassyRequest, *, document_id: str | None) -> VisaEmbassyRequest:
    if r.visa_case_id != case.id:
        raise HTTPException(404, "Not found or not permitted.")
    doc = _own_doc(db, case, document_id)
    r.status = "SENT"
    r.sent_at = _now()
    r.response_document_id = doc.id if doc else r.response_document_id
    _sync_request_task(db, case, r)
    still = db.scalar(select(VisaEmbassyRequest.id).where(VisaEmbassyRequest.visa_case_id == case.id, VisaEmbassyRequest.status == "OPEN").limit(1))
    if not still and case.status == VisaStatus.ADDITIONAL_DOCUMENTS:
        case.status = VisaStatus.SUBMITTED
    return r


def record_decision(db: Session, case: VisaCase, *, decision: str, decided_on: date, document_id: str | None, actor) -> VisaCaseTrack:
    if decision not in ("APPROVED", "REFUSED"):
        raise HTTPException(422, "Choose approved or refused.")
    if case.status not in (VisaStatus.SUBMITTED, VisaStatus.ADDITIONAL_DOCUMENTS):
        raise HTTPException(409, "A decision can be recorded only after the application was submitted.")
    doc = _own_doc(db, case, document_id)
    t = ensure_track(db, case)
    t.decision, t.decision_on, t.decision_document_id = decision, decided_on, doc.id if doc else None
    for r in db.scalars(select(VisaEmbassyRequest).where(VisaEmbassyRequest.visa_case_id == case.id, VisaEmbassyRequest.status == "OPEN")):
        r.status = "CLOSED"
        _sync_request_task(db, case, r)
    if decision == "APPROVED":
        case.status = VisaStatus.APPROVED
    else:
        case.status = VisaStatus.REJECTED
        escalate(db, case, "REFUSAL", message=None, actor=actor, priority="URGENT")
        # V9 S8: a refusal after tuition is a refund trigger — open the refund case now (idempotent).
        from app.services import money

        db.flush()
        money.ensure_refund_case(db, case.student_user_id, actor_id=getattr(actor, "id", None))
    return t


def record_issued(db: Session, case: VisaCase, *, document_id: str | None, issued_on: date | None, expires_on: date | None, actor) -> VisaCaseTrack:
    """The visa (or e-visa grant notice) must be uploaded — an issued visa is never recorded without it."""
    doc = _own_doc(db, case, document_id)
    if doc is None:
        raise HTTPException(422, "Upload your visa or visa grant notice first.")
    if case.status not in (VisaStatus.SUBMITTED, VisaStatus.ADDITIONAL_DOCUMENTS, VisaStatus.APPROVED):
        raise HTTPException(409, "Record the submission first.")
    t = ensure_track(db, case)
    t.visa_document_id = doc.id
    if t.decision is None:
        t.decision, t.decision_on = "APPROVED", issued_on or date.today()
    case.status = VisaStatus.ISSUED
    case.issued_on = issued_on or date.today()
    case.expires_on = expires_on or doc.expires_on
    _advance_application(db, case, S.VISA_ISSUED, actor)
    from app.core.audit import track as track_event
    from app.services.notify import notify

    track_event(db, "visa_issued", user_id=case.student_user_id)
    notify(db, case.student_user_id, "VISA_ISSUED", "notify.visaIssued", "Your visa has been issued — time to plan your arrival!", link="/arrival")
    return t


def sync_ready(db: Session, case: VisaCase, plan: dict) -> bool:
    """DOCUMENT_PREPARATION ↔ READY_TO_APPLY follows the pack check (all required documents ready and valid on the
    appointment date + preparation form confirmed). Returns True when the status changed."""
    if plan.get("status") != "RESOLVED" or not plan.get("pack"):
        return False
    ok = plan["pack"]["all_ready"] and plan["pack"]["form_confirmed"]
    if ok and case.status == VisaStatus.DOCUMENT_PREPARATION:
        case.status = VisaStatus.READY_TO_APPLY
        return True
    if not ok and case.status == VisaStatus.READY_TO_APPLY:
        case.status = VisaStatus.DOCUMENT_PREPARATION
        return True
    return False


# ================================================================================================ 4. HELP + escalation
def escalate(db: Session, case: VisaCase, reason: str, *, message: str | None, actor, priority: str = "HIGH", due_on: date | None = None) -> ServiceCase:
    """Complex exceptions (refusal, embassy request, unknown route, the student asking) go to a human as a VISA_SUPPORT case.
    Reuses the open one when there is one."""
    t = ensure_track(db, case)
    sc = db.get(ServiceCase, t.support_case_id) if t.support_case_id else None
    if sc is not None and concierge.is_closed(sc):
        sc = None
    details = {"reason": reason, "visa_case_id": str(case.id), "visa_status": case.status.value}
    if message:
        details["message"] = message[:2000]
    if sc is None:
        sc = concierge.create_case(db, case.student_user_id, "VISA_SUPPORT", actor_id=actor.id if actor else None, details=details, priority=priority,
                                   note=message, application_id=case.application_id,
                                   due_at=datetime.combine(due_on, datetime.min.time(), tzinfo=timezone.utc) if due_on else None)
        t.support_case_id = sc.id
    else:
        sc.details = {**(sc.details or {}), **details}
        if concierge.PRIORITIES.index(priority) > concierge.PRIORITIES.index(sc.priority):
            sc.priority = priority
        if sc.status in ("WAITING_STUDENT", "WAITING_EMBASSY", "RESOLVED"):
            concierge.transition(db, sc, "IN_PROGRESS", actor_id=actor.id if actor else None, note=message, staff=False)
        else:
            concierge.add_event(db, sc, "NOTE", actor_id=actor.id if actor else None, body=message or reason, visibility="STUDENT")
    return sc


def escalate_student(db: Session, student_user_id, reason: str, message: str | None, actor) -> ServiceCase:
    """Help before a visa case exists (route unknown, living elsewhere, already in Korea)."""
    case = current_case(db, student_user_id)
    if case is not None:
        return escalate(db, case, reason, message=message, actor=actor)
    existing = next((c for c in concierge.open_cases(db, student_user_id, "VISA_SUPPORT")), None)
    if existing:
        concierge.add_event(db, existing, "NOTE", actor_id=actor.id, body=message or reason, visibility="STUDENT")
        return existing
    return concierge.create_case(db, student_user_id, "VISA_SUPPORT", actor_id=actor.id, details={"reason": reason, "message": (message or "")[:2000]},
                                 priority="MEDIUM", note=message)


def help_block(db: Session, student_user_id, plan: dict) -> dict | None:
    """What happened · What is needed · Who should act · When · Source · Counselor contact — for the current issue."""
    case = current_case(db, student_user_id)
    a = db.scalar(select(AgencyAssignment).where(AgencyAssignment.student_user_id == student_user_id, AgencyAssignment.status == AssignmentStatus.ACTIVE))
    counselor = db.get(User, a.counselor_user_id) if a and a.counselor_user_id else None
    contact = {"name": counselor.full_name if counselor else None, "link": "/messages"}
    src = (plan.get("route") or {}).get("primary_source")
    issue = None
    if case is not None and case.status == VisaStatus.REJECTED:
        issue = {"code": "REFUSED", "who": "counselor", "when": None}
    elif case is not None and case.status == VisaStatus.ADDITIONAL_DOCUMENTS:
        r = db.scalar(select(VisaEmbassyRequest).where(VisaEmbassyRequest.visa_case_id == case.id, VisaEmbassyRequest.status == "OPEN")
                      .order_by(VisaEmbassyRequest.due_on.asc().nulls_last()))
        issue = {"code": "EMBASSY_REQUEST", "who": "you", "when": _iso(r.due_on) if r else None, "note": r.note if r else None}
    elif plan.get("status") in ("NO_ROUTE", "NOT_VERIFIED", "OTHER_RESIDENCE", "IN_KOREA"):
        issue = {"code": plan["status"], "who": "counselor", "when": None}
    elif plan.get("question"):
        issue = {"code": "NEEDS_ANSWER", "who": "you", "when": None}
    sc = None
    if case is not None:
        t = db.scalar(select(VisaCaseTrack).where(VisaCaseTrack.visa_case_id == case.id))
        sc = db.get(ServiceCase, t.support_case_id) if t and t.support_case_id else None
    if sc is None:
        sc = next(iter(concierge.open_cases(db, student_user_id, "VISA_SUPPORT")), None)
    return {"issue": issue, "source_url": src, "contact": contact,
            "support_case": {"id": str(sc.id), "status": sc.status, "waiting_on": concierge.state(sc).waiting, "closed": concierge.is_closed(sc)} if sc else None}


# ================================================================================================ plan (API payload)
def display_status(case: VisaCase | None, plan: dict, overdue_request: bool = False) -> str:
    if case is None:
        return "PREPARING"
    if overdue_request:
        return "NEEDS_ATTENTION"
    return DISPLAY.get(case.status, "PREPARING")


def ser_request(r: VisaEmbassyRequest, today: date) -> dict:
    return {"id": str(r.id), "note": r.note, "due_on": _iso(r.due_on), "status": r.status, "sent_at": _iso(r.sent_at),
            "overdue": bool(r.status == "OPEN" and r.due_on and r.due_on < today), "created_at": _iso(r.created_at),
            "response_document_id": str(r.response_document_id) if r.response_document_id else None}


def build_plan(db: Session, student_user_id, *, staff: bool = False, today: date | None = None, sync: bool = True) -> dict:
    today = today or date.today()
    case = current_case(db, student_user_id)
    plan = resolve(db, student_user_id, today=today, staff=staff)
    if case is not None and sync:
        t = ensure_track(db, case)
        # V9 reliability: route and post follow the current resolution — never a stale route/post from earlier inputs.
        t.route_id = uuid.UUID(plan["route"]["id"]) if plan.get("route") else None
        valid_posts = {p_["key"] for p_ in plan.get("posts") or []}
        t.post_key = (plan.get("post") or {}).get("key") or (t.post_key if t.post_key in valid_posts else None)
        t.method = (plan.get("method") or {}).get("code")
        if sync_ready(db, case, plan):
            plan["steps"] = _steps(plan, case, t)
    track = db.scalar(select(VisaCaseTrack).where(VisaCaseTrack.visa_case_id == case.id)) if case else None
    reqs = list(db.scalars(select(VisaEmbassyRequest).where(VisaEmbassyRequest.visa_case_id == case.id).order_by(VisaEmbassyRequest.created_at.desc()))) if case else []
    sreqs = [ser_request(r, today) for r in reqs]
    plan["case"] = None if case is None else {
        "id": str(case.id), "status": case.status.value, "display_status": display_status(case, plan, any(r["overdue"] for r in sreqs)),
        "visa_type": case.visa_type.value, "submitted_on": _iso(case.submitted_on), "issued_on": _iso(case.issued_on), "expires_on": _iso(case.expires_on),
        "target_entry_date": _iso(case.target_entry_date), "application_id": str(case.application_id) if case.application_id else None,
        "appointment": {"on": _iso(track.appointment_on), "status": track.appointment_status, "post_key": track.appointment_post,
                        "reference": track.appointment_reference} if track and track.appointment_on else None,
        "handoff_opened_at": _iso(track.handoff_opened_at) if track else None,
        "submission": {"on": _iso(case.submitted_on), "reference": track.submission_reference,
                       "document_id": str(track.submission_document_id) if track.submission_document_id else None} if track and case.submitted_on else None,
        "decision": {"decision": track.decision, "on": _iso(track.decision_on)} if track and track.decision else None,
        "visa_document_id": str(track.visa_document_id) if track and track.visa_document_id else None,
        "requests": sreqs,
    }
    plan["display_status"] = plan["case"]["display_status"] if plan["case"] else "PREPARING"
    plan["form"] = prefill_form(db, student_user_id, plan) if case is not None else None
    plan["help"] = help_block(db, student_user_id, plan)
    plan["next"] = _next_action(plan)
    if plan.get("status") == "NO_ROUTE" or plan.get("status") == "NOT_VERIFIED":
        from app.services.visa import visa_checklist

        if case is not None:
            plan["fallback_checklist"] = visa_checklist(db, case, plan["inputs"]["nationality"], use_routes=False)
    plan["disclaimer_key"] = "disclaimer"
    return plan


def _next_action(plan: dict) -> dict | None:
    """The single visa next action for the student (also used by home_step)."""
    case = plan.get("case")
    st = plan.get("status")
    if st in ("NO_ROUTE", "NOT_VERIFIED", "OTHER_RESIDENCE", "IN_KOREA"):
        return {"key": "counselor_confirms", "params": {"country": plan["inputs"].get("country_name")}, "who": "counselor"}
    if st in ("NEEDS_PROFILE", "NEEDS_PROGRAM"):
        return {"key": st.lower(), "params": {}, "who": "you"}
    if plan.get("question"):
        return {"key": "choose_post", "params": {}, "who": "you"}
    if case is None:
        return {"key": "preview", "params": {}, "who": "you"}
    s = case["status"]
    if s == "ISSUED":
        return None
    if s == "REJECTED":
        return {"key": "refused", "params": {}, "who": "counselor"}
    if s == "ADDITIONAL_DOCUMENTS":
        r = next((x for x in case["requests"] if x["status"] == "OPEN"), None)
        return {"key": "embassy_request", "params": {"date": r["due_on"] if r else None}, "who": "you"}
    if s == "APPROVED":
        return {"key": "upload_visa", "params": {}, "who": "you"}
    if s == "SUBMITTED":
        return {"key": "wait_decision", "params": {"date": case["submitted_on"]}, "who": "embassy"}
    method = (plan.get("method") or {}).get("code")
    if s == "READY_TO_APPLY":
        if method == "E_VISA_UNIVERSITY":
            return {"key": "university_files_evisa", "params": {}, "who": "university"}
        ap = case.get("appointment")
        if ap and ap["status"] == "BOOKED":
            return {"key": "go_to_appointment", "params": {"date": ap["on"]}, "who": "you"}
        return {"key": "book", "params": {}, "who": "you"}
    blocking = [d for d in plan["documents"] if d["applies"] == "yes" and d["status"] not in ("READY", "NEAR_EXPIRY", "AT_REGISTRATION", "NOT_NEEDED", "GET_LATER")]
    student_first = [d for d in blocking if d["status"] not in ("WAITING_UNIVERSITY", "IN_REVIEW", "FORM")]
    if student_first:
        d = student_first[0]
        return {"key": "document", "params": {"doc": d["key"], "status": d["status"]}, "who": d["who"]}
    if any(d["status"] == "FORM" for d in blocking) or not plan["pack"]["form_confirmed"]:
        return {"key": "form", "params": {}, "who": "you"}
    if blocking:
        d = blocking[0]
        return {"key": "waiting", "params": {"doc": d["key"], "status": d["status"]}, "who": d["who"]}
    later = [d for d in plan["documents"] if d["status"] == "GET_LATER"]
    if later:
        return {"key": "get_later", "params": {"doc": later[0]["key"], "date": later[0]["reason"]["params"].get("date")}, "who": "you"}
    return {"key": "book", "params": {}, "who": "you"}


# ================================================================================================ 5. COORDINATOR HOOKS
def home_step(db: Session, student_user_id) -> dict | None:
    """The single visa next action for the student home, or None (no visa case yet, or visa issued → concierge takes over).
    {key, title_key: "visaroute:home.<key>", params, link, status_key: "visaroute:status.<display>", who}"""
    case = current_case(db, student_user_id)
    if case is None or case.status == VisaStatus.ISSUED:
        return None
    plan = build_plan(db, student_user_id, sync=False)
    nxt = plan.get("next")
    if nxt is None:
        return None
    return {"key": nxt["key"], "title_key": f"visaroute:home.{nxt['key']}", "params": nxt["params"], "who": nxt["who"], "link": "/visa",
            "status_key": f"visaroute:status.{plan['display_status']}"}


def today_items(db: Session, principal) -> list[dict]:
    """Agency Today: appointments within 7 days, embassy requests due (≤ 3 days or overdue), packs ready to review.
    Each: {kind: "visa", reason, title_key: "visaroute:today.<reason>", params, student, due_at, overdue, link}."""
    from app.services.access import scope_student_ids

    if not (principal.is_agency or principal.is_hangyul):
        return []
    today = date.today()
    out = []
    cases = db.scalars(scope_student_ids(select(VisaCase), VisaCase.student_user_id, principal)
                       .where(VisaCase.status.in_([VisaStatus.DOCUMENT_PREPARATION, VisaStatus.READY_TO_APPLY, VisaStatus.SUBMITTED, VisaStatus.ADDITIONAL_DOCUMENTS]))).all()
    for case in cases:
        t = db.scalar(select(VisaCaseTrack).where(VisaCaseTrack.visa_case_id == case.id))
        stu = db.get(User, case.student_user_id)
        base = {"kind": "visa", "case_id": str(case.id), "student": {"id": str(stu.id), "full_name": stu.full_name} if stu else None,
                "link": f"/students/{case.student_user_id}?tab=visa"}
        if t and t.appointment_on and case.status in (VisaStatus.DOCUMENT_PREPARATION, VisaStatus.READY_TO_APPLY) and today <= t.appointment_on <= today + timedelta(days=7):
            out.append({**base, "reason": "appointment_soon", "title_key": "visaroute:today.appointment_soon",
                        "params": {"student": stu.full_name if stu else "", "date": t.appointment_on.isoformat()}, "due_at": t.appointment_on.isoformat(),
                        "overdue": False})
        for r in db.scalars(select(VisaEmbassyRequest).where(VisaEmbassyRequest.visa_case_id == case.id, VisaEmbassyRequest.status == "OPEN")):
            if r.due_on is None or r.due_on <= today + timedelta(days=3):
                out.append({**base, "reason": "request_due", "title_key": "visaroute:today.request_due",
                            "params": {"student": stu.full_name if stu else "", "date": _iso(r.due_on)}, "due_at": _iso(r.due_on),
                            "overdue": bool(r.due_on and r.due_on < today)})
        if case.status == VisaStatus.READY_TO_APPLY and not (t and t.pack_reviewed_at):
            out.append({**base, "reason": "pack_ready", "title_key": "visaroute:today.pack_ready", "params": {"student": stu.full_name if stu else ""},
                        "due_at": _iso(t.appointment_on) if t and t.appointment_on else None, "overdue": False})
    order = {"request_due": 0, "appointment_soon": 1, "pack_ready": 2}
    out.sort(key=lambda x: (not x["overdue"], order[x["reason"]], x["due_at"] or "9999"))
    return out[:50]


# ================================================================================================ legacy checklist bridge
def _clean_names() -> dict[str, str]:
    """Short English document names (the visaroute i18n catalogue) — used for task titles instead of the research wording."""
    try:
        data = json.loads((REPO_ROOT / "packages/i18n/locales/en/visaroute.json").read_text(encoding="utf-8"))
        return {k: v.get("name") for k, v in (data.get("doc") or {}).items() if isinstance(v, dict) and v.get("name")}
    except (OSError, ValueError):
        return {}


CLEAN_NAMES = _clean_names()


def route_view(db: Session, case: VisaCase) -> tuple[list[dict] | None, dict]:
    """(route-based checklist in the legacy /visa shape — None when no verified route —, one-line route summary)."""
    plan = resolve(db, case.student_user_id)
    route = plan.get("route")
    summary = {"status": plan.get("status"), "visa_type": (route or {}).get("visa_type"), "verification_status": (route or {}).get("verification_status"),
               "verified_at": (route or {}).get("verified_at"), "source_url": (route or {}).get("primary_source"),
               "post": {k: plan["post"][k] for k in ("key", "city", "name_en", "kind")} if plan.get("post") else None,
               "method": (plan.get("method") or {}).get("code"), "needs_answer": bool(plan.get("question")),
               "display_status": DISPLAY.get(case.status, "PREPARING"), "pack": plan.get("pack")}
    if plan.get("status") not in ("RESOLVED", "NEEDS_ANSWER"):
        return None, summary
    items = []
    for d in plan["documents"]:
        if d["applies"] == "no" or d["status"] == "NOT_NEEDED":
            continue
        items.append({
            "key": d["key"], "title": CLEAN_NAMES.get(d["key"], d["name_en"]), "detail": None, "document_category": d["category"], "required": d["applies"] == "yes",
            "done": d["status"] in ("READY", "NEAR_EXPIRY", "AT_REGISTRATION"), "blocked": False, "depends_on": [], "country_specific": True,
            "source_url": route["primary_source"], "verified_at": route["verified_at"], "verification_status": route["verification_status"],
            "name": d["name_en"], "name_key": d["key"], "rule": None, "route_status": d["status"],
            "toggle": d["provided_by"] == "university" and not d["category"], "who": d["who"],
        })
    return items, summary


def route_checklist(db: Session, case: VisaCase) -> list[dict] | None:
    return route_view(db, case)[0]
