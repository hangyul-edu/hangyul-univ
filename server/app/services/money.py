"""V9 — one money plan (REPORT §58 S2, S8).

One model used by Budget, the program page, offers, the visa page and the sponsor view. Every line answers:
  payer → payee   (who pays whom: UNIVERSITY | APPLICATION_RAIL | HANGYUL | EMBASSY | IMMIGRATION | INSURER | LANDLORD |
                   DORMITORY | EVERYDAY — shops, transport and phone for daily living)
  when            (APPLICATION | OFFER | TUITION_DEADLINE | BEFORE_VISA | BEFORE_ARRIVAL | ON_ARRIVAL | MONTHLY)
  refundable      (YES | NO | UNIVERSITY_RULE | UNKNOWN)
  basis           (OFFICIAL | ESTIMATE | SAMPLE | UNKNOWN, with source + date)
Amounts are KRW unless ``currency`` says otherwise; non-KRW lines (embassy fees) are never silently converted into the
KRW totals.

"Money you must show (not pay)" — ``funds_to_show`` — comes from the student's researched visa route (amount for the
university's region, holding period, whose name, certificate age), as codes + params so the UI translates it; the
embassy's own wording is kept only as ``published_en`` for an "as published" disclosure.

Announced-but-not-in-force rule changes (MOJ 2026-10-07) are returned separately with status ANNOUNCED and a source —
never mixed into the current rules.

S8 refund path: ``ensure_refund_case`` opens a REFUND service case when a visa is refused after tuition was paid, or an
application is withdrawn after tuition was paid.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    Application,
    ApplicationStatusHistory,
    Dormitory,
    Program,
    SavedUniversity,
    Scholarship,
    ServiceCase,
    StudentProfile,
    University,
    VisaCase,
)
from app.models.enums import ApplicationStatus as S
from app.models.enums import VisaStatus
from app.services import concierge
from app.services.budget import program_budget
from app.services.state_machine import TERMINAL, reached

# ------------------------------------------------------------------------------------------------ official figures
# Residence card fee — Korea Immigration Service notice "외국인등록증 발급 수수료 인상 안내 (2025. 1. 1. ~)": KRW 30,000 → 35,000.
# Research: docs/research/arrival-official.json → residence_card_registration (VERIFIED, 2026-09-29).
RESIDENCE_CARD = {
    "amount": 35_000, "basis": "OFFICIAL", "verified_at": "2026-10-10",  # fee re-verified in v9-arrival-revalidation.md §2.1
    "source_url": "https://www.immigration.go.kr/bbs/immigration/47/590299/artclView.do?layout=unknown",
    "source_label": "Korea Immigration Service (HiKorea)",
}
# NHIS student premium — 50 % reduction for D-2/D-4 is on NHIS; the 2026 amount (≈ KRW 79,320 / month) is stated by
# university notices only (Sungshin, SeoulTech), NOT by NHIS → ESTIMATE, shown as "about".
# Research: arrival-official.json → nhis_student_premium (PARTIAL) and v9-arrival-revalidation.md §2.2.
NHIS_MONTHLY = {
    "amount": 79_320, "basis": "ESTIMATE", "verified_at": "2026-09-29",
    "source_url": "https://www.sungshin.ac.kr/bbs/main_eng/4941/152421/artclView.do",
    "source_label": "University notice (2026 NHIS premium; not stated by NHIS itself)",
    "nhis_url": "https://www.nhis.or.kr/english/wbheaa02900m01.do",
}
CAPITAL_REGIONS = {"Seoul", "Gyeonggi", "Incheon"}

# MOJ 2026-10-07 package and MOE 2026-09-08 announcements — NOT in force. Shown only as "announced".
ANNOUNCED = [
    {"code": "TOPIK4_FINANCIAL_EXEMPTION", "announced_on": "2026-10-07", "target": "H2_2026",
     "source_url": "https://www.moj.go.kr/bbs/moj/182/500463/download.do", "source_label": "Ministry of Justice press release (2026-10-07)"},
    {"code": "STUDY_DEPOSIT_SCHEME", "announced_on": "2026-10-07", "target": "H1_2027",
     "source_url": "https://www.moj.go.kr/bbs/moj/182/500465/download.do", "source_label": "Ministry of Justice strategy draft (2026-10-07)"},
    {"code": "REFUND_TO_STUDENT_ACCOUNT", "announced_on": "2026-09-08", "target": "OCT_2026",
     "source_url": "https://m.koreaherald.com/article/10866638", "source_label": "Korea Herald (MOE announcement, 2026-09)"},
]
# Payment-route guard (research §2 findings 6–8; KU GSMI and PNU notices).
PAYMENT_GUARD = {
    "codes": ["PAY_UNIVERSITY_DIRECTLY", "OWN_NAME", "NO_MONEY_CHANGERS", "KEEP_RECEIPT"],
    "source_url": "https://kugsmi.korea.ac.kr/bbs/kugsmi/74/180398/download.do",
    "source_label": "Korea University notice to admitted international students",
}
# Funds must be genuinely held: a temporary deposit made only to obtain a balance certificate is unlawful (대법원 2024도14827).
GENUINE_FUNDS = {"code": "GENUINE_FUNDS_ONLY", "source_url": "https://www.lawtalk.co.kr/case-lenses/47848",
                 "source_label": "Supreme Court 2024도14827 (case summary)"}

PAYEE_OF = {"tuition": "UNIVERSITY", "application_fee": "APPLICATION_RAIL", "dormitory": "DORMITORY", "living": "EVERYDAY",
            "insurance": "INSURER", "visa_fee": "EMBASSY", "residence_card": "IMMIGRATION", "hangyul_fee": "HANGYUL"}
WHEN_OF = {"application_fee": "APPLICATION", "tuition": "TUITION_DEADLINE", "dormitory": "BEFORE_ARRIVAL", "visa_fee": "BEFORE_VISA",
           "residence_card": "ON_ARRIVAL", "insurance": "MONTHLY", "living": "MONTHLY", "hangyul_fee": "APPLICATION"}
REFUND_OF = {"application_fee": "NO", "tuition": "UNIVERSITY_RULE", "dormitory": "UNIVERSITY_RULE", "visa_fee": "NO",
             "residence_card": "NO", "insurance": "NO", "living": "NO", "hangyul_fee": "UNKNOWN"}
WHEN_ORDER = ["APPLICATION", "OFFER", "TUITION_DEADLINE", "BEFORE_VISA", "BEFORE_ARRIVAL", "ON_ARRIVAL", "MONTHLY"]


def _iso(v) -> str | None:
    return v.isoformat() if v else None


# ================================================================================================ funds to show
_CUR = r"(KRW|USD)\s?([\d,]{4,})"
_CAP = re.compile(r"seoul|capital|metro|gyeonggi|incheon", re.I)
_OTHER = re.compile(r"other region|regional|non-capital", re.I)


def _amounts(text: str, visa_type: str | None) -> list[dict]:
    """[{currency, amount, area: CAPITAL|OTHER|ANY}] from an embassy amount sentence."""
    if not text:
        return []
    t = text
    # China lists degree and language programme amounts in one table.
    if "Language programme" in t:
        deg, lang = t.split("Language programme", 1)
        t = lang if visa_type == "D-4-1" else deg
    out = []
    for seg in re.split(r"\s/\s|;\s", t):
        m = re.search(_CUR, seg)
        if not m:
            continue
        area = "OTHER" if _OTHER.search(seg) else "CAPITAL" if _CAP.search(seg) else "ANY"
        out.append({"currency": m.group(1), "amount": int(m.group(2).replace(",", "")), "area": area})
    # A degree-programme sentence that names both areas in one segment ("Seoul … KRW 20M; regional … KRW 16M").
    return out


def _months(text: str) -> list[int]:
    return [int(x) for x in re.findall(r"(\d+)\+?[\s-]*months?", text or "", re.I)]


def parse_funds(financial: dict | None, visa_type: str | None) -> dict | None:
    """Structured, translatable reading of a route's financial rule. Unknowns stay None."""
    if not financial or not isinstance(financial, dict):
        return None
    amount_text = financial.get("amount") or ""
    hold = financial.get("holding_period") or ""
    sponsor = financial.get("sponsor_rules") or ""
    if not amount_text:
        kind = "NOT_STATED"
    elif re.search(r"may differ|admission certificate|no fixed figure", amount_text, re.I):
        kind = "PER_ADMISSION_CERTIFICATE"
    else:
        kind = "FIXED"
    amounts = _amounts(amount_text, visa_type) if kind == "FIXED" else []
    if kind == "FIXED" and not amounts:
        kind = "PER_ADMISSION_CERTIFICATE" if amount_text else "NOT_STATED"
    months = _months(hold)
    lower = bool(re.search(r"consult|lower-tier|lower tier|certain universit", hold, re.I))
    held_kind = "HELD" if re.search(r"deposit|held|kept|frozen", hold, re.I) else "HISTORY" if re.search(r"statement|history|transaction", hold, re.I) else None
    days_held = None
    m = re.search(r"(?:kept|held|deposited)[^;]*?(\d+)\s*days", hold, re.I)
    if m and not months:
        days_held = int(m.group(1))
    elif m and re.search(r"at least (\d+) days", hold, re.I) and not re.search(r"at least \d+\+?\s*months?", hold, re.I):
        days_held = int(m.group(1))
    period = None
    if days_held:
        period = {"days": days_held, "kind": "HELD"}
    elif months:
        period = {"months": months[0], "kind": held_kind or "HISTORY"}
    longer = None
    if lower and months:
        base = period.get("months") if period else None
        if base is None or max(months) > base:
            longer = max(months)
    cert = None
    c = re.search(r"(?:issued|valid)\s+(?:within|no more than)\s+(\d+)\s*(days?|weeks?)", hold, re.I) or \
        re.search(r"no more than\s+(\d+)\s*(days?|weeks?)", hold, re.I)
    if c:
        cert = int(c.group(1)) * (7 if c.group(2).lower().startswith("week") else 1)
    if re.search(r"own name", sponsor, re.I):
        whose = "OWN_NAME"
    elif re.search(r"parent", sponsor, re.I):
        whose = "STUDENT_OR_PARENT"
    else:
        whose = "UNKNOWN"
    waived = bool(re.search(r"(waived|exempt|not required)[^.]*excellent", sponsor, re.I))
    return {"kind": kind, "amounts": amounts, "period": period, "longer_months_lower_tier": longer,
            "certificate_max_age_days": cert, "whose": whose, "waived_if_excellent": waived,
            "published_en": [x for x in (amount_text, hold, sponsor) if x], "source_url": financial.get("source_url")}


