"""Submission hub (V5 → V6): how each application actually reaches the university, and the evidence that it did.

Connector methods (docs/SUBMISSION_CONNECTORS.md, "V6")
    DIRECT_API            Hangyul submits through an official university API. None exists → ``DirectApiConnector.submit``
                          raises ``NotConfigured``; the UI shows "Awaiting provider integration", never a button.
    PARTNER_API           A partner platform's API (none contracted) → ``NotConfigured`` / "Awaiting provider integration".
    AUTHORIZED_AGENCY     The assigned agency submits on the student's behalf — only when the connector records an explicit
                          legal basis (``agency_submission_basis``), the agency holds an active ``SubmissionAgencyPermission``
                          for that connector, and the student has given an ACTIVE ``SubmissionAuthorization`` (consent +
                          snapshot). Otherwise the application falls back to guided self-submission. (``AGENCY_ASSISTED``
                          is read as an alias.) No catalogued university has such a basis today; the only one is a
                          development fixture (is_demo, never in production).
    APPLICATION_PROVIDER  A third-party application service the university uses (UWAY, JinhakApply, Gradnet…): the student
                          applies there personally (guided hand-off).
    GUIDED_EXTERNAL       The student submits on the university's official portal (guided hand-off).
    MANUAL                Paper / e-mail / in person, following the university's instructions.

Evidence rules (non-negotiable)
    * SUBMITTED_CONFIRMED only with evidence: a confirmation / application number, or a receipt document.
    * Without evidence the record is SUBMITTED_UNCONFIRMED ("You told us you submitted — add your confirmation").
    * The application's state machine moves READY → SUBMITTED only when evidence is recorded, through the existing
      transition endpoint (same permissions, history, notifications, document sharing).
    * No portal passwords are ever stored or asked for; no scraping; no MFA/CAPTCHA workarounds; nothing is sent anywhere
      automatically. Status sync is NONE or MANUAL for every connector.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    AgencyAssignment,
    Application,
    ApplicationStatusHistory,
    ApplicationSubmission,
    ConsentRecord,
    Document,
    Essay,
    Organization,
    Program,
    ProgramIntake,
    StudentProfile,
    SubmissionAgencyPermission,
    SubmissionAuthorization,
    SubmissionConnector,
    Task,
    University,
    User,
)
from app.models.base import utcnow
from app.models.enums import ApplicationStatus as S
from app.models.enums import AssignmentStatus, EssayStatus, TaskPriority, TaskStatus, TaskType
from app.services.readiness import application_readiness

METHODS = ("DIRECT_API", "PARTNER_API", "AUTHORIZED_AGENCY", "APPLICATION_PROVIDER", "GUIDED_EXTERNAL", "MANUAL")
METHOD_ALIASES = {"AGENCY_ASSISTED": "AUTHORIZED_AGENCY"}
STUDENT_HANDOFF = {"GUIDED_EXTERNAL", "APPLICATION_PROVIDER", "MANUAL"}
API_METHODS = {"DIRECT_API", "PARTNER_API"}
COUNSELOR_METHODS = {"AUTHORIZED_AGENCY", "DIRECT_API", "PARTNER_API"}
STATUSES = ("NOT_STARTED", "READY_FOR_HANDOFF", "HANDED_OFF", "SUBMITTED_CONFIRMED", "SUBMITTED_UNCONFIRMED")
FEE_STATUSES = ("NOT_REQUIRED", "UNPAID", "PAID", "CONFIRMED", "UNKNOWN")
STATUS_SYNC = ("NONE", "MANUAL", "WEBHOOK", "POLLING")
RESEARCH_FILE = Path(__file__).resolve().parents[3] / "docs" / "research" / "submission-methods.json"
PLACEHOLDER_NOTE = "Submission method not yet verified — your counselor confirms it."
CONSENT_VERSION = "2026-10-submission-v1"
# The only connector allowed to use AUTHORIZED_AGENCY in this codebase: a development fixture (seed extra_60).
FIXTURE_BASIS = "Development fixture — no real agreement. No university or application provider allows agency submission today."
CONSENT_PURPOSE = "SUBMISSION_AUTHORIZATION"
# Rough, labelled minutes per portal step (Hangyul's estimate, shown as "about N minutes"; never a university figure).
STEP_MINUTES = {"create_account": 5, "fill_application": 15, "pay_fee": 5, "get_application_number": 1, "upload_documents": 10,
                "upload_photo": 3, "print_application": 2, "print_test_slip": 2, "print_cover_page": 2, "print_mailing_label": 2,
                "request_recommendation_letters": 5}
STEP_ORDER = ("open_portal", "create_account", "fill_application", "upload_photo", "upload_documents", "request_recommendation_letters",
              "pay_fee", "get_application_number", "print_application", "print_test_slip", "print_cover_page", "print_mailing_label",
              "mail_documents", "mail_originals_after_preliminary_admission", "mail_originals_after_admission", "check_document_arrival", "check_result")


def normalize_method(m: str | None) -> str:
    m = (m or "").upper()
    return METHOD_ALIASES.get(m, m) if m else "GUIDED_EXTERNAL"


class NotConfigured(Exception):
    """Raised by connectors that would need an integration Hangyul does not have (no official API exists)."""


# ------------------------------------------------------------------------------------------------ connector interface


@dataclass
class Connector:
    row: SubmissionConnector | None
    method: str
    permission: SubmissionAgencyPermission | None = None
    # Set when the row says AUTHORIZED_AGENCY but agency submission is not allowed here (NO_BASIS | AGENCY_NOT_AUTHORISED |
    # NO_AGENCY): the application falls back to guided self-submission.
    agency_unavailable: str | None = None

    def can_student_handoff(self) -> bool:
        return self.method in STUDENT_HANDOFF

    def handoff_url(self) -> str | None:
        return self.row.portal_url if self.row else None

    def integration_state(self) -> str:
        """AWAITING_PROVIDER for API methods (no integration exists); NOT_APPLICABLE otherwise."""
        return "AWAITING_PROVIDER" if self.method in API_METHODS else "NOT_APPLICABLE"

    def submit(self, app: Application) -> dict:  # pragma: no cover - interface
        raise NotConfigured(f"{self.method} submission is done outside Hangyul and recorded with evidence.")


class DirectApiConnector(Connector):
    def submit(self, app: Application) -> dict:
        raise NotConfigured("No university offers an official submission API to Hangyul. Awaiting provider integration.")


class PartnerApiConnector(Connector):
    def submit(self, app: Application) -> dict:
        raise NotConfigured("No partner submission API is contracted. Awaiting provider integration.")


class GuidedExternalConnector(Connector):
    pass


class ApplicationProviderConnector(Connector):
    pass


class AuthorizedAgencyConnector(Connector):
    """The agency's staff submit on the official portal in their own browser, with their own account where the provider
    allows one — Hangyul never holds credentials and never submits by itself."""


AgencyAssistedConnector = AuthorizedAgencyConnector  # V5 name


class ManualConnector(Connector):
    pass


_CLASSES = {"DIRECT_API": DirectApiConnector, "PARTNER_API": PartnerApiConnector, "GUIDED_EXTERNAL": GuidedExternalConnector,
            "APPLICATION_PROVIDER": ApplicationProviderConnector, "AUTHORIZED_AGENCY": AuthorizedAgencyConnector, "MANUAL": ManualConnector}


def connector_row_for(db: Session, app: Application) -> SubmissionConnector | None:
    """Most specific row wins: program > degree level + intake term > degree level > university."""
    program = db.get(Program, app.program_id)
    intake = db.get(ProgramIntake, app.intake_id)
    best, best_score = None, -1
    for r in db.scalars(select(SubmissionConnector).where(SubmissionConnector.university_id == app.university_id)).all():
        score = 0
        if r.program_id:
            if r.program_id != app.program_id:
                continue
            score += 8
        if r.degree_level:
            if r.degree_level != program.degree_level.value:
                continue
            score += 4
        if r.intake_term:
            if r.intake_term != intake.term.value:
                continue
            score += 2
        if score > best_score:
            best, best_score = r, score
    return best


def _production() -> bool:
    from app.core.config import get_settings

    return get_settings().env == "production"


def agency_permission(db: Session, row: SubmissionConnector | None, agency_org_id) -> tuple[SubmissionAgencyPermission | None, str | None]:
    """(permission, None) when ``agency_org_id`` may submit under this connector, else (None, reason)."""
    if row is None or not (row.agency_submission_basis or "").strip():
        return None, "NO_BASIS"
    if agency_org_id is None:
        return None, "NO_AGENCY"
    today = utcnow().date()
    perm = db.scalar(select(SubmissionAgencyPermission).where(SubmissionAgencyPermission.connector_id == row.id,
                                                              SubmissionAgencyPermission.agency_org_id == agency_org_id,
                                                              SubmissionAgencyPermission.active.is_(True)))
    if perm is None or (perm.valid_from and perm.valid_from > today) or (perm.valid_until and perm.valid_until < today):
        return None, "AGENCY_NOT_AUTHORISED"
    if (perm.is_demo or row.is_demo) and _production():
        return None, "AGENCY_NOT_AUTHORISED"  # development fixtures never count in production
    return perm, None


def fixture_connector(db: Session) -> SubmissionConnector | None:
    return db.scalar(select(SubmissionConnector).where(SubmissionConnector.agency_submission_basis == FIXTURE_BASIS,
                                                       SubmissionConnector.program_id.is_not(None), SubmissionConnector.is_demo.is_(True)))


def connector_for(db: Session, app: Application) -> Connector:
    row = connector_row_for(db, app)
    method = normalize_method(row.method) if row else "GUIDED_EXTERNAL"
    perm, why = None, None
    if method == "AUTHORIZED_AGENCY":
        perm, why = agency_permission(db, row, app.agency_org_id)
        if perm is None:
            method = "GUIDED_EXTERNAL"  # no legal basis / agency not party to it → the student submits personally
    return _CLASSES.get(method, ManualConnector)(row=row, method=method, permission=perm, agency_unavailable=why)


def ser_connector(row: SubmissionConnector | None, university: University | None = None, conn: Connector | None = None) -> dict:
    method = conn.method if conn else (normalize_method(row.method) if row else "GUIDED_EXTERNAL")
    integration = "AWAITING_PROVIDER" if method in API_METHODS else "NOT_APPLICABLE"
    if row is None:
        return {"method": method, "configured_method": None, "provider": None, "portal_name": None, "portal_url": None, "official_url": None,
                "verification_status": "NEEDS_REVIEW", "instructions": PLACEHOLDER_NOTE, "placeholder": True,
                "fee": {"amount": None, "currency": None, "payment_method": None, "payee": None, "payer": "UNKNOWN"},
                "supported_actions": [], "documents_accepted": "UNKNOWN", "originals_by_mail": None, "confirmation_method": None,
                "receipt_method": None, "login_requirements": None, "status_sync": "NONE", "integration": integration,
                "agency_submission": {"basis": None, "basis_url": None, "basis_verified": None},
                "source_url": None, "verified_source": None, "last_verified": None, "partial": False, "is_demo": False,
                "university": university.name_en if university else None, "university_id": str(university.id) if university else None}
    return {
        "id": str(row.id), "method": method, "configured_method": normalize_method(row.method), "provider": row.provider,
        "portal_name": row.portal_name or _portal_name(row.provider), "portal_url": row.portal_url, "official_url": row.official_url or row.source_url,
        "supported_actions": row.supported_actions or [], "login_requirements": row.login_requirements,
        "fee": {"amount": row.fee_amount, "currency": row.fee_currency, "payment_method": row.fee_payment_method, "payee": row.fee_payee,
                "payer": row.fee_payer or "UNKNOWN"},
        "documents_accepted": row.documents_accepted or "UNKNOWN", "originals_by_mail": row.originals_by_mail,
        "confirmation_method": row.confirmation_method, "receipt_method": row.receipt_method, "status_sync": row.status_sync or "NONE",
        "integration": integration,
        "agency_submission": {"basis": row.agency_submission_basis, "basis_url": row.agency_submission_basis_url,
                              "basis_verified": row.agency_submission_basis_verified.isoformat() if row.agency_submission_basis_verified else None},
        "instructions": row.instructions, "source_url": row.source_url, "verified_source": row.verified_source,
        "last_verified": row.last_verified.isoformat() if row.last_verified else None,
        "verification_status": row.verification_status, "placeholder": row.verification_status == "NEEDS_REVIEW",
        "partial": row.verification_status == "PARTIAL", "is_demo": bool(row.is_demo),
        "notes": row.notes, "degree_level": row.degree_level, "intake_term": row.intake_term,
        "program_id": str(row.program_id) if row.program_id else None, "university": university.name_en if university else None, "university_id": str(university.id) if university else None,
    }


# --------------------------------------------------------------------------------------------------- records + checks


def get_record(db: Session, app_id) -> ApplicationSubmission | None:
    return db.scalar(select(ApplicationSubmission).where(ApplicationSubmission.application_id == app_id))


def _default_fee(conn: Connector) -> tuple[str, int | None, str | None, str | None]:
    row = conn.row
    if row is None or row.fee_amount is None:
        return "UNKNOWN", None, row.fee_currency if row else None, row.fee_payee if row else None
    if row.fee_amount == 0:
        return "NOT_REQUIRED", 0, row.fee_currency, row.fee_payee
    return "UNPAID", row.fee_amount, row.fee_currency, row.fee_payee


def ensure_record(db: Session, app: Application) -> ApplicationSubmission:
    rec = get_record(db, app.id)
    conn = connector_for(db, app)
    if rec is None:
        fee_status, amount, cur, payee = _default_fee(conn)
        rec = ApplicationSubmission(application_id=app.id, connector_id=conn.row.id if conn.row else None, method=conn.method, status="NOT_STARTED",
                                    fee_status=fee_status, fee_amount=amount, fee_currency=cur, fee_payee=payee, is_demo=app.is_demo)
        db.add(rec)
        db.flush()
    return rec


def evidence_kind(external_reference: str | None, receipt_document_id) -> str:
    ref, rec = bool(external_reference and external_reference.strip()), receipt_document_id is not None
    return "CONFIRMATION_AND_RECEIPT" if ref and rec else "CONFIRMATION_ID" if ref else "RECEIPT" if rec else "NONE"


def has_evidence(db: Session, app: Application) -> bool:
    rec = get_record(db, app.id)
    return bool(rec and rec.status == "SUBMITTED_CONFIRMED" and rec.evidence_kind != "NONE")


def require_evidence_for_student(db: Session, app: Application) -> None:
    """Called by the generic transition endpoint: a student can never mark an application SUBMITTED without evidence."""
    if not has_evidence(db, app):
        raise HTTPException(409, "Record your confirmation number or receipt first — Hangyul never marks an application submitted without evidence.")


def pre_leave_checklist(db: Session, app: Application, rec: ApplicationSubmission | None) -> dict:
    """Exactly what is ready before the student leaves for the official portal: documents, essays, fee."""
    prof = db.scalar(select(StudentProfile).where(StudentProfile.user_id == app.student_user_id))
    _pct, items = application_readiness(db, app, prof, utcnow().date())
    # Required items, plus optional ones that are ready (the same "N documents checked" the workspace lanes show).
    required = [i for i in items if i["required"] or i["ready"]]
    essays = db.scalars(select(Essay).where(Essay.application_id == app.id)).all()
    docs = [{"label": i["label"], "category": i["category"], "ready": i["ready"], "required": bool(i["required"]), "document_id": i["document_id"]}
            for i in required]
    return {
        "documents": {"ready": sum(1 for d in docs if d["ready"]), "total": len(docs), "items": docs},
        "essays": {"approved": sum(1 for e in essays if e.status == EssayStatus.APPROVED), "total": len(essays),
                   "items": [{"id": str(e.id), "essay_type": e.essay_type.value, "approved": e.status == EssayStatus.APPROVED} for e in essays]},
        "fee": {"status": rec.fee_status if rec else "UNKNOWN", "amount": rec.fee_amount if rec else None, "currency": rec.fee_currency if rec else None,
                "payee": rec.fee_payee if rec else None},
        "complete": all(d["ready"] for d in docs) and all(e.status == EssayStatus.APPROVED for e in essays),
    }


def ser_record(db: Session, rec: ApplicationSubmission | None, *, viewer_is_university: bool = False) -> dict | None:
    if rec is None:
        return None
    by = db.get(User, rec.recorded_by_user_id) if rec.recorded_by_user_id else None
    receipt = db.get(Document, rec.receipt_document_id) if rec.receipt_document_id else None
    method = normalize_method(rec.method)
    out = {
        "id": str(rec.id), "method": method, "status": rec.status, "handed_off_at": rec.handed_off_at.isoformat() if rec.handed_off_at else None,
        "submitted_on": rec.submitted_on.isoformat() if rec.submitted_on else None, "external_reference": rec.external_reference,
        "evidence_kind": rec.evidence_kind, "recorded_by_role": rec.recorded_by_role, "recorded_at": rec.recorded_at.isoformat() if rec.recorded_at else None,
        "fee": {"status": rec.fee_status, "amount": rec.fee_amount, "currency": rec.fee_currency, "payee": rec.fee_payee,
                "paid_on": rec.fee_paid_on.isoformat() if rec.fee_paid_on else None},
    }
    if viewer_is_university:
        return {k: out[k] for k in ("method", "status", "submitted_on", "external_reference", "evidence_kind", "recorded_at")}
    org = None
    if rec.authorization_id:
        auth = db.get(SubmissionAuthorization, rec.authorization_id)
        org = db.get(Organization, auth.agency_org_id) if auth else None
    out.update({
        "recorded_by": {"id": str(by.id), "full_name": by.full_name} if by else None,
        "recorded_by_org": org.name if org else None,
        "receipt": {"id": str(receipt.id), "title": receipt.title} if receipt else None,
        "note": rec.note, "completeness_at_submission": rec.completeness_at_submission,
        "failure": {"reason": rec.failure_reason, "at": rec.failed_at.isoformat()} if rec.failure_reason and rec.status != "SUBMITTED_CONFIRMED" else None,
    })
    return out


# ------------------------------------------------------------------------------------------- guided + authorised details


def _portal_name(provider: str | None) -> str | None:
    if not provider:
        return None
    return provider.split(" (")[0].strip() or provider


def _counselor_review(db: Session, app: Application) -> dict | None:
    """The counselor's final review = the agency's move to READY (only agencies make that transition)."""
    h = db.scalars(select(ApplicationStatusHistory).where(ApplicationStatusHistory.application_id == app.id, ApplicationStatusHistory.to_status == S.READY)
                   .order_by(ApplicationStatusHistory.created_at.desc())).first()
    if h is None:
        return None
    by = db.get(User, h.actor_user_id) if h.actor_user_id else None
    return {"date": h.created_at.date().isoformat(), "by": by.full_name if by else None}


def form_fields(db: Session, app: Application) -> list[dict]:
    """What the application form asks, taken from the student's profile — the summary shown before authorising and the
    "what to enter" list for self-submission. Passport numbers are only ever held masked."""
    u = db.get(User, app.student_user_id)
    prof = db.scalar(select(StudentProfile).where(StudentProfile.user_id == app.student_user_id))
    out = [{"key": "full_name", "value": u.full_name if u else None}, {"key": "email", "value": u.email if u else None}]
    if prof:
        out += [{"key": "date_of_birth", "value": prof.date_of_birth.isoformat() if prof.date_of_birth else None},
                {"key": "nationality", "value": prof.nationality},
                {"key": "passport", "value": prof.passport_number_masked}]
        edu = sorted(prof.educations, key=lambda e: e.graduation_year or 0)[-1] if prof.educations else None
        if edu:
            out.append({"key": "education", "value": f"{edu.institution} · {edu.graduation_year or ''}".strip(" ·")})
        lang = next((x for x in sorted(prof.languages, key=lambda x: x.test_date or date.min, reverse=True) if not x.is_planned), None)
        if lang:
            score = int(lang.score) if float(lang.score).is_integer() else lang.score
            out.append({"key": "language", "value": f"{lang.test.value} {score}"})
    program = db.get(Program, app.program_id)
    out.append({"key": "program", "value": program.name_en if program else None})
    return [f for f in out if f["value"]]


def guided_details(db: Session, app: Application, conn: Connector, checklist: dict | None) -> dict:
    """The connector-unavailable design: what Hangyul completed, what the student does next (exact steps, files, fee,
    what to enter), and whether the university requires the applicant to submit personally."""
    row = conn.row
    actions = [a for a in (row.supported_actions if row and row.supported_actions else []) if a in STEP_ORDER]
    steps = sorted(set(actions), key=STEP_ORDER.index) if actions else (["open_portal", "fill_application", "pay_fee", "get_application_number"] if row and row.portal_url else [])
    minutes = sum(STEP_MINUTES.get(s, 0) for s in steps) or None
    files = [d for d in (checklist or {}).get("documents", {}).get("items", []) if d["ready"]]
    self_required = bool(row and conn.method in STUDENT_HANDOFF and normalize_method(row.method) == "APPLICATION_PROVIDER"
                         and row.verification_status in ("VERIFIED", "PARTIAL"))
    return {"self_submit_required": self_required, "steps": steps, "minutes": minutes, "files": files,
            "form_fields": form_fields(db, app), "counselor_review": _counselor_review(db, app)}


def active_authorization(db: Session, app_id) -> SubmissionAuthorization | None:
    return db.scalar(select(SubmissionAuthorization).where(SubmissionAuthorization.application_id == app_id, SubmissionAuthorization.status == "ACTIVE"))


def latest_authorization(db: Session, app_id) -> SubmissionAuthorization | None:
    return db.scalars(select(SubmissionAuthorization).where(SubmissionAuthorization.application_id == app_id)
                      .order_by(SubmissionAuthorization.granted_at.desc())).first()


def _submitter(db: Session, app: Application) -> tuple[Organization | None, User | None]:
    org = db.get(Organization, app.agency_org_id) if app.agency_org_id else None
    a = db.scalar(select(AgencyAssignment).where(AgencyAssignment.student_user_id == app.student_user_id, AgencyAssignment.status == AssignmentStatus.ACTIVE))
    counselor = db.get(User, a.counselor_user_id) if a and a.counselor_user_id and a.organization_id == app.agency_org_id else None
    return org, counselor


def _doc_versions(db: Session, items: list[dict]) -> list[dict]:
    out = []
    for d in items:
        doc = db.get(Document, d["document_id"]) if d.get("document_id") else None
        out.append({"label": d["label"], "category": d["category"], "document_id": d.get("document_id"), "version": doc.current_version if doc else None,
                    "title": doc.title if doc else None, "ready": d["ready"]})
    return out


def build_snapshot(db: Session, app: Application, conn: Connector) -> dict:
    """Exactly what the student authorises (stored with the consent, shown again to the agency at final review)."""
    uni = db.get(University, app.university_id)
    prog = db.get(Program, app.program_id)
    intake = db.get(ProgramIntake, app.intake_id)
    rec = get_record(db, app.id)
    chk = pre_leave_checklist(db, app, rec)
    org, counselor = _submitter(db, app)
    row = conn.row
    fee_status, amount, cur, payee = _default_fee(conn)
    return {
        "consent_version": CONSENT_VERSION,
        "university": {"id": str(uni.id), "name_en": uni.name_en},
        "program": {"id": str(prog.id), "name_en": prog.name_en, "degree_level": prog.degree_level.value},
        "intake": {"id": str(intake.id), "year": intake.year, "term": intake.term.value, "deadline": intake.application_deadline.isoformat()},
        "form_fields": form_fields(db, app),
        "documents": _doc_versions(db, [d for d in chk["documents"]["items"] if d["ready"]]),
        "essays": chk["essays"]["items"],
        "fee": {"amount": amount, "currency": cur, "payee": payee, "payer": (row.fee_payer if row else None) or "STUDENT", "kind": "UNIVERSITY_APPLICATION_FEE"},
        "submitter": {"agency_id": str(org.id) if org else None, "agency": org.name if org else None,
                      "counselor_id": str(counselor.id) if counselor else None, "counselor": counselor.full_name if counselor else None},
        "mechanism": {"method": conn.method, "provider": row.provider if row else None, "portal_name": (row.portal_name or _portal_name(row.provider)) if row else None,
                      "portal_url": row.portal_url if row else None, "basis": row.agency_submission_basis if row else None},
    }


def package_changed(db: Session, app: Application, auth: SubmissionAuthorization) -> bool:
    """True when a document version the student authorised has changed since (the agency re-confirms with the student)."""
    then = {(d.get("document_id"), d.get("version")) for d in (auth.snapshot or {}).get("documents", [])}
    chk = pre_leave_checklist(db, app, get_record(db, app.id))
    now = {(d["document_id"], d["version"]) for d in _doc_versions(db, [d for d in chk["documents"]["items"] if d["ready"]])}
    return then != now


def ser_authorization(db: Session, auth: SubmissionAuthorization | None, app: Application | None = None) -> dict | None:
    if auth is None:
        return None
    return {"id": str(auth.id), "status": auth.status, "granted_at": auth.granted_at.isoformat(), "revoked_at": auth.revoked_at.isoformat() if auth.revoked_at else None,
            "used_at": auth.used_at.isoformat() if auth.used_at else None, "consent_version": auth.consent_version, "snapshot": auth.snapshot,
            "package_changed": package_changed(db, app, auth) if app is not None and auth.status == "ACTIVE" else False}


def final_review(db: Session, app: Application, conn: Connector, auth: SubmissionAuthorization | None) -> list[dict]:
    """Agency's final check before submitting on the official portal (codes are translated in the UI)."""
    chk = pre_leave_checklist(db, app, get_record(db, app.id))
    intake = db.get(ProgramIntake, app.intake_id)
    days = (intake.application_deadline - utcnow().date()).days
    changed = package_changed(db, app, auth) if auth and auth.status == "ACTIVE" else False
    return [
        {"code": "CONSENT", "ok": bool(auth and auth.status in ("ACTIVE", "USED")), "params": {"at": auth.granted_at.isoformat() if auth else None}},
        {"code": "DOCUMENTS", "ok": chk["documents"]["ready"] == chk["documents"]["total"], "params": {"ready": chk["documents"]["ready"], "total": chk["documents"]["total"]}},
        {"code": "ESSAYS", "ok": chk["essays"]["approved"] == chk["essays"]["total"], "params": {"approved": chk["essays"]["approved"], "total": chk["essays"]["total"]}},
        {"code": "PACKAGE_UNCHANGED", "ok": not changed, "params": {}},
        {"code": "DEADLINE", "ok": days >= 0, "params": {"deadline": intake.application_deadline.isoformat(), "days": days}},
        {"code": "FEE", "ok": True, "params": {"amount": conn.row.fee_amount if conn.row else None, "currency": conn.row.fee_currency if conn.row else None,
                                               "payer": (conn.row.fee_payer if conn.row else None) or "STUDENT"}},
    ]


