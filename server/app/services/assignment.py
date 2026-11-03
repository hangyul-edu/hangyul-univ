"""Agency assignment engine. Configurable weighted factors; explicitly NOT driven by raw acceptance rate.

Factors: country expertise, language capability, university expertise, degree expertise, current workload
vs capacity, SLA adherence, (quality-adjusted) historical performance, student preference, time-zone overlap.
Hangyul operations can override any assignment (recorded with reason + audit).
"""
import uuid
from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import AgencyAssignment, Application, Organization, OrganizationMember, StudentProfile, User
from app.models.base import utcnow
from app.models.enums import AssignmentStatus, OrgType, Role

DEFAULT_WEIGHTS = {
    "country": 25,
    "language": 20,
    "university": 10,
    "degree": 10,
    "workload": 20,
    "sla": 10,
    "preference": 5,
}

COUNTRY_LANG = {
    "VN": "vi", "CN": "zh", "MN": "mn", "UZ": "uz", "NP": "ne", "MM": "my", "JP": "ja", "ID": "id", "TH": "th",
    "IN": "hi", "BD": "bn", "PK": "ur", "LK": "si", "PH": "fil", "MY": "ms", "KZ": "kk", "KG": "ky", "TJ": "tg",
    "RU": "ru", "UA": "uk", "TR": "tr", "SA": "ar", "AE": "ar", "EG": "ar", "IR": "fa", "KH": "km", "US": "en",
}


def score_agencies(db: Session, student_user_id, preferred_org_id=None, weights: dict | None = None) -> list[dict]:
    w = {**DEFAULT_WEIGHTS, **(weights or {})}
    profile = db.scalar(select(StudentProfile).where(StudentProfile.user_id == student_user_id))
    user = db.get(User, student_user_id)
    nationality = profile.nationality if profile else None
    lang = COUNTRY_LANG.get(nationality or "", None) or (user.locale if user else None)
    target_unis = {
        str(u) for u in db.scalars(select(Application.university_id).where(Application.student_user_id == student_user_id))
    } | set((profile.preferred_university_ids or []) if profile else [])
    degree = profile.target_degree.value if profile and profile.target_degree else None

    agencies = db.scalars(select(Organization).where(Organization.type == OrgType.AGENCY, Organization.is_partner.is_(True))).all()
    active_counts = dict(
        db.execute(
            select(AgencyAssignment.organization_id, func.count())
            .where(AgencyAssignment.status == AssignmentStatus.ACTIVE)
            .group_by(AgencyAssignment.organization_id)
        ).all()
    )
    since = utcnow() - timedelta(days=90)
    sla_rows = db.execute(
        select(
            AgencyAssignment.organization_id,
            func.count(),
            func.count().filter(AgencyAssignment.first_response_at <= AgencyAssignment.first_response_due_at),
        )
        .where(AgencyAssignment.created_at >= since, AgencyAssignment.first_response_at.is_not(None))
        .group_by(AgencyAssignment.organization_id)
    ).all()
    sla = {org: (ok / total if total else None) for org, total, ok in sla_rows}

    results = []
    for a in agencies:
        specs = {(s.kind, s.value) for s in a.specialties}
        breakdown = []

        def add(key, ratio, note):
            breakdown.append({"factor": key, "weight": w[key], "points": round(w[key] * ratio, 1), "note": note})

        add("country", 1.0 if ("COUNTRY", nationality) in specs else 0.0, f"Country expertise: {nationality or 'unknown'}")
        langs = set(a.languages or [])
        add("language", 1.0 if lang and lang in langs else (0.3 if "en" in langs else 0.0), f"Speaks student's language ({lang})")
        uni_hits = sum(1 for u in target_unis if ("UNIVERSITY", u) in specs)
        add("university", min(1.0, uni_hits / max(1, len(target_unis))) if target_unis else 0.5, "Experience with target universities")
        add("degree", 1.0 if degree and ("DEGREE", degree) in specs else 0.3, f"Degree expertise: {degree or 'unknown'}")
        cap = a.capacity_active_cases or 50
        load = active_counts.get(a.id, 0) / cap
        add("workload", max(0.0, 1.0 - load), f"Workload {active_counts.get(a.id, 0)}/{cap} active cases")
        s = sla.get(a.id)
        add("sla", s if s is not None else 0.6, "First-response SLA met in last 90 days" if s is not None else "No SLA history yet (neutral)")
        add("preference", 1.0 if preferred_org_id and a.id == preferred_org_id else 0.0, "Student preference")
        total = round(sum(b["points"] for b in breakdown), 1)
        at_capacity = load >= 1.0
        results.append({"organization_id": str(a.id), "name": a.name, "score": total, "breakdown": breakdown, "at_capacity": at_capacity})
    results.sort(key=lambda r: (r["at_capacity"], -r["score"]))
    return results


