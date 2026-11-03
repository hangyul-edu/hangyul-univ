"""V5 demo personas for the admission-success and visa flows (fictional sample data, ``is_demo=True``).

* ``student.nepal@demo.hangyul.kr`` — Aarati Shrestha (Nepal): every document ready, essays approved, one application
  READY — the guided-submission hand-off (FLOW A) starts from here. Nepal is not an Apostille member: education
  documents go through consular confirmation.
* ``student.myanmar@demo.hangyul.kr`` — Hnin Wai Phyo (Myanmar), uses the app in Burmese: admitted, admission letter
  issued, visa preparation (FLOW C / FLOW E).

Both are served by Himalaya Korea Pathways (NP/MM specialist agency in the core seed).
"""
from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from sqlalchemy.orm import Session

from app.core.storage import sha256
from app.models import Document, DocumentReview, DocumentVersion, Program, VisaCase
from app.models.enums import ApplicationStatus as S
from app.models.enums import DegreeLevel, DocumentStatus, LegalizationPath, LegalizationStatus, PipelineStage, VisaStatus
from app.seed.extra_10_personas import ALL_DOCS, _application, _assign, _conversation, _education_and_language, _finish, _student
from app.seed.run import NOW, TODAY, tiny_pdf
from app.services.visa import infer_visa

LEGALIZED = {"GRADUATION_CERTIFICATE", "TRANSCRIPT", "FAMILY_RELATION_CERTIFICATE"}


def _consular_documents(db: Session, u, prof, a, storage, language: str) -> dict:
    """Like the V3 persona documents, but for a non-Apostille country: education documents need consular confirmation."""
    docs = {}
    for cat, title in ALL_DOCS:
        legal = cat.value in LEGALIZED
        created = NOW - timedelta(days=70)
        d = Document(owner_user_id=u.id, category=cat, title=title, issuing_country=prof.nationality,
                     issue_date=(TODAY - timedelta(days=12)) if cat.value == "BANK_STATEMENT" else date(2025, 6, 20),
                     language=language, translation_required=True,
                     legalization_path=LegalizationPath.CONSULAR_LEGALIZATION if legal else LegalizationPath.NONE,
                     legalization_status=LegalizationStatus.COMPLETED if legal else LegalizationStatus.NOT_REQUIRED,
                     status=DocumentStatus.VERIFIED, current_version=1, is_demo=True, created_at=created, updated_at=created + timedelta(days=2))
        if cat.value == "PASSPORT":
            d.expires_on = prof.passport_expiry
        db.add(d)
        db.flush()
        data = tiny_pdf(f"{title} - {u.full_name}")
        key = storage.put(data, prefix=f"students/{u.id}")
        db.add(DocumentVersion(document_id=d.id, version=1, storage_key=key, original_filename=f"{cat.value.lower()}.pdf", mime_type="application/pdf",
                               size_bytes=len(data), sha256=sha256(data), scan_status="SKIPPED", uploaded_by_id=u.id, created_at=created))
        db.add(DocumentReview(document_id=d.id, version=1, reviewer_user_id=a.counselor_user_id, reviewer_org_id=a.organization_id, decision="VERIFIED",
                              created_at=created + timedelta(days=2)))
        docs[cat] = d
    return docs


def _bachelor(ctx, slug: str, field: str) -> Program:
    uni = ctx["unis"][slug]
    return next(p for p in uni.programs if p.degree_level == DegreeLevel.BACHELOR and p.field == field)


def seed(db: Session, ctx: dict[str, Any]) -> None:
    storage = ctx["storage"]

    # ---------------------------------------------------------------- A · Nepal: application ready for guided submission
    u, prof = _student(db, "student.nepal@demo.hangyul.kr", "Aarati Shrestha", "Aarati", "NP")
    prof.desired_fields = ["engineering"]
    _education_and_language(db, prof, 8.4, 3)
    a = _assign(db, u, ctx, "himalaya-pathways")
    _consular_documents(db, u, prof, a, storage, "ne")
    prog = _bachelor(ctx, "kyungpook-national-university", "business")
    _application(db, u, a, prog, [S.DRAFT, S.DOCUMENT_PREPARATION, S.READY], 0)
    prof.pipeline_stage = PipelineStage.READY_TO_APPLY
    _conversation(db, u, a, [
        (False, "Namaste Aarati! Your Kyungpook application is complete — documents verified, statement and study plan approved.", 26),
        (True, "Thank you! What do I do next?", 25),
        (False, "Open the application: it walks you through submitting on the university's official portal and where to note your confirmation number.", 24),
    ])
    _finish(db, u, prof)

    # ---------------------------------------------------------------- C/E · Myanmar: admitted, visa preparation, Burmese UI
    u, prof = _student(db, "student.myanmar@demo.hangyul.kr", "Hnin Wai Phyo", "Hnin", "MM")
    u.locale = "my"
    prof.desired_fields = ["business"]
    _education_and_language(db, prof, 8.6, 4)
    a = _assign(db, u, ctx, "himalaya-pathways")
    _consular_documents(db, u, prof, a, storage, "my")
    prog = _bachelor(ctx, "pusan-national-university", "business")
    path = [S.DRAFT, S.DOCUMENT_PREPARATION, S.READY, S.SUBMITTED, S.UNIVERSITY_REVIEW, S.OFFERED, S.OFFER_ACCEPTED, S.TUITION_PENDING, S.TUITION_PAID,
            S.ADMISSION_CERTIFICATE_PENDING, S.ADMISSION_CERTIFICATE_ISSUED, S.VISA_PREPARATION]
    app = _application(db, u, a, prog, path, 18)
    app.tuition_amount_krw = prog.tuition_per_semester_krw
    app.tuition_due = TODAY - timedelta(days=6)
    intake = next(i for i in prog.intakes if i.id == app.intake_id)
    vt, why = infer_visa(prog.degree_level)
    db.add(VisaCase(student_user_id=u.id, application_id=app.id, visa_type=vt, visa_type_reason=why, status=VisaStatus.DOCUMENT_PREPARATION,
                    completed_steps=["admission_certificate", "passport"], target_entry_date=intake.semester_start - timedelta(days=10)))
    prof.pipeline_stage = PipelineStage.VISA_PREPARATION
    _conversation(db, u, a, [
        (False, "Congratulations Hnin! Pusan National University issued your admission letter. Your visa checklist is open in the app.", 40),
        (True, "Thank you! Which documents do I need for the embassy in Yangon?", 38),
    ])
    _finish(db, u, prof)
