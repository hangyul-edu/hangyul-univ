"""Development seed. Usage: python -m app.seed.run [--reset]

Everything created here is development/demo data (is_demo=True / verification_status=DEMO) unless it is a
reference fact with a registered source. Nothing here should ever be loaded into production."""
import argparse
import json
import random
import uuid
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.core.db import SessionLocal, engine
from app.core.security import hash_password, mask
from app.core.storage import get_storage, sha256
from app.models import (
    AdmissionRequirement,
    AgencyAssignment,
    AgencySpecialty,
    AnalyticsEvent,
    Application,
    ApplicationDocument,
    ApplicationStatusHistory,
    ApplicationSubmission,
    Appointment,
    ArrivalPlan,
    Campus,
    ConsentRecord,
    ContentArticle,
    Conversation,
    ConversationParticipant,
    Country,
    Document,
    DocumentRequirement,
    DocumentReview,
    DocumentVersion,
    Dormitory,
    Essay,
    EssayComment,
    EssayVersion,
    HousingCase,
    LegalizationRule,
    Locale,
    Message,
    Order,
    Organization,
    OrganizationMember,
    PartnerContract,
    PartnerQuota,
    Payment,
    Program,
    ProgramIntake,
    SavedUniversity,
    Scholarship,
    ScholarshipAward,
    ScholarshipPool,
    ScholarshipRule,
    ServicePrice,
    ServiceProduct,
    Source,
    StudentEducation,
    StudentEnrollment,
    StudentLanguage,
    StudentOutcome,
    StudentProfile,
    StudentTerm,
    Task,
    University,
    User,
    UserRole,
    VisaCase,
    VisaRequirement,
)
from app.models.enums import (
    ApplicationStatus as S,
)
from app.models.enums import (
    AssignmentStatus,
    AwardStatus,
    ContentStatus,
    ContractStatus,
    ConversationKind,
    DegreeLevel,
    DocumentStatus,
    EnrollmentStatus,
    EssayStatus,
    EssayType,
    HousingStatus,
    IntakeTerm,
    LanguageTest,
    LegalizationPath,
    LegalizationStatus,
    MessageVisibility,
    OrderStatus,
    OrgType,
    PipelineStage,
    Role,
    ScholarshipKind,
    SourceType,
    TaskStatus,
    VerificationStatus,
    VisaStatus,
    VisaType,
)
from app.models.enums import (
    DocumentCategory as DC,
)
from app.seed import catalog_data as C
from app.seed import essay_text
from app.seed.content_data import ARTICLES, TRANSLATIONS
from app.seed.extras import run_extras
from app.seed.institutions import seed_institutions
from app.seed.reference_data import COUNTRIES, HCCH, LOCALES
from app.services import entitlements as entitlements_svc
from app.services.analytics import rollup
from app.services.freshness import run_freshness_scan
from app.services.readiness import REVIEW_TARGET_HOURS, application_readiness
from app.services.state_machine import PROGRESS_ORDER
from app.services.tasks_engine import generate_for_student
from app.services.visa import infer_visa

RESEARCH_JSON = Path(__file__).resolve().parents[3] / "docs" / "research-sources.json"
DEMO_PASSWORD = "Hangyul!2026"  # development-only; documented in README
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
    demo = Source(key="hangyul-demo-dataset", name="Hangyul Univ development sample data", url="https://github.com/hangyul/hangyul-univ#demo-data",
                  source_type=SourceType.DEMO, topic="demo", summary="Placeholder values for development. Not verified facts.", status=VerificationStatus.CURRENT,
                  review_interval_days=3650, last_checked_at=NOW)
    db.add(demo)
    sources[demo.key] = demo
    db.flush()
    return sources


# ------------------------------------------------------------------ catalog

def sourced(obj, src: Source, *, demo: bool = True):
    obj.source_id = src.id
    obj.source_url = src.url
    obj.verified_at = src.last_checked_at
    obj.verification_status = "DEMO" if demo else "CURRENT"
    return obj