def pick_amount(funds: dict | None, region: str | None) -> dict | None:
    """The amount for the student's university region (capital area or not); None when the region is unknown and both differ."""
    if not funds or not funds["amounts"]:
        return None
    amts = funds["amounts"]
    if len(amts) == 1 or region is None:
        return amts[0] if len({(a["currency"], a["amount"]) for a in amts}) == 1 else None
    want = "CAPITAL" if region in CAPITAL_REGIONS else "OTHER"
    return next((a for a in amts if a["area"] == want), next((a for a in amts if a["area"] == "ANY"), None))


def funds_to_show(db: Session, student_user_id, *, nationality: str | None = None, level=None, region: str | None = None,
                  tier: str | None = None) -> dict:
    """The visa 'money you must show (not pay)' block, available before the visa stage.

    Uses the student's nationality and target degree (or the given values) to find the researched route, and the target
    program's university region to choose the capital-area or regional amount.
    """
    from app.services import visa_routes

    prof = db.scalar(select(StudentProfile).where(StudentProfile.user_id == student_user_id)) if student_user_id else None
    ctx = target_context(db, student_user_id) if student_user_id else {}
    nationality = nationality or (prof.nationality if prof else None)
    prog = ctx.get("program")
    uni = ctx.get("university")
    level = level or (prog.degree_level if prog else (prof.target_degree if prof else None))
    region = region or (uni.region if uni else None)
    tier = tier or ((uni.visa_certification or "UNKNOWN") if uni else None)
    visa_type = visa_routes.visa_type_for(level)
    out = {"status": "NO_ROUTE", "nationality": nationality, "visa_type": visa_type, "region": region,
           "region_kind": ("CAPITAL" if region in CAPITAL_REGIONS else "OTHER") if region else None,
           "university": uni.name_en if uni else None, "university_id": str(uni.id) if uni else None, "genuine": GENUINE_FUNDS, "announced": ANNOUNCED[:2]}
    if not nationality or not visa_type:
        out["status"] = "NEEDS_PROFILE"
        return out
    route = visa_routes.find_route(db, nationality, visa_type, level)
    if route is None or route.verification_status == "NEEDS_REVIEW":
        return out
    f = parse_funds(visa_routes.effective_financial(route), route.visa_type)
    out["scheduled"] = visa_routes.scheduled_announced(route)  # e.g. Kyrgyzstan 2027-01-01: announced, not yet in force
    if f is None:
        return out
    chosen = pick_amount(f, region)
    out.update({"status": "RESOLVED", "route_visa_type": route.visa_type, "verification": route.verification_status,
                "verified_at": _iso(route.verified_at), "funds": f, "amount": chosen,
                "waived_here": bool(f["waived_if_excellent"] and tier == "EXCELLENT")})
    return out