def submission_view(db: Session, app: Application, *, viewer: str = "student") -> dict:
    """Everything the hand-off / authorisation UI needs. ``viewer`` ∈ student | agency | university."""
    uni = db.get(University, app.university_id)
    conn = connector_for(db, app)
    rec = get_record(db, app.id)
    if viewer == "university":
        return {"method": normalize_method(rec.method) if rec else conn.method, "record": ser_record(db, rec, viewer_is_university=True),
                "application_status": app.status.value, "submitted_at": app.submitted_at.isoformat() if app.submitted_at else None,
                "external_reference": app.external_reference}
    status = rec.status if rec else "NOT_STARTED"
    if status == "NOT_STARTED" and app.status == S.READY:
        status = "READY_FOR_HANDOFF"
    pre = app.status in (S.READY, S.DOCUMENT_PREPARATION, S.PROFILE_REVIEW, S.DRAFT)
    checklist = pre_leave_checklist(db, app, rec) if pre else None
    agency_mode = conn.method == "AUTHORIZED_AGENCY"
    auth = latest_authorization(db, app.id) if agency_mode or (rec and rec.authorization_id) else None
    active = auth if auth and auth.status == "ACTIVE" else None
    org, counselor = _submitter(db, app)
    confirmed = status == "SUBMITTED_CONFIRMED"
    # V9 reliability: once the deadline has passed without a hand-off, nothing offers "submit" any more (the strategy
    # item DEADLINE_PASSED, owned by the counselor, explains what happens next).
    late = _deadline_passed(db, app)
    return {
        "application_id": str(app.id), "application_status": app.status.value, "university": {"id": str(uni.id), "name_en": uni.name_en},
        "connector": ser_connector(conn.row, uni, conn), "status": status, "record": ser_record(db, rec),
        "can_handoff": app.status == S.READY and conn.can_student_handoff() and status in ("READY_FOR_HANDOFF", "HANDED_OFF", "SUBMITTED_UNCONFIRMED")
                       and not (late and status == "READY_FOR_HANDOFF"),
        "deadline_passed": late,
        "student_can_record": conn.method not in COUNSELOR_METHODS and (app.status == S.READY or app.status in (S.SUBMITTED, S.UNIVERSITY_REVIEW)),
        "counselor_submits": conn.method in COUNSELOR_METHODS,
        "checklist": checklist,
        "integration_state": conn.integration_state(),
        "direct_api": "NOT_CONFIGURED",
        "guided": guided_details(db, app, conn, checklist) if pre and conn.method in STUDENT_HANDOFF else None,
        "agency_submission": {
            "available": agency_mode, "unavailable_reason": conn.agency_unavailable,
            "agency": org.name if org else None, "counselor": counselor.full_name if counselor else None,
            "basis": conn.row.agency_submission_basis if agency_mode and conn.row else None,
            "permission_basis": conn.permission.basis if conn.permission else None,
        },
        "authorization": ser_authorization(db, auth, app),
        "can_authorize": agency_mode and app.status == S.READY and active is None and not confirmed and not late,
        "consent_version": CONSENT_VERSION,
        # What the consent screen shows before authorising (the same snapshot is stored with the consent).
        "consent_preview": build_snapshot(db, app, conn) if agency_mode and viewer == "student" and app.status == S.READY and active is None and not confirmed and not late else None,
        "can_revoke": active is not None and not confirmed,
        "final_review": final_review(db, app, conn, auth) if agency_mode and viewer == "agency" and pre else None,
        "never": ["store_portal_password", "scrape_portal", "bypass_mfa_or_captcha", "claim_submitted_without_evidence"],
    }