def seed_catalog(db: Session, sources: dict[str, Source]) -> dict[str, University]:
    demo = sources["hangyul-demo-dataset"]
    unis = {}
    templates = {t[0]: t for t in C.PROGRAM_TEMPLATES}
    for slug, en, ko, typ, region, city, founded, web, skey, lat, lng, color, living in C.UNIVERSITIES:
        src = sources.get(skey, demo)
        u = University(slug=slug, name_en=en, name_ko=ko, institution_type=typ, region=region, city=city, founded_year=founded, website_url=web,
                       international_admissions_url=src.url, latitude=lat, longitude=lng, brand_color=color, est_living_cost_monthly_krw=living,
                       summary=f"{en} is a {typ.lower()} university in {city}.",
                       international_services=["International student office", "Orientation", "Korean language institute", "Buddy program"],
                       certification_status="UNKNOWN", certification_source_url=sources["moj-moe-certification-2026-02"].url)
        sourced(u, src, demo=True)
        db.add(u)
        db.flush()
        db.add(Campus(university_id=u.id, name="Main campus", city=city, is_main=True))
        unis[slug] = u
        for key in C.OFFERINGS[slug]:
            _, pen, pko, degree, field, lang, sems, tuition, topik, ielts, toefl, gpa = templates[key]
            tuition_adj = int(tuition * rng.uniform(0.9, 1.12) / 1000) * 1000
            prog = sourced(Program(university_id=u.id, name_en=pen, name_ko=pko, degree_level=degree, field=field, instruction_language=lang,
                                   duration_semesters=sems, tuition_per_semester_krw=tuition_adj if degree != "LANGUAGE" else 1650000 + rng.choice([0, 50000, 100000]),
                                   application_fee_krw=rng.choice([60000, 80000, 100000, 150000]) if degree != "LANGUAGE" else 60000,
                                   description="Confirm the current curriculum, fees and dates on the university's official admissions site before you apply."), demo)
            db.add(prog)
            db.flush()
            prior = {"MASTER": "BACHELOR", "DOCTORATE": "MASTER", "TRANSFER": "ASSOCIATE", "LANGUAGE": None}.get(degree, "HIGH_SCHOOL")
            db.add(sourced(AdmissionRequirement(program_id=prog.id, min_prior_education=prior, min_gpa_percent=gpa, min_topik_level=topik, min_ielts=ielts,
                                                min_toefl_ibt=toefl, language_alternative=lang == "BILINGUAL",
                                                requires_interview=degree in ("MASTER", "DOCTORATE") or rng.random() < 0.3,
                                                requires_portfolio=field == "design",
                                                notes="TOPIK 3 for entry follows the Ministry of Education recommended standard; the university's own rule prevails." if topik == 3 else None), demo))
            # Intakes (dates are sample schedule based on typical windows)
            if degree == "LANGUAGE":
                sched = [(2026, "SPRING", date(2026, 1, 15), date(2026, 3, 2)), (2026, "FALL", date(2026, 7, 10), date(2026, 9, 1)),
                         (2026, "WINTER", date(2026, 10, 30), date(2026, 12, 1)), (2027, "SPRING", date(2027, 1, 20), date(2027, 3, 2))]
            else:
                sched = [(2025, "FALL", date(2025, 4, 15), date(2025, 9, 1)), (2026, "SPRING", date(2025, 10, 31), date(2026, 3, 2)),
                         (2026, "FALL", date(2026, 4, 20), date(2026, 9, 1)),
                         (2027, "SPRING", date(2026, 11, 5) + timedelta(days=rng.randint(-20, 25)), date(2027, 3, 2)),
                         (2027, "FALL", date(2027, 4, 30) + timedelta(days=rng.randint(-20, 20)), date(2027, 9, 1))]
            for y, term, deadline, start in sched:
                db.add(sourced(ProgramIntake(program_id=prog.id, year=y, term=term, application_opens=deadline - timedelta(days=45), application_deadline=deadline,
                                             document_deadline=deadline + timedelta(days=5), decision_date=deadline + timedelta(days=50),
                                             tuition_deadline=deadline + timedelta(days=70), semester_start=start,
                                             interview_window="Online, 3–5 weeks after the deadline" if degree in ("MASTER", "DOCTORATE") else None,
                                             seats_international=rng.choice([None, 10, 15, 20, 30]), is_open=deadline >= TODAY), demo))
        # University-level document requirements
        reqs = [
            (DC.PASSPORT, "Passport copy", True, False, False, None, None, 10),
            (DC.PHOTO, "Passport-style photo", True, False, False, None, None, 15),
            (DC.GRADUATION_CERTIFICATE, "Final diploma / graduation certificate", True, True, True, None, None, 20),
            (DC.TRANSCRIPT, "Academic transcript", True, True, True, None, None, 25),
            (DC.BANK_STATEMENT, "Bank balance certificate", True, False, True, None, 30, 40),
            (DC.FAMILY_RELATION_CERTIFICATE, "Family relationship certificate", True, True, True, ["CN", "VN"], None, 45),
            (DC.PERSONAL_STATEMENT, "Personal statement", True, False, False, None, None, 50),
            (DC.STUDY_PLAN, "Study plan", True, False, False, None, None, 55),
            (DC.TOPIK, "Language test certificate (TOPIK / IELTS / TOEFL)", False, False, False, None, None, 60),
        ]
        for cat, label, req, leg, trans, nats, max_age, order in reqs:
            db.add(sourced(DocumentRequirement(university_id=u.id, category=cat, label=label, is_required=req, legalization_required=leg,
                                               translation_required=trans, applies_to_nationalities=nats, max_age_days=max_age, sort_order=order,
                                               notes="Chinese applicants: include hukou/family certificate; some universities also accept CHSI/CDGDC reports." if cat == DC.FAMILY_RELATION_CERTIFICATE else None),
                           sources["skku-guide-2022-uway"], demo=True))
        for degree_level in ("MASTER", "DOCTORATE"):
            db.add(sourced(DocumentRequirement(university_id=u.id, degree_level=degree_level, category=DC.RECOMMENDATION, label="Recommendation letters (2)",
                                               is_required=True, sort_order=58), demo))
            db.add(sourced(DocumentRequirement(university_id=u.id, degree_level=degree_level, category=DC.CV, label="CV / résumé", is_required=True, sort_order=59), demo))
        # Dormitories (sample)
        db.add(sourced(Dormitory(university_id=u.id, name="International House", room_types=["Double", "Single"], capacity=rng.choice([None, 400, 650, 900]),
                                 cost_per_semester_krw_min=rng.choice([1100000, 1300000, 1500000]), cost_per_semester_krw_max=rng.choice([2100000, 2400000, 2800000]),
                                 international_priority=True, meal_plan=rng.random() < 0.5,
                                 application_note="Applications open after admission; first-year international students are usually prioritized."), demo))
        # University scholarships (sample)
        for name, cov, lo, hi, rules in C.SCHOLARSHIPS_UNI:
            s = sourced(Scholarship(university_id=u.id, kind=ScholarshipKind.UNIVERSITY, name=f"{en.split(' University')[0]} {name}", provider=en,
                                    coverage=cov, tuition_waiver_percent_min=lo, tuition_waiver_percent_max=hi, degree_levels=["BACHELOR", "TRANSFER", "MASTER", "DOCTORATE"],
                                    is_automatic=True, description="Check the university's current scholarship rules before you apply."), demo)
            db.add(s)
            db.flush()
            for f, op, v, d in rules:
                db.add(ScholarshipRule(scholarship_id=s.id, field=f, operator=op, value=v, description=d))
    gks = sourced(Scholarship(kind=ScholarshipKind.GOVERNMENT, name="Global Korea Scholarship (GKS) — Graduate", provider="NIIED (Government of Korea)",
                              coverage="Airfare, full tuition, monthly allowance, insurance and 1 year of Korean language study",
                              degree_levels=["MASTER", "DOCTORATE"], is_automatic=False,
                              description="Apply through a Korean embassy or a designated university. Applicants generally must not hold Korean citizenship; see the official notice for age, GPA and eligibility rules."),
                  sources["gks-g-2026-ny"], demo=False)
    db.add(gks)
    db.flush()
    db.add(ScholarshipRule(scholarship_id=gks.id, field="gpa_percent", operator="gte", value="80", description="Strong academic record (the notice sets an exact GPA threshold — check it)"))
    db.flush()
    return unis


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

def make_user(db: Session, email: str, name: str, *, locale="en", roles=(), demo=True) -> User:
    global PW_HASH
    if not PW_HASH:
        # Seed extras import this module as ``app.seed.run`` while the seed itself runs as ``__main__``,
        # so the hash set in main() is not visible here; compute it once on first use.
        PW_HASH = hash_password(DEMO_PASSWORD)
    u = User(email=email, password_hash=PW_HASH, full_name=name, locale=locale, is_demo=demo, created_at=NOW - timedelta(days=rng.randint(30, 400)))
    db.add(u)
    db.flush()
    for r in roles:
        db.add(UserRole(user_id=u.id, role=r))
    return u


PW_HASH = ""

NAMES = {
    "VN": (["Nguyễn Thị Lan", "Trần Minh Khoa", "Lê Thu Hà", "Phạm Quốc Bảo", "Hoàng Gia Huy", "Vũ Ngọc Anh", "Đặng Thảo Vy", "Bùi Đức Minh", "Đỗ Khánh Linh",
            "Ngô Hải Nam", "Dương Mai Phương", "Lý Thanh Tùng", "Phan Bảo Ngọc", "Trịnh Hoài An", "Mai Tuấn Kiệt", "Cao Diệu Linh", "Hồ Nhật Quang", "Tạ Minh Châu"], "vi"),
    "CN": (["Wang Jiayi", "Li Hao", "Zhang Yuxin", "Liu Chen", "Chen Siyu", "Yang Zihan", "Zhao Mingyu", "Huang Xinyi", "Zhou Jie", "Wu Ruoxi"], "zh-Hans"),
    "UZ": (["Dilnoza Karimova", "Jasur Tursunov", "Madina Yusupova", "Bekzod Rakhimov", "Nigora Azimova", "Sardor Kholmatov", "Malika Ergasheva", "Otabek Nazarov"], "uz"),
    "MN": (["Enkhjin Bat-Erdene", "Temuulen Ganbold", "Nomin Dorj", "Bilguun Tserendorj", "Anujin Batbayar", "Munkh-Orgil Sukhbaatar"], "mn"),
    "NP": (["Sita Sharma", "Aarav Adhikari", "Prakriti Gurung", "Bikash Thapa", "Anisha Shrestha", "Rohan Karki"], "ne"),
    "MM": (["Thandar Aung", "Kyaw Zin Htet", "Su Myat Noe", "Min Khant Kyaw"], "my"),
    "ID": (["Putri Rahmawati", "Rizky Pratama"], "id"),
    "JP": (["Sato Yuna", "Takahashi Ren"], "ja"),
    "KZ": (["Aruzhan Seitkali", "Dias Nurlanov"], "kk"),
    "BD": (["Nusrat Jahan", "Tanvir Hasan"], "bn"),
    "IN": (["Priya Nair"], "hi"),
    "PK": (["Ayesha Khan"], "ur"),
    "TH": (["Pimchanok Srisuk"], "th"),
    "PH": (["Maria Santos"], "fil"),
}
AGENCY_FOR = {"VN": "lotus-bridge", "KH": "lotus-bridge", "UZ": "silk-road", "KZ": "silk-road", "MN": "silk-road", "NP": "himalaya-pathways", "MM": "himalaya-pathways",
              "BD": "himalaya-pathways", "IN": "himalaya-pathways", "PK": "himalaya-pathways", "CN": "seoul-gateway", "JP": "seoul-gateway"}


