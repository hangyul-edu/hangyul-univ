"""V26 — "지금 진행 중인 서비스": what each service the student bought is doing right now (REPORT §334 S3, brief §20).

`/me/services` already said *how much* of a plan is left ("지원 학교 관리 2 / 2"). It never said *which* applications those
two are, what the team is doing about each, who acts next, or when. A student with three applications on their home screen
and "2 / 2 · 모두 사용했습니다" here had to work out on their own that the third is a draft and does not count.

Every line below is read from the record that proves it — applications, essays, documents, appointments, the visa case —
never inferred from plan text. A line exists only for a service the plan includes. The words are i18n keys
(`student:v26.now.*`); the server returns codes, ids, dates and links.

Line shape: {key, state, owner, items:[{label, sub, status, link, counts?}], next:{code, link}|None, when:ISO|None}
  state  ACTIVE (being worked on) · YOU (waiting on the student) · LATER (starts after an earlier step) · DONE · AVAILABLE
  owner  TEAM (한귤 유니브 상담팀) · STUDENT · UNIVERSITY
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.common import iso
from app.models import Application, Appointment, Document, Essay, Program, SavedUniversity, University, VisaCase
from app.models.base import utcnow
from app.models.enums import ApplicationStatus as S
from app.models.enums import EssayStatus as E

_LATER_STAGE = (S.OFFERED, S.OFFER_ACCEPTED, S.TUITION_PENDING, S.TUITION_PAID, S.ADMISSION_CERTIFICATE_PENDING,
                S.ADMISSION_CERTIFICATE_ISSUED, S.VISA_PREPARATION, S.VISA_SUBMITTED, S.VISA_ISSUED, S.ENROLLED)
_STUDENT_APP = (S.DRAFT, S.DOCUMENT_PREPARATION, S.ADDITIONAL_DOCUMENTS, S.OFFERED, S.TUITION_PENDING)
_TEAM_ESSAY = (E.SUBMITTED, E.AI_PRECHECK, E.AGENCY_REVIEW, E.FINAL_REVIEW)
_STUDENT_ESSAY = (E.DRAFT, E.CHANGES_REQUESTED, E.STUDENT_REVISION)


def _names(u: University) -> dict:
    """Both names and the id — the client picks by UI language (``localName``); never one stored display string."""
    return {"label": u.name_en, "university_id": str(u.id), "name_en": u.name_en, "name_ko": u.name_ko}


def lines(db: Session, user_id, plan: dict | None) -> list[dict]:
    if not plan:
        return []
    ent = plan.get("entitlements") or {}
    usage = {u["key"]: u for u in plan.get("usage") or []}
    now = utcnow()
    out: list[dict] = []

    apps = db.execute(
        select(Application, University, Program).join(University, University.id == Application.university_id)
        .join(Program, Program.id == Application.program_id)
        .where(Application.student_user_id == user_id, Application.status != S.WITHDRAWN)
        .order_by(Application.updated_at.desc(), Application.id)).all()

    # 1 · 지원 학교 관리 — which applications use the allowance (a draft does not, by rule: entitlements._used).
    if (ent.get("max_managed_applications") or 0) > 0:
        items = [{**_names(u), "sub": p.name_en, "sub_ko": p.name_ko, "status": a.status.value, "link": f"/applications/{a.id}",
                  "counted": a.status != S.DRAFT} for a, u, p in apps]
        mine = next(((a, u) for a, u, _p in apps if a.status in _STUDENT_APP), None)
        managed = [i for i in items if i["counted"]]
        out.append({
            "key": "max_managed_applications",
            "state": "ACTIVE" if managed else "AVAILABLE",
            "owner": "STUDENT" if mine else "TEAM",
            "items": items,
            "next": {"code": "OPEN_APPLICATION", "link": f"/applications/{mine[0].id}", "params": {"university_id": str(mine[1].id)},
                     "names": _names(mine[1])} if mine
            else ({"code": "FIND_PROGRAMS", "link": "/explore"} if not items else None),
            "when": None,
            "usage": usage.get("max_managed_applications"),
        })

    # 2 · 첨삭 — the essays, and who has each one now. V29: Premium's editing is not rationed (`None`) — gate on the scope,
    # not on the count, or the plan that includes the most editing would show none.
    if ent.get("essay_review_scope", "ROUNDS" if (ent.get("essay_review_rounds") or 0) > 0 else "NONE") != "NONE":
        essays = db.scalars(select(Essay).where(Essay.owner_user_id == user_id).order_by(Essay.updated_at.desc())).all()
        team = [e for e in essays if e.status in _TEAM_ESSAY]
        student = [e for e in essays if e.status in _STUDENT_ESSAY]
        out.append({
            "key": "essay_review_rounds",
            "state": "ACTIVE" if team else "YOU" if student else ("DONE" if essays else "AVAILABLE"),
            "owner": "TEAM" if team else "STUDENT",
            "items": [{"label": e.title, "sub": e.essay_type.value, "status": e.status.value, "link": f"/essays/{e.id}",
                       "user_content": True} for e in essays[:4]],
            "scope": ent.get("essay_review_scope"),
            "next": {"code": "OPEN_ESSAY", "link": f"/essays/{student[0].id}"} if student and not team else None,
            "when": iso(min((e.due_date for e in student if e.due_date), default=None)) if student and not team else None,
            "usage": usage.get("essay_review_rounds"),
        })

    # 3 · 상담 — the next scheduled conversation with the team, inside the plan's support window (V29: 1 day / 3 days /
    # the contracted term — not a number of minutes).
    # (`consultation_minutes` is read only for a legacy V15 contract — catalogue 2026-10-19.v15, kept by its buyers.)
    if (ent.get("consultation_sessions") or ent.get("consultation_minutes") or 0) > 0:
        nxt = db.scalar(select(Appointment).where(Appointment.student_user_id == user_id, Appointment.status == "SCHEDULED",
                                                  Appointment.starts_at >= now).order_by(Appointment.starts_at))
        out.append({
            "key": "consultation", "state": "ACTIVE" if nxt else "AVAILABLE", "owner": "TEAM",
            "items": [{"label": nxt.kind, "sub": nxt.channel, "status": "SCHEDULED", "link": "/messages"}] if nxt else [],
            "next": None if nxt else {"code": "MESSAGE_TEAM", "link": "/messages"},
            "when": iso(nxt.starts_at) if nxt else None,
            "support_window_type": ent.get("support_window_type"), "support_window_days": ent.get("support_window_days"),
            "follow_up_level": ent.get("follow_up_level"),
        })

    # 4 · 서류 검토 — what the team is checking and what came back to the student.
    level = ent.get("document_review_level") or ent.get("document_review")
    if level not in (None, "NONE"):
        docs = db.scalars(select(Document).where(Document.owner_user_id == user_id)).all()
        review = [d for d in docs if d.status in ("UPLOADED", "NEEDS_REVIEW")]
        fix = [d for d in docs if d.status in ("NEEDS_CORRECTION", "EXPIRED")]
        ok = [d for d in docs if d.status == "VERIFIED"]
        out.append({
            "key": "document_review",
            "state": "YOU" if fix else "ACTIVE" if review else ("DONE" if ok else "AVAILABLE"),
            "owner": "STUDENT" if fix else "TEAM",
            "items": [], "counts": {"review": len(review), "fix": len(fix), "verified": len(ok)},
            "next": {"code": "FIX_DOCUMENT", "link": f"/documents?doc={fix[0].id}", "params": {"category": fix[0].category.value}} if fix else None,
            "when": None, "level": level,
        })

    # 5 · 비자 — the visa case, or "after an offer" until there is one.
    visa_level = ent.get("visa_support_level") or ent.get("visa_support")
    if visa_level not in (None, "NONE"):
        visa = db.scalar(select(VisaCase).where(VisaCase.student_user_id == user_id).order_by(VisaCase.created_at.desc()))
        offered = any(a.status in _LATER_STAGE for a, _u, _p in apps)
        out.append({
            "key": "visa_support",
            "state": "ACTIVE" if visa else ("AVAILABLE" if offered else "LATER"),
            "owner": "TEAM",
            "items": [{"label": visa.visa_type.value, "sub": None, "status": visa.status.value, "link": "/visa"}] if visa else [],
            "next": {"code": "OPEN_VISA", "link": "/visa"} if visa or offered else None,
            "when": None, "level": visa_level,
        })

    # 6 · 기숙사 · 입국 후 — they start with an offer.
    # The level says *who* does the work: INFORMATION is the student reading; SCHEDULE / APPLICATION and the settlement
    # levels are the team's (plan_operations creates their tasks and, for APPLICATION, the dormitory case).
    for key, legacy in (("dormitory_support_level", "dormitory_support"), ("settlement_support_level", "settlement_support")):
        lv = ent.get(key) or ent.get(legacy)
        if lv in (None, "NONE"):
            continue
        offered = any(a.status in _LATER_STAGE for a, _u, _p in apps)
        dorm = key.startswith("dormitory")
        out.append({"key": legacy, "level": lv, "state": "AVAILABLE" if offered else "LATER",
                    "owner": "STUDENT" if lv == "INFORMATION" and dorm else "TEAM", "items": [],
                    "next": {"code": "OPEN_HOUSING" if dorm else "OPEN_ARRIVAL", "link": "/housing" if dorm else "/arrival"} if offered else None,
                    "when": (plan.get("engagement") or {}).get("pre_arrival_starts_at") if not dorm else None})

    # 7 · 추천 대학 — the universities the team recommended (saved with source HANGYUL).
    if (ent.get("max_recommended_institutions") or 0) > 0:
        recs = db.execute(select(University).join(SavedUniversity, SavedUniversity.university_id == University.id)
                          .where(SavedUniversity.user_id == user_id, SavedUniversity.source == "HANGYUL")).scalars().all()
        out.append({"key": "max_recommended_institutions", "state": "DONE" if recs else "AVAILABLE", "owner": "TEAM",
                    "items": [{**_names(u), "sub": u.city, "status": None, "link": f"/universities/{u.slug}"} for u in recs],
                    "next": None, "when": None, "usage": usage.get("max_recommended_institutions")})
    return out