# ================================================================================================ target program
def target_context(db: Session, student_user_id) -> dict:
    """The program the money plan is about: the most advanced active application, else the latest saved program."""
    apps = list(db.scalars(select(Application).where(Application.student_user_id == student_user_id).order_by(Application.updated_at.desc())).all())
    rank = [S.ENROLLED, S.VISA_ISSUED, S.VISA_SUBMITTED, S.VISA_PREPARATION, S.ADMISSION_CERTIFICATE_ISSUED, S.ADMISSION_CERTIFICATE_PENDING,
            S.TUITION_PAID, S.TUITION_PENDING, S.OFFER_ACCEPTED, S.OFFERED]
    live = [a for a in apps if a.status not in TERMINAL]
    app = next((a for st in rank for a in live if a.status == st), None) or (live[0] if live else None)
    prog = db.get(Program, app.program_id) if app else None
    if prog is None:
        saved = db.scalar(select(SavedUniversity).where(SavedUniversity.user_id == student_user_id, SavedUniversity.program_id.is_not(None))
                          .order_by(SavedUniversity.created_at.desc()))
        prog = db.get(Program, saved.program_id) if saved else None
    uni = db.get(University, prog.university_id) if prog else None
    return {"application": app, "program": prog, "university": uni}


# ================================================================================================ lines
@dataclass
class MoneyLine:
    key: str
    amount_min: int | None
    amount_max: int | None
    currency: str
    period: str
    payee: str
    when: str
    refundable: str
    basis: str
    source_url: str | None = None
    source_label: str | None = None
    verified_at: str | None = None
    note_code: str | None = None
    published_en: str | None = None
    guard: bool = False  # the payment-route guard applies (pay the university directly, own name)
    payer: str = "STUDENT_FAMILY"

    def dict(self) -> dict:
        return {k: getattr(self, k) for k in self.__dataclass_fields__}


