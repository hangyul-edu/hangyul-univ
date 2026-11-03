"""V5 visa concierge seed (owned by the visa_routes workstream).

1. Loads the researched embassy playbooks (docs/research/visa-playbooks.json) into the versioned ``visa_routes`` tables —
   idempotent; every route keeps the research ``verification_status`` (VERIFIED / PARTIAL / NEEDS_REVIEW) and its sources.
   This is research data, not demo data. Nothing is filled in from another country.
2. University visa certification tier: UNKNOWN for every university (no verified MOJ/MOE result is stored), so no
   e-visa is offered by the resolver — it shows the "if your university is certified…" caveat instead.
3. Personas (fictional, ``is_demo=True``):
   * ``student.myanmar@`` (FLOW C, Burmese): parents sponsor; a PLANNED embassy date in 25 days, so the bank certificate
     from 12 days ago will be too old on that day (new one needed, with the "get it after" date).
   * ``student.visaroute@demo.hangyul.kr`` — Enkhjin Batbayar (Mongolia, Kyungpook BBA, Silk Road Pathways): FLOW E.
     Admission letter issued, visa preparation: admission documents reused, the university's paper received,
     self-introduction and marital-status certificate already added; TB certificate and criminal record still missing.
"""
from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.storage import sha256
from app.models import Document, DocumentReview, DocumentVersion, University, User, VisaCase
from app.models.enums import ApplicationStatus as S
from app.models.enums import DegreeLevel, DocumentCategory, DocumentStatus, LegalizationPath, LegalizationStatus, PipelineStage, VisaStatus
from app.seed.extra_10_personas import ALL_DOCS, _application, _assign, _conversation, _education_and_language, _finish, _student
from app.seed.run import NOW, TODAY, tiny_pdf
from app.services import visa_routes as vr
from app.services.visa import infer_visa

FLOW_E = "student.visaroute@demo.hangyul.kr"
LEGALIZED = {"GRADUATION_CERTIFICATE", "TRANSCRIPT", "FAMILY_RELATION_CERTIFICATE"}


def _file(db: Session, storage, u, d: Document, reviewer, org_id, *, verified: bool = True) -> None:
    data = tiny_pdf(f"{d.title} - {u.full_name}")
    key = storage.put(data, prefix=f"students/{u.id}")
    db.add(DocumentVersion(document_id=d.id, version=1, storage_key=key, original_filename=f"{d.title.lower().replace(' ', '_')}.pdf", mime_type="application/pdf",
                           size_bytes=len(data), sha256=sha256(data), scan_status="SKIPPED", uploaded_by_id=u.id, created_at=d.created_at))
    if verified:
        db.add(DocumentReview(document_id=d.id, version=1, reviewer_user_id=reviewer, reviewer_org_id=org_id, decision="VERIFIED", created_at=d.created_at + timedelta(days=1)))


def _mongolia_persona(db: Session, ctx: dict[str, Any]) -> None:
    if db.scalar(select(User).where(User.email == FLOW_E)):
        return
    storage = ctx["storage"]
    u, prof = _student(db, FLOW_E, "Enkhjin Batbayar", "Enkhjin", "MN")
    prof.date_of_birth = date(2005, 11, 3)
    prof.financial_sponsor = "SELF"
    _education_and_language(db, prof, 8.8, 4)
    a = _assign(db, u, ctx, "silk-road")
    for cat, title in ALL_DOCS:
        created = NOW - timedelta(days=75)
        legal = cat.value in LEGALIZED
        d = Document(owner_user_id=u.id, category=cat, title=title, issuing_country="MN",
                     issue_date=(TODAY - timedelta(days=3)) if cat == DocumentCategory.BANK_STATEMENT else date(2025, 6, 18),
                     language="mn", translation_required=True, legalization_path=LegalizationPath.APOSTILLE if legal else LegalizationPath.NONE,
                     legalization_status=LegalizationStatus.COMPLETED if legal else LegalizationStatus.NOT_REQUIRED, status=DocumentStatus.VERIFIED,
                     current_version=1, is_demo=True, created_at=created, updated_at=created + timedelta(days=1))
        if cat == DocumentCategory.PASSPORT:
            d.expires_on = prof.passport_expiry
        db.add(d)
        db.flush()
        _file(db, storage, u, d, a.counselor_user_id, a.organization_id)
    uni = ctx["unis"]["kyungpook-national-university"]
    prog = next(p for p in uni.programs if p.degree_level == DegreeLevel.BACHELOR and p.field == "business")
    path = [S.DRAFT, S.DOCUMENT_PREPARATION, S.READY, S.SUBMITTED, S.UNIVERSITY_REVIEW, S.OFFERED, S.OFFER_ACCEPTED, S.TUITION_PENDING, S.TUITION_PAID,
            S.ADMISSION_CERTIFICATE_PENDING, S.ADMISSION_CERTIFICATE_ISSUED, S.VISA_PREPARATION]
    app = _application(db, u, a, prog, path, 16)
    app.tuition_amount_krw = prog.tuition_per_semester_krw
    intake = next(i for i in prog.intakes if i.id == app.intake_id)
    vt, why = infer_visa(prog.degree_level)
    case = VisaCase(student_user_id=u.id, application_id=app.id, visa_type=vt, visa_type_reason=why, status=VisaStatus.DOCUMENT_PREPARATION,
                    completed_steps=["admission_certificate"], target_entry_date=intake.semester_start - timedelta(days=10))
    db.add(case)
    db.flush()
    # Visa-only paper already added (self-introduction, marital-status certificate) and linked to the visa items.
    t = vr.ensure_track(db, case)
    t.is_demo = True
    links = {}
    for key, title, days in (("other_self_intro", "Self-introduction", 9), ("other_marital_status", "Marital status certificate", 8)):
        created = NOW - timedelta(days=days)
        d = Document(owner_user_id=u.id, category=DocumentCategory.OTHER, title=title, issuing_country="MN", issue_date=TODAY - timedelta(days=days),
                     language="mn", status=DocumentStatus.VERIFIED, current_version=1, is_demo=True, created_at=created, updated_at=created)
        db.add(d)
        db.flush()
        _file(db, storage, u, d, a.counselor_user_id, a.organization_id)
        links[key] = str(d.id)
    t.item_documents = links
    t.item_marks = {"business_registration": {"received_at": (NOW - timedelta(days=5)).isoformat()}}
    prof.pipeline_stage = PipelineStage.VISA_PREPARATION
    _conversation(db, u, a, [
        (False, "Congratulations Enkhjin! Kyungpook National University issued your admission letter — your visa plan is ready in the app.", 12),
        (True, "Thank you! I will get the TB test next week.", 11),
    ])
    _finish(db, u, prof)


def seed(db: Session, ctx: dict[str, Any]) -> None:
    vr.load_playbooks(db)
    for uni in db.scalars(select(University)).all():
        if not uni.visa_certification:
            uni.visa_certification = "UNKNOWN"

    # FLOW C / E — Myanmar persona (created by extra_15): parents sponsor, an embassy date planned in 25 days.
    mm = db.scalar(select(User).where(User.email == "student.myanmar@demo.hangyul.kr"))
    if mm:
        case = vr.current_case(db, mm.id)
        if case:
            vr.set_answers(db, mm.id, {"sponsor": "PARENTS"})
            t = vr.ensure_track(db, case)
            t.is_demo = True
            t.appointment_on, t.appointment_status, t.appointment_post = TODAY + timedelta(days=25), "PLANNED", "yangon"

    _mongolia_persona(db, ctx)
    db.flush()
