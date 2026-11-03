"""Structured extraction — values read from an uploaded document, stored as SUGGESTIONS only.

What this can read (rule-based "automatic check", no AI, no OCR — tesseract is not installed on this machine):
* PDFs with a text layer: text via ``pdftotext`` (poppler), page count via ``pdfinfo``.
* Passport machine-readable zone (MRZ, ICAO 9303 TD3: two lines of 44 characters) when it is present as text; check
  digits are verified — all valid → confidence "high".
* Labelled lines ("Date of birth: 21/07/1998", "GPA: 8.6 / 10", "TOPIK Level 4", "Date of issue: …") → "medium".
* The file name (e.g. ``bank_2026-09-10.pdf``) → "low".
* PNG / JPEG / WEBP: only the pixel size (header parsing, no image library) — no text can be read from images.

Nothing here writes to the profile. ``apply_confirmation`` is the ONLY function that does, and it is called only from the
explicit "Confirm" action (see api/v1/dossier.py). Passport and document numbers are masked before they are stored.
"""
from __future__ import annotations

import re
import struct
import subprocess
import tempfile
import unicodedata
from datetime import date
from pathlib import Path

from app.core.security import mask

PDFTOTEXT = "/usr/bin/pdftotext"
PDFINFO = "/usr/bin/pdfinfo"
TIMEOUT_S = 8

FIELDS = ("full_name", "date_of_birth", "passport_number", "passport_expiry", "nationality", "school", "graduation_date", "gpa",
          "test_score", "issue_date", "expiry_date", "document_number")


# ----------------------------------------------------------------------------- file inspection (no heavy deps)

# Untrusted input: the poppler child process runs with capped memory and CPU (prlimit — no preexec_fn, which is not
# safe inside the web server's thread pool) and a wall-clock timeout.
PRLIMIT = ["/usr/bin/prlimit", f"--as={512 * 1024 * 1024}", f"--cpu={TIMEOUT_S}"] if Path("/usr/bin/prlimit").exists() else []


def _run(args: list[str], data: bytes) -> str | None:
    with tempfile.NamedTemporaryFile(suffix=".pdf") as f:
        f.write(data)
        f.flush()
        try:
            out = subprocess.run([*PRLIMIT, *args, f.name, *(["-"] if args[0] == PDFTOTEXT else [])], capture_output=True,
                                 timeout=TIMEOUT_S, check=False)
        except (OSError, subprocess.TimeoutExpired):
            return None
        if out.returncode != 0:
            return None
        return out.stdout.decode("utf-8", "replace")


def pdf_text(data: bytes, max_pages: int = 6) -> str | None:
    return _run([PDFTOTEXT, "-q", "-layout", "-enc", "UTF-8", "-l", str(max_pages)], data)


def pdf_pages(data: bytes) -> int | None:
    info = _run([PDFINFO], data)
    if info:
        m = re.search(r"^Pages:\s+(\d+)", info, re.M)
        if m:
            return int(m.group(1))
    # Fallback: count page objects.
    n = len(re.findall(rb"/Type\s*/Page(?!s)", data))
    return n or None


def image_size(data: bytes) -> tuple[int, int] | None:
    """Pixel size from PNG / JPEG / WEBP headers."""
    try:
        if data[:8] == b"\x89PNG\r\n\x1a\n":
            w, h = struct.unpack(">II", data[16:24])
            return w, h
        if data[:3] == b"\xff\xd8\xff":
            i = 2
            while i < len(data) - 9:
                if data[i] != 0xFF:
                    i += 1
                    continue
                marker = data[i + 1]
                if marker in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):
                    h, w = struct.unpack(">HH", data[i + 5:i + 9])
                    return w, h
                if marker in (0xD8, 0x01) or 0xD0 <= marker <= 0xD7:
                    i += 2
                    continue
                seg = struct.unpack(">H", data[i + 2:i + 4])[0]
                i += 2 + seg
            return None
        if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
            kind = data[12:16]
            if kind == b"VP8 ":
                w, h = struct.unpack("<HH", data[26:30])
                return w & 0x3FFF, h & 0x3FFF
            if kind == b"VP8L":
                b = data[21:25]
                w = 1 + (((b[1] & 0x3F) << 8) | b[0])
                h = 1 + (((b[3] & 0x0F) << 10) | (b[2] << 2) | ((b[1] & 0xC0) >> 6))
                return w, h
            if kind == b"VP8X":
                w = 1 + int.from_bytes(data[24:27], "little")
                h = 1 + int.from_bytes(data[27:30], "little")
                return w, h
    except (struct.error, IndexError):
        return None
    return None