def next_step(db: Session, app: Application) -> dict | None:
    """Coordinator/home hook: the submission step for one application, in the strategy item shape (or None)."""
    if app.status not in (S.READY, S.SUBMITTED, S.UNIVERSITY_REVIEW):
        return None
    uni = db.get(University, app.university_id)
    conn = connector_for(db, app)
    rec = get_record(db, app.id)
    status = rec.status if rec else "NOT_STARTED"
    link = f"/applications/{app.id}"
    if _deadline_passed(db, app):
        return None  # V9 reliability: no "submit" step after the deadline (DEADLINE_PASSED is the counselor's item)
    if app.status == S.READY and conn.method == "AUTHORIZED_AGENCY" and status != "SUBMITTED_CONFIRMED" and active_authorization(db, app.id) is None:
        org = db.get(Organization, app.agency_org_id) if app.agency_org_id else None
        return {"code": "SUBMISSION_AUTHORIZE", "severity": "improve", "owner": "student", "title": f"Authorize {org.name if org else 'your agency'} to submit",
                "why": "Your Hangyul application is ready. Your agency can submit it once you authorize it.",
                "params": {"university": uni.name_en, "university_id": str(uni.id), "agency": org.name if org else ""},
                "action": {"code": "AUTHORIZE", "label": "Review and authorize", "link": link}, "sample": False}
    if app.status == S.READY and conn.can_student_handoff() and status in ("NOT_STARTED", "READY_FOR_HANDOFF"):
        return {"code": "SUBMISSION_HANDOFF", "severity": "improve", "owner": "student", "title": f"Submit on {uni.name_en}'s official portal",
                "why": "Your Hangyul application is ready.", "params": {"university": uni.name_en, "university_id": str(uni.id)},
                "action": {"code": "HANDOFF", "label": "Start", "link": link}, "sample": False}
    if status in ("HANDED_OFF", "SUBMITTED_UNCONFIRMED") and conn.method not in COUNSELOR_METHODS:
        return {"code": "SUBMISSION_CONFIRM", "severity": "improve", "owner": "student", "title": f"Add your {uni.name_en} confirmation",
                "why": "You told us you submitted — the confirmation number or receipt finishes it.", "params": {"university": uni.name_en, "university_id": str(uni.id)},
                "action": {"code": "CONFIRM", "label": "Add confirmation", "link": link}, "sample": False}
    return None


