"""V5 dossier demo data (fictional sample data, ``is_demo=True``).

* Lan (``student@demo.hangyul.kr``): her passport, transcript and bank certificate files get a machine-readable text
  layer (the passport with a valid ICAO machine-readable zone), and the automatic check runs on them — so the
  "We found this information. Please check it." suggestions are the real output of ``services/extraction.py``:
  passport expiry / date of birth / number from the MRZ (match her profile), GPA 8.6/10 from the transcript (her profile
  says 8.4 — she decides), graduation date, the bank certificate's issue date. Nothing is written to her profile.
* ``student.dossier@demo.hangyul.kr`` — Trần Minh Thư (Viet Nam, Lotus Bridge): all documents verified; the Pusan
  National University application was submitted and is under review; a Kyungpook application is being prepared. Her
  bank certificate was issued 50 days ago: it was fine when Pusan received it, but Kyungpook needs one issued within the
  last 30 days. FLOW B (e2e/v5-dossier.spec.ts) starts here.
"""
from __future__ import annotations

from datetime import timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.storage import sha256
from app.models import ApplicationDocument, Document, DocumentVersion, User
from app.models.enums import ApplicationStatus as S
from app.models.enums import DocumentCategory as DC
from app.models.enums import PipelineStage
from app.seed.extra_10_personas import _application, _assign, _conversation, _documents, _education_and_language, _finish, _program, _student
from app.seed.run import NOW, TODAY
from app.services.extraction import mrz_check


def text_pdf(lines: list[str]) -> bytes:
    """A one-page PDF with a real text layer (ASCII lines, Helvetica / Courier for the MRZ)."""
    ops, y = [], 740
    for ln in lines:
        font = "/F2 10" if ln.startswith("P<") or (len(ln) == 44 and "<" in ln) else "/F1 12"
        safe = ln.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        ops.append(f"BT {font} Tf 60 {y} Td ({safe}) Tj ET")
        y -= 20
    content = "\n".join(ops).encode("latin-1")
    objs = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>",
        b"<< /Length " + str(len(content)).encode() + b" >>\nstream\n" + content + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>",
    ]
    out = b"%PDF-1.4\n"
    offsets = []
    for i, o in enumerate(objs, 1):
        offsets.append(len(out))
        out += f"{i} 0 obj\n".encode() + o + b"\nendobj\n"
    xref = len(out)
    out += f"xref\n0 {len(objs) + 1}\n0000000000 65535 f \n".encode()
    for off in offsets:
        out += f"{off:010d} 00000 n \n".encode()
    out += f"trailer << /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF".encode()
    return out


def mrz_lines(surname: str, given: str, number: str, nat: str, dob: str, sex: str, exp: str) -> list[str]:
    l1 = f"P<{nat}{surname}<<{given.replace(' ', '<')}".ljust(44, "<")[:44]
    num = number.ljust(9, "<")
    personal = "<" * 14
    parts = [num + str(mrz_check(num)), nat, dob + str(mrz_check(dob)), sex, exp + str(mrz_check(exp)), personal + str(mrz_check(personal))]
    body = parts[0] + parts[1] + parts[2] + parts[3] + parts[4] + parts[5]
    composite = str(mrz_check(parts[0] + parts[2] + parts[4] + parts[5]))
    l2 = (body + composite)[:44]
    return [l1, l2]


def _replace_file(db: Session, storage, d: Document, data: bytes, filename: str) -> None:
    v = db.scalar(select(DocumentVersion).where(DocumentVersion.document_id == d.id, DocumentVersion.version == d.current_version))
    if v is None:
        return
    v.storage_key = storage.put(data, prefix=f"students/{d.owner_user_id}")
    v.size_bytes, v.sha256, v.original_filename = len(data), sha256(data), filename


def _lan(db: Session, storage) -> None:
    from app.services.dossier import build_dossier

    u = db.scalar(select(User).where(User.email == "student@demo.hangyul.kr"))
    if u is None:
        return
    docs = {d.category: d for d in db.scalars(select(Document).where(Document.owner_user_id == u.id))}
    if (d := docs.get(DC.PASSPORT)) is not None:
        _replace_file(db, storage, d, text_pdf([
            "SOCIALIST REPUBLIC OF VIET NAM - PASSPORT - SPECIMEN",
            "Surname: NGUYEN   Given names: THI LAN",
            "Nationality: VIETNAMESE",
            "Date of birth: 21/07/1998",
            "Date of expiry: 01/09/2031",
            "",
            *mrz_lines("NGUYEN", "THI LAN", "C09063512", "VNM", "980721", "F", "310901"),
        ]), "passport.pdf")
    if (d := docs.get(DC.TRANSCRIPT)) is not None:
        _replace_file(db, storage, d, text_pdf([
            "ACADEMIC TRANSCRIPT - SPECIMEN",
            "School: Hai Phong Specialized High School",
            "Full name: Nguyen Thi Lan",
            "Date of graduation: 15/06/2025",
            "Cumulative GPA: 8.6 / 10",
        ]), "transcript.pdf")
    if (d := docs.get(DC.BANK_STATEMENT)) is not None and d.issue_date:
        _replace_file(db, storage, d, text_pdf([
            "VIETCOMBANK - BALANCE CERTIFICATE - SPECIMEN",
            "Account holder: Nguyen Van Hung (father)",
            f"Date of issue: {d.issue_date.strftime('%d/%m/%Y')}",
            "Certificate no.: VCB-2026-0918-4471",
        ]), "bank_statement.pdf")
    db.flush()
    # Run the automatic check now so the demo shows its real output from the first page view.
    build_dossier(db, u.id, today=TODAY)
    from app.models import DocumentAnalysis, DocumentFinding, ExtractedField

    for model in (DocumentAnalysis, ExtractedField, DocumentFinding):
        for row in db.scalars(select(model).join(Document, Document.id == model.document_id).where(Document.owner_user_id == u.id)):
            row.is_demo = True


def _thu(db: Session, ctx: dict) -> None:
    storage = ctx["storage"]
    u, prof = _student(db, "student.dossier@demo.hangyul.kr", "Trần Minh Thư", "Thư", "VN")
    _education_and_language(db, prof, 8.7, 4)
    a = _assign(db, u, ctx, "lotus-bridge")
    docs = _documents(db, u, prof, a, storage)
    bank = docs[DC.BANK_STATEMENT]
    bank.issue_date = TODAY - timedelta(days=50)
    pusan = _application(db, u, a, _program(ctx, "pusan-national-university"), [S.DRAFT, S.DOCUMENT_PREPARATION, S.READY, S.SUBMITTED, S.UNIVERSITY_REVIEW], 0)
    pusan.submitted_at = NOW - timedelta(days=45)
    knu = _application(db, u, a, _program(ctx, "kyungpook-national-university"), [S.DRAFT, S.DOCUMENT_PREPARATION], 0)
    knu.submitted_at = None
    db.flush()
    # Not submitted yet: nothing is shared with Kyungpook (the persona helper shares every document by default).
    for link in db.scalars(select(ApplicationDocument).where(ApplicationDocument.application_id == knu.id)):
        link.shared_with_university = False
    prof.pipeline_stage = PipelineStage.APPLIED
    _conversation(db, u, a, [
        (False, "Chào Thư! Pusan has your application. For Kyungpook we only need a fresh bank certificate — everything else is reused.", 30),
        (True, "Great, I'll ask the bank this week.", 28),
    ])
    _finish(db, u, prof)


def seed(db: Session, ctx: dict[str, Any]) -> None:
    _thu(db, ctx)
    db.flush()
    _lan(db, ctx["storage"])
