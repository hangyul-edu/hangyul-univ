"""V8 Agency Today — "Who needs me now?"

One ranked list of students, each with the plain reasons it ranks where it does. There is no score: the order is a
fixed, explainable rule that the response states (`rule`) and every item carries (`rank`):

  1. the item's most urgent reason, by tier (1 = act now … 5 = nudge),
  2. within a tier: the more reasons at that tier first,
  3. then by the reason's clock — the earliest due date, or the longest wait.

Reasons (tier · code — sentence on the page):
  1 · first_reply_late     First reply is late (assignment's first-response time has passed)
  1 · deadline_missing     Deadline in ≤ 3 days and required items are still missing
  2 · reply_waiting        The student wrote and is waiting for our answer for more than 24 h
  2 · review_late          Documents waiting for review longer than the 48 h review time
  2 · essay_late           An essay review is past its promised time
  2 · university_request   The university asked for one more document
  3 · deadline_soon        A deadline within 7 days
  3 · task_overdue         A team task for this student is overdue
  3 · reply_new            The student wrote and is waiting for our answer
  3 · first_reply_due      First reply due within 24 h
  4 · review_waiting       Documents waiting for review (within the review time)
  5 · student_silent       We are waiting on the student and they have been silent for more than 3 days

V9 (REPORT §59 A2) — the list absorbs the category counts Today used to show beside it. New reasons:
  1 · submission_issue     A failed submission attempt is recorded and nothing was submitted since
  2 · confirmation_missing Handed off / reported submitted > 2 days ago, no reference or receipt yet
  2 · submit_authorized    The student authorised the agency to submit; the agency must submit now
  2 · visa_overdue         A visa embassy request is past its date
  2 · service_late         A service case is past its SLA
  3 · ready_to_submit      Ready: the counselor's final check and hand-off (or submission) is next
  3 · visa_action          A visa appointment within 7 days, an embassy request due, a pack ready to review
  3 · service_action       A service case needs action (urgent, flight delayed, reconfirm, pickup soon, needs an owner)
  3 · essay_due            An essay review is due within 48 h
  4 · document_check       A document check needs a person (name/date mismatch, wrong type, poor scan, duplicate)
  4 · final_review         Not yet Ready, but every required item is ready: the final review is next

Every reason belongs to one work type (WORK_TYPES); `ranked(type=…)` filters the same list to the students with a reason
of that type and ranks them by those reasons only, so the chip count equals the rows it shows.

Every reason is computed with the predicate of the queue its action opens (caseload / writing), so the list never
claims work that the linked screen does not show.
"""
from __future__ import annotations

import uuid
from collections import defaultdict
from datetime import datetime, timedelta

from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session, selectinload

from app.api.common import iso
from app.models import (
    AgencyAssignment,
    Application,
    Conversation,
    Document,
    DocumentRequest,
    Message,
    Order,
    ProgramIntake,
    ServiceProduct,
    StudentProfile,
    Task,
    University,
    User,
)
from app.models.base import utcnow
from app.models.enums import AssignmentStatus, MessageVisibility, OrderStatus
from app.services import caseload, waiting

TIERS = {
    "first_reply_late": 1, "deadline_missing": 1, "submission_issue": 1,
    "reply_waiting": 2, "review_late": 2, "essay_late": 2, "university_request": 2,
    "confirmation_missing": 2, "submit_authorized": 2, "visa_overdue": 2, "service_late": 2,
    "deadline_soon": 3, "task_overdue": 3, "reply_new": 3, "first_reply_due": 3,
    "ready_to_submit": 3, "visa_action": 3, "service_action": 3, "essay_due": 3,
    "review_waiting": 4, "document_check": 4, "final_review": 4,
    "student_silent": 5,
}
# V9 work types (Today's filter chips). One type per reason.
WORK_TYPES = ("documents", "writing", "applications", "messages", "university_requests", "visa", "services", "deadlines", "tasks")
TYPE_OF = {
    "review_late": "documents", "review_waiting": "documents", "document_check": "documents",
    "essay_late": "writing", "essay_due": "writing",
    "ready_to_submit": "applications", "final_review": "applications", "submit_authorized": "applications",
    "confirmation_missing": "applications", "submission_issue": "applications",
    "first_reply_late": "messages", "first_reply_due": "messages", "reply_waiting": "messages", "reply_new": "messages", "student_silent": "messages",
    "university_request": "university_requests",
    "visa_overdue": "visa", "visa_action": "visa",
    "service_late": "services", "service_action": "services",
    "deadline_missing": "deadlines", "deadline_soon": "deadlines",
    "task_overdue": "tasks",
}
# Reason → the waiting-model code whose named person owns it (caseload._named_owners); others fall back to the counselor.
NAMED_BY = {"review_late": "review", "review_waiting": "review", "essay_late": "essay_review", "essay_due": "essay_review",
            "task_overdue": "task", "service_late": "service", "service_action": "service"}
