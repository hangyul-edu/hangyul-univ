"""Transparent first-year budget per program.

Every line carries its basis so the UI never presents an estimate as a fact:
  OFFICIAL — a CURRENT, sourced record (university / government figure)
  SAMPLE   — a DEMO catalog record (development sample data)
  ESTIMATE — derived by Hangyul from a documented rule of thumb (explained in `note`)
  UNKNOWN  — applies to most students but we hold no reliable figure (amount is None)
Ranges are used wherever the inputs are ranges or estimates. Only ELIGIBLE scholarships reduce the total;
POSSIBLE ones are listed separately so a hope is never subtracted from the bill.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import date

from app.models import Dormitory, Program, Scholarship, StudentProfile, University
from app.services.matching import scholarship_eligibility

# Living cost (the university's published typical monthly cost) is widened to ±15% — it is a typical value, not a quote.
LIVING_SPREAD = (0.85, 1.15)
# When the student lives in a dormitory, rent is paid through the dormitory line; the remaining monthly living cost
# (food, transport, phone, personal) is estimated at 55–75% of the typical all-in figure.
LIVING_WITHOUT_RENT = (0.55, 0.75)


def basis_of(obj) -> str:
    status = getattr(obj, "verification_status", None)
    if status == "CURRENT":
        return "OFFICIAL"
    if status == "DEMO":
        return "SAMPLE"
    return "ESTIMATE" if status else "UNKNOWN"


def _iso(v) -> str | None:
    return v.isoformat() if v else None


@dataclass
class Line:
    key: str
    amount_min: int | None
    amount_max: int | None
    basis: str
    source_url: str | None = None
    verified_at: str | None = None
    note: str | None = None
    period: str = "YEAR"  # YEAR | ONCE | SEMESTER


@dataclass
class ScholarshipLine:
    id: str
    name: str
    kind: str
    status: str  # ELIGIBLE | POSSIBLE
    amount_min: int | None
    amount_max: int | None
    coverage: str | None
    basis: str
    source_url: str | None
    verified_at: str | None


@dataclass
class ProgramBudget:
    program_id: str
    program_name: str
    university_name: str
    university_slug: str
    city: str
    lines: list[Line] = field(default_factory=list)
    scholarships: list[ScholarshipLine] = field(default_factory=list)
    first_year_min: int | None = None
    first_year_max: int | None = None
    monthly_living_min: int | None = None
    monthly_living_max: int | None = None
    cash_before_arrival_min: int | None = None
    cash_before_arrival_max: int | None = None
    unknown_keys: list[str] = field(default_factory=list)
    housing: str = "DORM"  # DORM | OFF_CAMPUS
    # V4: the ONE cost figure shown wherever a program appears — tuition + fees + housing + living for the first year,
    # BEFORE any scholarship, rounded outward to ₩100,000 (no fake precision). Same numbers as `first_year_range()`.
    first_year_gross_min: int | None = None
    first_year_gross_max: int | None = None
    # The best ELIGIBLE scholarship's first-year value (what `first_year_min/max` subtract). None when none applies.
    scholarship_best_min: int | None = None
    scholarship_best_max: int | None = None
    range_basis: str = "UNKNOWN"


def _scholarship_value(s: Scholarship, semester_tuition: int | None) -> tuple[int | None, int | None]:
    """Value over the first year as published: an amount, or a waiver percentage applied to one semester's tuition."""
    if s.amount_krw:
        return s.amount_krw, s.amount_krw
    if semester_tuition and (s.tuition_waiver_percent_min is not None or s.tuition_waiver_percent_max is not None):
        lo = s.tuition_waiver_percent_min if s.tuition_waiver_percent_min is not None else s.tuition_waiver_percent_max
        hi = s.tuition_waiver_percent_max if s.tuition_waiver_percent_max is not None else s.tuition_waiver_percent_min
        return round(semester_tuition * lo / 100), round(semester_tuition * hi / 100)
    return None, None