def pick_counselor(db: Session, org_id, *, exclude: set | None = None, student_user_id=None) -> OrganizationMember | None:
    """V9: the available person with the most room. Candidates = active counselors (managers only as overflow) who are
    not on leave; order = counselors first, then expertise fit for this student (country, language), then the lowest
    weighted load against personal capacity (services/agency_ops.member_loads — the Team page numbers), then fewest cases."""
    from app.services import agency_ops

    today = utcnow().date()
    counselors = [m for m in db.scalars(
        select(OrganizationMember).where(
            OrganizationMember.organization_id == org_id,
            OrganizationMember.role == Role.AGENCY_ADMIN,
            OrganizationMember.is_active.is_(True),
        )
    ).all() if not (m.on_leave_until and m.on_leave_until >= today) and m.user_id not in (exclude or set())]
    if not counselors:
        return None
    loads = {r["user_id"]: r for r in agency_ops.member_loads(db, org_id)["people"]}
    profile = db.scalar(select(StudentProfile).where(StudentProfile.user_id == student_user_id)) if student_user_id else None
    nat = profile.nationality if profile else None
    lang = COUNTRY_LANG.get(nat or "")

    def fit(m: OrganizationMember) -> int:
        return -((1 if nat and nat in (m.countries or []) else 0) + (1 if lang and lang in (m.languages or []) else 0))

    def ratio(m: OrganizationMember) -> float:
        r = loads.get(str(m.user_id))
        if not r:
            return 0.0
        return r["load"] if r["load"] is not None else r["points"] / 100.0

    return min(counselors, key=lambda m: (ratio(m) > 1, fit(m), ratio(m), (loads.get(str(m.user_id)) or {}).get("cases", 0)))


def assign(db: Session, student_user_id, *, org_id=None, counselor_user_id=None, order_id=None, assigned_by="ENGINE", reason=None) -> AgencyAssignment:
    ranked = [] if org_id else score_agencies(db, student_user_id)
    chosen_org = org_id or (ranked[0]["organization_id"] if ranked else None)
    if chosen_org is None:
        raise ValueError("No partner agency available")
    chosen_org = uuid.UUID(str(chosen_org))
    for existing in db.scalars(
        select(AgencyAssignment).where(AgencyAssignment.student_user_id == student_user_id, AgencyAssignment.status == AssignmentStatus.ACTIVE)
    ):
        existing.status = AssignmentStatus.REASSIGNED
        existing.ended_at = utcnow()
    counselor = counselor_user_id or (m.user_id if (m := pick_counselor(db, chosen_org, student_user_id=student_user_id)) else None)
    org = db.get(Organization, chosen_org)
    top = next((r for r in ranked if r["organization_id"] == str(chosen_org)), None)
    a = AgencyAssignment(
        student_user_id=student_user_id,
        organization_id=chosen_org,
        counselor_user_id=counselor,
        status=AssignmentStatus.ACTIVE,
        score=top["score"] if top else None,
        score_breakdown=top["breakdown"] if top else None,
        assigned_by=assigned_by,
        override_reason=reason,
        order_id=order_id,
        first_response_due_at=utcnow() + timedelta(hours=org.sla_first_response_hours or 24),
    )
    db.add(a)
    db.flush()
    return a