# V13 (brief Part 10) — the OPERATIONAL STATE a row is in, which is what a counsellor triages by once the
# caseload is large. The nine work types above answer "what kind of work is this?"; at 200 students per
# counsellor every one of them is a double-digit number, and nine double-digit numbers above a list is a
# second KPI row wearing a filter's clothes (V12's own hostile review, §94.3, predicted exactly this). The
# states answer the question that actually triages: "is this mine to do, or am I waiting on somebody?"
#
# They are NOT a new model. `our_work` / `waiting_student` / `waiting_university` are the existing seven-party
# waiting model (services/waiting.py, docs/STATE_MAP.md) folded to the three parties a counsellor can act on
# the difference between; `urgent` is tier 1 of the ranking rule below. Nothing here decides a party on its
# own, so a row's state and the "Waiting on" panel beside it can never disagree.
STATES = ("urgent", "our_work", "waiting_student", "waiting_university", "other")
# `urgent` deliberately overlaps the other three: it is a severity cut across them, not a fifth bucket, which
# is why the state counts do not sum to the total and the UI never presents them as if they did.
PARTY_STATE = {
    waiting.COUNSELOR: "our_work", waiting.AGENCY: "our_work", waiting.HANGYUL: "our_work",
    waiting.STUDENT: "waiting_student",
    waiting.UNIVERSITY: "waiting_university",
    waiting.EXTERNAL: "other", waiting.NONE: "other",
}
URGENT_TIER = 1


def state_of(party: str, tier: int) -> set[str]:
    """Every state a row belongs to. A tier-1 row is urgent *and* whatever party it waits on."""
    out = {PARTY_STATE.get(party, "other")}
    if tier <= URGENT_TIER:
        out.add("urgent")
    return out


RULE = [
    "Most urgent reason first (tier 1 = act now: late first reply, deadline in 3 days with items missing).",
    "Within the same tier, students with more reasons first.",
    "Then the earliest due date or the longest wait.",
]
# Where each reason's action goes (the queue / workspace tab that shows exactly that work).
ACTION = {
    "first_reply_late": ("reply", "/students/{sid}?tab=messages"),
    "first_reply_due": ("reply", "/students/{sid}?tab=messages"),
    "reply_waiting": ("reply", "/students/{sid}?tab=messages"),
    "reply_new": ("reply", "/students/{sid}?tab=messages"),
    "deadline_missing": ("prepare", "/students/{sid}?tab=applications"),
    "deadline_soon": ("prepare", "/students/{sid}?tab=applications"),
    "review_late": ("review", "/documents?student={sid}"),
    "review_waiting": ("review", "/documents?student={sid}"),
    "essay_late": ("essay", None),
    "university_request": ("request", "/students/{sid}?tab=applications"),
    "task_overdue": ("task", "/students/{sid}?tab=tasks"),
    "student_silent": ("nudge", "/students/{sid}?tab=messages"),
    "submission_issue": ("submit", "/submissions?state=issue"),
    "confirmation_missing": ("confirm", "/submissions?state=confirmation_missing"),
    "submit_authorized": ("submit", "/submissions?state=authorized"),
    "ready_to_submit": ("handoff", "/submissions?state=ready"),
    "final_review": ("check", "/submissions?state=needs_final_review"),
    "visa_overdue": ("visa", "/students/{sid}?tab=visa"),
    "visa_action": ("visa", "/students/{sid}?tab=visa"),
    "service_late": ("service", "/services?view=overdue"),
    "service_action": ("service", "/services"),
    "essay_due": ("essay", None),
    "document_check": ("review", "/students/{sid}?tab=documents"),
}


def _reason(code: str, at: datetime | None, **params) -> dict:
    return {"code": code, "tier": TIERS[code], "at": iso(at) if at else None, "params": params}


