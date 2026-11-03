"""V5 writing review demo data (fictional sample data, ``is_demo=True``).

* Hangyul default rubric (16 dimensions) and review-time policy (first review 48 h, revision 48 h, final review 24 h).
* A Hangyul writing specialist, ``writing@demo.hangyul.kr`` (HANGYUL_COUNSELOR), plus reviewer profiles (languages,
  degrees, fields, countries, capacity) for every agency counselor / document reviewer — reviewer matching uses them.
* Essay prompts for the demo programs, labelled **SAMPLE**: the wording is written by Hangyul for the demo and is NOT
  the university's official question (no source link, never verified). Pusan National University's BBA personal
  statement has two versions (2026 Fall → 2027 Spring) to show intake versioning. Pusan's Media and Communication
  personal statement deliberately has no prompt ("We don't have this university's exact question yet").
* Review state for every essay: rounds, submission times, expected review times, events; approved essays record their
  approved version (the application uses it). Lotus Bridge demo cases:
  - Lan's Kyungpook personal statement: first review in progress (due within 48 h), rubric partly rated, a Hangyul
    second-read comment, and a real fact-check finding ("At university I studied…" — her profile lists high school).
  - student06: personal statement submitted 3 days ago → overdue → reviewer task + manager escalation (the SLA sweep).
  - student09: personal statement revised and resubmitted (round 2); study plan in final review (quality gate).
* Historical approved essays get review events before their application's submission, then ``record_outcomes`` links
  them to decided applications for the internal "Patterns" section (n per group, n<5 withheld).
"""
from __future__ import annotations

import random
from datetime import timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    AgencyAssignment,
    Application,
    Essay,
    EssayComment,
    EssayVersion,
    Organization,
    OrganizationMember,
    Program,
    ReviewerProfile,
    ReviewRubric,
    RubricScore,
    University,
    User,
    WritingEvent,
    WritingPolicy,
    WritingPrompt,
)
from app.models.enums import AssignmentStatus, EssayStatus, EssayType, OrgType, Role
from app.seed.run import NOW
from app.services import writing as W

E = EssayStatus
KEY_DIMS = ("ANSWERS_PROMPT", "MOTIVATION", "PROGRAM_CONNECTION", "FUTURE_PLAN")

PS_PROMPT = ("Describe your motivation for applying to the {program} program at {university}, how your academic background "
             "has prepared you, and your study and career plans.")
PS_PROMPT_V2 = ("Why do you want to study {program} at {university}? Explain how your previous studies connect to this program. "
                "What do you plan to do during your studies and after graduation?")
SP_PROMPT = ("Present your study plan for the degree period at {university}, including the courses you want to take, "
             "your Korean language goals, and your plans after graduation.")
SAMPLE_NOTE = "Drafted by Hangyul — not the university's official wording. Confirm the real question before approval."

OVERDUE_BODY = """I first became interested in {field} when I helped my aunt run the accounts of her small tailoring business in Da Nang. Every month I entered her sales into a spreadsheet, and after a year I noticed that her best customers came from word of mouth rather than from the flyers she paid for.

In high school I chose economics as my elective and wrote a short report comparing two local markets. My teacher encouraged me to present it at our school's student conference, which was the first time I spoke in front of more than a hundred people.

I am applying to {university} because I want to learn how companies measure what really works. I also visited the campus of {other} during a summer language course and liked the atmosphere there.

After my studies I would like to return to Vietnam and help family businesses use data to make better decisions."""

REVISED_V2 = """My interest in {field} started in my family's pharmacy. I kept the stock records during school holidays and learned which medicines ran out before the rainy season.

I studied hard and I want to study at a good university in Korea. Korea is a developed country and I want to broaden my horizons."""

REVISED_V3 = """My interest in {field} started in my family's pharmacy in Can Tho. During school holidays I kept the stock records, and I noticed that cough medicine ran out every year two weeks before the rainy season. When I showed my father a simple chart, he started ordering earlier, and that season we did not run out once.

At {university}, the {program} program's courses on operations and data analysis would teach me the methods behind what I did by instinct. I have finished TOPIK preparation classes and plan to take the exam again before the semester starts.

During my studies I want to join a student consulting club and work on projects with local shops. After graduating, I plan to work for a distribution company that supplies pharmacies in the Mekong Delta."""