def program_budget(program: Program, university: University, dorms: list[Dormitory], scholarships: list[Scholarship],
                   profile: StudentProfile | None, housing: str | None = None, today: date | None = None) -> ProgramBudget:
    b = ProgramBudget(program_id=str(program.id), program_name=program.name_en, university_name=university.name_en,
                      university_slug=university.slug, city=university.city)
    sem = program.tuition_per_semester_krw
    pb = basis_of(program)
    # Tuition (two semesters in the first year).
    if sem is not None:
        b.lines.append(Line("tuition", sem * 2, sem * 2, pb, program.source_url, _iso(program.verified_at), "2 semesters", "YEAR"))
    else:
        b.lines.append(Line("tuition", None, None, "UNKNOWN", note="Tuition is not published for this program yet."))
    # Application fee (once).
    if program.application_fee_krw is not None:
        b.lines.append(Line("application_fee", program.application_fee_krw, program.application_fee_krw, pb, program.source_url,
                            _iso(program.verified_at), None, "ONCE"))
    else:
        b.lines.append(Line("application_fee", None, None, "UNKNOWN", period="ONCE"))
    # Housing.
    priced = [d for d in dorms if d.cost_per_semester_krw_min is not None]
    b.housing = housing or ("DORM" if priced else "OFF_CAMPUS")
    if b.housing == "DORM" and priced:
        lo = min(d.cost_per_semester_krw_min for d in priced)
        hi = max((d.cost_per_semester_krw_max or d.cost_per_semester_krw_min) for d in priced)
        d0 = priced[0]
        b.lines.append(Line("dormitory", lo * 2, hi * 2, basis_of(d0), d0.source_url, _iso(d0.verified_at),
                            "2 semesters; vacation stays are usually extra", "YEAR"))
        spread = LIVING_WITHOUT_RENT
        living_note = "Food, transport, phone and personal costs (rent is in the dormitory line)."
    else:
        b.housing = "OFF_CAMPUS"
        spread = LIVING_SPREAD
        living_note = "Typical monthly cost including a shared room or studio off campus."
        if not priced:
            living_note += " No dormitory price is published for this university."
    monthly = university.est_living_cost_monthly_krw
    if monthly:
        mlo, mhi = round(monthly * spread[0], -4), round(monthly * spread[1], -4)
        b.monthly_living_min, b.monthly_living_max = int(mlo), int(mhi)
        b.lines.append(Line("living", int(mlo) * 12, int(mhi) * 12, "ESTIMATE" if basis_of(university) != "SAMPLE" else "SAMPLE",
                            university.source_url, _iso(university.verified_at), living_note, "YEAR"))
    else:
        b.lines.append(Line("living", None, None, "UNKNOWN", note=living_note))
    # Costs almost every student has but for which we hold no reliable figure: shown, never invented.
    b.lines.append(Line("insurance", None, None, "UNKNOWN",
                        note="Health insurance is required. Your counselor confirms the current premium for your situation.", period="YEAR"))
    b.lines.append(Line("visa_fee", None, None, "UNKNOWN",
                        note="The visa fee depends on your nationality and the embassy. Check the embassy page linked in your visa checklist.", period="ONCE"))
    # Scholarships.
    elig_lo = elig_hi = 0
    for s in scholarships:
        res = scholarship_eligibility(s, profile, program) if profile else {"status": "POSSIBLE"}
        if res["status"] == "NOT_ELIGIBLE":
            continue
        lo, hi = _scholarship_value(s, sem)
        b.scholarships.append(ScholarshipLine(str(s.id), s.name, s.kind.value, res["status"], lo, hi, s.coverage, basis_of(s),
                                              s.source_url, _iso(s.verified_at)))
    # A student receives at most one tuition scholarship in practice: take the best ELIGIBLE one, not the sum.
    eligible = [x for x in b.scholarships if x.status == "ELIGIBLE" and x.amount_max]
    if eligible:
        best = max(eligible, key=lambda x: x.amount_max or 0)
        elig_lo, elig_hi = best.amount_min or 0, best.amount_max or 0
    # Totals: known lines only; unknown lines are listed so the UI can say "plus".
    known = [ln for ln in b.lines if ln.amount_min is not None]
    b.unknown_keys = [ln.key for ln in b.lines if ln.amount_min is None]
    if eligible:
        b.scholarship_best_min, b.scholarship_best_max = elig_lo, elig_hi
    if known:
        b.first_year_min = max(0, sum(ln.amount_min for ln in known) - elig_hi)
        b.first_year_max = max(0, sum(ln.amount_max for ln in known) - elig_lo)
    if sem is not None and known:
        b.first_year_gross_min = _round_down(sum(ln.amount_min for ln in known))
        b.first_year_gross_max = _round_up(sum(ln.amount_max for ln in known))
        b.range_basis = "SAMPLE" if any(ln.basis == "SAMPLE" for ln in known) else "ESTIMATE"
    # Cash needed before arrival: first semester tuition, application fee, first dormitory semester, first month of living.
    cash_lo = cash_hi = 0
    if sem is not None:
        cash_lo += max(0, sem - elig_hi)
        cash_hi += max(0, sem - elig_lo)
    for ln in b.lines:
        if ln.key == "application_fee" and ln.amount_min is not None:
            cash_lo += ln.amount_min
            cash_hi += ln.amount_max
        if ln.key == "dormitory" and ln.amount_min is not None:
            cash_lo += ln.amount_min // 2
            cash_hi += ln.amount_max // 2
    if b.monthly_living_min:
        cash_lo += b.monthly_living_min
        cash_hi += b.monthly_living_max
    if sem is not None:
        b.cash_before_arrival_min, b.cash_before_arrival_max = cash_lo, cash_hi
    return b