def seed_orgs(db: Session, unis: dict[str, University]):
    global PW_HASH
    PW_HASH = hash_password(DEMO_PASSWORD)
    hangyul = Organization(type=OrgType.HANGYUL, name="Hangyul Univ", slug="hangyul", country_code="KR", is_partner=True, languages=["ko", "en"])
    db.add(hangyul)
    db.flush()
    staff = {}
    for email, name, role in (("admin@demo.hangyul.kr", "Kim Seo-yeon", Role.HANGYUL_SUPER_ADMIN), ("ops@demo.hangyul.kr", "Park Ji-ho", Role.HANGYUL_OPERATIONS),
                              ("finance@demo.hangyul.kr", "Lee Da-eun", Role.HANGYUL_FINANCE)):
        u = make_user(db, email, name, locale="ko", roles=[role])
        db.add(OrganizationMember(organization_id=hangyul.id, user_id=u.id, role=role, title=role.value.replace("HANGYUL_", "").replace("_", " ").title()))
        staff[role] = u
    agencies = {}
    counselors: dict[str, list[User]] = {}
    for name, slug, cc, langs, cap, sla, specs in C.AGENCIES:
        org = Organization(type=OrgType.AGENCY, name=name, slug=slug, country_code=cc, is_partner=True, languages=langs, capacity_active_cases=cap,
                           sla_first_response_hours=sla, timezone="Asia/Ho_Chi_Minh" if cc == "VN" else "Asia/Seoul", is_demo=True, license_number=f"{cc}-AG-{len(agencies) + 1:04d}")
        db.add(org)
        db.flush()
        for kind, value in specs:
            db.add(AgencySpecialty(organization_id=org.id, kind=kind, value=value))
        agencies[slug] = org
        counselors[slug] = []
        short = slug.split("-")[0]
        # V22 (REPORT §246): one permission — every member is an AGENCY_ADMIN. The e-mail prefixes are kept so the
        # demo personas, e2e specs and the test suite keep their handles; the title is a job title, not a permission.
        team = [(f"owner@{short}.demo.hangyul.kr", "Administrator", Role.AGENCY_ADMIN), (f"manager@{short}.demo.hangyul.kr", "Administrator", Role.AGENCY_ADMIN),
                (f"counselor@{short}.demo.hangyul.kr", "Administrator", Role.AGENCY_ADMIN), (f"counselor2@{short}.demo.hangyul.kr", "Administrator", Role.AGENCY_ADMIN),
                (f"reviewer@{short}.demo.hangyul.kr", "Administrator", Role.AGENCY_ADMIN)]
        people = {"lotus": ["Nguyễn Văn Hùng", "Đinh Thị Hoa", "Trương Mỹ Linh", "Lê Hoàng Long", "Phạm Thu Trang"],
                  "silk": ["Rustam Aliev", "Gulnora Saidova", "Aziz Mirzaev", "Kamola Rashidova", "Timur Abdullaev"],
                  "himalaya": ["Ramesh Poudel", "Sunita Rai", "Nabin Bhattarai", "Ei Mon Kyaw", "Kiran Lama"],
                  "seoul": ["Choi Min-jun", "Jung Ha-eun", "Han Ji-woo", "Wang Lei", "Yoon Seo-ah"]}[short]
        for (email, title, role), pname in zip(team, people):
            u = make_user(db, email, pname, locale=langs[0] if langs[0] in ("vi", "ko", "uz", "ne") else "en")
            db.add(OrganizationMember(organization_id=org.id, user_id=u.id, role=role, title=title, languages=langs[:2]))
            if email.split("@")[0] in ("counselor", "counselor2", "manager"):
                # counselors first so counselor@<agency> owns the main demo caseload
                (counselors[slug].insert(0, u) if email.startswith("counselor@") else counselors[slug].append(u))
    # University tenants (demo partnerships)
    uni_orgs = {}
    for slug in C.PARTNER_UNIS:
        u = unis[slug]
        u.is_partner = True
        org = Organization(type=OrgType.UNIVERSITY, name=u.name_en, slug=f"uni-{slug}", country_code="KR", university_id=u.id, is_partner=True, is_demo=True)
        db.add(org)
        db.flush()
        short = slug.split("-")[0]
        for email, name, role in ((f"admin@{short}.univ.demo.hangyul.kr", "International Office Admin", Role.UNIVERSITY_ADMIN),
                                  (f"admissions@{short}.univ.demo.hangyul.kr", "Admissions Officer", Role.UNIVERSITY_ADMIN),
                                  (f"reviewer@{short}.univ.demo.hangyul.kr", "Faculty Reviewer", Role.UNIVERSITY_ADMIN),
                                  (f"analyst@{short}.univ.demo.hangyul.kr", "Data Analyst", Role.UNIVERSITY_ADMIN)):
            person = {"sungkyunkwan": ["Shin Hye-jin", "Kang Dong-hyun", "Prof. Oh Sung-min", "Seo Yu-na"],
                      "kyung": ["Baek Soo-jin", "Lim Jae-won", "Prof. Hwang In-ho", "Ko Eun-bi"],
                      "pusan": ["Moon Ji-young", "Yang Hyun-woo", "Prof. Song Ki-tae", "Jeon Min-seo"]}[short][["International Office Admin", "Admissions Officer", "Faculty Reviewer", "Data Analyst"].index(name)]
            usr = make_user(db, email, person, locale="ko")
            db.add(OrganizationMember(organization_id=org.id, user_id=usr.id, role=role, title=name))
        uni_orgs[slug] = org
        contract = PartnerContract(university_id=u.id, title=f"{u.name_en} × Hangyul recruitment partnership", status=ContractStatus.ACTIVE,
                                   start_date=date(2025, 3, 1), end_date=date(2027, 12, 31), recruitment_fee_krw=rng.choice([1500000, 2000000, 2500000]),
                                   commission_percent=None, guaranteed_minimum_krw=None, target_countries=["VN", "UZ", "MN", "NP", "MM"],
                                   intake_label="2027-SPRING", incentive_tiers=[{"min_enrolled": 20, "bonus_krw": 5000000}, {"min_enrolled": 40, "bonus_krw": 12000000}],
                                   guarantee_enabled=slug == "pusan-national-university",
                                   guarantee_terms="Conditional admission for the Korean Language Program when you hold TOPIK 2+, meet the document checklist and seats remain." if slug == "pusan-national-university" else None,
                                   guarantee_criteria={"min_topik": 2, "degree_levels": ["LANGUAGE"]} if slug == "pusan-national-university" else None,
                                   notes="Recruitment partnership for the 2027 intakes; quotas and incentives reviewed each semester.", is_demo=True)
        db.add(contract)
        db.flush()
        klp = next(p for p in u.programs if p.degree_level == DegreeLevel.LANGUAGE)
        db.add(PartnerQuota(contract_id=contract.id, program_id=None, intake_label="2027-SPRING", seats=40, used=rng.randint(8, 18)))
        db.add(PartnerQuota(contract_id=contract.id, program_id=klp.id, intake_label="2027-SPRING", seats=25, used=rng.randint(3, 9)))
        pool = ScholarshipPool(contract_id=contract.id, name="Hangyul Partner Scholarship — 2027 Spring", intake_label="2027-SPRING",
                               total_krw=rng.choice([30000000, 40000000, 50000000]),
                               rules_summary="Admitted Hangyul students with TOPIK 4+ or GPA ≥ 85 (normalized). Paid as a first-semester tuition credit.")
        db.add(pool)
        db.flush()
        s = Scholarship(university_id=u.id, kind=ScholarshipKind.HANGYUL_PARTNER, name=f"Hangyul Partner Scholarship — {u.name_en}", provider="Hangyul Univ",
                        coverage="KRW 1,000,000–2,000,000 first-semester tuition credit", amount_krw=1500000, degree_levels=["LANGUAGE", "BACHELOR", "TRANSFER", "MASTER"],
                        is_automatic=False, pool_id=pool.id, description="Funded from an active partnership. Shown only while the partnership and pool are active.",
                        verification_status="DEMO")
        db.add(s)
        db.flush()
        db.add(ScholarshipRule(scholarship_id=s.id, field="topik_level", operator="gte", value="4", description="TOPIK level 4 or higher"))
    db.flush()
    return hangyul, staff, agencies, counselors, uni_orgs


# ------------------------------------------------------------------ students