# ----------------------------------------------------------------------------- normalisation

def fold(s: str) -> str:
    """'Nguyễn Thị Lan' → 'NGUYEN THI LAN' (diacritics removed, đ → D, punctuation → spaces)."""
    s = s.replace("đ", "d").replace("Đ", "D")
    s = "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))
    return re.sub(r"[^A-Z0-9 ]+", " ", s.upper()).strip()


def names_match(a: str, b: str) -> bool:
    """Same person name regardless of order, accents and middle names: every token of the shorter name appears in the longer."""
    ta, tb = set(fold(a).split()), set(fold(b).split())
    if not ta or not tb:
        return True
    small, big = (ta, tb) if len(ta) <= len(tb) else (tb, ta)
    return len(small) >= 2 and small <= big or ta == tb


_MONTHS = {m: i for i, m in enumerate(["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"], 1)}


def parse_date(s: str) -> date | None:
    s = s.strip()
    for rx, order in ((r"(\d{4})[-./](\d{1,2})[-./](\d{1,2})", "ymd"), (r"(\d{1,2})[-./](\d{1,2})[-./](\d{4})", "dmy")):
        m = re.search(rx, s)
        if m:
            a, b, c = (int(x) for x in m.groups())
            y, mo, d = (a, b, c) if order == "ymd" else (c, b, a)
            try:
                return date(y, mo, d)
            except ValueError:
                return None
    m = re.search(r"(\d{1,2})\s+([A-Za-z]{3})[A-Za-z]*\.?\s+(\d{4})", s)
    if m and m.group(2).upper() in _MONTHS:
        try:
            return date(int(m.group(3)), _MONTHS[m.group(2).upper()], int(m.group(1)))
        except ValueError:
            return None
    return None


# ----------------------------------------------------------------------------- MRZ (ICAO 9303 TD3)

def _mrz_value(c: str) -> int:
    if c.isdigit():
        return int(c)
    if c == "<":
        return 0
    return ord(c) - 55


def mrz_check(s: str) -> int:
    weights = (7, 3, 1)
    return sum(_mrz_value(c) * weights[i % 3] for i, c in enumerate(s)) % 10


def _mrz_date(yymmdd: str, *, future: bool) -> date | None:
    try:
        yy, mm, dd = int(yymmdd[:2]), int(yymmdd[2:4]), int(yymmdd[4:6])
    except ValueError:
        return None
    today = date.today()
    century = 2000 if (future or 2000 + yy <= today.year) else 1900
    try:
        return date(century + yy, mm, dd)
    except ValueError:
        return None


def parse_mrz(text: str) -> dict | None:
    lines = [re.sub(r"\s+", "", ln) for ln in text.splitlines()]
    lines = [ln for ln in lines if len(ln) == 44 and re.fullmatch(r"[A-Z0-9<]{44}", ln)]
    for i in range(len(lines) - 1):
        l1, l2 = lines[i], lines[i + 1]
        if not l1.startswith("P"):
            continue
        number, n_check = l2[0:9], l2[9]
        nat = l2[10:13].replace("<", "")
        dob, dob_check = l2[13:19], l2[19]
        exp, exp_check = l2[21:27], l2[27]
        valid = (mrz_check(number) == int(n_check) if n_check.isdigit() else False) and \
                (mrz_check(dob) == int(dob_check) if dob_check.isdigit() else False) and \
                (mrz_check(exp) == int(exp_check) if exp_check.isdigit() else False)
        names = l1[5:].split("<<", 1)
        surname = names[0].replace("<", " ").strip()
        given = names[1].replace("<", " ").strip() if len(names) > 1 else ""
        return {
            "valid": valid, "number": number.replace("<", ""), "nationality": nat, "issuing_state": l1[2:5].replace("<", ""),
            "date_of_birth": _mrz_date(dob, future=False), "expiry": _mrz_date(exp, future=True),
            "full_name": " ".join(x for x in (surname, given) if x),
        }
    return None