# ------------------------------------------------------------------------------------------------------------ actions


def _confirm_task(db: Session, app: Application, *, open_: bool) -> None:
    """Student-visible task "Add your confirmation" while a hand-off has no evidence; closed once confirmed."""
    key = f"submission-confirm:{app.id}"
    t = db.scalar(select(Task).where(Task.dedupe_key == key))
    uni = db.get(University, app.university_id)
    now = utcnow()
    if open_:
        a = db.scalar(select(AgencyAssignment).where(AgencyAssignment.student_user_id == app.student_user_id, AgencyAssignment.status == AssignmentStatus.ACTIVE))
        intake = db.get(ProgramIntake, app.intake_id)
        due = datetime.combine(intake.application_deadline, datetime.min.time(), tzinfo=now.tzinfo) + timedelta(hours=23) if intake else None
        if t is None:
            db.add(Task(title=f"Add your {uni.name_en} confirmation number or receipt", title_key="task.submissionConfirm",
                        title_params={"university": uni.name_en, "university_id": str(uni.id)}, task_type=TaskType.APPLICATION_SUBMIT, priority=TaskPriority.HIGH,
                        status=TaskStatus.OPEN, due_at=due, owner_user_id=app.student_user_id, owner_org_id=a.organization_id if a else None,
                        student_user_id=app.student_user_id, application_id=app.id, university_id=app.university_id, source="SUCCESS",
                        dedupe_key=key, link=f"/applications/{app.id}", visible_to_student=True))
        elif t.status in (TaskStatus.DONE, TaskStatus.CANCELLED):
            t.status, t.completed_at = TaskStatus.OPEN, None
    elif t is not None and t.status in (TaskStatus.OPEN, TaskStatus.IN_PROGRESS):
        t.status, t.completed_at = TaskStatus.DONE, now