ROUND_TO = 100_000


def _round_down(v: int) -> int:
    return (v // ROUND_TO) * ROUND_TO


def _round_up(v: int) -> int:
    return -((-v) // ROUND_TO) * ROUND_TO


def first_year_range(program: Program, university: University, dorms: list[Dormitory]) -> dict:
    """Compact first-year range for list/program payloads: {low, high, basis, tuition_year, excludes}.

    Derived from `program_budget` (no scholarship, default housing) so a program never has two different prices.
    `low`/`high` are None when tuition is not published — the UI then says so instead of guessing.
    """
    b = program_budget(program, university, dorms, [], None)
    sem = program.tuition_per_semester_krw
    return {
        "low": b.first_year_gross_min,
        "high": b.first_year_gross_max,
        "basis": b.range_basis,
        "tuition_year": sem * 2 if sem is not None else None,
        "housing": b.housing,
        "excludes": b.unknown_keys,
    }


def as_dict(b: ProgramBudget) -> dict:
    return asdict(b)


# Indicative display rates (KRW per 1 unit). SAMPLE values for display only — never used for payment.
FX_AS_OF = "2026-09-01"
FX_KRW_PER_UNIT = {
    "USD": 1380.0, "EUR": 1500.0, "JPY": 9.3, "CNY": 190.0, "VND": 0.055, "UZS": 0.11, "MNT": 0.40, "NPR": 10.3,
    "MMK": 0.66, "IDR": 0.086, "THB": 39.0, "PHP": 24.0, "BDT": 11.5, "INR": 16.5, "KZT": 2.8, "LKR": 4.6,
}


# ---------------- V4: what an offer actually asks the student to pay ----------------
import re  # noqa: E402

_PCT_OF_SEMESTER = re.compile(r"(\d{1,3}(?:\.\d+)?)\s*%\s*(?:of\s+)?(?:the\s+)?(?:first[- ]semester\s+)?tuition", re.I)
_AMOUNT = re.compile(r"(?:₩|KRW\s?)\s?([\d,]{5,})", re.I)


def offer_scholarship_value(note: str | None, tuition_krw: int | None) -> int | None:
    """Value of the scholarship written in an offer, when it can be computed exactly from the offer itself.

    Understands "30% of first-semester tuition" (applied to the invoiced tuition) and explicit KRW amounts.
    Anything else returns None — the UI then shows the university's wording instead of guessing.
    """
    if not note:
        return None
    m = _AMOUNT.search(note)
    if m:
        return int(m.group(1).replace(",", ""))
    m = _PCT_OF_SEMESTER.search(note)
    if m and tuition_krw:
        pct = float(m.group(1))
        if 0 < pct <= 100:
            return round(tuition_krw * pct / 100)
    return None


def offer_payment(tuition_krw: int | None, scholarship_note: str | None) -> dict:
    """{tuition, scholarship, pay} for the tuition invoice of an offer. `pay` is None when it cannot be computed."""
    sch = offer_scholarship_value(scholarship_note, tuition_krw)
    pay = None
    if tuition_krw is not None:
        pay = max(0, tuition_krw - (sch or 0)) if (sch is not None or not scholarship_note) else None
    return {"tuition": tuition_krw, "scholarship": sch, "pay": pay, "scholarship_note": scholarship_note}