FINAL_SP = """Year 1: I will focus on the core courses of the {program} program and on Korean. I plan to take Korean for academic purposes in both semesters and reach TOPIK level 5 by the end of the year.

Year 2: I will take the statistics and research methods courses and join a study group. In the summer I want to apply for a short internship with a company that works between Korea and Vietnam.

Years 3–4: I will choose electives related to international business and write my graduation project about how Vietnamese brands enter the Korean market.

After graduation I plan to work in Korea for two to three years to gain experience, and then return to Vietnam to work in market entry for Korean companies."""


def _uni_prog(db: Session, e: Essay):
    t = W.essay_target(db, e)
    return t["university"], t["program"], t["intake"]


def seed(db: Session, ctx: dict[str, Any]) -> None:
    rng = random.Random(5252)

    # ---- rubric + policy (Hangyul defaults)
    db.add(ReviewRubric(organization_id=None, name="Hangyul admissions writing rubric", dimensions=W.DEFAULT_DIMENSIONS, is_demo=True))
    db.add(WritingPolicy(organization_id=None, first_review_hours=48, revision_review_hours=48, final_review_hours=24))

    # ---- Hangyul writing specialist
    from app.seed import fixtures as R

    hangyul = ctx.get("hangyul") or db.scalar(select(Organization).where(Organization.type == OrgType.HANGYUL))
    writer = R.make_user(db, "writing@demo.hangyul.kr", "Yoo Ha-neul", locale="ko", roles=[Role.HANGYUL_COUNSELOR])
    db.add(OrganizationMember(organization_id=hangyul.id, user_id=writer.id, role=Role.HANGYUL_COUNSELOR, title="Writing specialist", languages=["ko", "en"]))
    db.add(ReviewerProfile(user_id=writer.id, organization_id=hangyul.id, languages=["ko", "en", "vi"], degrees=["BACHELOR", "MASTER"],
                           fields=["business", "media_communication", "international_studies"], countries=["VN", "UZ", "MN"], capacity=25, is_demo=True))

    # ---- reviewer profiles for agency teams (from the agency's own specialties)
    for org in db.scalars(select(Organization).where(Organization.type == OrgType.AGENCY)).all():
        degrees = [s.value for s in org.specialties if s.kind == "DEGREE"]
        countries = [s.value for s in org.specialties if s.kind == "COUNTRY"]
        langs = list(dict.fromkeys([*(org.languages or []), "en"]))
        for m in db.scalars(select(OrganizationMember).where(OrganizationMember.organization_id == org.id)).all():
            if m.user.email.split("@")[0] not in ("counselor", "counselor2", "reviewer", "manager"):
                continue
            reviewer = m.user.email.startswith("reviewer@")
            db.add(ReviewerProfile(user_id=m.user_id, organization_id=org.id, languages=langs + (["ko"] if reviewer else []),
                                   degrees=degrees, fields=["business", "computer_science"] if reviewer else [], countries=countries,
                                   capacity=20 if reviewer else 12, is_demo=True))
    db.flush()

    # ---- SAMPLE prompts for the demo programs (program-specific, effective from 2026 Fall)
    essays = db.scalars(select(Essay)).all()
    prog_ids = {e.program_id for e in essays if e.program_id}
    pnu = db.scalar(select(University).where(University.slug == "pusan-national-university"))
    for prog in db.scalars(select(Program).where(Program.id.in_(prog_ids))).all():
        if prog.degree_level.value == "LANGUAGE":
            continue
        uni = db.get(University, prog.university_id)
        fmt = {"program": prog.name_en, "university": uni.name_en, "university_id": str(uni.id)}
        pnu_bba = uni.id == pnu.id and "Business" in prog.name_en
        pnu_media = uni.id == pnu.id and "Media" in prog.name_en
        if not pnu_media:
            v1 = WritingPrompt(university_id=uni.id, program_id=prog.id, essay_type="PERSONAL_STATEMENT", effective_from_year=2026, effective_from_term="FALL",
                               prompt_text=PS_PROMPT.format(**fmt), prompt_language="en", word_limit=1000, required_language="en",
                               verification_status="SAMPLE", version=1, note=SAMPLE_NOTE, is_demo=True)
            db.add(v1)
            if pnu_bba:
                db.flush()
                v2 = WritingPrompt(university_id=uni.id, program_id=prog.id, essay_type="PERSONAL_STATEMENT", effective_from_year=2027, effective_from_term="SPRING",
                                   prompt_text=PS_PROMPT_V2.format(**fmt), prompt_language="en", word_limit=800, required_language="en",
                                   verification_status="SAMPLE", version=2, note=SAMPLE_NOTE, is_demo=True)
                db.add(v2)
                db.flush()
                v1.superseded_by_id = v2.id
        db.add(WritingPrompt(university_id=uni.id, program_id=prog.id, essay_type="STUDY_PLAN", effective_from_year=2026, effective_from_term="FALL",
                             prompt_text=SP_PROMPT.format(**fmt), prompt_language="en", word_limit=1500, required_language="en",
                             verification_status="SAMPLE", version=1, note=SAMPLE_NOTE, is_demo=True))
    db.flush()

    # ---- review records for every essay
    for e in essays:
        # The core seed copied one generic sentence into every essay as its "prompt"; the university's question now
        # comes from a (versioned, labelled) WritingPrompt, so the unsourced copy is removed.
        e.prompt = None
        r = W.review_for(db, e)  # get-or-create (a running API may already have created an empty record)
        r.is_demo = True
        W.ensure_prompt(db, e, r)
        app = db.get(Application, e.application_id) if e.application_id else None
        org_id = app.agency_org_id if app else None
        if e.status == E.APPROVED:
            rounds = rng.choice([1, 1, 2, 2, 2, 3])
            end = (app.submitted_at - timedelta(days=rng.randint(2, 6))) if app and app.submitted_at else NOW - timedelta(days=rng.randint(3, 20))
            t = end - timedelta(days=4 * rounds)
            for rd in range(1, rounds + 1):
                hours = rng.randint(8, 60)
                late = hours > 48
                db.add(WritingEvent(essay_id=e.id, kind="SUBMITTED", round=rd, version=e.current_version, organization_id=org_id,
                                    due_at=t + timedelta(hours=48), at=t, is_demo=True))
                done = t + timedelta(hours=hours)
                kind = "APPROVED" if rd == rounds else "REVIEWED"
                db.add(WritingEvent(essay_id=e.id, kind=kind, round=rd, version=e.current_version, actor_user_id=e.reviewer_user_id, organization_id=org_id,
                                    due_at=t + timedelta(hours=48), detail={"hours": float(hours), "late": late}, at=done, is_demo=True))
                if late:
                    r.sla_breaches += 1
                t = done + timedelta(days=2)
            r.review_round, r.first_submitted_at = rounds, end - timedelta(days=4 * rounds)
            r.approved_version, r.approved_at, r.approved_by_id = e.current_version, t - timedelta(days=2), e.reviewer_user_id
            r.assigned_by = "ENGINE"
            for d in KEY_DIMS:
                db.add(RubricScore(essay_id=e.id, dimension=d, rating="MEETS", version=e.current_version, reviewer_user_id=e.reviewer_user_id))
        elif e.status in (E.AGENCY_REVIEW, E.SUBMITTED, E.AI_PRECHECK):
            submitted = NOW - timedelta(hours=rng.randint(3, 20))
            r.review_round, r.submitted_at, r.first_submitted_at = 1, submitted, submitted
            r.expected_review_by = submitted + timedelta(hours=48)
            r.assigned_by = "ENGINE"
            db.add(WritingEvent(essay_id=e.id, kind="SUBMITTED", round=1, version=e.current_version, organization_id=org_id,
                                due_at=r.expected_review_by, at=submitted, is_demo=True))
        elif e.status in (E.CHANGES_REQUESTED, E.STUDENT_REVISION):
            submitted = NOW - timedelta(days=rng.randint(4, 8))
            reviewed = submitted + timedelta(hours=rng.randint(10, 40))
            r.review_round, r.submitted_at, r.first_submitted_at, r.last_reviewed_at = 1, submitted, submitted, reviewed
            r.assigned_by = "ENGINE"
            db.add(WritingEvent(essay_id=e.id, kind="SUBMITTED", round=1, version=e.current_version, organization_id=org_id,
                                due_at=submitted + timedelta(hours=48), at=submitted, is_demo=True))
            db.add(WritingEvent(essay_id=e.id, kind="REVIEWED", round=1, version=e.current_version, actor_user_id=e.reviewer_user_id, organization_id=org_id,
                                due_at=submitted + timedelta(hours=48), detail={"hours": round((reviewed - submitted).total_seconds() / 3600, 1), "late": False},
                                at=reviewed, is_demo=True))
    db.flush()
    for e in essays:  # explainable reasons for the reviewer already on the essay
        r = W.review_for(db, e)
        if e.reviewer_user_id and r.assigned_by:
            cand = next((c for c in W.reviewer_candidates(db, e) if c["user"]["id"] == str(e.reviewer_user_id)), None)
            r.assignment_reasons = cand["reasons"] if cand else []

    # ---- Lotus Bridge demo cases
    lan = db.scalar(select(User).where(User.email == "student@demo.hangyul.kr"))
    knu = db.scalar(select(University).where(University.slug == "kyungpook-national-university"))
    lan_ps = next((e for e in essays if e.owner_user_id == lan.id and e.essay_type == EssayType.PERSONAL_STATEMENT and e.status == E.AGENCY_REVIEW
                   and _uni_prog(db, e)[0] is not None and _uni_prog(db, e)[0].id == knu.id), None) if lan and knu else None
    if lan_ps:
        r = W.review_for(db, lan_ps)
        r.submitted_at = r.first_submitted_at = NOW - timedelta(hours=26)
        r.expected_review_by = r.submitted_at + timedelta(hours=48)
        for ev in db.scalars(select(WritingEvent).where(WritingEvent.essay_id == lan_ps.id)):
            ev.at, ev.due_at = r.submitted_at, r.expected_review_by
        body = W.latest_body(lan_ps)
        q = "I hope to work between the two markets"
        db.add(EssayComment(essay_id=lan_ps.id, version=lan_ps.current_version, author_user_id=writer.id, quote=q,
                            anchor_start=body.find(q) if q in body else None, anchor_end=(body.find(q) + len(q)) if q in body else None,
                            body="Hangyul second read: this is your key sentence. Say which kind of role you mean and how this program prepares you for it.",
                            created_at=NOW - timedelta(hours=17)))
        rev = lan_ps.reviewer_user_id
        for dim, rating, note in (("ANSWERS_PROMPT", "MEETS", None), ("MOTIVATION", "MEETS", None),
                                  ("PROGRAM_CONNECTION", "NEEDS_WORK", "Connects to Korea in general, not to Kyungpook's BBA. Ask her which course or track she wants and why."),
                                  ("EVIDENCE", "NEEDS_WORK", "The SME project needs one concrete result.")):
            db.add(RubricScore(essay_id=lan_ps.id, dimension=dim, rating=rating, note=note, version=lan_ps.current_version, reviewer_user_id=rev))

    lotus = db.scalar(select(Organization).where(Organization.slug == "lotus-bridge"))
    if lotus:
        members = {u.email: u for u in db.scalars(select(User).join(AgencyAssignment, AgencyAssignment.student_user_id == User.id)
                                                  .where(AgencyAssignment.organization_id == lotus.id, AgencyAssignment.status == AssignmentStatus.ACTIVE))}
        plain = sorted([u for em, u in members.items() if not em.startswith("student@") and not em.startswith("student.")], key=lambda u: u.email)
        pool = [e for u in plain for e in sorted((x for x in essays if x.owner_user_id == u.id and x.status == E.AGENCY_REVIEW), key=lambda x: x.essay_type.value)]
        ps = [e for e in pool if e.essay_type == EssayType.PERSONAL_STATEMENT]
        sp = [e for e in pool if e.essay_type == EssayType.STUDY_PLAN]
        if ps:  # overdue first review → sweep creates the reviewer task + manager escalation
            e = ps[0]
            uni, prog, _ = _uni_prog(db, e)
            other = db.scalar(select(University).where(University.id != (uni.id if uni else None), University.slug == "yonsei-university")) or \
                db.scalar(select(University).where(University.id != (uni.id if uni else None)))
            body = OVERDUE_BODY.format(field=(prog.field.replace("_", " ") if prog else "business"), university=uni.name_en if uni else "the university",
                                       other=other.name_en)
            e.current_version += 1
            db.add(EssayVersion(essay_id=e.id, version=e.current_version, body=body, author_user_id=e.owner_user_id, note="Full draft", created_at=NOW - timedelta(days=3, hours=2)))
            r = W.review_for(db, e)
            r.submitted_at = r.first_submitted_at = NOW - timedelta(days=3)
            r.expected_review_by = r.submitted_at + timedelta(hours=48)
            for ev in db.scalars(select(WritingEvent).where(WritingEvent.essay_id == e.id)):
                ev.at, ev.due_at, ev.version = r.submitted_at, r.expected_review_by, e.current_version
        if len(ps) > 1:  # student revised → round 2
            e = ps[1]
            uni, prog, _ = _uni_prog(db, e)
            fmt = {"field": prog.field.replace("_", " ") if prog else "business", "university": uni.name_en if uni else "the university", "university_id": str(uni.id) if uni else None,
                   "program": prog.name_en if prog else "degree"}
            first = NOW - timedelta(days=6)
            v2 = db.scalar(select(EssayVersion).where(EssayVersion.essay_id == e.id, EssayVersion.version == e.current_version))
            if v2:
                v2.body, v2.created_at = REVISED_V2.format(**fmt), first - timedelta(hours=2)
            e.current_version += 1
            db.add(EssayVersion(essay_id=e.id, version=e.current_version, body=REVISED_V3.format(**fmt), author_user_id=e.owner_user_id,
                                note="Revised after comments", created_at=NOW - timedelta(hours=9)))
            reviewed = first + timedelta(hours=30)
            db.add(EssayComment(essay_id=e.id, version=e.current_version - 1, author_user_id=e.reviewer_user_id, quote="I want to broaden my horizons",
                                body="This could be written by anyone. What exactly did you see in the pharmacy that made you want to study this?",
                                resolved_at=NOW - timedelta(hours=9), resolved_by_id=e.owner_user_id, created_at=reviewed))
            r = W.review_for(db, e)
            for ev in list(db.scalars(select(WritingEvent).where(WritingEvent.essay_id == e.id))):
                db.delete(ev)
            org_id = lotus.id
            db.add(WritingEvent(essay_id=e.id, kind="SUBMITTED", round=1, version=e.current_version - 1, organization_id=org_id, due_at=first + timedelta(hours=48), at=first, is_demo=True))
            db.add(WritingEvent(essay_id=e.id, kind="REVIEWED", round=1, version=e.current_version - 1, actor_user_id=e.reviewer_user_id, organization_id=org_id,
                                due_at=first + timedelta(hours=48), detail={"hours": 30.0, "late": False}, at=reviewed, is_demo=True))
            r.review_round, r.first_submitted_at, r.last_reviewed_at = 2, first, reviewed
            r.submitted_at = NOW - timedelta(hours=8)
            r.expected_review_by = r.submitted_at + timedelta(hours=48)
            db.add(WritingEvent(essay_id=e.id, kind="SUBMITTED", round=2, version=e.current_version, organization_id=org_id, due_at=r.expected_review_by,
                                at=r.submitted_at, is_demo=True))
        if len(sp) > 1:  # final review with the gate almost clear
            e = sp[-1]
            uni, prog, _ = _uni_prog(db, e)
            e.current_version += 1
            db.add(EssayVersion(essay_id=e.id, version=e.current_version, body=FINAL_SP.format(program=prog.name_en if prog else "degree"),
                                author_user_id=e.owner_user_id, note="Final draft", created_at=NOW - timedelta(hours=14)))
            e.status = E.FINAL_REVIEW
            r = W.review_for(db, e)
            r.review_round, r.last_reviewed_at = 2, NOW - timedelta(hours=6)
            r.submitted_at = NOW - timedelta(hours=6)
            r.expected_review_by = r.submitted_at + timedelta(hours=24)
            db.add(WritingEvent(essay_id=e.id, kind="FINAL", round=2, version=e.current_version, actor_user_id=e.reviewer_user_id, organization_id=lotus.id,
                                due_at=r.expected_review_by, detail={"hours": 12.0, "late": False}, at=r.submitted_at, is_demo=True))
            for dim in KEY_DIMS:
                db.add(RubricScore(essay_id=e.id, dimension=dim, rating="MEETS", version=e.current_version, reviewer_user_id=e.reviewer_user_id))
    db.flush()

    # ---- automatic checks for everything a reviewer or student is working on
    for e in db.scalars(select(Essay).where(Essay.status.in_((E.AGENCY_REVIEW, E.FINAL_REVIEW, E.CHANGES_REQUESTED, E.STUDENT_REVISION, E.SUBMITTED)))).all():
        db.refresh(e)
        W.run_checks(db, e)
    W.sla_sweep(db)
    W.record_outcomes(db)
    db.flush()
