"""V5 — universal dossier API (owned by the dossier workstream; see docs/DOCUMENT_AUTOMATION.md and docs/REPORT.md §30).

Tenant rules are the existing ones: a student sees only their own dossier; agency staff only students with an active
assignment to their organisation (counselors: their own students); Hangyul staff everyone; universities never see a
dossier — only, per application, the documents that were shared with them (``GET /applications/{id}/package``).
Denials are 404 (``access.forbidden``) so tenants cannot probe for records.
"""
from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.common import parse_uuid
from app.core.audit import audit, track
from app.core.db import get_db
from app.core.deps import Principal, get_principal, require_agency_or_hangyul, require_student
from app.models import Document, DocumentFinding, DocumentRequest, DossierDocumentState, ExtractedField
from app.models.base import utcnow
from app.models.enums import DocumentCategory
from app.services import dossier as D
from app.services.access import ensure_student_access, forbidden, get_application_for

router = APIRouter(tags=["dossier"])


def _staff_or_owner_doc(db: Session, p: Principal, doc_id) -> Document:
    d = db.get(Document, doc_id)
    if not d or p.is_university:
        raise forbidden()
    ensure_student_access(db, p, d.owner_user_id)
    return d


# ----------------------------------------------------------------------------- dossier

@router.get("/me/dossier")
def my_dossier(p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    """The student's universal dossier: facts, documents with applicability per application, findings, suggestions, packages."""
    out = D.build_dossier(db, p.id)
    out["visibility"] = who_can_see(db, p.id, out)
    db.commit()
    return out


def who_can_see(db: Session, student_user_id, dossier: dict) -> dict:
    """V9 S4 — "Who can see this?" in plain facts (no new data; derived from assignment, consent and submissions).

    Adds ``rows[].sent_to`` (universities a document of that row went to, with application and date) in place and
    returns the account-level block: you · your counselor and agency (consent date) · Hangyul reviewers · retention ·
    what can be withdrawn.
    """
    from app.models import AgencyAssignment, Application, ConsentRecord, Organization, User
    from app.models.enums import AssignmentStatus

    a = db.scalar(select(AgencyAssignment).where(AgencyAssignment.student_user_id == student_user_id, AgencyAssignment.status == AssignmentStatus.ACTIVE))
    agency = None
    if a:
        org = db.get(Organization, a.organization_id)
        cu = db.get(User, a.counselor_user_id) if a.counselor_user_id else None
        consents = list(db.scalars(select(ConsentRecord).where(ConsentRecord.user_id == student_user_id, ConsentRecord.purpose == "SHARE_WITH_AGENCY")
                                   .order_by(ConsentRecord.created_at.desc())))
        latest = next((c for c in consents if c.scope_org_id in (None, a.organization_id)), None)
        agency = {"organization": org.name if org else None, "counselor": cu.full_name if cu else None,
                  "consent_at": latest.created_at.date().isoformat() if latest and latest.granted else None,
                  "consent_granted": bool(latest and latest.granted)}
    apps = {str(x.id): x for x in db.scalars(select(Application).where(Application.student_user_id == student_user_id))}
    for row in dossier.get("rows", []):
        ids = {str(d["id"]) for d in [row.get("document")] + row.get("other_versions", []) if d}
        sent = []
        for u in row.get("applications", []):
            if not u.get("sent") or (u.get("document_id") and u["document_id"] not in ids):
                continue
            ap = apps.get(u["application_id"])
            sent.append({"application_id": u["application_id"], "university": u["university"],
                         "sent_on": ap.submitted_at.date().isoformat() if ap and ap.submitted_at else None})
        row["sent_to"] = sent
    return {
        "you": True,
        "agency": agency,
        "hangyul_reviewers": True,
        "universities": "ONLY_SENT",  # a university sees only what was sent with an application to it
        "retention": {"code": "WHILE_ACTIVE", "legal_exception": True, "policy_status": "PENDING_APPROVAL"},
        "withdraw": {"agency_sharing": bool(agency), "sent_to_university": False, "link": "/settings#privacy"},
    }


@router.get("/agency/students/{student_id}/dossier")
def student_dossier(student_id: str, p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    sid = parse_uuid(student_id)
    ensure_student_access(db, p, sid)
    out = D.build_dossier(db, sid, staff=True)
    db.commit()
    return out


@router.get("/applications/{app_id}/package")
def application_package(app_id: str, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    """Package builder for one application. Universities see only the verified documents shared with them."""
    app = get_application_for(db, p, parse_uuid(app_id))
    return D.package_for(db, app, university_view=p.is_university)


# ----------------------------------------------------------------------------- reuse (duplicate minimisation)

@router.get("/me/dossier/reuse")
def reuse(category: DocumentCategory, application_id: str | None = None, request_id: str | None = None,
          p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    """Before uploading: "You already have a verified transcript used by 2 applications — replace it or add a different version?"."""
    return D.reuse_check(db, p.id, category.value, application_id=parse_uuid(application_id) if application_id else None,
                         request_id=parse_uuid(request_id) if request_id else None)


class DecisionIn(BaseModel):
    category: DocumentCategory
    decision: str = Field(pattern="^(KEEP|REPLACE|ADD_VERSION)$")
    document_id: str | None = None
    application_id: str | None = None


KIND = {"KEEP": "KEPT_EXISTING", "REPLACE": "NEW_VERSION", "ADD_VERSION": "NEW_DOCUMENT"}


@router.post("/me/dossier/reuse-decisions", status_code=201)
def reuse_decision(body: DecisionIn, p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    doc_id = parse_uuid(body.document_id) if body.document_id else None
    if doc_id:
        d = db.get(Document, doc_id)
        if not d or d.owner_user_id != p.id:
            raise forbidden()
    app_id = None
    if body.application_id:
        app_id = get_application_for(db, p, parse_uuid(body.application_id)).id
    ev = D.record_event(db, student_user_id=p.id, kind=KIND[body.decision], actor_id=p.id, document_id=doc_id, application_id=app_id,
                        category=body.category.value)
    track(db, "dossier_reuse_decision", user_id=p.id, properties={"decision": body.decision, "category": body.category.value})
    db.commit()
    return {"id": str(ev.id), "kind": ev.kind}


class SendIn(BaseModel):
    document_id: str


@router.post("/dossier/requests/{request_id}/send-existing")
def send_existing(request_id: str, body: SendIn, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    """Answer a university request with a document already in the dossier ("Send your existing …")."""
    from app.services.document_requests import ser_request

    r = db.get(DocumentRequest, parse_uuid(request_id))
    if not r:
        raise forbidden()
    app = get_application_for(db, p, r.application_id)
    if p.is_university:
        raise HTTPException(403, "The applicant or their counselor sends requested documents.")
    doc = db.get(Document, parse_uuid(body.document_id))
    if not doc:
        raise forbidden()
    D.send_existing(db, r, app, doc, actor_id=p.id)
    audit(db, action="application.document_request_fulfilled", entity_type="application", entity_id=app.id, actor=p,
          subject_user_id=app.student_user_id, detail={"request_id": str(r.id), "reused_document": str(doc.id)})
    track(db, "dossier_request_sent_existing", user_id=app.student_user_id, university_id=app.university_id, application_id=app.id,
          properties={"category": doc.category.value})
    db.commit()
    return ser_request(r, db)


# ----------------------------------------------------------------------------- extraction suggestions

class ConfirmIn(BaseModel):
    value: str | None = Field(default=None, max_length=200)


def _field(db: Session, p: Principal, field_id: str) -> tuple[ExtractedField, Document]:
    f = db.get(ExtractedField, parse_uuid(field_id))
    if not f:
        raise forbidden()
    d = _staff_or_owner_doc(db, p, f.document_id)
    return f, d


@router.post("/dossier/extractions/{field_id}/confirm")
def confirm_field(field_id: str, body: ConfirmIn, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    """The ONLY path that writes an extracted value to the profile / document — an explicit confirmation (optionally edited)."""
    f, d = _field(db, p, field_id)
    if f.status != "SUGGESTED":
        raise HTTPException(409, "This suggestion was already answered.")
    value = (body.value or f.value).strip()
    if not value:
        raise HTTPException(422, "Enter a value.")
    if f.field in ("passport_number", "document_number") and body.value:
        from app.core.security import mask

        value = mask(value.replace("•", ""), keep=3 if f.field == "passport_number" else 4) or value
    f.applied = D.apply_confirmation(db, f, value)
    f.status, f.confirmed_value, f.decided_at, f.decided_by_id = "CONFIRMED", value, utcnow(), p.id
    audit(db, action="dossier.extraction_confirmed", entity_type="extracted_field", entity_id=f.id, actor=p, subject_user_id=f.student_user_id,
          detail={"field": f.field, "edited": body.value is not None and body.value.strip() != f.value, "applied": f.applied})
    db.commit()
    ctx = D.load(db, f.student_user_id, app_ids=[])
    return D.ser_field(ctx, d, f)


@router.post("/dossier/extractions/{field_id}/reject")
def reject_field(field_id: str, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    f, d = _field(db, p, field_id)
    if f.status != "SUGGESTED":
        raise HTTPException(409, "This suggestion was already answered.")
    f.status, f.decided_at, f.decided_by_id = "REJECTED", utcnow(), p.id
    audit(db, action="dossier.extraction_rejected", entity_type="extracted_field", entity_id=f.id, actor=p, subject_user_id=f.student_user_id,
          detail={"field": f.field})
    db.commit()
    ctx = D.load(db, f.student_user_id, app_ids=[])
    return D.ser_field(ctx, d, f)


# ----------------------------------------------------------------------------- findings (staff)

class NoteIn(BaseModel):
    note: str | None = Field(default=None, max_length=1000)


def _finding(db: Session, p: Principal, finding_id: str) -> DocumentFinding:
    f = db.get(DocumentFinding, parse_uuid(finding_id))
    if not f:
        raise forbidden()
    ensure_student_access(db, p, f.student_user_id)
    return f


@router.post("/dossier/findings/{finding_id}/{action}")
def decide_finding(finding_id: str, action: str, body: NoteIn | None = None, p: Principal = Depends(require_agency_or_hangyul),
                   db: Session = Depends(get_db)):
    """Staff close a finding: ``resolve`` (handled) or ``dismiss`` (not a problem). Sticky for this file version."""
    if action not in ("resolve", "dismiss", "reopen"):
        raise HTTPException(404, "Not found")
    f = _finding(db, p, finding_id)
    if action == "reopen":
        f.status, f.resolved_at, f.resolved_by_id = "OPEN", None, None
    else:
        f.status, f.resolved_at, f.resolved_by_id = ("RESOLVED" if action == "resolve" else "DISMISSED"), utcnow(), p.id
    f.note = (body.note if body else None) or f.note
    audit(db, action=f"dossier.finding_{action}", entity_type="document_finding", entity_id=f.id, actor=p, subject_user_id=f.student_user_id,
          detail={"code": f.code})
    db.commit()
    return D.ser_finding(f, staff=True)


class TranslationIn(BaseModel):
    status: str | None = Field(default=None, pattern="^(PROVIDED|NEEDED)$")


@router.post("/dossier/documents/{doc_id}/translation")
def set_translation(doc_id: str, body: TranslationIn, p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    """Staff record whether a certified translation is included (null = back to the automatic rule)."""
    d = _staff_or_owner_doc(db, p, parse_uuid(doc_id))
    st = db.scalar(select(DossierDocumentState).where(DossierDocumentState.document_id == d.id))
    if st is None:
        st = DossierDocumentState(document_id=d.id)
        db.add(st)
    st.translation_status, st.updated_by_id = body.status, p.id
    audit(db, action="dossier.translation_status", entity_type="document", entity_id=d.id, actor=p, subject_user_id=d.owner_user_id,
          detail={"status": body.status})
    db.commit()
    return {"document_id": str(d.id), "translation": D.translation_status(d, st)}


@router.post("/dossier/documents/{doc_id}/analyze")
def reanalyze(doc_id: str, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    """Run the automatic check again for the current file version (unanswered suggestions for it are replaced)."""
    from app.models import DocumentAnalysis

    d = _staff_or_owner_doc(db, p, parse_uuid(doc_id))
    if not d.versions:
        raise HTTPException(409, "No file uploaded yet.")
    for a in db.scalars(select(DocumentAnalysis).where(DocumentAnalysis.document_id == d.id, DocumentAnalysis.version == d.current_version)):
        db.delete(a)
    for f in db.scalars(select(ExtractedField).where(ExtractedField.document_id == d.id, ExtractedField.version == d.current_version,
                                                     ExtractedField.status == "SUGGESTED")):
        db.delete(f)
    db.flush()
    v = next((x for x in d.versions if x.version == d.current_version), d.versions[-1])
    a = D.analyze_version(db, d, v)
    db.commit()
    return {"document_id": str(d.id), "version": a.version, "page_count": a.page_count, "text_chars": a.text_chars, "width": a.width,
            "height": a.height, "detected_category": a.detected_category, "has_mrz": a.has_mrz, "error": a.error, "method": a.method}


# ----------------------------------------------------------------------------- metrics

@router.get("/dossier/metrics")
def metrics(since: date | None = Query(None), until: date | None = Query(None), p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    if p.is_student:
        raise forbidden()
    scope: dict = {"since": since, "until": until}
    if p.is_agency:
        from app.services.access import agency_student_ids_subquery

        scope["student_ids"] = list(db.scalars(agency_student_ids_subquery(p)).all())
    elif p.is_university:
        scope["university_id"] = p.university_id
        from app.services.access import university_student_ids_subquery

        scope["student_ids"] = list(db.scalars(university_student_ids_subquery(p)).all())
    return D.dossier_metrics(db, scope)