# ----------------------------------------------------------------------------- document type detection

TYPE_KEYWORDS: dict[str, tuple[str, ...]] = {
    "PASSPORT": (r"\bpassport\b", r"hộ chiếu", r"여권"),
    "TRANSCRIPT": (r"\btranscript\b", r"academic record", r"bảng điểm", r"học bạ", r"성적증명서", r"statement of marks"),
    "GRADUATION_CERTIFICATE": (r"\bdiploma\b", r"graduation certificate", r"certificate of graduation", r"bằng tốt nghiệp", r"졸업증명서", r"degree certificate"),
    "BANK_STATEMENT": (r"\bbank\b", r"balance certificate", r"account balance", r"certificate of deposit", r"số dư", r"잔고"),
    "TOPIK": (r"\btopik\b", r"test of proficiency in korean", r"한국어능력시험"),
    "IELTS": (r"\bielts\b",),
    "TOEFL": (r"\btoefl\b",),
    "FAMILY_RELATION_CERTIFICATE": (r"family relation", r"household registration", r"hộ khẩu", r"가족관계"),
    "BIRTH_CERTIFICATE": (r"birth certificate", r"giấy khai sinh", r"출생증명"),
}
# Categories that are the same kind of evidence (no "wrong type" warning between them).
COMPATIBLE = [{"GRADUATION_CERTIFICATE", "EXPECTED_GRADUATION_CERTIFICATE"}, {"BANK_STATEMENT", "SPONSOR_DOCUMENT", "EMPLOYMENT_INCOME_PROOF"},
              {"FAMILY_RELATION_CERTIFICATE", "BIRTH_CERTIFICATE"}]


def compatible(a: str, b: str) -> bool:
    return a == b or any(a in g and b in g for g in COMPATIBLE)


def detect_category(text: str | None, filename: str | None, has_mrz: bool) -> tuple[str | None, str]:
    """Best guess of what a document is. Returns (category, basis) with basis 'mrz' | 'text' | 'filename' | ''."""
    if has_mrz:
        return "PASSPORT", "mrz"
    if text:
        low = text.lower()
        scores = {cat: sum(len(re.findall(p, low)) for p in pats) for cat, pats in TYPE_KEYWORDS.items()}
        best = max(scores.items(), key=lambda kv: kv[1])
        if best[1] > 0 and list(scores.values()).count(best[1]) == 1:
            return best[0], "text"
    if filename:
        low = re.sub(r"[_\-.]+", " ", filename.lower())
        for cat, pats in TYPE_KEYWORDS.items():
            if any(re.search(p, low) for p in pats):
                return cat, "filename"
    return None, ""


# ----------------------------------------------------------------------------- field extraction

LABELS: list[tuple[str, str]] = [
    ("date_of_birth", r"(?:date of birth|birth date|d\.o\.b\.?|ngày sinh|생년월일)\s*[:\-]?\s*(.+)"),
    ("issue_date", r"(?:date of issue|issue date|issued on|date issued|ngày cấp|발급일)\s*[:\-]?\s*(.+)"),
    ("expiry_date", r"(?:date of expiry|expiry date|expires on|valid until|có giá trị đến|만료일)\s*[:\-]?\s*(.+)"),
    ("graduation_date", r"(?:date of graduation|graduation date|graduated on|ngày tốt nghiệp|졸업일)\s*[:\-]?\s*(.+)"),
    ("document_number", r"(?:document no\.?|document number|certificate no\.?|serial no\.?|số hiệu|번호)\s*[:\-]?\s*([A-Z0-9\-/]{4,30})"),
    ("school", r"(?:school|institution|university|trường)\s*[:\-]\s*(.+)"),
    ("full_name", r"(?:full name|name of (?:student|holder)|student name|họ và tên|성명)\s*[:\-]\s*(.+)"),
]


