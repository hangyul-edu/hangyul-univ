"""V6 submission seed — the authorised-agency *development fixture* (never created when HG_ENV=production).

Research (docs/SUBMISSION_CONNECTORS.md, docs/COMPETITOR_BENCHMARK.md "Submission reality (2026-10)"): no catalogued
university or application provider (UWAY, JinhakApply, Gradnet) allows an agency to submit on a student's behalf —
applicants must apply personally. So no real connector gets AUTHORIZED_AGENCY. To exercise the flow in development
only, this module creates:

* an **inactive** fixture program at Pusan National University, named like any other programme (V12: a
  fixture must not announce itself in ordinary product chrome — brief Part 1)
  (``is_active=False``: never listed in the catalogue, matches or the public site; applications only via this seed or
  the dev-only fixture endpoint), with one open intake copied from the BBA program's dates;
* a program-level connector with ``method=AUTHORIZED_AGENCY`` and ``agency_submission_basis`` = ``FIXTURE_BASIS``
  ("Development fixture — no real agreement…"), ``verification_status=SAMPLE``, ``is_demo=True``;
* a ``SubmissionAgencyPermission`` for Lotus Bridge (basis DEMO, is_demo);
* two Lotus personas on the fixture program, both READY with every document verified and essays approved:
  ``student.authorize@demo.hangyul.kr`` (Võ Thanh Tâm — has not authorised yet: the consent screen) and
  ``student.authorized@demo.hangyul.kr`` (Đặng Ngọc Mai — authorised two days ago: the agency "Ready to submit" queue).

Idempotent: ``apply(db)`` can be run against an existing development database (see the __main__ block).
"""
from __future__ import annotations

from datetime import timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.storage import get_storage
from app.models import (
    Application,
    Organization,
    Program,
    ProgramIntake,
    SubmissionAgencyPermission,
    SubmissionConnector,
    University,
    User,
)
from app.models.enums import ApplicationStatus as S
from app.models.enums import DegreeLevel, PipelineStage
from app.services import submission

FIXTURE_PROGRAM = "International Business (English track)"
FIXTURE_PROGRAM_KO = "국제경영학과 (영어트랙)"
UNI_SLUG = "pusan-national-university"
AGENCY_SLUG = "lotus-bridge"
PERSONAS = (
    ("student.authorize@demo.hangyul.kr", "Võ Thanh Tâm", "Tâm", False),
    ("student.authorized@demo.hangyul.kr", "Đặng Ngọc Mai", "Mai", True),
)


def _production() -> bool:
    from app.core.config import get_settings

    return get_settings().env == "production"


def _fixture_program(db: Session, uni: University) -> Program:
    prog = db.scalar(select(Program).where(Program.university_id == uni.id, Program.name_en == FIXTURE_PROGRAM))
    if prog:
        return prog
    base = next(p for p in uni.programs if p.degree_level == DegreeLevel.BACHELOR and p.field == "business")
    prog = Program(university_id=uni.id, name_en=FIXTURE_PROGRAM, name_ko=FIXTURE_PROGRAM_KO, degree_level=DegreeLevel.BACHELOR, field="business",
                   instruction_language=base.instruction_language, duration_semesters=base.duration_semesters,
                   tuition_per_semester_krw=base.tuition_per_semester_krw, application_fee_krw=base.application_fee_krw,
                   description="Exercises the authorised-agency submission flow. Inactive: never listed in the catalogue, the directory, matches or the public site.",
                   is_active=False)
    db.add(prog)
    db.flush()
    src = next((i for i in sorted(base.intakes, key=lambda i: i.application_deadline) if i.is_open), None)
    if src:
        db.add(ProgramIntake(program_id=prog.id, year=src.year, term=src.term, round=src.round, application_opens=src.application_opens,
                             application_deadline=src.application_deadline, document_deadline=src.document_deadline, decision_date=src.decision_date,
                             tuition_deadline=src.tuition_deadline, semester_start=src.semester_start, is_open=True))
        db.flush()
    db.refresh(prog)
    return prog