def _visa_fee_line(route) -> MoneyLine:
    from app.services import visa_routes

    fees = route.fees if route is not None else None
    vt = route.visa_type if route is not None else None
    if route is not None and visa_routes.fee_free(route):
        # The embassy's fee table exempts this route's nationals (e.g. Thai nationals: FREE) — a real 0, not "unknown".
        return MoneyLine("visa_fee", 0, 0, "KRW", "ONCE", "EMBASSY", "BEFORE_VISA", "NO", "OFFICIAL" if route.verification_status == "VERIFIED" else "ESTIMATE",
                         (fees.get("source_url") if isinstance(fees, dict) else None), "Embassy of the Republic of Korea", _iso(route.verified_at),
                         "VISA_FEE_FREE", fees.get("details") if isinstance(fees, dict) else None)
    if isinstance(fees, dict) and isinstance(fees.get("amount"), (int, float)) and fees.get("currency"):
        basis = "OFFICIAL" if route.verification_status == "VERIFIED" else "ESTIMATE"
        return MoneyLine("visa_fee", int(fees["amount"]), int(fees["amount"]), fees["currency"], "ONCE", "EMBASSY", "BEFORE_VISA", "NO", basis,
                         fees.get("source_url") or None, "Embassy of the Republic of Korea", _iso(route.verified_at),
                         "VISA_FEE_ROUTE" if basis == "OFFICIAL" else "VISA_FEE_PARTIAL", fees.get("details"))
    text = None
    if isinstance(fees, dict):
        text = fees.get("visa_fee") or fees.get("details")
    elif isinstance(fees, str):
        text = fees
    if route is not None and text:
        return MoneyLine("visa_fee", None, None, "KRW", "ONCE", "EMBASSY", "BEFORE_VISA", "NO", "UNKNOWN",
                         (fees.get("source_url") if isinstance(fees, dict) else None) or (route.sources[0]["url"] if route.sources else None),
                         "Embassy of the Republic of Korea", _iso(route.verified_at), "VISA_FEE_AS_PUBLISHED", text)
    return MoneyLine("visa_fee", None, None, "KRW", "ONCE", "EMBASSY", "BEFORE_VISA", "NO", "UNKNOWN", note_code="VISA_FEE_UNKNOWN" if vt else "VISA_FEE_NO_ROUTE")