def collect(db: Session, p, ids: list[uuid.UUID], now: datetime | None = None) -> dict[uuid.UUID, list[dict]]:
    """Reasons per student for the given students (set-based: a fixed number of queries)."""
    now = now or utcnow()
    out: dict[uuid.UUID, list[dict]] = defaultdict(list)
    if not ids:
        return out

    # First reply
    for sid, due in db.execute(select(AgencyAssignment.student_user_id, AgencyAssignment.first_response_due_at).where(
            AgencyAssignment.student_user_id.in_(ids), AgencyAssignment.status == AssignmentStatus.ACTIVE,
            AgencyAssignment.first_response_at.is_(None), AgencyAssignment.first_response_due_at < now + timedelta(hours=caseload.SLA_RISK_HOURS))).all():
        if due < now:
            out[sid].append(_reason("first_reply_late", due, hours=int((now - due).total_seconds() // 3600)))
        else:
            out[sid].append(_reason("first_reply_due", due, hours=max(0, int((due - now).total_seconds() // 3600))))

    # Deadlines (applications not yet submitted, deadline within 7 days)
    from app.services.readiness import application_readiness, warm_memo

    rows = db.execute(select(Application, ProgramIntake.application_deadline, University.name_en)
                      .join(ProgramIntake, ProgramIntake.id == Application.intake_id).join(University, University.id == Application.university_id)
                      .where(Application.student_user_id.in_(ids), Application.status.in_(caseload.PRE_SUBMIT),
                             ProgramIntake.application_deadline >= now.date(), ProgramIntake.application_deadline <= (now + timedelta(days=7)).date())
                      .order_by(ProgramIntake.application_deadline)).all()
    # V26 (REPORT §344): the profiles arrive with the relations `profile_percent` reads, and one memo serves every readiness
    # call below — 204 per-application readiness computations took 2.4 s of the queue's 3.2 s at 1,071 students.
    profiles = {pr.user_id: pr for pr in db.scalars(select(StudentProfile).where(StudentProfile.user_id.in_({a.student_user_id for a, *_ in rows}))
                                                     .options(selectinload(StudentProfile.educations), selectinload(StudentProfile.languages)))} if rows else {}
    memo: dict = {}
    warm_memo(db, [a for a, *_ in rows], profiles, memo)
    seen_deadline: set[uuid.UUID] = set()
    for a, deadline, uni in rows:
        if a.student_user_id in seen_deadline:
            continue  # the earliest deadline speaks for the student
        seen_deadline.add(a.student_user_id)
        days = (deadline - now.date()).days
        _pct, checklist = application_readiness(db, a, profiles.get(a.student_user_id), now.date(), memo)
        missing = sum(1 for i in checklist if i["required"] and not i["ready"])
        at = datetime.combine(deadline, datetime.min.time(), tzinfo=now.tzinfo)
        if days <= 3 and missing:
            out[a.student_user_id].append(_reason("deadline_missing", at, days=days, university=uni, items=missing, date=deadline.isoformat()))
        else:
            out[a.student_user_id].append(_reason("deadline_soon", at, days=days, university=uni, items=missing, date=deadline.isoformat()))

    # Student replies waiting for us (latest student-visible message written by the student)
    latest = (select(Message.conversation_id, func.max(Message.created_at).label("at"))
              .where(Message.visibility == MessageVisibility.PARTICIPANTS).group_by(Message.conversation_id).subquery())
    waits: dict[uuid.UUID, datetime] = {}
    for sid, at in db.execute(select(Conversation.student_user_id, latest.c.at)
                              .join(latest, latest.c.conversation_id == Conversation.id)
                              .join(Message, and_(Message.conversation_id == Conversation.id, Message.created_at == latest.c.at))
                              .where(Conversation.student_user_id.in_(ids), Message.author_user_id == Conversation.student_user_id)).all():
        if sid not in waits or at < waits[sid]:
            waits[sid] = at
    for sid, at in waits.items():
        hours = int((now - at).total_seconds() // 3600)
        out[sid].append(_reason("reply_waiting" if hours >= 24 else "reply_new", at, hours=hours, days=hours // 24))

    # Documents waiting for review
    cut = now - timedelta(hours=caseload.REVIEW_SLA_HOURS)
    for sid, n, n_late, oldest in db.execute(select(Document.owner_user_id, func.count(), func.count().filter(Document.updated_at < cut), func.min(Document.updated_at))
                                             .where(Document.owner_user_id.in_(ids), Document.status.in_(caseload.REVIEW_DOCS))
                                             .group_by(Document.owner_user_id)).all():
        if n_late:
            out[sid].append(_reason("review_late", oldest, count=n, late=n_late, hours=int((now - oldest).total_seconds() // 3600)))
        else:
            out[sid].append(_reason("review_waiting", oldest, count=n))

    # Essay reviews past their time (writing SLA; same rows as /essays?view=overdue)
    from app.services import writing as writing_svc

    idset = {str(i) for i in ids}
    writing_rows = writing_svc.today_items(db, p)
    for w in writing_rows:
        if w["kind"] == "WRITING_OVERDUE" and w["student"]["id"] in idset:
            sid = uuid.UUID(w["student"]["id"])
            if not any(r["code"] == "essay_late" for r in out[sid]):
                at = datetime.fromisoformat(w["due_at"]) if w["due_at"] else None
                out[sid].append({**_reason("essay_late", at, essay_type=w["essay_type"], university=w["university"]), "link": w["link"]})

    # University asked for one more document
    for sid, uni, at in db.execute(select(Application.student_user_id, University.name_en, func.min(DocumentRequest.requested_at))
                                   .join(DocumentRequest, DocumentRequest.application_id == Application.id)
                                   .join(University, University.id == Application.university_id)
                                   .where(Application.student_user_id.in_(ids), DocumentRequest.status == "OPEN")
                                   .group_by(Application.student_user_id, University.name_en)).all():
        if not any(r["code"] == "university_request" for r in out[sid]):
            out[sid].append(_reason("university_request", at, university=uni))

    # Team tasks overdue
    for sid, n, oldest in db.execute(select(Task.student_user_id, func.count(), func.min(Task.due_at))
                                     .where(Task.student_user_id.in_(ids), Task.status.in_(caseload.OPEN), Task.visible_to_student.is_(False), Task.due_at < now)
                                     .group_by(Task.student_user_id)).all():
        out[sid].append(_reason("task_overdue", oldest, count=n, days=max(0, (now - oldest).days)))

    # V9: essay reviews due within 48 h (writing SLA; same rows as /essays?view=due48)
    for w in writing_rows:
        if w["kind"] == "WRITING_DUE_SOON" and w["student"]["id"] in idset:
            sid = uuid.UUID(w["student"]["id"])
            if not any(r["code"] in ("essay_late", "essay_due") for r in out[sid]):
                at = datetime.fromisoformat(w["due_at"]) if w["due_at"] else None
                out[sid].append({**_reason("essay_due", at, essay_type=w["essay_type"], university=w["university"]), "link": w["link"]})

    # V9: visa support (appointments within 7 days, embassy requests due, packs ready) — visa_routes.today_items
    from app.services import visa_routes as visa_svc

    for v in visa_svc.today_items(db, p):
        st = v.get("student") or {}
        if st.get("id") not in idset:
            continue
        sid = uuid.UUID(st["id"])
        code = "visa_overdue" if v.get("overdue") else "visa_action"
        if any(r["code"] in ("visa_overdue", "visa_action") for r in out[sid]):
            continue
        at = datetime.fromisoformat(v["due_at"]).replace(tzinfo=now.tzinfo) if v.get("due_at") and len(v["due_at"]) == 10 else (
            datetime.fromisoformat(v["due_at"]) if v.get("due_at") else None)
        out[sid].append({**_reason(code, at, what=v["reason"], date=(v.get("due_at") or "")[:10] or None), "link": v["link"]})

    # V9: service cases (pickup, housing, residence card, visa support) — concierge.today_items
    from app.services import concierge as concierge_svc

    for c in concierge_svc.today_items(db, p):
        st = c.get("student") or {}
        if st.get("id") not in idset:
            continue
        sid = uuid.UUID(st["id"])
        if any(r["code"] in ("service_late", "service_action") for r in out[sid]):
            continue
        at = datetime.fromisoformat(c["due_at"]) if c.get("due_at") else None
        out[sid].append({**_reason("service_late" if c.get("overdue") else "service_action", at, what=c["reason"], type=c["type"]), "link": c["link"]})

    # V9: document checks that need a person — dossier.today_items
    from app.services import dossier as dossier_svc

    for f in dossier_svc.today_items(db, p):
        if f["student_id"] not in idset:
            continue
        sid = uuid.UUID(f["student_id"])
        if not any(r["code"] == "document_check" for r in out[sid]):
            at = datetime.fromisoformat(f["created_at"]) if f.get("created_at") else None
            out[sid].append({**_reason("document_check", at, category=f["category"], finding=f["code"]), "link": f["link"]})

    # V9: submissions (services/submission.submission_pipeline — the same states as /submissions)
    from app.services import submission as submission_svc

    sub_code = {"issue": "submission_issue", "confirmation_missing": "confirmation_missing", "authorized": "submit_authorized",
                "ready": "ready_to_submit", "needs_final_review": "final_review"}
    for row in submission_svc.submission_pipeline(db, p, student_ids=ids)["items"]:
        code = sub_code.get(row["state"])
        if not code:
            continue
        sid = uuid.UUID(row["student"]["id"])
        if any(r["code"] == code for r in out[sid]):
            continue
        at = datetime.fromisoformat(row["since"]) if row["since"] else None
        out[sid].append({**_reason(code, at, university=row["university"], days=row["days"], date=row["deadline"]),
                         "link": f"/submissions?state={row['state']}&application={row['application_id']}"})

    # Waiting on the student, silent > 3 days
    silent = set(db.scalars(select(StudentProfile.user_id).where(StudentProfile.user_id.in_(ids), caseload.pred_student_silent(now))).all())
    if silent:
        last: dict[uuid.UUID, datetime] = dict(db.execute(select(Message.author_user_id, func.max(Message.created_at))
                                                           .where(Message.author_user_id.in_(silent)).group_by(Message.author_user_id)).all())
        for sid in silent:
            at = last.get(sid)
            out[sid].append(_reason("student_silent", at, days=(now - at).days if at else None))
    return out


def rank_key(reasons: list[dict]) -> tuple:
    top = min(r["tier"] for r in reasons)
    at_top = [r for r in reasons if r["tier"] == top]
    clock = min((r["at"] or "9999") for r in at_top)
    return (top, -len(at_top), clock)


def _due(reasons: list[dict], fallback: str | None) -> str | None:
    """The row's deadline: the earliest dated reason that is a deadline or a promise (not a wait), else the student's
    next application deadline."""
    dated = [r["params"].get("date") or (r["at"] if r["code"] in DUE_CODES else None) for r in reasons]
    dated = [d for d in dated if d]
    return min(dated)[:10] if dated else fallback


DUE_CODES = {"deadline_missing", "deadline_soon", "task_overdue", "first_reply_late", "first_reply_due", "essay_late", "essay_due",
             "visa_overdue", "visa_action", "service_late", "service_action"}


def ranked(db: Session, p, ids: list[uuid.UUID], *, limit: int = 40, now: datetime | None = None,
           work_type: str | None = None, state: str | None = None) -> dict:
    now = now or utcnow()
    reasons = collect(db, p, ids, now)
    all_rows = [(sid, sorted(rs, key=lambda r: (r["tier"], r["at"] or "9999"))) for sid, rs in reasons.items() if rs]
    by_type: dict[str, int] = {t: 0 for t in WORK_TYPES}
    for _sid, rs in all_rows:
        for t in {TYPE_OF[r["code"]] for r in rs}:
            by_type[t] += 1
    # One grouped query for the whole page, using the same seven-party evaluation as the "Waiting on" panel, so
    # the two can never disagree about which party a given student waits on.
    #
    # They do answer different questions and their totals differ on purpose: this queue holds only students with
    # an open reason, while "Waiting on" counts the whole caseload. A student can be waiting on a university
    # with nothing for anyone to do about it today — they appear in that panel and not in this queue, which is
    # correct for both.
    parties = waiting.evaluate(db, [sid for sid, _rs in all_rows], now) if all_rows else {}
    states_of: dict[uuid.UUID, set[str]] = {
        sid: state_of(parties.get(sid, (waiting.NONE, None))[0], min(r["tier"] for r in rs))
        for sid, rs in all_rows
    }
    by_state: dict[str, int] = {st: 0 for st in STATES}
    for sid, _rs in all_rows:
        for st in states_of[sid]:
            by_state[st] += 1
    # "All" always counts every row with work, whatever is filtered — it is the chip a counsellor returns to.
    all_total = len(all_rows)
    if state:
        all_rows = [(sid, rs) for sid, rs in all_rows if state in states_of[sid]]
    if work_type:
        # Same list, same rule — only this type's reasons count (and lead the row).
        rows = [(sid, [r for r in rs if TYPE_OF[r["code"]] == work_type] + [r for r in rs if TYPE_OF[r["code"]] != work_type])
                for sid, rs in all_rows if any(TYPE_OF[r["code"]] == work_type for r in rs)]
        key = lambda x: (*rank_key([r for r in x[1] if TYPE_OF[r["code"]] == work_type]), str(x[0]))  # noqa: E731
    else:
        rows = all_rows
        key = lambda x: (*rank_key(x[1]), str(x[0]))  # noqa: E731
    rows.sort(key=key)
    shown = rows[:limit]
    sids = [sid for sid, _ in shown]
    names = dict(db.execute(select(User.id, User.full_name).where(User.id.in_(sids))).all()) if sids else {}
    stages = dict(db.execute(select(StudentProfile.user_id, StudentProfile.pipeline_stage).where(StudentProfile.user_id.in_(sids))).all()) if sids else {}
    counselor = {}
    if sids:
        cu = {a: c for a, c in db.execute(select(AgencyAssignment.student_user_id, AgencyAssignment.counselor_user_id).where(
            AgencyAssignment.student_user_id.in_(sids), AgencyAssignment.status == AssignmentStatus.ACTIVE)).all()}
        cn = dict(db.execute(select(User.id, User.full_name).where(User.id.in_({c for c in cu.values() if c}))).all())
        counselor = {s: ({"id": str(c), "name": cn.get(c)} if c else None) for s, c in cu.items()}
    named = caseload._named_owners(db, sids, now) if sids else {}
    next_dl = dict(db.execute(select(Application.student_user_id, func.min(ProgramIntake.application_deadline))
                              .join(ProgramIntake, ProgramIntake.id == Application.intake_id)
                              .where(Application.student_user_id.in_(sids), Application.status.in_(caseload.PRE_SUBMIT),
                                     ProgramIntake.application_deadline >= now.date()).group_by(Application.student_user_id)).all()) if sids else {}
    # V15 (brief Part 8): the purchased plan, as one small token on the row. It is here because it changes
    # what the counselor may promise — not as a prioritisation input. **Ordering is untouched**: a Premium
    # student's priority-response rule must never bury another student's deadline, so plan does not enter
    # ``rank_key`` at all. One query for the page, not one per row.
    plans = dict(db.execute(
        select(Order.user_id, ServiceProduct.code)
        .join(ServiceProduct, ServiceProduct.id == Order.product_id)
        .where(Order.user_id.in_(sids), Order.status == OrderStatus.PAID)
        .order_by(Order.amount_minor.desc())
    ).all()) if sids else {}
    items = []
    for pos, (sid, rs) in enumerate(shown, start=1):
        top = rs[0]
        kind, link = ACTION[top["code"]]
        tier, n_top, clock = rank_key([r for r in rs if TYPE_OF[r["code"]] == work_type] if work_type else rs)
        nb = NAMED_BY.get(top["code"])
        person = named.get((sid, nb)) if nb else None
        owner = ({"kind": "person", **person} if person else
                 {"kind": "person", **counselor[sid]} if counselor.get(sid) else
                 {"kind": "agency" if sid in counselor else "hangyul", "name": None})
        dl = next_dl.get(sid)
        items.append({
            "position": pos, "student": {"id": str(sid), "name": names.get(sid)}, "stage": stages[sid].value if stages.get(sid) else None,
            "counselor": counselor.get(sid), "reasons": rs,
            "action": {"kind": kind, "link": top.get("link") or link.format(sid=sid)},
            "rank": {"tier": tier, "reasons_at_tier": -n_top, "clock": None if clock == "9999" else clock},
            # V9: each row = reason · next action · deadline · owner; its work types are the chips it counts under.
            "types": sorted({TYPE_OF[r["code"]] for r in rs}), "owner": owner, "deadline": _due(rs, dl.isoformat() if dl else None),
            "plan": plans.get(sid),
        })
    by_tier: dict[int, int] = defaultdict(int)
    for _sid, rs in rows:
        rel = [r for r in rs if TYPE_OF[r["code"]] == work_type] if work_type else rs
        by_tier[min(r["tier"] for r in rel)] += 1
    return {"generated_at": iso(now), "rule": RULE, "total": len(rows), "all_total": all_total, "by_tier": {str(k): v for k, v in sorted(by_tier.items())},
            "by_type": by_type, "type": work_type, "types": list(WORK_TYPES),
            "by_state": by_state, "state": state, "states": list(STATES), "items": items}