ESSAY_SAMPLE = """When I was fifteen, my family's small shop in Hai Phong started selling Korean snacks, and I became the person who translated the labels for customers. That job made me curious about how Korean companies build brands that travel across borders.

At university I studied business administration and led a student project analyzing how Vietnamese SMEs use social media. We interviewed twelve shop owners and presented our findings to the faculty. I learned that I enjoy turning messy interviews into clear recommendations.

I want to study in Korea because Korean firms are among the largest investors in Vietnam, and I hope to work between the two markets. I have been studying Korean for two years and passed TOPIK level 4 this spring.

After graduating, I plan to join a Korean company's Vietnam office in marketing strategy, and later help Vietnamese brands enter Korea."""


def history_path(final: S) -> list[S]:
    if final in (S.REJECTED, S.WAITLISTED):
        return PROGRESS_ORDER[: PROGRESS_ORDER.index(S.UNIVERSITY_REVIEW) + 1] + [final]
    if final == S.WITHDRAWN:
        return [S.DRAFT, S.DOCUMENT_PREPARATION, S.WITHDRAWN]
    path = []
    for s in PROGRESS_ORDER:
        if s in (S.PROFILE_REVIEW, S.ADDITIONAL_DOCUMENTS, S.WAITLISTED, S.ADMISSION_CERTIFICATE_PENDING):
            continue
        # Interviews are optional — but never skip the step the application ends on (the path would run on to ENROLLED).
        if s == S.INTERVIEW and rng.random() < 0.6 and final != S.INTERVIEW:
            continue
        path.append(s)
        if s == final:
            break
    return path