def plan_lines(budget_lines: list, *, route=None, visa_type: str | None = None, hangyul_fee: dict | None = None) -> list[dict]:
    """Money-plan lines from a ``ProgramBudget``'s lines + the researched official figures."""
    out: list[MoneyLine] = []
    for ln in budget_lines:
        key = ln.key
        if key in ("insurance", "visa_fee"):
            continue  # replaced by researched figures below
        refundable = REFUND_OF.get(key, "UNKNOWN")
        lo, hi, period, note = ln.amount_min, ln.amount_max, ln.period, (f"{key.upper()}_UNKNOWN" if ln.amount_min is None else None)
        # Say amounts the way they are paid: living per month, dormitory per semester, tuition per year (two payments).
        if key == "living" and lo is not None and period == "YEAR":
            lo, hi, period = round(lo / 12, -3), round((hi or lo) / 12, -3), "MONTH"
        elif key == "dormitory" and lo is not None and period == "YEAR":
            lo, hi, period, note = lo // 2, (hi or lo) // 2, "SEMESTER", "DORM_PER_SEMESTER"
        elif key == "tuition" and lo is not None and period == "YEAR":
            lo, hi, period, note = lo // 2, (hi or lo) // 2, "SEMESTER", "TUITION_PER_SEMESTER"
        out.append(MoneyLine(key, int(lo) if lo is not None else None, int(hi) if hi is not None else None, "KRW", period,
                             PAYEE_OF.get(key, "UNIVERSITY"), WHEN_OF.get(key, "BEFORE_ARRIVAL"), refundable, ln.basis, ln.source_url, None,
                             ln.verified_at, note, guard=key == "tuition"))
    out.append(_visa_fee_line(route))
    # Residence card: everyone staying over 90 days (D-2 and D-4 included).
    rc = RESIDENCE_CARD
    out.append(MoneyLine("residence_card", rc["amount"], rc["amount"], "KRW", "ONCE", "IMMIGRATION", "ON_ARRIVAL", "NO", rc["basis"],
                         rc["source_url"], rc["source_label"], rc["verified_at"], "RESIDENCE_CARD_90_DAYS"))
    # Health insurance (NHIS): monthly; D-2 from registration, D-4 six months after entry (NHIS).
    nh = NHIS_MONTHLY
    d4 = (visa_type or "").startswith("D-4")
    out.append(MoneyLine("insurance", nh["amount"], nh["amount"], "KRW", "MONTH", "INSURER", "MONTHLY", "NO", nh["basis"], nh["source_url"],
                         nh["source_label"], nh["verified_at"], "NHIS_D4" if d4 else "NHIS_D2"))
    if hangyul_fee and hangyul_fee.get("amount_minor") is not None and hangyul_fee.get("currency"):
        amt = hangyul_fee["amount_minor"] if hangyul_fee["currency"] == "KRW" else hangyul_fee["amount_minor"] // 100
        out.append(MoneyLine("hangyul_fee", amt, amt, hangyul_fee["currency"], "ONCE", "HANGYUL", "APPLICATION", "UNKNOWN",
                             "SAMPLE" if hangyul_fee.get("is_demo") else "OFFICIAL", note_code=f"HANGYUL_FEE_{hangyul_fee.get('status', 'NONE')}"))
    order = {w: i for i, w in enumerate(WHEN_ORDER)}
    out.sort(key=lambda x: order.get(x.when, 99))
    return [x.dict() for x in out]