def _agency_task(db: Session, app: Application, *, state: str) -> None:
    """Agency task "Submit {student}'s {university} application" while an authorisation is ACTIVE (staff only)."""
    key = f"submission-agency:{app.id}"
    t = db.scalar(select(Task).where(Task.dedupe_key == key))
    now = utcnow()
    if state == "open":
        uni = db.get(University, app.university_id)
        stu = db.get(User, app.student_user_id)
        _org, counselor = _submitter(db, app)
        intake = db.get(ProgramIntake, app.intake_id)
        due = datetime.combine(intake.application_deadline, datetime.min.time(), tzinfo=now.tzinfo) + timedelta(hours=17) if intake else None
        if t is None:
            db.add(Task(title=f"Submit {stu.full_name}'s {uni.name_en} application (authorised)", title_key="task.submissionAgency",
                        title_params={"student": stu.full_name, "university": uni.name_en, "university_id": str(uni.id)}, task_type=TaskType.APPLICATION_SUBMIT,
                        priority=TaskPriority.HIGH, status=TaskStatus.OPEN, due_at=due, owner_user_id=counselor.id if counselor else None,
                        owner_org_id=app.agency_org_id, student_user_id=app.student_user_id, application_id=app.id, university_id=app.university_id,
                        source="SUCCESS", dedupe_key=key, link=f"/submissions?app={app.id}", visible_to_student=False))
        elif t.status in (TaskStatus.DONE, TaskStatus.CANCELLED):
            t.status, t.completed_at = TaskStatus.OPEN, None
    elif t is not None and t.status in (TaskStatus.OPEN, TaskStatus.IN_PROGRESS):
        t.status, t.completed_at = (TaskStatus.DONE if state == "done" else TaskStatus.CANCELLED), now


def _deadline_passed(db: Session, app: Application) -> bool:
    from app.services.strategy import deadline_passed

    return deadline_passed(db, app)


def _refuse_if_late(db: Session, app: Application) -> None:
    if _deadline_passed(db, app):
        intake = db.get(ProgramIntake, app.intake_id)
        raise HTTPException(409, f"DEADLINE_PASSED: the application deadline ({intake.application_deadline.isoformat()}) has passed. "
                                 "Your counselor can check for a later round or intake.")


def handoff(db: Session, app: Application, actor_id) -> ApplicationSubmission:
    if app.status != S.READY:
        raise HTTPException(409, "This application isn't ready to submit yet.")
    _refuse_if_late(db, app)
    conn = connector_for(db, app)
    if not conn.can_student_handoff():
        raise HTTPException(409, "Your counselor submits this application for you.")
    rec = ensure_record(db, app)
    if rec.status == "SUBMITTED_CONFIRMED":
        raise HTTPException(409, "This application's submission is already confirmed.")
    if rec.status != "SUBMITTED_UNCONFIRMED":
        rec.status = "HANDED_OFF"
    rec.handed_off_at = utcnow()
    rec.handed_off_by_user_id = actor_id
    rec.method = conn.method
    _confirm_task(db, app, open_=True)
    db.flush()
    return rec


def api_submit(db: Session, app: Application) -> dict:
    """Only meaningful for DIRECT_API / PARTNER_API: always NotConfigured today (the API layer turns it into a 409 with
    code AWAITING_PROVIDER). Other methods are submitted outside Hangyul."""
    return connector_for(db, app).submit(app)


def authorize(db: Session, app: Application, student_id) -> SubmissionAuthorization:
    """The student authorises the assigned agency to submit this application (idempotent: an ACTIVE one is returned)."""
    conn = connector_for(db, app)
    if conn.method != "AUTHORIZED_AGENCY":
        raise HTTPException(409, "Agency submission isn't available for this application — you submit it on the official portal.")
    existing = active_authorization(db, app.id)
    if existing:
        return existing
    if app.status != S.READY:
        raise HTTPException(409, "This application isn't ready to submit yet.")
    if has_evidence(db, app):
        raise HTTPException(409, "This application's submission is already confirmed.")
    _refuse_if_late(db, app)
    snap = build_snapshot(db, app, conn)
    if not snap["submitter"]["agency"]:
        raise HTTPException(409, "No agency is assigned to submit this application.")
    now = utcnow()
    auth = SubmissionAuthorization(application_id=app.id, student_user_id=student_id, agency_org_id=app.agency_org_id,
                                   submitter_user_id=parse_id(snap["submitter"]["counselor_id"]), permission_id=conn.permission.id if conn.permission else None,
                                   status="ACTIVE", granted_at=now, consent_version=CONSENT_VERSION, snapshot=snap, is_demo=app.is_demo)
    db.add(auth)
    db.add(ConsentRecord(user_id=student_id, purpose=CONSENT_PURPOSE, version=CONSENT_VERSION, granted=True, scope_org_id=app.agency_org_id, created_at=now))
    rec = ensure_record(db, app)
    rec.method = conn.method
    rec.failure_reason, rec.failed_at = None, None
    _agency_task(db, app, state="open")
    db.flush()
    return auth


def revoke(db: Session, app: Application, student_id, reason: str | None = None) -> SubmissionAuthorization | None:
    """Withdraw consent before submission. Idempotent: nothing active → the latest authorisation is returned unchanged."""
    auth = active_authorization(db, app.id)
    if auth is None:
        latest = latest_authorization(db, app.id)
        if latest and latest.status == "USED":
            raise HTTPException(409, "Your agency already submitted this application — consent can't be withdrawn after submission.")
        return latest
    if has_evidence(db, app):
        raise HTTPException(409, "Your agency already submitted this application — consent can't be withdrawn after submission.")
    now = utcnow()
    auth.status, auth.revoked_at, auth.revoked_reason = "REVOKED", now, (reason or "").strip()[:500] or None
    db.add(ConsentRecord(user_id=student_id, purpose=CONSENT_PURPOSE, version=auth.consent_version, granted=False, scope_org_id=auth.agency_org_id, created_at=now))
    _agency_task(db, app, state="cancel")
    db.flush()
    return auth


def report_failure(db: Session, app: Application, *, reason: str) -> ApplicationSubmission:
    """The agency tried the official portal and it failed (payment declined, portal error…). Nothing is submitted; the
    student sees the reason; the authorisation stays ACTIVE so staff can retry."""
    conn = connector_for(db, app)
    if conn.method != "AUTHORIZED_AGENCY":
        raise HTTPException(409, "Only an authorised agency submission can report a failed attempt.")
    if active_authorization(db, app.id) is None:
        raise HTTPException(409, "The student hasn't authorised this submission (or withdrew consent).")
    rec = ensure_record(db, app)
    if rec.status == "SUBMITTED_CONFIRMED":
        raise HTTPException(409, "This application's submission is already confirmed.")
    rec.failure_reason, rec.failed_at = reason.strip()[:1000], utcnow()
    db.flush()
    return rec


def parse_id(v):
    import uuid as _uuid

    return _uuid.UUID(v) if v else None


