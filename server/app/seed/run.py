"""Reference seed. Usage: python -m app.seed.run [--reset]

Loads ONLY verified reference data: countries, locales, the research source registry, the 425-institution public
directory, the V27 official-source research (scholarships, language rules, admission guides), legalization and visa
rules, the approved service plans and the editorial articles. It creates no users, organisations, applications or
sample catalogue rows: a freshly seeded database has zero members (V32, REPORT §436).

Synthetic data for automated tests lives in `app.seed.fixtures`, which refuses any non-test database.
"""
import argparse
import json
import random
from datetime import date, datetime, time, timezone
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.db import SessionLocal, engine
from app.models import (
    ContentArticle,
    Country,
    Institution,
    LegalizationRule,
    Locale,
    Scholarship,
    ServicePrice,
    ServiceProduct,
    Source,
    User,
    VisaRequirement,
)
from app.models.enums import (
    ContentStatus,
    LegalizationPath,
    SourceType,
    VerificationStatus,
    VisaType,
)
from app.models.enums import (
    DocumentCategory as DC,
)
from app.seed.content_data import ARTICLES, TRANSLATIONS
from app.seed.institutions import seed_institutions
from app.seed.reference_data import COUNTRIES, HCCH, LOCALES
from app.services import entitlements as entitlements_svc
from app.services.freshness import run_freshness_scan

RESEARCH_JSON = Path(__file__).resolve().parents[3] / "docs" / "research-sources.json"
TODAY = date.today()
NOW = datetime.now(timezone.utc)
rng = random.Random(2026)


def dt(d: date, hour: int = 10) -> datetime:
    return datetime.combine(d, time(hour, rng.randint(0, 59)), tzinfo=timezone.utc)


def tiny_pdf(label: str) -> bytes:
    """A valid one-page PDF placeholder so the secure download path works end-to-end."""
    content = f"BT /F1 18 Tf 72 720 Td (Hangyul Univ document: {label}) Tj ET".encode()
    objs = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
        b"<< /Length " + str(len(content)).encode() + b" >>\nstream\n" + content + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
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


# ------------------------------------------------------------------ reference

def seed_reference(db: Session) -> dict[str, Source]:
    for code, en, native, ko, region, loc, cur, rank, (member, eff, verified), aliases in COUNTRIES:
        db.add(Country(code=code, name_en=en, name_native=native, name_ko=ko, region=region, default_locale=loc, currency=cur,
                       is_priority_market=rank is not None, priority_rank=rank, apostille_member=member,
                       apostille_effective_from=date.fromisoformat(eff) if eff else None,
                       apostille_verified_at=date(2026, 9, 27) if verified else None, apostille_source_url=HCCH, aliases=aliases))
    for code, en, native, direction, status in LOCALES:
        db.add(Locale(code=code, name_en=en, name_native=native, direction=direction, translation_status=status))
    sources: dict[str, Source] = {}
    for item in json.loads(RESEARCH_JSON.read_text()):
        s = Source(key=item["key"], name=item["name"], url=item["url"], source_type=SourceType(item["source_type"]), topic=item.get("topic"),
                   summary=item.get("summary"), last_checked_at=dt(date.fromisoformat(item["verified_at"])),
                   status=VerificationStatus.CURRENT if item["verification_status"] == "VERIFIED" else VerificationStatus.REVIEW_DUE,
                   review_interval_days=90 if item["source_type"] in ("GOVERNMENT", "OFFICIAL_PORTAL", "INTERNATIONAL_ORG") else 180,
                   terms_note="Manual review; no automated scraping." )
        db.add(s)
        sources[s.key] = s
    db.flush()
    return sources


# ------------------------------------------------------------------ catalog