def when_totals(lines: list[dict]) -> list[dict]:
    """KRW subtotal per moment ('when'); other currencies are listed, never converted."""
    groups: dict[str, dict] = {}
    for ln in lines:
        g = groups.setdefault(ln["when"], {"when": ln["when"], "krw_min": 0, "krw_max": 0, "other": [], "unknown": 0})
        if ln["amount_min"] is None:
            g["unknown"] += 1
        elif ln["currency"] == "KRW":
            g["krw_min"] += ln["amount_min"]
            g["krw_max"] += ln["amount_max"] or ln["amount_min"]
        else:
            g["other"].append({"currency": ln["currency"], "amount": ln["amount_min"], "key": ln["key"]})
    order = {w: i for i, w in enumerate(WHEN_ORDER)}
    return sorted(groups.values(), key=lambda g: order.get(g["when"], 99))


def program_plan(db: Session, student_user_id, program: Program, *, housing: str | None = None, hangyul_fee: dict | None = None) -> dict:
    """The money plan for one program, for one student."""
    from app.services import visa_routes

    uni = db.get(University, program.university_id)
    dorms = list(db.scalars(select(Dormitory).where(Dormitory.university_id == uni.id)))
    schol = list(db.scalars(select(Scholarship).where((Scholarship.university_id == uni.id) | (Scholarship.university_id.is_(None)))))
    prof = db.scalar(select(StudentProfile).where(StudentProfile.user_id == student_user_id)) if student_user_id else None
    b = program_budget(program, uni, dorms, schol, prof, housing, date.today())
    vt = visa_routes.visa_type_for(program.degree_level)
    route = visa_routes.find_route(db, prof.nationality if prof else None, vt, program.degree_level) if prof else None
    lines = plan_lines(b.lines, route=route, visa_type=vt, hangyul_fee=hangyul_fee)
    return {"program_id": str(program.id), "program_name": program.name_en, "university_name": uni.name_en, "university_slug": uni.slug,
            "region": uni.region, "visa_type": vt, "lines": lines, "by_when": when_totals(lines),
            "first_year_gross_min": b.first_year_gross_min, "first_year_gross_max": b.first_year_gross_max, "range_basis": b.range_basis}


def money_plan(db: Session, student_user_id, *, program: Program | None = None, housing: str | None = None, hangyul_fee: dict | None = None) -> dict:
    ctx = target_context(db, student_user_id)
    program = program or ctx.get("program")
    plan = program_plan(db, student_user_id, program, housing=housing, hangyul_fee=hangyul_fee) if program else None
    uni = db.get(University, program.university_id) if program else None
    show = funds_to_show(db, student_user_id, level=program.degree_level if program else None, region=uni.region if uni else None,
                         tier=(uni.visa_certification or "UNKNOWN") if uni else None)
    return {"program": plan, "funds_to_show": show, "guard": PAYMENT_GUARD, "announced": ANNOUNCED,
            "refund": refund_summary(db, student_user_id), "as_of": date.today().isoformat()}


# ================================================================================================ S8 refund path
REFUND_TABLE = {
    "OPEN": concierge.St("team", "open", ("ASKED_UNIVERSITY", "WAITING_STUDENT", "REFUNDED", "CANCELLED")),
    "WAITING_STUDENT": concierge.St("student", "open", ("ASKED_UNIVERSITY", "REFUNDED", "CANCELLED")),
    "ASKED_UNIVERSITY": concierge.St("external", "open", ("WAITING_STUDENT", "REFUNDED", "CANCELLED")),
    "REFUNDED": concierge.St("none", "done", ("OPEN",)),
    "CANCELLED": concierge.St("none", "cancelled", ("OPEN",)),
}
concierge.register_case_type("REFUND", REFUND_TABLE, "OPEN", sla_hours=48)
concierge.TYPE_LABEL_EN.setdefault("REFUND", "Tuition refund")


def _paid_tuition(db: Session, app: Application) -> bool:
    if reached(app.status, S.TUITION_PAID) and app.status not in (S.WITHDRAWN, S.REJECTED):
        return True
    return db.scalar(select(ApplicationStatusHistory.id).where(ApplicationStatusHistory.application_id == app.id,
                                                              ApplicationStatusHistory.to_status == S.TUITION_PAID).limit(1)) is not None