def record_confirmation(db: Session, app: Application, *, actor_id, actor_role: str, external_reference: str | None, submitted_on: date | None,
                        receipt_document_id=None, fee_status: str | None = None, fee_paid_on: date | None = None, note: str | None = None,
                        actor_org_id=None) -> ApplicationSubmission:
    """Record what happened on the external side. Evidence decides CONFIRMED vs UNCONFIRMED; nothing else can.
    Idempotent: repeating a confirmed record with the same reference changes nothing; a different reference is a 409."""
    if app.status not in (S.READY, S.SUBMITTED, S.UNIVERSITY_REVIEW, S.ADDITIONAL_DOCUMENTS, S.INTERVIEW):
        raise HTTPException(409, "A submission can be recorded once the application is ready.")
    conn = connector_for(db, app)
    if actor_role == "STUDENT" and conn.method in COUNSELOR_METHODS:
        raise HTTPException(403, "Your counselor submits this application and records the confirmation.")
    ref = (external_reference or "").strip() or None
    existing = get_record(db, app.id)
    if existing and existing.status == "SUBMITTED_CONFIRMED":
        if ref and existing.external_reference and ref != existing.external_reference:
            raise HTTPException(409, f"This submission is already recorded with reference {existing.external_reference}.")
        if not ref and receipt_document_id is None:
            return existing  # duplicate action: nothing new
    auth = None
    if conn.method == "AUTHORIZED_AGENCY" and not (existing and existing.status == "SUBMITTED_CONFIRMED"):
        if actor_role != "AGENCY" or actor_org_id != app.agency_org_id:
            raise HTTPException(403, "Only the authorised agency records this submission.")
        auth = active_authorization(db, app.id)
        if auth is None:
            latest = latest_authorization(db, app.id)
            raise HTTPException(409, "The student withdrew consent — nothing may be submitted." if latest and latest.status == "REVOKED"
                                else "The student hasn't authorised this submission yet.")
        if not ref:
            raise HTTPException(422, "Enter the application or reference number the official portal issued.")
    if receipt_document_id is not None:
        doc = db.get(Document, receipt_document_id)
        if doc is None or doc.owner_user_id != app.student_user_id:
            raise HTTPException(404, "Receipt document not found.")
    if submitted_on and submitted_on > utcnow().date():
        raise HTTPException(422, "The submission date can't be in the future.")
    rec = ensure_record(db, app)
    rec.external_reference = ref or rec.external_reference
    rec.receipt_document_id = receipt_document_id or rec.receipt_document_id
    rec.submitted_on = submitted_on or rec.submitted_on or utcnow().date()
    rec.evidence_kind = evidence_kind(rec.external_reference, rec.receipt_document_id)
    rec.recorded_by_user_id, rec.recorded_by_role, rec.recorded_at = actor_id, actor_role, utcnow()
    rec.method = conn.method
    if note:
        rec.note = note[:2000]
    if fee_status:
        set_fee(rec, fee_status, actor_role=actor_role, paid_on=fee_paid_on)
    confirmed = rec.evidence_kind != "NONE"
    rec.status = "SUBMITTED_CONFIRMED" if confirmed else "SUBMITTED_UNCONFIRMED"
    if confirmed:
        rec.failure_reason, rec.failed_at = None, None
    if auth is not None and confirmed:
        auth.status, auth.used_at = "USED", utcnow()
        rec.authorization_id = auth.id
        _agency_task(db, app, state="done")
    if confirmed and rec.completeness_at_submission is None:
        prof = db.scalar(select(StudentProfile).where(StudentProfile.user_id == app.student_user_id))
        _pct, items = application_readiness(db, app, prof, utcnow().date())
        req = [i for i in items if i["required"]]
        rec.completeness_at_submission = round(sum(1 for i in req if i["ready"]) / len(req), 3) if req else 1.0
    if conn.method not in COUNSELOR_METHODS:
        _confirm_task(db, app, open_=not confirmed)
    db.flush()
    return rec


def set_fee(rec: ApplicationSubmission, status: str, *, actor_role: str, paid_on: date | None = None, amount: int | None = None) -> None:
    if status not in FEE_STATUSES:
        raise HTTPException(422, "Unknown fee status.")
    if status == "CONFIRMED" and actor_role == "STUDENT":
        raise HTTPException(403, "Your counselor confirms the fee once the university (or its provider) shows it as paid.")
    rec.fee_status = status
    if amount is not None:
        rec.fee_amount = amount
    if status in ("PAID", "CONFIRMED"):
        rec.fee_paid_on = paid_on or rec.fee_paid_on or utcnow().date()


# ------------------------------------------------------------------------------------------------- agency queue


def agency_queue(db: Session, p, *, view: str = "ready") -> dict:
    """The "Ready to submit" queue: applications in the caller's scope whose connector allows authorised agency
    submission. Groups: ready (authorised, not yet recorded) · awaiting (READY, student hasn't authorised) · submitted."""
    from app.services.access import scope_applications

    candidates = db.scalars(scope_applications(select(Application).where(
        Application.status.in_([S.READY, S.SUBMITTED, S.UNIVERSITY_REVIEW, S.ADDITIONAL_DOCUMENTS, S.INTERVIEW])), p)).all()
    rows, counts = [], {"ready": 0, "awaiting": 0, "submitted": 0, "failed": 0}
    for app in candidates:
        conn = connector_for(db, app)
        auth = latest_authorization(db, app.id)
        if conn.method != "AUTHORIZED_AGENCY" and auth is None:
            continue
        rec = get_record(db, app.id)
        confirmed = bool(rec and rec.status == "SUBMITTED_CONFIRMED")
        if confirmed:
            group = "submitted" if auth and auth.status == "USED" else None
        elif app.status == S.READY and auth and auth.status == "ACTIVE":
            group = "ready"
        elif app.status == S.READY and conn.method == "AUTHORIZED_AGENCY":
            group = "awaiting"
        else:
            group = None
        if group is None:
            continue
        counts[group] += 1
        if group == "ready" and rec and rec.failure_reason:
            counts["failed"] += 1
        if view != "all" and group != view:
            continue
        uni = db.get(University, app.university_id)
        prog = db.get(Program, app.program_id)
        intake = db.get(ProgramIntake, app.intake_id)
        stu = db.get(User, app.student_user_id)
        chk = pre_leave_checklist(db, app, rec)
        rows.append({
            "application_id": str(app.id), "group": group, "student": {"id": str(stu.id), "full_name": stu.full_name},
            "university": {"id": str(uni.id), "name_en": uni.name_en}, "program": {"id": str(prog.id), "name_en": prog.name_en},
            "intake": {"year": intake.year, "term": intake.term.value}, "deadline": intake.application_deadline.isoformat(),
            "authorized_at": auth.granted_at.isoformat() if auth and auth.status in ("ACTIVE", "USED") else None,
            "authorization_status": auth.status if auth else None,
            "package": {"complete": chk["complete"], "ready": chk["documents"]["ready"], "total": chk["documents"]["total"]},
            "fee_status": rec.fee_status if rec else _default_fee(conn)[0],
            "failure": rec.failure_reason if rec and not confirmed else None,
            "external_reference": rec.external_reference if confirmed else None, "submitted_on": rec.submitted_on.isoformat() if confirmed and rec.submitted_on else None,
            "fixture": bool(conn.row and conn.row.is_demo and conn.row.agency_submission_basis == FIXTURE_BASIS),
        })
    rows.sort(key=lambda r: (r["deadline"], r["student"]["full_name"]))
    return {"items": rows, "counts": counts, "view": view}


# ------------------------------------------------------------------------------------------------- V9 submissions queue

PIPELINE_STATES = ("issue", "confirmation_missing", "authorized", "ready", "needs_final_review", "submitted", "received")
CONFIRMATION_MISSING_DAYS = 2
PIPELINE_DEFINITIONS = {
    "needs_final_review": "Not yet Ready, every required item is ready: the counselor's final review (move to Ready) is next.",
    "ready": "Ready, nothing recorded yet: the counselor hands it off (the student submits on the official portal) or submits it.",
    "authorized": "The student authorised the agency to submit (recorded legal basis); the agency submits and records the reference.",
    "submitted": f"Handed off or reported submitted within the last {CONFIRMATION_MISSING_DAYS} days; waiting for the reference or receipt.",
    "confirmation_missing": f"Handed off or reported submitted more than {CONFIRMATION_MISSING_DAYS} days ago and still no reference or receipt.",
    "received": "Evidence recorded (reference number or receipt) and the application is with the university.",
    "issue": "A failed attempt is recorded (portal error, payment declined…) and nothing has been submitted since.",
}


