from datetime import date

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.api.common import Page, iso, paginate, parse_uuid, ser_document
from app.core.audit import audit, track
from app.core.db import get_db
from app.core.deps import Principal, get_principal, require_agency_or_hangyul
from app.core.scanning import ensure_servable, settle_document_version
from app.core.security import sign_file_token, verify_file_token
from app.core.storage import INFECTED, PENDING, get_storage, scan_bytes, sha256, validate_upload
from app.models import (
    AgencyAssignment,
    Application,
    ApplicationDocument,
    Document,
    DocumentReview,
    DocumentVersion,
    MessageAttachment,
    OrganizationMember,
    StudentProfile,
    University,
    User,
)
from app.models.base import utcnow
from app.models.enums import (
    AssignmentStatus,
    DocumentCategory,
    DocumentStatus,
    LegalizationPath,
    LegalizationStatus,
    Role,
)
from app.services.access import ensure_student_access, forbidden, scope_student_ids
from app.services.display_identity import author_for
from app.services.document_requests import university_visible_document_ids
from app.services.notify import notify
from app.services.readiness import legalization_for
from app.services.tasks_engine import generate_for_student

router = APIRouter(tags=["documents"])

# Categories whose originals commonly need apostille/consular legalization for Korean admissions.
LEGALIZABLE = {DocumentCategory.TRANSCRIPT, DocumentCategory.GRADUATION_CERTIFICATE, DocumentCategory.EXPECTED_GRADUATION_CERTIFICATE,
               DocumentCategory.FAMILY_RELATION_CERTIFICATE, DocumentCategory.BIRTH_CERTIFICATE}


def _can_see_document(db: Session, p: Principal, d: Document) -> bool:
    if p.is_university:
        # Universities only see documents explicitly shared for an application to their university.
        # Also documents the student sent in answer to one of the university's explicit document requests.
        return d.id in set(db.scalars(university_visible_document_ids(p.university_id)).all())
    try:
        ensure_student_access(db, p, d.owner_user_id)
        return True
    except HTTPException:
        return False


def _get_doc(db: Session, p: Principal, doc_id: str) -> Document:
    d = db.scalar(select(Document).where(Document.id == parse_uuid(doc_id)).options(selectinload(Document.versions)))
    if not d or not _can_see_document(db, p, d):
        raise forbidden()
    return d


@router.get("/documents")
def list_documents(
    page: Page = Depends(),
    student_id: str | None = None,
    status: list[str] | None = Query(None),
    category: list[str] | None = Query(None),
    p: Principal = Depends(get_principal),
    db: Session = Depends(get_db),
):
    stmt = select(Document).options(selectinload(Document.versions))
    if p.is_university:
        stmt = stmt.where(Document.id.in_(university_visible_document_ids(p.university_id)))
    else:
        stmt = scope_student_ids(stmt, Document.owner_user_id, p)
    if student_id:
        stmt = stmt.where(Document.owner_user_id == parse_uuid(student_id))
    if status:
        stmt = stmt.where(Document.status.in_(status))
    if category:
        stmt = stmt.where(Document.category.in_(category))
    stmt = stmt.order_by(Document.updated_at.desc())
    users = {}

    def ser(d):
        out = ser_document(d)
        if not p.is_student:
            u = users.get(d.owner_user_id) or db.get(User, d.owner_user_id)
            users[d.owner_user_id] = u
            out["owner_name"] = u.full_name
        return out

    return paginate(db, stmt, page, ser)


REVIEW_SLA_HOURS = 48