def refund_trigger(db: Session, student_user_id) -> dict | None:
    """{trigger, application, at} when the student may be owed a tuition refund; None otherwise."""
    from app.models.v5_visa_routes import VisaCaseTrack

    apps = list(db.scalars(select(Application).where(Application.student_user_id == student_user_id)).all())
    visa = db.scalar(select(VisaCase).where(VisaCase.student_user_id == student_user_id).order_by(VisaCase.created_at.desc()))
    track = db.scalar(select(VisaCaseTrack).where(VisaCaseTrack.visa_case_id == visa.id)) if visa else None
    refused = visa is not None and visa.status == VisaStatus.REJECTED
    if refused:
        app = next((a for a in apps if visa.application_id and a.id == visa.application_id), None) or next((a for a in apps if _paid_tuition(db, a)), None)
        if app is not None and _paid_tuition(db, app):
            at = (track.decision_on if track and track.decision_on else (visa.updated_at.date() if visa.updated_at else date.today()))
            return {"trigger": "VISA_REFUSED", "application": app, "at": at}
    for a in apps:
        if a.status == S.WITHDRAWN and _paid_tuition(db, a):
            h = db.scalar(select(ApplicationStatusHistory).where(ApplicationStatusHistory.application_id == a.id,
                                                                ApplicationStatusHistory.to_status == S.WITHDRAWN)
                          .order_by(ApplicationStatusHistory.created_at.desc()))
            return {"trigger": "WITHDRAWN_AFTER_TUITION", "application": a, "at": h.created_at.date() if h else (a.updated_at.date() if a.updated_at else date.today())}
    return None


def ensure_refund_case(db: Session, student_user_id, *, actor_id=None) -> ServiceCase | None:
    """Open (once) the REFUND service case for a trigger. Idempotent per application."""
    trig = refund_trigger(db, student_user_id)
    if trig is None:
        return None
    app = trig["application"]
    existing = db.scalar(select(ServiceCase).where(ServiceCase.student_user_id == student_user_id, ServiceCase.case_type == "REFUND",
                                                   ServiceCase.application_id == app.id))
    if existing is not None:
        return existing
    uni = db.get(University, app.university_id)
    details = {"trigger": trig["trigger"], "since": trig["at"].isoformat(), "university": uni.name_en if uni else None, "university_id": str(uni.id) if uni else None,
               "amount_paid_krw": app.tuition_amount_krw, "rule": {"known": False, "code": "COUNSELOR_CONFIRMS"},
               "own_account": True}
    return concierge.create_case(db, student_user_id, "REFUND", actor_id=actor_id, details=details, application_id=app.id, priority="HIGH",
                                 note="Refund case opened automatically")


def refund_summary(db: Session, student_user_id, *, today: date | None = None) -> dict | None:
    """What the student and sponsor see: rule, own-account rule and elapsed days. Never internal notes."""
    today = today or date.today()
    case = db.scalar(select(ServiceCase).where(ServiceCase.student_user_id == student_user_id, ServiceCase.case_type == "REFUND")
                     .order_by(ServiceCase.created_at.desc()))
    if case is None:
        return None
    d = case.details or {}
    since = date.fromisoformat(d["since"]) if d.get("since") else (case.created_at.date() if case.created_at else today)
    st = concierge.state(case)
    return {"case_id": str(case.id), "status": case.status, "waiting_on": st.waiting, "closed": st.bucket in ("done", "cancelled"),
            "trigger": d.get("trigger"), "university": d.get("university"), "amount_paid_krw": d.get("amount_paid_krw"),
            "rule": d.get("rule") or {"known": False, "code": "COUNSELOR_CONFIRMS"}, "own_account": True,
            "since": since.isoformat(), "elapsed_days": max(0, (today - since).days),
            "application_id": str(case.application_id) if case.application_id else None,
            "announced": next(a for a in ANNOUNCED if a["code"] == "REFUND_TO_STUDENT_ACCOUNT")}


def utc_now() -> datetime:
    return datetime.now(timezone.utc)