def seed_rules(db: Session, sources: dict[str, Source]):
    hcch = sources["hcch-apostille-status"]
    wiki = sources["wikipedia-apostille-parties"]
    consular_steps = lambda country, city: [  # noqa: E731
        {"key": "original", "title": "Get the official original (or certified copy) from your school"},
        {"key": "notarize", "title": "Notarize the copy at a notary office"},
        {"key": "mofa", "title": f"Authenticate at the Ministry of Foreign Affairs of {country}"},
        {"key": "consular", "title": f"Consular confirmation at the Korean Embassy in {city}"},
        {"key": "translation", "title": "Certified translation into Korean or English"},
        {"key": "verify", "title": "Upload to Hangyul for verification"},
    ]
    for cc, country, city in (("NP", "Nepal", "Kathmandu"), ("MM", "Myanmar", "Yangon"), ("LK", "Sri Lanka", "Colombo"), ("KH", "Cambodia", "Phnom Penh")):
        db.add(LegalizationRule(issuing_country=cc, path=LegalizationPath.CONSULAR_LEGALIZATION, requires_notarization=True, requires_translation=True,
                                steps=consular_steps(country, city), source_id=wiki.id, verified_at=NOW, verification_status=VerificationStatus.CURRENT,
                                consulate_note=f"Book the Korean Embassy in {city} in advance; processing time varies."))
    db.add(LegalizationRule(issuing_country="CN", path=LegalizationPath.APOSTILLE, requires_notarization=True, requires_translation=True, source_id=hcch.id,
                            verified_at=NOW, verification_status=VerificationStatus.REVIEW_DUE,
                            consulate_note="China has applied the Apostille Convention since 7 Nov 2023. Many universities also accept a CHSI/CDGDC verification report instead.",
                            steps=[{"key": "original", "title": "Get the official diploma/transcript copies"}, {"key": "notarize", "title": "Notarize at a Chinese notary office"},
                                   {"key": "apostille", "title": "Apostille from the competent Chinese authority"},
                                   {"key": "chsi", "title": "Optional: CHSI/CDGDC verification report (check your university)"},
                                   {"key": "translation", "title": "Certified translation if not in Korean/English"}, {"key": "verify", "title": "Upload to Hangyul for verification"}]))
    # Visa rules (generic + nationality-specific)
    mofa = sources["mofa-la-d2-d4"]
    funds = sources["moe-funding-thresholds"]
    vn = sources["mofa-vn-d2-d4"]
    hik = sources["immigration-visa-navigator"]
    d2 = [
        ("admission_certificate", "Standard admission letter (표준입학허가서) from your university", DC.ADMISSION_LETTER, [], mofa, "CURRENT"),
        ("passport", "Valid passport (6+ months validity recommended)", DC.PASSPORT, [], mofa, "CURRENT"),
        ("application_form", "Visa application form with a passport photo", DC.PHOTO, [], mofa, "CURRENT"),
        ("tuition_receipt", "Tuition payment receipt", None, ["admission_certificate"], mofa, "CURRENT"),
        ("financial_proof", "Proof of funds — Seoul-area degree: KRW 20,000,000/yr; regional: KRW 16,000,000/yr (verify current figure)", DC.BANK_STATEMENT, [], funds, "REVIEW_DUE"),
        ("final_education", "Final education certificate with apostille or consular confirmation", DC.GRADUATION_CERTIFICATE, [], mofa, "CURRENT"),
        ("visa_application", "Apply at the Korean embassy/consulate (or via Certificate for Confirmation of Visa Issuance)", None, ["admission_certificate", "financial_proof", "passport"], sources["visa-portal"], "CURRENT"),
        ("visa_issued", "Visa issued — check the dates and your name", DC.VISA, ["visa_application"], sources["visa-portal"], "CURRENT"),
        ("residence_card", "Apply for a residence card within 90 days of arrival", DC.RESIDENCE_CARD, ["visa_issued"], hik, "REVIEW_DUE"),
    ]
    for vt in (VisaType.D2_1, VisaType.D2_2, VisaType.D2_3, VisaType.D2_4):
        for i, (key, title, cat, deps, src, st) in enumerate(d2):
            db.add(VisaRequirement(visa_type=vt, step_key=key, title=title, document_category=cat.value if cat else None, depends_on=deps, sort_order=i * 10,
                                   source_id=src.id, source_url=src.url, verified_at=src.last_checked_at, verification_status=st))
    d4 = [
        ("admission_certificate", "Admission letter from the university language institute", DC.ADMISSION_LETTER, [], mofa, "CURRENT"),
        ("passport", "Valid passport", DC.PASSPORT, [], mofa, "CURRENT"),
        ("application_form", "Visa application form with a passport photo", DC.PHOTO, [], mofa, "CURRENT"),
        ("financial_proof", "Proof of funds — language program: KRW 10,000,000 per 6 months in Seoul area; KRW 8,000,000 regional (verify)", DC.BANK_STATEMENT, [], funds, "REVIEW_DUE"),
        ("family_relation", "Parents' bank statement + family relationship document if a parent sponsors you", DC.FAMILY_RELATION_CERTIFICATE, [], mofa, "CURRENT"),
        ("final_education", "Final education certificate with apostille or consular confirmation", DC.GRADUATION_CERTIFICATE, [], mofa, "CURRENT"),
        ("visa_application", "Apply at the Korean embassy/consulate", None, ["admission_certificate", "financial_proof"], sources["visa-portal"], "CURRENT"),
        ("visa_issued", "Visa issued", DC.VISA, ["visa_application"], sources["visa-portal"], "CURRENT"),
        ("residence_card", "Apply for a residence card within 90 days of arrival", DC.RESIDENCE_CARD, ["visa_issued"], hik, "REVIEW_DUE"),
    ]
    for i, (key, title, cat, deps, src, st) in enumerate(d4):
        db.add(VisaRequirement(visa_type=VisaType.D4_1, step_key=key, title=title, document_category=cat.value if cat else None, depends_on=deps, sort_order=i * 10,
                               source_id=src.id, source_url=src.url, verified_at=src.last_checked_at, verification_status=st))
    for vt in (VisaType.D2_2, VisaType.D2_3, VisaType.D2_4, VisaType.D4_1):
        db.add(VisaRequirement(visa_type=vt, nationality="VN", step_key="financial_proof_vn", replaces_step_key="financial_proof",
                               title="Proof of funds per the Korean Embassy in Hanoi (reported: USD 15,000 held for 3 months — confirm before applying)",
                               document_category=DC.BANK_STATEMENT.value, sort_order=40, source_id=vn.id, source_url=vn.url, verified_at=vn.last_checked_at,
                               verification_status="REVIEW_DUE"))
        db.add(VisaRequirement(visa_type=vt, nationality="CN", step_key="family_relation_cn", title="Hukou / family relationship certificate (notarized)",
                               document_category=DC.FAMILY_RELATION_CERTIFICATE.value, sort_order=45, source_id=sources["skku-guide-2022-uway"].id,
                               source_url=sources["skku-guide-2022-uway"].url, verified_at=NOW, verification_status="REVIEW_DUE"))
    db.flush()