def submission_pipeline(db: Session, p, *, state: str | None = None, student_ids=None) -> dict:
    """Every application in the caller's scope between "almost ready" and "the university has it", across ALL connector
    methods (guided hand-off, application providers, manual, authorised agency, APIs), in seven states derived only from
    submission records, authorisations and evidence (PIPELINE_DEFINITIONS). `agency_queue` (V6) is unchanged."""
    from app.services.access import scope_applications

    now = utcnow()
    stmt = scope_applications(select(Application).where(Application.status.in_(
        [S.PROFILE_REVIEW, S.DOCUMENT_PREPARATION, S.READY, S.SUBMITTED, S.UNIVERSITY_REVIEW, S.ADDITIONAL_DOCUMENTS, S.INTERVIEW])), p)
    if student_ids is not None:
        stmt = stmt.where(Application.student_user_id.in_(student_ids))
    apps = db.scalars(stmt).all()
    ids = [a.id for a in apps]
    recs = {r.application_id: r for r in db.scalars(select(ApplicationSubmission).where(ApplicationSubmission.application_id.in_(ids))).all()} if ids else {}
    auths: dict = {}
    for au in (db.scalars(select(SubmissionAuthorization).where(SubmissionAuthorization.application_id.in_(ids)).order_by(SubmissionAuthorization.granted_at)).all()
               if ids else []):
        auths[au.application_id] = au
    ready_at = dict(db.execute(select(ApplicationStatusHistory.application_id, func.max(ApplicationStatusHistory.created_at))
                               .where(ApplicationStatusHistory.application_id.in_(ids), ApplicationStatusHistory.to_status == S.READY)
                               .group_by(ApplicationStatusHistory.application_id)).all()) if ids else {}
    profs = {pr.user_id: pr for pr in db.scalars(select(StudentProfile).where(StudentProfile.user_id.in_({a.student_user_id for a in apps})))} if apps else {}
    # V9 scale (docs/qa/v9/scale): the full checklist per preparing application was an N+1 (~10 ms each; 1.3 s for a
    # 200-student caseload). A required non-essay document is ready only when a VERIFIED copy exists, so an application
    # whose student lacks a VERIFIED document of some required category can never be "needs_final_review" — skip the
    # checklist for it. Every other application still gets the exact readiness check below.
    # Keep the catalog rows the per-application helpers fetch with db.get() in the identity map (strong refs), so each
    # program / intake / university is loaded once per call rather than once per application.
    _catalog = ([*db.scalars(select(Program).where(Program.id.in_({a.program_id for a in apps}))).all(),
                 *db.scalars(select(ProgramIntake).where(ProgramIntake.id.in_({a.intake_id for a in apps}))).all(),
                 *db.scalars(select(University).where(University.id.in_({a.university_id for a in apps}))).all()] if apps else [])
    prep = [a for a in apps if a.status in (S.PROFILE_REVIEW, S.DOCUMENT_PREPARATION)]
    verified_cats: dict = {}
    if prep:
        from app.models import Document
        from app.models.enums import DocumentStatus
        from app.services.readiness import ESSAY_BACKED, requirements_for

        for sid, cat in db.execute(select(Document.owner_user_id, Document.category).where(
                Document.owner_user_id.in_({a.student_user_id for a in prep}), Document.status == DocumentStatus.VERIFIED).distinct()).all():
            verified_cats.setdefault(sid, set()).add(cat.value)
    req_cache: dict = {}

    def _cannot_be_ready(a: Application) -> bool:
        prof = profs.get(a.student_user_id)
        nat = prof.nationality if prof else None
        key = (a.program_id, nat)
        if key not in req_cache:
            req_cache[key] = {r.category.value for r in requirements_for(db, db.get(Program, a.program_id), nat)
                              if r.is_required and r.category.value not in ESSAY_BACKED}
        return bool(req_cache[key] - verified_cats.get(a.student_user_id, set()))

    counts = {k: 0 for k in PIPELINE_STATES}
    picked: list[tuple[str, Application, object, object, object]] = []
    for a in apps:
        rec, auth = recs.get(a.id), auths.get(a.id)
        rs = rec.status if rec else "NOT_STARTED"
        confirmed = rs == "SUBMITTED_CONFIRMED"
        since = None
        if rec is not None and rec.failure_reason and not confirmed:
            st, since = "issue", rec.failed_at
        elif rs in ("HANDED_OFF", "SUBMITTED_UNCONFIRMED") and a.status in (S.READY, S.SUBMITTED, S.UNIVERSITY_REVIEW):
            since = rec.recorded_at if rs == "SUBMITTED_UNCONFIRMED" and rec.recorded_at else rec.handed_off_at or rec.updated_at
            st = "confirmation_missing" if since and since < now - timedelta(days=CONFIRMATION_MISSING_DAYS) else "submitted"
        elif confirmed and a.status in (S.SUBMITTED, S.UNIVERSITY_REVIEW, S.ADDITIONAL_DOCUMENTS, S.INTERVIEW):
            st, since = "received", rec.recorded_at
        elif a.status == S.READY and auth is not None and auth.status == "ACTIVE" and not confirmed:
            st, since = "authorized", auth.granted_at
        elif a.status == S.READY and not confirmed:
            st, since = "ready", ready_at.get(a.id)
        elif a.status in (S.PROFILE_REVIEW, S.DOCUMENT_PREPARATION):
            if _cannot_be_ready(a):
                continue
            _pct, items = application_readiness(db, a, profs.get(a.student_user_id), now.date())
            req = [i for i in items if i["required"]]
            if not req or any(not i["ready"] for i in req):
                continue
            st, since = "needs_final_review", a.updated_at
        else:
            continue
        counts[st] += 1
        if state and st != state:
            continue
        picked.append((st, a, rec, auth, since))
    sids = {a.student_user_id for _s, a, *_ in picked}
    names = dict(db.execute(select(User.id, User.full_name).where(User.id.in_(sids))).all()) if sids else {}
    unis = dict(db.execute(select(University.id, University.name_en).where(University.id.in_({a.university_id for _s, a, *_ in picked}))).all()) if picked else {}
    progs = dict(db.execute(select(Program.id, Program.name_en).where(Program.id.in_({a.program_id for _s, a, *_ in picked}))).all()) if picked else {}
    deadlines = dict(db.execute(select(ProgramIntake.id, ProgramIntake.application_deadline).where(ProgramIntake.id.in_({a.intake_id for _s, a, *_ in picked}))).all()) if picked else {}
    couns = {}
    if sids:
        cu = dict(db.execute(select(AgencyAssignment.student_user_id, AgencyAssignment.counselor_user_id).where(
            AgencyAssignment.student_user_id.in_(sids), AgencyAssignment.status == AssignmentStatus.ACTIVE)).all())
        cn = dict(db.execute(select(User.id, User.full_name).where(User.id.in_({c for c in cu.values() if c}))).all())
        couns = {s: ({"id": str(c), "name": cn.get(c)} if c else None) for s, c in cu.items()}
    order = {k: i for i, k in enumerate(PIPELINE_STATES)}
    rows = []
    conn_cache: dict = {}  # V9 scale: the connector depends only on these four ids — resolve each combination once

    def _method_for(a: Application) -> str:
        key = (a.university_id, a.program_id, a.intake_id, a.agency_org_id)
        if key not in conn_cache:
            conn_cache[key] = connector_for(db, a).method
        return conn_cache[key]

    for st, a, rec, auth, since in picked:
        method = normalize_method(rec.method) if rec else _method_for(a)
        dl = deadlines.get(a.intake_id)
        rows.append({
            "application_id": str(a.id), "state": st, "status": a.status.value, "method": method,
            "student": {"id": str(a.student_user_id), "full_name": names.get(a.student_user_id)},
            "university": unis.get(a.university_id), "program": progs.get(a.program_id),
            "deadline": dl.isoformat() if dl else None, "since": since.isoformat() if since else None,
            "days": max(0, (now - since).days) if since else None,
            "reference": rec.external_reference if rec else None, "evidence": rec.evidence_kind if rec else "NONE",
            "failure": rec.failure_reason if rec and st == "issue" else None,
            "counselor": couns.get(a.student_user_id), "link": f"/applications/{a.id}",
        })
    rows.sort(key=lambda r: (order[r["state"]], -(r["days"] or 0), r["deadline"] or "9999"))
    return {"generated_at": now.isoformat(), "states": list(PIPELINE_STATES), "counts": counts, "definitions": PIPELINE_DEFINITIONS,
            "state": state, "items": rows}


# ------------------------------------------------------------------------------------------------- research + seeding