def _gpa(text: str) -> str | None:
    m = re.search(r"(?:cumulative\s+)?(?:gpa|grade point average|điểm trung bình)[^0-9\n]{0,20}(\d{1,2}(?:[.,]\d{1,2})?)\s*(?:/|out of)\s*(\d{1,3}(?:[.,]\d)?)", text, re.I)
    if m:
        return f"{m.group(1).replace(',', '.')}/{m.group(2).replace(',', '.')}"
    return None


def _score(text: str) -> str | None:
    m = re.search(r"TOPIK[^0-9\n]{0,30}(?:level|급)\s*(\d)", text, re.I) or re.search(r"(?:level|급)\s*(\d)[^\n]{0,20}TOPIK", text, re.I)
    if m:
        return f"TOPIK {m.group(1)}"
    m = re.search(r"IELTS[^\n]{0,60}?(?:overall(?: band)?(?: score)?)\s*[:\-]?\s*(\d(?:\.\d)?)", text, re.I)
    if m:
        return f"IELTS {m.group(1)}"
    m = re.search(r"TOEFL[^\n]{0,60}?(?:total(?: score)?)\s*[:\-]?\s*(\d{2,3})", text, re.I)
    if m:
        return f"TOEFL {m.group(1)}"
    return None


# Documents whose name field is the student's own name.
PERSONAL_CATEGORIES = {"PASSPORT", "NATIONAL_ID", "TRANSCRIPT", "GRADUATION_CERTIFICATE", "EXPECTED_GRADUATION_CERTIFICATE", "TOPIK", "IELTS", "TOEFL",
                       "BIRTH_CERTIFICATE", "ADMISSION_LETTER"}


def extract_fields(text: str | None, filename: str | None, category: str) -> list[dict]:
    """[{field, value, confidence, source}] — suggestions only. Values are strings (ISO dates, masked numbers)."""
    out: dict[str, dict] = {}

    def put(field: str, value: str | None, confidence: str, source: str):
        if value and field not in out:
            out[field] = {"field": field, "value": value[:200], "confidence": confidence, "source": source}

    mrz = parse_mrz(text) if text else None
    if mrz:
        conf = "high" if mrz["valid"] else "medium"
        put("full_name", mrz["full_name"], conf, "mrz")
        put("passport_number", mask(mrz["number"]), conf, "mrz")
        if mrz["date_of_birth"]:
            put("date_of_birth", mrz["date_of_birth"].isoformat(), conf, "mrz")
        if mrz["expiry"]:
            put("passport_expiry", mrz["expiry"].isoformat(), conf, "mrz")
        if mrz["nationality"]:
            put("nationality", mrz["nationality"], conf, "mrz")
    if text:
        for ln in text.splitlines():
            ln = ln.strip()
            for field, rx in LABELS:
                m = re.search(rx, ln, re.I)
                if not m:
                    continue
                raw = m.group(1).strip()
                if field in ("date_of_birth", "issue_date", "expiry_date", "graduation_date"):
                    d = parse_date(raw)
                    if d:
                        target = "passport_expiry" if (field == "expiry_date" and category == "PASSPORT") else field
                        put(target, d.isoformat(), "medium", "text")
                elif field == "document_number":
                    put(field, mask(raw, keep=4), "medium", "text")
                elif field == "full_name" and category not in PERSONAL_CATEGORIES:
                    continue  # e.g. a bank certificate names the account holder (often a parent) — not the student
                else:
                    value = re.split(r"\s{2,}", raw)[0].strip(" .")
                    if 2 <= len(value) <= 120:
                        put(field, value, "medium", "text")
        put("gpa", _gpa(text), "medium", "text")
        put("test_score", _score(text), "medium", "text")
    if filename:
        m = re.search(r"(20\d{2})[-_.]?(\d{2})[-_.]?(\d{2})", filename)
        if m:
            try:
                d = date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
                put("passport_expiry" if category == "PASSPORT" and d > date.today() else "issue_date", d.isoformat(), "low", "filename")
            except ValueError:
                pass
    return list(out.values())


def masked_tail(value: str | None, keep: int = 3) -> str | None:
    if not value:
        return None
    clean = value.replace("•", "")
    return clean[-keep:] if clean else None