def seed_products(db: Session):
    """The three retail plans, read from ``shared/plans.json``.

    V15: this function used to *contain* the catalogue — FREE_EXPLORER / APPLICATION_SUPPORT /
    PREMIUM_SUCCESS, with USD defaults and KR/VN regional rows. None of that was ever approved. The owner's
    business plan defines three KRW plans and one price each, so the numbers now live in
    ``packages/types/src/plans.ts``, are generated into ``shared/plans.json``, and this seed only writes what
    it is given. Editing a price here would reintroduce exactly the drift V15 removed.

    ``is_demo=False`` on the prices is the substantive change: these are approved business inputs, which is
    what ``release:check``'s ``approved_prices`` requirement reads.
    """
    for plan in entitlements_svc.plan_defs():
        p = ServiceProduct(
            code=plan["code"], name_key=f"services.{plan['code']}.name", name_en=plan["name_en"], name_ko=plan["name_ko"],
            tagline_en=None, features=[], entitlements=dict(plan["entitlements"]),
            is_recommended=bool(plan["recommended"]), sort_order=plan["sort_order"],
        )
        db.add(p)
        db.flush()
        # One price per plan. The plan document states a single retail price; a second currency or a
        # country row would mean the homepage and a student's checkout could disagree.
        db.add(ServicePrice(product_id=p.id, currency=plan["currency"], amount_minor=plan["amount_minor"],
                            country_code=None, is_demo=False))
    db.flush()


# ------------------------------------------------------------------ orgs & people

def seed_content(db: Session):
    for a in ARTICLES:
        db.add(ContentArticle(slug=a["slug"], locale="en", content_type=a["content_type"], title=a["title"], summary=a["summary"], body_md=a["body"],
                              seo_title=f"{a['title']} | Hangyul Univ", seo_description=a["summary"], source_keys=a["sources"], country_code=a.get("country"),
                              status=ContentStatus.PUBLISHED, author_name="Hangyul Univ Editorial", reviewer_name="Hangyul Operations",
                              last_verified_at=date(2026, 9, 27), translation_status="SOURCE"))
    base = {a["slug"]: a for a in ARTICLES}
    for t in TRANSLATIONS:
        src = base[t["slug"]]
        db.add(ContentArticle(slug=t["slug"], locale=t["locale"], content_type=src["content_type"], title=t["title"], summary=t["summary"], body_md=t["body"],
                              seo_title=t["title"], seo_description=t["summary"], source_keys=src["sources"], status=ContentStatus.PUBLISHED,
                              author_name="Hangyul Univ Editorial", last_verified_at=date(2026, 9, 27), translation_status=t["status"]))


def reset(db_engine):
    with db_engine.begin() as c:
        c.execute(text("DROP SCHEMA public CASCADE; CREATE SCHEMA public;"))
    import subprocess
    import sys
    subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"], check=True, cwd=Path(__file__).resolve().parents[2])



def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--reset", action="store_true", help="Drop and recreate the schema before seeding")
    args = parser.parse_args()
    if args.reset:
        reset(engine)
    with SessionLocal() as db:
        if db.query(Institution).count() > 0:
            print("Database already has reference data. Use --reset to rebuild it.")
            return
        sources = seed_reference(db)
        print(f"  institutions: {seed_institutions(db)}")
        from app.seed.v27_research import load as load_v27_research
        print(f"  v27 research: {load_v27_research(db)}")
        seed_rules(db, sources)
        seed_products(db)
        seed_content(db)
        # Visa playbooks (docs/research/visa-playbooks.json, re-validated official data): versioned loader.
        from app.seed.visa_playbooks import load as load_visa_playbooks
        load_visa_playbooks(db, TODAY)
        run_freshness_scan(db)
        db.commit()
        print(f"Reference data: {db.query(Institution).count()} institutions, {db.query(Scholarship).count()} scholarships, "
              f"{db.query(Country).count()} countries, {db.query(Source).count()} sources, {db.query(ServiceProduct).count()} plans, "
              f"{db.query(User).count()} users.")


if __name__ == "__main__":
    main()