def load_research() -> list[dict]:
    """Read docs/research/submission-methods.json when present (tolerant of list or {universities:[…]} shapes)."""
    if not RESEARCH_FILE.exists():
        return []
    try:
        data = json.loads(RESEARCH_FILE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return []
    if isinstance(data, dict):
        for key in ("universities", "items", "methods", "data", "records"):
            if isinstance(data.get(key), list):
                data = data[key]
                break
        else:
            data = [dict(v, slug=k) if isinstance(v, dict) else {"slug": k} for k, v in data.items() if isinstance(v, dict)]
    return [d for d in data if isinstance(d, dict)]


def _pick(d: dict, *keys, default=None):
    for k in keys:
        cur = d
        for part in k.split("."):
            cur = cur.get(part) if isinstance(cur, dict) else None
            if cur is None:
                break
        if cur not in (None, ""):
            return cur
    return default


def _as_date(v) -> date | None:
    if not v:
        return None
    try:
        return date.fromisoformat(str(v)[:10])
    except ValueError:
        return None


def _method(raw) -> str:
    v = str(raw or "").upper().replace("-", "_").replace(" ", "_")
    v = METHOD_ALIASES.get(v, v)
    if v in ("DIRECT_API", "PARTNER_API"):
        return "GUIDED_EXTERNAL"  # no official API is claimed from research text unless configured in code
    if v == "AUTHORIZED_AGENCY":
        return "GUIDED_EXTERNAL"  # agency submission needs a recorded legal basis — never inferred from research text
    if v in METHODS:
        return v
    if "PROVIDER" in v or "UWAY" in v or "JINHAK" in v:
        return "APPLICATION_PROVIDER"
    if "MAIL" in v or "POST" in v or "PAPER" in v or "EMAIL" in v or "IN_PERSON" in v or v == "MANUAL":
        return "MANUAL"
    return "GUIDED_EXTERNAL"


LEVEL_DEGREES = {
    "UNDERGRADUATE": ["BACHELOR", "TRANSFER", "ASSOCIATE"], "GRADUATE": ["MASTER", "DOCTORATE", "COMBINED"],
    "LANGUAGE": ["LANGUAGE"], "LANGUAGE_INSTITUTE": ["LANGUAGE"],
}
DEGREES = ("LANGUAGE", "ASSOCIATE", "BACHELOR", "TRANSFER", "MASTER", "DOCTORATE", "COMBINED")


def _status(raw) -> str:
    v = str(raw or "NEEDS_REVIEW").upper()
    if v in ("VERIFIED", "CURRENT", "CONFIRMED", "OFFICIAL"):
        return "VERIFIED"
    if v in ("PARTIAL", "PARTLY_VERIFIED", "PARTIALLY_VERIFIED"):
        return "PARTIAL"
    return "NEEDS_REVIEW"


def _documents(e: dict) -> str:
    docs = str(_pick(e, "documents_accepted", "documents_upload", "documents_submission", "document_submission", default="UNKNOWN")).upper()
    if docs in ("ONLINE", "MAIL", "BOTH", "UNKNOWN"):
        return docs
    if "BOTH" in docs or ("ONLINE" in docs and ("MAIL" in docs or "POST" in docs)):
        return "BOTH"
    if "MAIL" in docs or "POST" in docs:
        return "MAIL"
    return "ONLINE" if "ONLINE" in docs or "UPLOAD" in docs else "UNKNOWN"


def _row(e: dict, university: University, degree: str | None) -> dict:
    fee = _pick(e, "application_fee", "fee") or {}
    fee = fee if isinstance(fee, dict) else {"amount": fee}
    amount = _pick(fee, "amount", "amount_krw", "krw")
    try:
        amount = int(float(str(amount).replace(",", ""))) if amount not in (None, "") else None
    except ValueError:
        amount = None
    sources = _pick(e, "source_urls", "sources") or []
    first = sources[0] if sources else None
    src = _pick(e, "source_url") or (first.get("url") if isinstance(first, dict) else first)
    verified = _as_date(_pick(e, "last_verified", "verified_at", "checked_at") or (first.get("verified_at") if isinstance(first, dict) else None))
    status = _status(_pick(e, "verification_status", "status")) if src else "NEEDS_REVIEW"
    actions = _pick(e, "supported_actions") or ["HANDOFF", "RECORD_CONFIRMATION", "UPLOAD_RECEIPT"]
    actions = actions if isinstance(actions, list) else [str(actions)]
    notes = _pick(e, "notes", "caveats")
    provider = _pick(e, "provider", "provider_name", "platform")
    portal = _portal_name(provider)
    method = _method(_pick(e, "submission_method", "method", "type"))
    login = _pick(e, "login_requirements", "account")
    if not login and "create_account" in actions:
        login = (f"The applicant creates their own {portal or 'portal'} account and signs in personally. "
                 "Hangyul never asks for, sees or stores this password.")
    receipts = [t for a, t in (("print_test_slip", "Test identification slip (print it)"), ("print_application", "Printable application form"),
                               ("print_cover_page", "Printable cover page"), ("check_document_arrival", "Document-arrival check page"))
                if a in actions]
    title = first.get("title") if isinstance(first, dict) else None
    return {
        "university_id": university.id, "degree_level": degree,
        "method": method,
        "provider": provider, "portal_name": portal,
        "portal_url": _pick(e, "portal_url", "application_portal_url", "url", "application_url"),
        "official_url": src,
        "supported_actions": actions,
        "login_requirements": login,
        "fee_payer": "STUDENT" if amount and method in STUDENT_HANDOFF else None,
        "originals_by_mail": e.get("originals_by_mail") if isinstance(e.get("originals_by_mail"), bool) else None,
        "receipt_method": " · ".join(receipts) or None,
        "status_sync": "MANUAL" if "check_result" in actions else "NONE",
        "verified_source": str(title)[:300] if title else None,
        "fee_amount": amount, "fee_currency": _pick(fee, "currency", default="KRW" if amount is not None else None),
        "fee_payment_method": _pick(fee, "payment_method", "method"), "fee_payee": _pick(fee, "payee", "paid_to", "who_is_paid"),
        "documents_accepted": _documents(e),
        "confirmation_method": _pick(e, "confirmation_method", "confirmation"),
        "instructions": _pick(e, "instructions", "summary"),
        "source_url": src, "last_verified": verified, "verification_status": status,
        "notes": notes if isinstance(notes, str) else None,
    }


def connector_rows_from_research(entries: dict | list[dict], university: University) -> list[dict]:
    """Map research entries for one university to SubmissionConnector column dicts.

    Accepts the research file's shape (one entry per university *and level*: ``level`` UNDERGRADUATE | GRADUATE) as
    well as a single entry with ``variants``. Each level becomes one row per degree it covers; degrees no entry covers
    get a university-wide NEEDS_REVIEW placeholder so nothing unverified is presented as verified."""
    entries = [entries] if isinstance(entries, dict) else list(entries)
    rows: list[dict] = []
    covered: set[str] = set()
    for e in entries:
        variants = _pick(e, "variants", "levels", "by_level") or []
        level = str(_pick(e, "level", "degree_level", default="")).upper()
        degrees = LEVEL_DEGREES.get(level) or ([level] if level in DEGREES else [])
        if degrees:
            for d in degrees:
                rows.append(_row(e, university, d))
                covered.add(d)
        else:
            rows.append(_row(e, university, None))
            covered.update(DEGREES)
        for v in variants if isinstance(variants, list) else []:
            if isinstance(v, dict):
                lvl = str(_pick(v, "degree_level", "level", default="")).upper()
                for d in LEVEL_DEGREES.get(lvl) or ([lvl] if lvl in DEGREES else []):
                    rows.append(_row({**e, **v}, university, d))
                    covered.add(d)
    if set(DEGREES) - covered:
        rows.append(placeholder_row(university))
    return rows


def placeholder_row(university: University) -> dict:
    """No verified research yet: the university's admissions page, clearly labelled NEEDS_REVIEW."""
    return {"university_id": university.id, "method": "GUIDED_EXTERNAL", "provider": None,
            "portal_url": university.international_admissions_url or university.website_url,
            "supported_actions": ["HANDOFF", "RECORD_CONFIRMATION", "UPLOAD_RECEIPT"], "documents_accepted": "UNKNOWN",
            "instructions": PLACEHOLDER_NOTE, "verification_status": "NEEDS_REVIEW", "source_url": None, "last_verified": None}


def sync_connectors(db: Session, *, demo: bool = True) -> dict:
    """(Re)build connector rows for every catalogued university from the research file, else placeholders. Idempotent."""
    research = load_research()
    by_key: dict[str, list[dict]] = {}
    for e in research:
        key = next((e[k].strip().lower() for k in ("slug", "university_slug", "university", "name_en", "name") if isinstance(e.get(k), str)), None)
        if key:
            by_key.setdefault(key, []).append(e)
    stats = {"researched": 0, "placeholder": 0, "research_file": RESEARCH_FILE.exists()}
    for uni in db.scalars(select(University)).all():
        entries = by_key.get(uni.slug) or by_key.get(uni.name_en.lower())
        rows = connector_rows_from_research(entries, uni) if entries else [placeholder_row(uni)]
        stats["researched" if entries else "placeholder"] += 1
        existing = db.scalars(select(SubmissionConnector).where(SubmissionConnector.university_id == uni.id, SubmissionConnector.program_id.is_(None))).all()
        for r in existing:
            db.delete(r)
        db.flush()
        for r in rows:
            db.add(SubmissionConnector(is_demo=demo and r.get("verification_status") != "VERIFIED", **r))
    db.flush()
    return stats


def on_submitted(db: Session, app: Application, *, actor_id, actor_kind: str, external_reference: str | None) -> None:
    """Called by the generic transition endpoint when an application moves to SUBMITTED. A counselor who moves it
    directly (legacy path) leaves an honest record: confirmed only when they typed the confirmation number."""
    rec = ensure_record(db, app)
    if rec.status == "SUBMITTED_CONFIRMED":
        return
    ref = (external_reference or "").strip() or rec.external_reference
    rec.external_reference = ref
    rec.evidence_kind = evidence_kind(ref, rec.receipt_document_id)
    rec.status = "SUBMITTED_CONFIRMED" if rec.evidence_kind != "NONE" else "SUBMITTED_UNCONFIRMED"
    rec.recorded_by_user_id, rec.recorded_by_role, rec.recorded_at = actor_id, actor_kind, utcnow()
    rec.submitted_on = rec.submitted_on or utcnow().date()
    if rec.status == "SUBMITTED_CONFIRMED":
        _confirm_task(db, app, open_=False)