def seed_students(db: Session, unis, agencies, counselors, uni_orgs, sources, storage, staff):
    all_programs = [p for u in unis.values() for p in u.programs]
    intakes_by_prog = {p.id: sorted(p.intakes, key=lambda i: i.application_deadline) for p in all_programs}
    population = []
    for cc, (names, loc) in NAMES.items():
        for n in names:
            population.append((cc, n, loc))
    students = []
    for idx, (cc, name, loc) in enumerate(population):
        is_main = idx == 0  # Nguyễn Thị Lan — the main demo student
        email = "student@demo.hangyul.kr" if is_main else f"student{idx:02d}@demo.hangyul.kr"
        u = make_user(db, email, name, locale=loc if not is_main else "en", roles=[Role.STUDENT])
        if is_main:
            u.preferred_name = "Lan"
        db.add(ConsentRecord(user_id=u.id, purpose="TERMS", version="2026-09", granted=True, created_at=u.created_at))
        db.add(ConsentRecord(user_id=u.id, purpose="PRIVACY", version="2026-09", granted=True, created_at=u.created_at))
        degree = DegreeLevel.BACHELOR if is_main else rng.choices([DegreeLevel.BACHELOR, DegreeLevel.MASTER, DegreeLevel.LANGUAGE, DegreeLevel.DOCTORATE, DegreeLevel.TRANSFER], [45, 22, 22, 5, 6])[0]
        prof = StudentProfile(user_id=u.id, nationality=cc, residence_country=cc, date_of_birth=date(rng.randint(1996, 2008), rng.randint(1, 12), rng.randint(1, 28)),
                              has_passport=True, passport_number_masked=mask(f"{cc}{rng.randint(1000000, 9999999)}"), passport_expiry=date(2031, rng.randint(1, 12), 1),
                              target_degree=degree, target_intake_year=2027, target_intake_term=IntakeTerm.SPRING if rng.random() < 0.6 or is_main else IntakeTerm.FALL,
                              desired_fields=["business", "media_communication"] if is_main else rng.sample(C.FIELD_ORDER, 2),
                              preferred_regions=["Seoul"] if is_main else rng.sample(["Seoul", "Busan", "Daegu", "Gyeonggi"], rng.randint(1, 2)),
                              annual_budget_krw=24000000 if is_main else rng.choice([14000000, 18000000, 22000000, 26000000, 32000000]),
                              needs_scholarship=True if is_main else rng.random() < 0.6, housing_preference="DORM" if is_main else rng.choice(["DORM", "DORM", "OFF_CAMPUS", "NO_PREFERENCE"]),
                              korean_self_level="INTERMEDIATE" if is_main else rng.choice(["BEGINNER", "INTERMEDIATE", "ADVANCED", "NONE"]),
                              english_self_level=rng.choice(["INTERMEDIATE", "ADVANCED"]), financial_sponsor="PARENTS" if is_main else rng.choice(["PARENTS", "SELF", "RELATIVE"]),
                              career_goal="Marketing strategy between Korean and Vietnamese companies." if is_main else None, onboarding_step=7,
                              onboarding_completed_at=u.created_at + timedelta(days=1), is_demo=True, lead_source=rng.choice(["web_signup", "partner_event", "referral", "social"]))
        db.add(prof)
        db.flush()
        prior = {"BACHELOR": "HIGH_SCHOOL", "LANGUAGE": "HIGH_SCHOOL", "TRANSFER": "ASSOCIATE", "MASTER": "BACHELOR", "DOCTORATE": "MASTER"}[degree.value]
        scale = rng.choice([(10, 0), (4, 0), (100, 0)]) if not is_main else (10, 0)
        gpa_val = round(rng.uniform(scale[0] * 0.65, scale[0] * 0.95), 2) if not is_main else 8.4
        db.add(StudentEducation(profile_id=prof.id, level=prior, institution="Hai Phong Specialized High School" if is_main else "Public upper-secondary school",
                                country=cc, major="General" if prior == "HIGH_SCHOOL" else "Business", graduation_year=2025, graduation_status="GRADUATED",
                                gpa_value=gpa_val, gpa_scale_min=0, gpa_scale_max=scale[0], gpa_percent=round(gpa_val / scale[0] * 100, 1)))
        topik = 4 if is_main else rng.choices([None, 2, 3, 4, 5], [25, 15, 30, 20, 10])[0]
        if topik:
            db.add(StudentLanguage(profile_id=prof.id, test=LanguageTest.TOPIK, score=topik, test_date=date(2026, 4, 12), expires_on=date(2028, 4, 12), verified=is_main))
        if is_main or rng.random() < 0.35:
            db.add(StudentLanguage(profile_id=prof.id, test=LanguageTest.IELTS, score=6.5 if is_main else rng.choice([5.5, 6.0, 6.5, 7.0]), test_date=date(2025, 11, 2), expires_on=date(2027, 11, 2)))
        db.flush()
        students.append((u, prof, is_main))

    # Assignments, orders, applications
    now = NOW
    cohort_intakes = {"historic": [], "current": []}
    for u, prof, is_main in students:
        agency_slug = AGENCY_FOR.get(prof.nationality, rng.choice(list(agencies)))
        assigned = is_main or rng.random() < 0.78
        org = agencies[agency_slug]
        a = None
        if assigned:
            counselor = counselors[agency_slug][0] if is_main else rng.choice(counselors[agency_slug])
            created = now - timedelta(days=rng.randint(3, 340)) if not is_main else now - timedelta(days=40)
            # V15: a realistic mix of the three retail plans, weighted the way the business expects to sell
            # them — All-in-One is 주력 상품 (business plan §9), Basic is the entry product, Premium is the
            # smaller high-touch tail. The demo caseload has to contain all three or the Agency Console's
            # plan-scope behaviour is never exercised by the data it ships with.
            plan_code = "PREMIUM" if is_main else rng.choices(["BASIC", "ALL_IN_ONE", "PREMIUM"], weights=[28, 55, 17])[0]
            prod = db.query(ServiceProduct).filter_by(code=plan_code).one()
            price = next(p for p in prod.prices if p.country_code is None)
            order = Order(user_id=u.id, product_id=prod.id, price_id=price.id, currency=price.currency, amount_minor=price.amount_minor, status=OrderStatus.PAID,
                          paid_at=created, created_at=created)
            db.add(order)
            db.flush()
            db.add(Payment(order_id=order.id, provider="demo", provider_ref=f"demo_{uuid.uuid4().hex[:12]}", status="PAID", amount_minor=price.amount_minor, currency=price.currency, raw={"demo": True}))
            sla = org.sla_first_response_hours or 24
            responded = created + timedelta(hours=rng.choice([2, 5, 9, 16, 20, 30, 44])) if (is_main or rng.random() < 0.92) else None
            if created > now - timedelta(days=2) and rng.random() < 0.5:
                responded = None
            a = AgencyAssignment(student_user_id=u.id, organization_id=org.id, counselor_user_id=counselor.id, status=AssignmentStatus.ACTIVE, score=round(rng.uniform(62, 91), 1),
                                 score_breakdown=[{"factor": "country", "weight": 25, "points": 25, "note": f"Country expertise: {prof.nationality}"}],
                                 assigned_by="ENGINE", order_id=order.id, first_response_due_at=created + timedelta(hours=sla), first_response_at=responded, created_at=created)
            db.add(a)
            db.add(ConsentRecord(user_id=u.id, purpose="SHARE_WITH_AGENCY", version="2026-09", granted=True, created_at=created))
            prof.pipeline_stage = PipelineStage.ASSIGNED
        # Pick programs of the target degree
        options = [p for p in all_programs if p.degree_level == prof.target_degree] or all_programs
        if is_main:
            options = [p for p in all_programs if p.degree_level == DegreeLevel.BACHELOR and p.field in ("business", "media_communication")]
        n_apps = 3 if is_main else (rng.choice([0, 1, 1, 2, 2, 3]) if assigned else rng.choice([0, 0, 1]))
        chosen = rng.sample(options, min(n_apps, len(options)))
        for j, prog in enumerate(chosen):
            intakes = intakes_by_prog[prog.id]
            historic = (not is_main) and rng.random() < 0.38
            if historic:
                intake = next((i for i in intakes if i.year == 2026 and i.term == IntakeTerm.SPRING), None) or next((i for i in intakes if i.year == 2025), intakes[0])
                if rng.random() < 0.35:
                    intake = next((i for i in intakes if i.year == 2025 and i.term == IntakeTerm.FALL), intake)
                final = rng.choices([S.ENROLLED, S.REJECTED, S.WITHDRAWN, S.VISA_ISSUED, S.WAITLISTED], [55, 18, 8, 9, 10])[0]
            else:
                intake = next((i for i in intakes if i.is_open), intakes[-1])
                if is_main:
                    # Persona A: preparing applications — none can honestly be 'ready' while documents are missing.
                    final = [S.DOCUMENT_PREPARATION, S.DOCUMENT_PREPARATION, S.DRAFT][j]
                else:
                    final = rng.choices([S.DRAFT, S.DOCUMENT_PREPARATION, S.READY, S.SUBMITTED, S.UNIVERSITY_REVIEW, S.INTERVIEW, S.OFFERED, S.ADDITIONAL_DOCUMENTS, S.REJECTED,
                                         S.OFFER_ACCEPTED, S.TUITION_PENDING],
                                        [10, 16, 8, 10, 14, 5, 9, 4, 5, 4, 4])[0]
            if db.query(Application).filter_by(student_user_id=u.id, intake_id=intake.id).first():
                continue
            app = Application(student_user_id=u.id, program_id=prog.id, intake_id=intake.id, university_id=prog.university_id,
                              agency_org_id=a.organization_id if a else None, status=final, is_demo=True)
            db.add(app)
            db.flush()
            # Status history backdated to fit the intake timeline
            path = history_path(final) if final != S.ADDITIONAL_DOCUMENTS else [S.DRAFT, S.DOCUMENT_PREPARATION, S.READY, S.SUBMITTED, S.UNIVERSITY_REVIEW, S.ADDITIONAL_DOCUMENTS]
            start = dt(intake.application_deadline - timedelta(days=rng.randint(40, 80)))
            # V26 (REPORT §341, data quality): an application for a far-off intake was still *started* in the past. Before
            # V26 a 2027 deadline put `start` in the future and the whole history after it (24 rows dated 2027). The clamp
            # draws nothing from `rng`: one extra draw per application would re-deal every later random choice and change
            # which applications end READY, OFFERED, … (it did — two V9 fixtures disappeared, REPORT §349).
            start = min(start, now - timedelta(days=14))
            end = min(now - timedelta(hours=6), dt(intake.semester_start + timedelta(days=10)) if historic else now - timedelta(hours=6))
            steps = len(path)
            span = max((end - start).total_seconds(), 3600 * steps)
            prev = None
            for k, st in enumerate(path):
                at = start + timedelta(seconds=span * (k / max(steps - 1, 1)) ** 1.1)
                if st == S.SUBMITTED:
                    at = min(at, dt(intake.application_deadline) - timedelta(days=rng.randint(0, 10)))
                    app.submitted_at = at
                if st in (S.OFFERED, S.REJECTED, S.WAITLISTED):
                    app.decided_at = at
                db.add(ApplicationStatusHistory(application_id=app.id, from_status=prev, to_status=st, actor_org_type="UNIVERSITY" if st in (S.UNIVERSITY_REVIEW, S.OFFERED, S.REJECTED, S.WAITLISTED, S.TUITION_PAID, S.ADMISSION_CERTIFICATE_ISSUED, S.ENROLLED, S.INTERVIEW) else "AGENCY",
                                                created_at=at))
                prev = st
            app.created_at = start
            app.updated_at = at
            if final == S.INTERVIEW:
                app.interview_at = now + timedelta(days=rng.randint(3, 14))
            if final == S.TUITION_PENDING:
                app.tuition_amount_krw = prog.tuition_per_semester_krw
                app.tuition_due = TODAY + timedelta(days=rng.randint(5, 25))
            if final == S.OFFERED and rng.random() < 0.4:
                app.offer_scholarship_note = "Freshman merit scholarship: 30% of first-semester tuition"
            if rng.random() < 0.07:
                app.flagged, app.flag_reason = True, "Transcript name spelling differs from passport"
            (cohort_intakes["historic"] if historic else cohort_intakes["current"]).append((app, intake, prof))
        # Saved universities
        for uni in rng.sample(list(unis.values()), 3 if is_main else rng.randint(0, 3)):
            db.add(SavedUniversity(user_id=u.id, university_id=uni.id, created_at=now - timedelta(days=rng.randint(1, 120))))
        # Pipeline stage from the furthest application
        best = None
        for app, intake, p2 in cohort_intakes["historic"] + cohort_intakes["current"]:
            if app.student_user_id == u.id:
                rank = PROGRESS_ORDER.index(app.status) if app.status in PROGRESS_ORDER else -1
                if best is None or rank > best[0]:
                    best = (rank, app.status)
        if best:
            mapping = {S.DRAFT: PipelineStage.DOCUMENT_PREPARATION, S.DOCUMENT_PREPARATION: PipelineStage.DOCUMENT_PREPARATION, S.READY: PipelineStage.READY_TO_APPLY,
                       S.SUBMITTED: PipelineStage.APPLIED, S.UNIVERSITY_REVIEW: PipelineStage.APPLIED, S.ADDITIONAL_DOCUMENTS: PipelineStage.APPLIED,
                       S.INTERVIEW: PipelineStage.INTERVIEW, S.OFFERED: PipelineStage.OFFERED, S.OFFER_ACCEPTED: PipelineStage.TUITION_PENDING,
                       S.TUITION_PENDING: PipelineStage.TUITION_PENDING, S.VISA_ISSUED: PipelineStage.ARRIVAL_PREPARATION, S.ENROLLED: PipelineStage.ACTIVE_STUDENT,
                       S.WAITLISTED: PipelineStage.WAITLISTED, S.REJECTED: PipelineStage.REJECTED}
            prof.pipeline_stage = mapping.get(best[1], prof.pipeline_stage)
        elif not assigned:
            prof.pipeline_stage = rng.choice([PipelineStage.NEW_LEAD, PipelineStage.PROFILE_INCOMPLETE, PipelineStage.QUALIFIED])
    db.flush()

    # Documents for every student with applications (tiny PDFs in private storage)
    reviewers = {slug: next((m.user_id for m in agencies[slug].members if m.user.email.startswith("reviewer@")), None) for slug in agencies}
    for u, prof, is_main in students:
        apps = db.query(Application).filter_by(student_user_id=u.id).all()
        if not apps and not is_main:
            continue
        a = db.query(AgencyAssignment).filter_by(student_user_id=u.id, status=AssignmentStatus.ACTIVE).first()
        advanced = any(x.status not in (S.DRAFT, S.DOCUMENT_PREPARATION) for x in apps)
        cats = [(DC.PASSPORT, "Passport"), (DC.PHOTO, "Photo"), (DC.GRADUATION_CERTIFICATE, "High school diploma"), (DC.TRANSCRIPT, "Transcript"),
                (DC.BANK_STATEMENT, "Bank balance certificate"), (DC.TOPIK, "TOPIK certificate"), (DC.PERSONAL_STATEMENT, "Personal statement"), (DC.STUDY_PLAN, "Study plan")]
        if prof.nationality in ("CN", "VN"):
            cats.append((DC.FAMILY_RELATION_CERTIFICATE, "Family relationship certificate"))
        for cat, title in cats:
            if is_main:
                status = {DC.PASSPORT: DocumentStatus.VERIFIED, DC.PHOTO: DocumentStatus.VERIFIED, DC.GRADUATION_CERTIFICATE: DocumentStatus.VERIFIED,
                          DC.TRANSCRIPT: DocumentStatus.NEEDS_CORRECTION, DC.BANK_STATEMENT: DocumentStatus.NEEDS_REVIEW, DC.TOPIK: DocumentStatus.VERIFIED,
                          DC.FAMILY_RELATION_CERTIFICATE: None, DC.PERSONAL_STATEMENT: None, DC.STUDY_PLAN: None}[cat]
                if status is None:
                    continue
            else:
                if not advanced and rng.random() < 0.3:
                    continue
                status = DocumentStatus.VERIFIED if advanced else rng.choices([DocumentStatus.VERIFIED, DocumentStatus.NEEDS_REVIEW, DocumentStatus.NEEDS_CORRECTION, DocumentStatus.UPLOADED], [50, 25, 12, 13])[0]
            legal = cat in (DC.GRADUATION_CERTIFICATE, DC.TRANSCRIPT, DC.FAMILY_RELATION_CERTIFICATE)
            country = db.get(Country, prof.nationality)
            path = LegalizationPath.NONE
            if legal:
                path = LegalizationPath.APOSTILLE if (country.apostille_member and (country.apostille_effective_from or date.min) <= TODAY) else LegalizationPath.CONSULAR_LEGALIZATION
            leg_status = LegalizationStatus.NOT_REQUIRED if not legal else (LegalizationStatus.COMPLETED if status == DocumentStatus.VERIFIED else LegalizationStatus.IN_PROGRESS)
            if is_main and cat == DC.TRANSCRIPT:
                leg_status = LegalizationStatus.REQUIRED
            created = NOW - timedelta(days=rng.randint(2, 60))
            d = Document(owner_user_id=u.id, category=cat, title=title, issuing_country=prof.nationality, issue_date=(TODAY - timedelta(days=12)) if cat == DC.BANK_STATEMENT else date(2025, 6, 15),
                         language="vi" if prof.nationality == "VN" else "en", translation_required=prof.nationality not in ("US", "GB"), legalization_path=path,
                         legalization_status=leg_status, legalization_progress=["original", "notarize"] if leg_status == LegalizationStatus.IN_PROGRESS else None,
                         status=status, current_version=1, is_demo=True, created_at=created, updated_at=created + timedelta(hours=rng.randint(1, 72)),
                         rejection_reason=("The transcript needs an apostille before it can be used. The copy uploaded is not authenticated." if is_main and cat == DC.TRANSCRIPT
                                           else "The scan is cut off at the bottom — please upload all pages." if status == DocumentStatus.NEEDS_CORRECTION else None))
            if cat == DC.PASSPORT:
                d.expires_on = prof.passport_expiry
            db.add(d)
            db.flush()
            data = tiny_pdf(f"{title} - {u.full_name}")
            key = storage.put(data, prefix=f"students/{u.id}")
            db.add(DocumentVersion(document_id=d.id, version=1, storage_key=key, original_filename=f"{cat.value.lower()}.pdf", mime_type="application/pdf",
                                   size_bytes=len(data), sha256=sha256(data), scan_status="SKIPPED", uploaded_by_id=u.id, created_at=created))
            if status in (DocumentStatus.VERIFIED, DocumentStatus.NEEDS_CORRECTION) and a:
                slug = next(s for s, o in agencies.items() if o.id == a.organization_id)
                db.add(DocumentReview(document_id=d.id, version=1, reviewer_user_id=reviewers[slug] or a.counselor_user_id, reviewer_org_id=a.organization_id,
                                      decision=status.value, reason=d.rejection_reason, created_at=created + timedelta(hours=rng.randint(4, 60))))
        # Share docs for submitted apps
        for app in apps:
            if app.submitted_at:
                for req in db.query(DocumentRequirement).filter_by(university_id=app.university_id, program_id=None).all():
                    if req.degree_level and req.degree_level != db.get(Program, app.program_id).degree_level.value:
                        continue
                    doc = db.query(Document).filter_by(owner_user_id=u.id, category=req.category).first()
                    if doc:
                        db.add(ApplicationDocument(application_id=app.id, requirement_id=req.id, document_id=doc.id, shared_with_university=True))
    db.flush()

    # Essays
    for u, prof, is_main in students:
        for app in db.query(Application).filter_by(student_user_id=u.id).all():
            uni = db.get(University, app.university_id)
            a = db.query(AgencyAssignment).filter_by(student_user_id=u.id, status=AssignmentStatus.ACTIVE).first()
            for et, label, limit in ((EssayType.PERSONAL_STATEMENT, "Personal statement", 1000), (EssayType.STUDY_PLAN, "Study plan", 1500)):
                pre = app.status in (S.DRAFT, S.DOCUMENT_PREPARATION)
                status = (EssayStatus.AGENCY_REVIEW if is_main and et == EssayType.PERSONAL_STATEMENT and app.status == S.DOCUMENT_PREPARATION
                          else EssayStatus.DRAFT if is_main else rng.choice([EssayStatus.DRAFT, EssayStatus.AGENCY_REVIEW, EssayStatus.CHANGES_REQUESTED]) if pre else EssayStatus.APPROVED)
                e = Essay(owner_user_id=u.id, application_id=app.id, program_id=app.program_id, essay_type=et, title=f"{label} — {uni.name_en}",
                          prompt="Describe your motivation for applying, your academic background, and your study and career plans." if et == EssayType.PERSONAL_STATEMENT else
                          "Present your study plan for the degree period, including Korean language goals and your plans after graduation.",
                          word_limit=limit, status=status, reviewer_user_id=a.counselor_user_id if a else None, due_date=db.get(ProgramIntake, app.intake_id).application_deadline,
                          current_version=2 if status != EssayStatus.DRAFT else 1)
                db.add(e)
                db.flush()
                body = ESSAY_SAMPLE if is_main and et == EssayType.PERSONAL_STATEMENT else essay_text.body_for(db, e, partial=status == EssayStatus.DRAFT)
                db.add(EssayVersion(essay_id=e.id, version=1, body=body.split("\n\n")[0] if e.current_version == 2 else body, author_user_id=u.id, created_at=NOW - timedelta(days=9)))
                if e.current_version == 2:
                    db.add(EssayVersion(essay_id=e.id, version=2, body=body, author_user_id=u.id, created_at=NOW - timedelta(days=2), note="Expanded draft"))
                if is_main and et == EssayType.PERSONAL_STATEMENT and status == EssayStatus.AGENCY_REVIEW and a:
                    from app.services.essays import precheck
                    e.precheck = precheck(et.value, body, e.prompt, limit)
                    db.add(EssayComment(essay_id=e.id, version=2, author_user_id=a.counselor_user_id, quote="I enjoy turning messy interviews into clear recommendations",
                                        anchor_start=body.find("I enjoy"), anchor_end=body.find("I enjoy") + 60,
                                        body="Great insight — can you add one concrete result from the project (e.g. what a shop owner changed)?",
                                        created_at=NOW - timedelta(hours=20)))
                    db.add(EssayComment(essay_id=e.id, version=2, author_user_id=a.counselor_user_id, quote="passed TOPIK level 4 this spring",
                                        body="Mention how you'll keep improving toward TOPIK 5 during the first year.",
                                        suggestion="passed TOPIK level 4 this spring and am preparing for level 5", created_at=NOW - timedelta(hours=19)))
                    db.add(EssayComment(essay_id=e.id, version=2, author_user_id=a.counselor_user_id, body="Internal: strong candidate for the partner scholarship if TOPIK 5 lands.",
                                        visibility=MessageVisibility.INTERNAL, created_at=NOW - timedelta(hours=18)))
    db.flush()

    # Historic cohort → enrollment, visa, arrival, terms, outcomes
    for app, intake, prof in cohort_intakes["historic"] + cohort_intakes["current"]:
        if app.status in (S.VISA_ISSUED, S.ENROLLED, S.ADMISSION_CERTIFICATE_ISSUED, S.VISA_PREPARATION, S.VISA_SUBMITTED):
            vt, why = infer_visa(db.get(Program, app.program_id).degree_level)
            v = VisaCase(student_user_id=app.student_user_id, application_id=app.id, visa_type=vt, visa_type_reason=why,
                         status=VisaStatus.ISSUED if app.status in (S.VISA_ISSUED, S.ENROLLED) else VisaStatus.DOCUMENT_PREPARATION,
                         completed_steps=["admission_certificate", "passport", "application_form", "tuition_receipt", "financial_proof", "final_education", "visa_application", "visa_issued"]
                         if app.status in (S.VISA_ISSUED, S.ENROLLED) else ["admission_certificate", "passport"],
                         issued_on=intake.semester_start - timedelta(days=30) if app.status in (S.VISA_ISSUED, S.ENROLLED) else None,
                         target_entry_date=intake.semester_start)
            db.add(v)
        if app.status == S.ENROLLED:
            arrived = dt(intake.semester_start - timedelta(days=rng.randint(3, 12)))
            db.add(ArrivalPlan(student_user_id=app.student_user_id, arrival_airport="ICN", arrival_at=arrived, arrived_at=arrived, pickup_requested=True, pickup_status="CONFIRMED",
                               completed_items=["flight_booked", "airport_pickup", "housing_confirmed", "sim_esim", "bank_account", "residence_card_application", "health_insurance"],
                               residence_card_due=(arrived + timedelta(days=90)).date()))
            status = rng.choices([EnrollmentStatus.ENROLLED, EnrollmentStatus.WITHDRAWN, EnrollmentStatus.ON_LEAVE], [86, 8, 6])[0]
            e = StudentEnrollment(student_user_id=app.student_user_id, university_id=app.university_id, program_id=app.program_id, application_id=app.id,
                                  agency_org_id=app.agency_org_id, cohort_label=f"{intake.year}-{intake.term.value}", nationality=prof.nationality, status=status,
                                  enrolled_on=intake.semester_start, expected_graduation=intake.semester_start + timedelta(days=365 * 4),
                                  visa_expires_on=intake.semester_start + timedelta(days=rng.choice([365, 730])), is_demo=True)
            db.add(e)
            db.flush()
            terms = ["2025-FALL", "2026-SPRING", "2026-FALL"] if intake.year == 2025 else ["2026-SPRING", "2026-FALL"]
            for t in terms:
                db.add(StudentTerm(enrollment_id=e.id, term_label=t, registered=status != EnrollmentStatus.WITHDRAWN or t == terms[0], gpa_percent=round(rng.uniform(62, 95), 1),
                                   attendance_percent=round(rng.uniform(64, 99), 1), academic_standing=rng.choices(["GOOD", "WARNING"], [90, 10])[0], data_source="UNIVERSITY_FEED"))
            if status == EnrollmentStatus.WITHDRAWN:
                db.add(StudentOutcome(enrollment_id=e.id, kind="WITHDRAWN", occurred_on=intake.semester_start + timedelta(days=120)))
            prof.pipeline_stage = PipelineStage.ACTIVE_STUDENT if status == EnrollmentStatus.ENROLLED else PipelineStage.WITHDRAWN
    # Older cohorts imported from a university feed (for retention/graduation analytics)
    for slug, org in uni_orgs.items():
        uni = unis[slug]
        progs = [p for p in uni.programs if p.degree_level in (DegreeLevel.BACHELOR, DegreeLevel.MASTER)]
        for year in (2021, 2022, 2023, 2024):
            for _ in range(rng.randint(6, 11)):
                cc = rng.choices(["VN", "CN", "UZ", "MN", "NP", "MM"], [35, 25, 15, 10, 10, 5])[0]
                alum = make_user(db, f"alumni.{uuid.uuid4().hex[:8]}@demo.hangyul.kr", rng.choice(NAMES[cc][0]), roles=[Role.STUDENT])
                prog = rng.choice(progs)
                years = 2 if prog.degree_level == DegreeLevel.MASTER else 4
                enrolled_on = date(year, 3, 2)
                grad = date(year + years, 2, 20)
                if grad < TODAY:
                    status = rng.choices([EnrollmentStatus.GRADUATED, EnrollmentStatus.WITHDRAWN, EnrollmentStatus.TRANSFERRED], [78, 16, 6])[0]
                else:
                    status = rng.choices([EnrollmentStatus.ENROLLED, EnrollmentStatus.WITHDRAWN, EnrollmentStatus.ON_LEAVE], [82, 12, 6])[0]
                e = StudentEnrollment(student_user_id=alum.id, university_id=uni.id, program_id=prog.id, agency_org_id=rng.choice(list(agencies.values())).id,
                                      cohort_label=f"{year}-SPRING", nationality=cc, status=status, enrolled_on=enrolled_on, expected_graduation=grad,
                                      visa_expires_on=min(grad, TODAY + timedelta(days=rng.randint(20, 400))), is_demo=True)
                db.add(e)
                db.flush()
                n_terms = max(1, min((TODAY - enrolled_on).days // 182, years * 2))
                if status == EnrollmentStatus.WITHDRAWN:
                    n_terms = rng.randint(1, max(1, n_terms - 1))
                for k in range(n_terms):
                    db.add(StudentTerm(enrollment_id=e.id, term_label=f"{year + k // 2}-{'SPRING' if k % 2 == 0 else 'FALL'}", registered=True,
                                       gpa_percent=round(rng.uniform(60, 96), 1), attendance_percent=round(rng.uniform(60, 99), 1),
                                       academic_standing=rng.choices(["GOOD", "WARNING", "PROBATION"], [86, 10, 4])[0], data_source="UNIVERSITY_FEED"))
                if status in (EnrollmentStatus.GRADUATED, EnrollmentStatus.WITHDRAWN, EnrollmentStatus.TRANSFERRED):
                    db.add(StudentOutcome(enrollment_id=e.id, kind=status.value, occurred_on=grad if status == EnrollmentStatus.GRADUATED else enrolled_on + timedelta(days=182 * n_terms)))
                    if status == EnrollmentStatus.GRADUATED:
                        db.add(StudentOutcome(enrollment_id=e.id, kind=rng.choice(["EMPLOYED_KR", "FURTHER_STUDY", "RETURNED_HOME"]), occurred_on=grad + timedelta(days=120)))
    db.flush()

    # Scholarship awards (partner pools)
    for slug, org in uni_orgs.items():
        uni = unis[slug]
        pool = db.query(ScholarshipPool).join(PartnerContract).filter(PartnerContract.university_id == uni.id).first()
        offered = [a for a, i, p in cohort_intakes["current"] + cohort_intakes["historic"] if a.university_id == uni.id and a.status in (S.OFFERED, S.OFFER_ACCEPTED, S.TUITION_PENDING, S.ENROLLED)]
        for app in offered[:4]:
            db.add(ScholarshipAward(pool_id=pool.id, student_user_id=app.student_user_id, application_id=app.id, amount_krw=rng.choice([1000000, 1500000, 2000000]),
                                    status=rng.choice([AwardStatus.COMMITTED, AwardStatus.PAID, AwardStatus.PROPOSED]), note="Partner scholarship award"))

    # Main demo student extras: housing, messages, appointment
    main_u, main_prof, _ = students[0]
    a = db.query(AgencyAssignment).filter_by(student_user_id=main_u.id, status=AssignmentStatus.ACTIVE).one()
    db.add(HousingCase(student_user_id=main_u.id, status=HousingStatus.RESEARCHING, preference="DORM", budget_monthly_krw=600000, room_preference="Double", completed_items=["compare_options"]))
    conv = Conversation(kind=ConversationKind.STUDENT_SUPPORT, subject="Your study-in-Korea team", student_user_id=main_u.id, last_message_at=NOW - timedelta(hours=3))
    db.add(conv)
    db.flush()
    db.add(ConversationParticipant(conversation_id=conv.id, user_id=main_u.id))
    db.add(ConversationParticipant(conversation_id=conv.id, organization_id=a.organization_id))
    msgs = [
        (a.counselor_user_id, "Chào Lan! I'm Mỹ Linh, your counselor. I've reviewed your profile — your TOPIK 4 opens up Korean-taught business programs in Seoul.", MessageVisibility.PARTICIPANTS, 72),
        (main_u.id, "Thank you! Which documents should I prepare first?", MessageVisibility.PARTICIPANTS, 70),
        (a.counselor_user_id, "Start with the apostille for your diploma and transcript — Vietnam joined the Apostille Convention this month, so this is now faster than consular confirmation.", MessageVisibility.PARTICIPANTS, 69),
        (a.counselor_user_id, "Internal: parents' bank certificate is dated 12 days ago; Hanoi embassy may want 3-month holding history — confirm before visa stage.", MessageVisibility.INTERNAL, 30),
        (a.counselor_user_id, "I left comments on your personal statement. Your story about translating snack labels is great — let's make the project result more concrete.", MessageVisibility.PARTICIPANTS, 3),
    ]
    for author, body, vis, hours in msgs:
        db.add(Message(conversation_id=conv.id, author_user_id=author, body=body, visibility=vis, created_at=NOW - timedelta(hours=hours)))
    db.add(Appointment(student_user_id=main_u.id, organization_id=a.organization_id, host_user_id=a.counselor_user_id, kind="CONSULTATION", starts_at=NOW + timedelta(days=2, hours=3),
                       duration_minutes=30, channel="VIDEO", status="SCHEDULED", notes="Application strategy & scholarship plan"))
    from app.services.notify import notify
    notify(db, main_u.id, "DOCUMENT_NEEDS_CORRECTION", "notify.documentNeedsCorrection", "Transcript needs a correction: apostille required.",
           params={"document": "Transcript", "reason": "Apostille required", "category": "TRANSCRIPT"}, link="/documents?focus=TRANSCRIPT")
    # V26 (REPORT §341): every seeded notification opens the exact record it is about, like the live ones.
    ps = db.scalar(select(Essay).where(Essay.owner_user_id == main_u.id, Essay.essay_type == EssayType.PERSONAL_STATEMENT).order_by(Essay.created_at))
    notify(db, main_u.id, "ESSAY_COMMENT", "notify.essayComment", "New comments on your personal statement", params={"title": "Personal statement", "essay_type": "PERSONAL_STATEMENT"},
           link=f"/essays/{ps.id}" if ps else "/essays")
    notify(db, main_u.id, "MESSAGE", "notify.message", "New message from Trương Mỹ Linh", params={"author": "Trương Mỹ Linh"}, link=f"/messages/{conv.id}")
    staff_conv = Conversation(kind=ConversationKind.STAFF, subject="Q4 intake planning — Lotus Bridge", last_message_at=NOW - timedelta(days=1))
    db.add(staff_conv)
    db.flush()
    db.add(ConversationParticipant(conversation_id=staff_conv.id, organization_id=a.organization_id))
    db.add(ConversationParticipant(conversation_id=staff_conv.id, user_id=staff[Role.HANGYUL_OPERATIONS].id))
    db.add(Message(conversation_id=staff_conv.id, author_user_id=staff[Role.HANGYUL_OPERATIONS].id, body="Vietnam apostille change is live — please update document guidance for all Spring 2027 applicants.", created_at=NOW - timedelta(days=1)))
    db.flush()
    return students


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


def seed_events(db: Session):
    """Top-of-funnel analytics events (demo)."""
    for u in db.query(User).join(UserRole).filter(UserRole.role == Role.STUDENT, User.email.like("student%")).all():
        prof = db.query(StudentProfile).filter_by(user_id=u.id).first()
        for name in ("student_registered", "profile_started", "profile_completed", "match_generated"):
            db.add(AnalyticsEvent(name=name, user_id=u.id, nationality=prof.nationality if prof else None, occurred_at=u.created_at + timedelta(hours=rng.randint(0, 72))))


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
    storage = get_storage()
    with SessionLocal() as db:
        if db.query(User).count() > 0:
            print("Database already has data. Use --reset to rebuild the demo dataset.")
            return
        sources = seed_reference(db)
        unis = seed_catalog(db, sources)
        # The public institution directory (V12): the national registry, loaded from the committed dataset.
        # It is not demo data and not generated here — see app/seed/institutions.py.
        print(f"  institutions: {seed_institutions(db)}")
        # V27: the official-source research (rules, scholarships, admission guides) — evidence, not demo data.
        from app.seed.v27_research import load as load_v27_research
        print(f"  v27 research: {load_v27_research(db)}")
        seed_rules(db, sources)
        seed_products(db)
        hangyul, staff, agencies, counselors, uni_orgs = seed_orgs(db, unis)
        db.flush()
        for org in agencies.values():
            db.refresh(org)
        students = seed_students(db, unis, agencies, counselors, uni_orgs, sources, storage, staff)
        seed_content(db)
        seed_events(db)
        db.flush()
        run_extras(db, {"sources": sources, "unis": unis, "agencies": agencies, "counselors": counselors, "uni_orgs": uni_orgs,
                        "staff": staff, "hangyul": hangyul, "students": students, "storage": storage})
        # Derived state: readiness, tasks, analytics rollups, freshness queue
        for u, prof, _ in students:
            for app in db.query(Application).filter_by(student_user_id=u.id).all():
                app.readiness_percent, checklist = application_readiness(db, app, prof, TODAY)
                # Coherence: an application cannot be "ready to submit" while a required document is not ready.
                # V27: an application already handed off / reported submitted is past READY — demoting it would leave a
                # submission record that contradicts its status.
                in_flight = db.scalar(select(ApplicationSubmission.id).where(ApplicationSubmission.application_id == app.id,
                                                                             ApplicationSubmission.status.in_(["HANDED_OFF", "SUBMITTED_UNCONFIRMED"])))
                if app.status == S.READY and not in_flight and any(c["required"] and not c["ready"] for c in checklist):
                    app.status = S.DOCUMENT_PREPARATION
                    last = db.query(ApplicationStatusHistory).filter_by(application_id=app.id, to_status=S.READY).first()
                    if last:
                        last.to_status = S.DOCUMENT_PREPARATION
            generate_for_student(db, u.id)
        # Age some engine tasks so dashboards show overdue work realistically
        # (V4) except review tasks: they start when the file was uploaded and are due REVIEW_TARGET_HOURS later, so the
        # only overdue review is the one extra_30_review_times deliberately keeps late.
        for t in db.query(Task).filter(Task.status == TaskStatus.OPEN).all():
            if (t.dedupe_key or "").startswith("docreq:"):
                continue  # university requests keep the time they were asked (extra_40_partner_consistency)
            t.created_at = NOW - timedelta(days=rng.randint(0, 20))
            if t.task_type.value == "DOCUMENT_REVIEW" and (t.dedupe_key or "").startswith("review:"):
                doc = db.get(Document, uuid.UUID(t.dedupe_key.split(":", 1)[1]))
                if doc is not None and doc.updated_at:
                    t.created_at = doc.updated_at
                    t.due_at = doc.updated_at + timedelta(hours=REVIEW_TARGET_HOURS)
        rollup(db)
        run_freshness_scan(db)
        db.commit()
        print(f"Seeded: {db.query(User).count()} users, {db.query(University).count()} universities, {db.query(Program).count()} programs, "
              f"{db.query(Application).count()} applications, {db.query(Document).count()} documents, {db.query(Task).count()} tasks.")
        print(f"Demo password for all demo accounts: {DEMO_PASSWORD}")


if __name__ == "__main__":
    main()