def _fixture_connector(db: Session, uni: University, prog: Program) -> SubmissionConnector:
    conn = db.scalar(select(SubmissionConnector).where(SubmissionConnector.program_id == prog.id))
    if conn is None:
        conn = SubmissionConnector(university_id=uni.id, program_id=prog.id, method="AUTHORIZED_AGENCY")
        db.add(conn)
    conn.method = "AUTHORIZED_AGENCY"
    conn.provider = None
    conn.portal_name = None
    conn.portal_url = uni.international_admissions_url or uni.website_url
    conn.official_url = uni.international_admissions_url or uni.website_url
    conn.supported_actions = ["open_portal", "fill_application", "pay_fee", "get_application_number", "check_result"]
    conn.login_requirements = "Agency staff sign in with their own account in their own browser. Hangyul never asks for, sees or stores any password."
    conn.fee_amount, conn.fee_currency, conn.fee_payee, conn.fee_payer = 144000, "KRW", "the university (fixture)", "STUDENT"
    conn.fee_payment_method = "Paid by the student; the fixture models the university application fee only."
    conn.documents_accepted, conn.originals_by_mail = "ONLINE", False
    conn.confirmation_method = "Application number shown after payment (fixture)."
    conn.receipt_method = "Printable application receipt (fixture)."
    conn.status_sync = "MANUAL"
    conn.agency_submission_basis = submission.FIXTURE_BASIS
    conn.agency_submission_basis_url = None
    conn.agency_submission_basis_verified = None
    conn.instructions = "Development fixture: demonstrates authorised agency submission. No real university allows it today."
    conn.verification_status = "SAMPLE"
    conn.is_demo = True
    db.flush()
    return conn


def _persona(db: Session, ctx: dict, prog: Program, email: str, name: str, preferred: str, authorised: bool) -> None:
    from app.seed.extra_10_personas import _application, _assign, _documents, _education_and_language, _finish, _student

    if db.scalar(select(User).where(User.email == email)):
        return
    u, prof = _student(db, email, name, preferred, "VN")
    _education_and_language(db, prof, 8.5, 4)
    a = _assign(db, u, ctx, AGENCY_SLUG)
    _documents(db, u, prof, a, ctx["storage"])
    app = _application(db, u, a, prog, [S.DRAFT, S.DOCUMENT_PREPARATION, S.READY], 0)
    for h in app.history:
        if h.to_status == S.READY:
            h.actor_user_id = a.counselor_user_id
    prof.pipeline_stage = PipelineStage.READY_TO_APPLY
    db.flush()
    _finish(db, u, prof)
    if authorised:
        auth = submission.authorize(db, app, u.id)
        auth.granted_at = auth.granted_at - timedelta(days=2)
        auth.is_demo = True
    db.flush()


def _ctx_from_db(db: Session, storage) -> dict:
    org = db.scalar(select(Organization).where(Organization.slug == AGENCY_SLUG))
    counselor = db.scalar(select(User).where(User.email == "counselor@lotus.demo.hangyul.kr"))
    unis = {u.slug: u for u in db.scalars(select(University))}
    return {"agencies": {AGENCY_SLUG: org}, "counselors": {AGENCY_SLUG: [counselor]}, "unis": unis, "storage": storage}


def apply(db: Session, ctx: dict | None = None) -> dict:
    if _production():
        return {"skipped": "production"}
    ctx = ctx or _ctx_from_db(db, get_storage())
    uni = ctx["unis"].get(UNI_SLUG) or db.scalar(select(University).where(University.slug == UNI_SLUG))
    org = ctx["agencies"].get(AGENCY_SLUG)
    if uni is None or org is None:
        return {"skipped": "missing university or agency"}
    prog = _fixture_program(db, uni)
    conn = _fixture_connector(db, uni, prog)
    perm = db.scalar(select(SubmissionAgencyPermission).where(SubmissionAgencyPermission.connector_id == conn.id,
                                                              SubmissionAgencyPermission.agency_org_id == org.id))
    if perm is None:
        db.add(SubmissionAgencyPermission(connector_id=conn.id, agency_org_id=org.id, basis="DEMO", active=True, is_demo=True,
                                          contract_reference="DEV-FIXTURE", note="Development fixture — no real agreement exists."))
        db.flush()
    for email, name, preferred, authorised in PERSONAS:
        _persona(db, ctx, prog, email, name, preferred, authorised)
    n = len(db.scalars(select(Application).where(Application.program_id == prog.id)).all())
    return {"program_id": str(prog.id), "connector_id": str(conn.id), "applications": n}


def seed(db: Session, ctx: dict[str, Any]) -> None:
    ctx["submission_v6"] = apply(db, {**ctx, "counselors": {AGENCY_SLUG: [ctx["counselors"][AGENCY_SLUG][0]]}} if ctx.get("counselors") else None)


if __name__ == "__main__":  # apply to an existing development database: python -m app.seed.extra_60_submission_v6
    from app.core.db import SessionLocal

    with SessionLocal() as s:
        print(apply(s))
        s.commit()