@router.get("/documents/review-queue")
def review_queue(page: Page = Depends(), assigned: str | None = Query(None, pattern="^(me|unassigned|any)$"), category: list[str] | None = Query(None),
                 p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    """Documents waiting for a first review, oldest first, with owner, SLA and assigned reviewer resolved in bulk."""
    stmt = select(Document).options(selectinload(Document.versions)).where(Document.status.in_([DocumentStatus.UPLOADED, DocumentStatus.NEEDS_REVIEW]))
    stmt = scope_student_ids(stmt, Document.owner_user_id, p).order_by(Document.updated_at.asc())
    if assigned == "me":
        stmt = stmt.where(Document.reviewer_user_id == p.id)
    elif assigned == "unassigned":
        stmt = stmt.where(Document.reviewer_user_id.is_(None))
    if category:
        stmt = stmt.where(Document.category.in_(category))
    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
    docs = db.scalars(stmt.limit(page.page_size).offset((page.page - 1) * page.page_size)).all()
    people = {u.id: u for u in db.scalars(select(User).where(User.id.in_({d.owner_user_id for d in docs} | {d.reviewer_user_id for d in docs if d.reviewer_user_id}))).all()}
    nats = dict(db.execute(select(StudentProfile.user_id, StudentProfile.nationality).where(StudentProfile.user_id.in_({d.owner_user_id for d in docs}))).all())
    now = utcnow()
    items = []
    for d in docs:
        out = ser_document(d)
        hours = round((now - d.updated_at).total_seconds() / 3600, 1)
        reviewer = people.get(d.reviewer_user_id) if d.reviewer_user_id else None
        out.update({"owner_name": people[d.owner_user_id].full_name if d.owner_user_id in people else None, "owner_nationality": nats.get(d.owner_user_id),
                    "waiting_hours": hours, "sla_hours": REVIEW_SLA_HOURS, "over_sla": hours > REVIEW_SLA_HOURS,
                    "assigned_reviewer": {"id": str(reviewer.id), "full_name": reviewer.full_name} if reviewer else None})
        items.append(out)
    return {"items": items, "total": total, "page": page.page, "page_size": page.page_size}


class BulkIn(BaseModel):
    ids: list[str] = Field(min_length=1, max_length=100)
    action: str = Field(pattern="^(VERIFY|ASSIGN_REVIEWER|REQUEST_CORRECTION)$")
    reviewer_user_id: str | None = None
    reason: str | None = Field(default=None, max_length=2000)


REVIEWER_ROLES = (Role.AGENCY_ADMIN, Role.HANGYUL_SUPER_ADMIN, Role.HANGYUL_OPERATIONS, Role.HANGYUL_COUNSELOR)  # V22


@router.post("/documents/bulk")
def bulk_documents(body: BulkIn, p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    """Apply one review action to many documents. Each document is permission-checked on its own; results are per item."""
    if not p.has(*REVIEWER_ROLES):
        raise HTTPException(403, "Your role cannot review documents.")
    if body.action == "REQUEST_CORRECTION" and not (body.reason or "").strip():
        raise HTTPException(422, "Tell the students what to fix.")
    reviewer = None
    if body.action == "ASSIGN_REVIEWER":
        if not body.reviewer_user_id:
            raise HTTPException(422, "Choose a reviewer.")
        reviewer = parse_uuid(body.reviewer_user_id)
        member = db.scalar(select(OrganizationMember).where(OrganizationMember.user_id == reviewer, OrganizationMember.organization_id == p.org_id,
                                                            OrganizationMember.is_active.is_(True))) if not p.is_hangyul else True
        if not member:
            raise HTTPException(422, "That person is not on your team.")
    results = []
    touched = set()
    for raw in body.ids:
        try:
            d = _get_doc(db, p, raw)
        except HTTPException:
            results.append({"id": raw, "ok": False, "error": "not_found"})
            continue
        if body.action in ("VERIFY", "REQUEST_CORRECTION") and d.status not in (DocumentStatus.UPLOADED, DocumentStatus.NEEDS_REVIEW):
            results.append({"id": raw, "ok": False, "error": "not_waiting_for_review"})
            continue
        if body.action == "ASSIGN_REVIEWER":
            d.reviewer_user_id = reviewer
            audit(db, action="document.assign_reviewer", entity_type="document", entity_id=d.id, actor=p, subject_user_id=d.owner_user_id,
                  detail={"reviewer": str(reviewer)})
        else:
            decision = "VERIFIED" if body.action == "VERIFY" else "NEEDS_CORRECTION"
            _apply_review(db, p, d, decision, body.reason, None, bulk=True)
            touched.add(d.owner_user_id)
        results.append({"id": raw, "ok": True})
    for sid in touched:
        generate_for_student(db, sid)
    db.commit()
    return {"results": results, "ok": sum(1 for r in results if r["ok"]), "failed": sum(1 for r in results if not r["ok"])}


@router.get("/documents/legalization-path")
def legalization_path(country: str, category: str | None = None, university_id: str | None = None, db: Session = Depends(get_db)):
    return legalization_for(db, country.upper(), category, parse_uuid(university_id) if university_id else None)


@router.post("/documents", status_code=201)
async def upload_document(
    file: UploadFile = File(...),
    category: DocumentCategory = Form(...),
    title: str | None = Form(None),
    issuing_country: str | None = Form(None),
    issue_date: date | None = Form(None),
    expires_on: date | None = Form(None),
    language: str | None = Form(None),
    document_id: str | None = Form(None),
    student_user_id: str | None = Form(None),
    p: Principal = Depends(get_principal),
    db: Session = Depends(get_db),
):
    """Students upload into their own vault. Agency staff with an active assignment (and Hangyul staff) may upload on behalf
    of a student by passing `student_user_id`; the version records who uploaded it and the action is audited."""
    if p.is_student:
        owner_id = p.id
    elif (p.is_agency or p.is_hangyul) and student_user_id:
        owner_id = parse_uuid(student_user_id)
        ensure_student_access(db, p, owner_id)
    else:
        raise HTTPException(403, "Only students, or their agency on their behalf, can upload documents.")
    data = await file.read()
    mime = validate_upload(data, file.filename or "upload")
    if document_id:
        doc = _get_doc(db, p, document_id)
        if doc.owner_user_id != owner_id:
            raise forbidden()
    else:
        cc = issuing_country.upper() if issuing_country else None
        path = LegalizationPath.NONE
        leg_status = LegalizationStatus.NOT_REQUIRED
        if category in LEGALIZABLE and cc and cc != "KR":
            info = legalization_for(db, cc, category.value)
            path = LegalizationPath(info["path"]) if info["path"] in LegalizationPath.__members__ else LegalizationPath.NONE
            leg_status = LegalizationStatus.REQUIRED if path != LegalizationPath.NONE else LegalizationStatus.NOT_REQUIRED
        doc = Document(
            owner_user_id=owner_id, category=category, title=title or category.value.replace("_", " ").title(), issuing_country=cc,
            issue_date=issue_date, expires_on=expires_on, language=language,
            translation_required=bool(language and language not in ("ko", "en")), legalization_path=path, legalization_status=leg_status,
        )
        db.add(doc)
        db.flush()
    storage = get_storage()
    key = storage.put(data, prefix=f"students/{owner_id}")
    # V29: stored privately as PENDING, then scanned; only a CLEAN (or development SKIPPED) version becomes reviewable.
    doc.current_version += 1
    version = DocumentVersion(document_id=doc.id, version=doc.current_version, storage_key=key, original_filename=(file.filename or "upload")[:255],
                              mime_type=mime, size_bytes=len(data), sha256=sha256(data), scan_status=PENDING, uploaded_by_id=p.id, created_at=utcnow())
    db.add(version)
    db.flush()
    scan, signature = scan_bytes(data)
    settle_document_version(db, doc, version, scan, signature, actor=p, from_upload=True)
    if scan == INFECTED:
        db.commit()  # the blocked version and its audit row are the record of what happened
        raise HTTPException(422, "This file failed the security scan.")
    on_behalf = owner_id != p.id
    audit(db, action="document.upload_on_behalf" if on_behalf else "document.upload", entity_type="document", entity_id=doc.id, actor=p,
          subject_user_id=owner_id, detail={"version": doc.current_version, "category": doc.category.value, "size": len(data)})
    track(db, "document_uploaded", user_id=owner_id, organization_id=p.org_id if on_behalf else None,
          properties={"category": doc.category.value, "on_behalf": on_behalf})
    if on_behalf:
        notify(db, owner_id, "DOCUMENT_UPLOADED_FOR_YOU", "notify.documentUploadedForYou", f"{p.user.full_name} added {doc.title} to your documents",
               params={"author": p.user.full_name, "document": doc.title}, link=f"/documents?doc={doc.id}")
    else:
        a = db.scalar(select(AgencyAssignment).where(AgencyAssignment.student_user_id == p.id, AgencyAssignment.status == AssignmentStatus.ACTIVE))
        if a and a.counselor_user_id:
            notify(db, a.counselor_user_id, "DOCUMENT_UPLOADED", "notify.documentUploaded", f"{p.user.full_name} uploaded {doc.title}",
                   params={"student": p.user.full_name, "document": doc.title}, link=f"/documents?doc={doc.id}")
    generate_for_student(db, owner_id)
    db.commit()
    db.refresh(doc)
    return ser_document(doc)


@router.get("/documents/{doc_id}")
def get_document(doc_id: str, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    d = _get_doc(db, p, doc_id)
    out = ser_document(d)
    reviews = db.scalars(select(DocumentReview).where(DocumentReview.document_id == d.id).order_by(DocumentReview.created_at.desc())).all()
    out["reviews"] = [{"decision": r.decision, "reason": r.reason, "version": r.version, "checks": r.checks, "at": iso(r.created_at),
                       "reviewer": ((author_for(p, db.get(User, r.reviewer_user_id)) or {}).get("full_name") if r.reviewer_user_id else "Automated pre-check")} for r in reviews]
    out["legalization"] = legalization_for(db, d.issuing_country, d.category.value) if d.category in LEGALIZABLE else None
    links = db.execute(select(ApplicationDocument, Application).join(Application, Application.id == ApplicationDocument.application_id).where(ApplicationDocument.document_id == d.id)).all()
    unis = {u.id: u.name_en for u in db.scalars(select(University).where(University.id.in_({a.university_id for _ad, a in links}))).all()} if links else {}
    out["used_in_applications"] = [{"application_id": str(a.id), "shared_with_university": ad.shared_with_university, "university": unis.get(a.university_id)}
                                   for ad, a in links if not p.is_university or a.university_id == p.university_id]
    if not p.is_student:
        # The reviewer pane names the student and fills {{student_name}} in correction templates.
        owner = db.get(User, d.owner_user_id)
        out["owner_name"] = owner.full_name if owner else None
    return out


@router.post("/documents/{doc_id}/download-url")
def download_url(doc_id: str, version: int | None = None, disposition: str = Query("inline", pattern="^(inline|attachment)$"),
                 p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    d = _get_doc(db, p, doc_id)
    v = next((x for x in d.versions if x.version == (version or d.current_version)), None)
    if not v:
        raise HTTPException(404, "No file uploaded yet")
    ensure_servable(v.scan_status)  # V29: 410 FILE_BLOCKED / 423 FILE_SCAN_PENDING
    audit(db, action="document.access", entity_type="document", entity_id=d.id, actor=p, subject_user_id=d.owner_user_id,
          detail={"version": v.version, "disposition": disposition})
    db.commit()
    return {"url": f"/api/v1/files/{sign_file_token(v.storage_key, p.id, disposition)}", "expires_in": 300, "filename": v.original_filename, "mime_type": v.mime_type}


@router.get("/files/{token}")
def serve_file(token: str, db: Session = Depends(get_db)):
    try:
        key, _user_id, disposition = verify_file_token(token)
    except ValueError:
        raise HTTPException(403, "This link has expired. Open the document again.")
    v = db.scalar(select(DocumentVersion).where(DocumentVersion.storage_key == key)) or db.scalar(select(MessageAttachment).where(MessageAttachment.storage_key == key))
    if not v:
        raise HTTPException(404, "Not found")
    ensure_servable(v.scan_status)  # V29: also here — a link minted before a verdict changed must not serve the file
    data = get_storage().get(key)
    safe_name = v.original_filename.replace('"', "")
    return Response(data, media_type=v.mime_type, headers={
        "Content-Disposition": f'{disposition}; filename="{safe_name}"',
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        # Framable only by our own origin (reviewer preview panes); no scripts. PDFs need the browser viewer, so no sandbox for them.
        "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; frame-ancestors 'self'" + ("" if v.mime_type == "application/pdf" else "; sandbox"),
        "X-Frame-Options": "SAMEORIGIN",
    })


class DocumentPatch(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    issuing_country: str | None = Field(default=None, min_length=2, max_length=2)
    issue_date: date | None = None
    expires_on: date | None = None
    language: str | None = None
    legalization_progress: list[str] | None = None
    reusable: bool | None = None


@router.patch("/documents/{doc_id}")
def patch_document(doc_id: str, body: DocumentPatch, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    d = _get_doc(db, p, doc_id)
    if p.is_university:
        raise HTTPException(403, "Universities cannot edit student documents.")
    data = body.model_dump(exclude_unset=True)
    if "issuing_country" in data and data["issuing_country"]:
        data["issuing_country"] = data["issuing_country"].upper()
    for k, v in data.items():
        setattr(d, k, v)
    if "legalization_progress" in data and d.legalization_path != LegalizationPath.NONE:
        info = legalization_for(db, d.issuing_country, d.category.value)
        step_keys = [s["key"] for s in info.get("steps", [])]
        done = [s for s in d.legalization_progress if s in step_keys]
        d.legalization_progress = done
        d.legalization_status = (LegalizationStatus.COMPLETED if step_keys and all(k in done for k in step_keys if k != "verify")
                                 else LegalizationStatus.IN_PROGRESS if done else LegalizationStatus.REQUIRED)
    audit(db, action="document.update", entity_type="document", entity_id=d.id, actor=p, subject_user_id=d.owner_user_id, detail={"fields": sorted(data)})
    generate_for_student(db, d.owner_user_id)
    db.commit()
    db.refresh(d)
    return ser_document(d)


class ReviewIn(BaseModel):
    decision: str = Field(pattern="^(VERIFIED|NEEDS_CORRECTION)$")
    reason: str | None = Field(default=None, max_length=2000)
    checks: list[dict] | None = None


def _apply_review(db: Session, p: Principal, d: Document, decision: str, reason: str | None, checks: list | None, *, bulk: bool = False) -> None:
    d.status = DocumentStatus(decision)
    d.rejection_reason = reason if decision == "NEEDS_CORRECTION" else None
    d.reviewer_user_id = p.id
    if decision == "VERIFIED" and d.legalization_status == LegalizationStatus.IN_PROGRESS:
        d.legalization_status = LegalizationStatus.COMPLETED
    db.add(DocumentReview(document_id=d.id, version=d.current_version, reviewer_user_id=p.id, reviewer_org_id=p.org_id, decision=decision,
                          reason=reason, checks=checks, created_at=utcnow()))
    audit(db, action="document.review", entity_type="document", entity_id=d.id, actor=p, subject_user_id=d.owner_user_id, detail={"decision": decision, "bulk": bulk})
    if decision == "VERIFIED":
        track(db, "document_verified", user_id=d.owner_user_id, organization_id=p.org_id, properties={"category": d.category.value})
        notify(db, d.owner_user_id, "DOCUMENT_VERIFIED", "notify.documentVerified", f"{d.title} was verified.", params={"document": d.title, "category": d.category.value}, link=f"/documents?doc={d.id}")
    else:
        notify(db, d.owner_user_id, "DOCUMENT_NEEDS_CORRECTION", "notify.documentNeedsCorrection", f"{d.title} needs a correction: {reason}",
               params={"document": d.title, "reason": reason, "category": d.category.value}, link=f"/documents?doc={d.id}")
    # Mark first response for SLA if this is the counselor's first action.
    a = db.scalar(select(AgencyAssignment).where(AgencyAssignment.student_user_id == d.owner_user_id, AgencyAssignment.status == AssignmentStatus.ACTIVE))
    if a and a.first_response_at is None and p.is_agency:
        a.first_response_at = utcnow()


@router.post("/documents/{doc_id}/review")
def review_document(doc_id: str, body: ReviewIn, p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    d = _get_doc(db, p, doc_id)
    if not p.has(*REVIEWER_ROLES):
        raise HTTPException(403, "Your role cannot review documents.")
    if body.decision == "NEEDS_CORRECTION" and not body.reason:
        raise HTTPException(422, "Tell the student what to fix.")
    _apply_review(db, p, d, body.decision, body.reason, body.checks)
    generate_for_student(db, d.owner_user_id)
    db.commit()
    db.refresh(d)
    return ser_document(d)
