"""V9 agency + Hangyul operations demo data (REPORT §59 A4, A5, A7, A8, A12). Idempotent: ``apply(db)`` also runs against
the live development database (server/scripts/v9_agency_data.py).

* Team: per-person countries, universities, degree levels and fields (taken from the person's own caseload — what they
  actually work on), a personal capacity in load points, and one person on leave (Lotus reviewer, back in a week).
* Templates: every organisation template gets a language-group key; payment, arrival and housing kinds (en + ko) for every
  agency; Vietnamese variants of all Lotus Bridge templates; one TEAM and one PERSONAL template at Lotus. The Korean brand
  in older template text is corrected to 한귤.
* Submissions: two Lotus guided submissions in flight — one handed off four days ago with no reference yet ("confirmation
  missing"), one reported submitted yesterday without a reference ("submitted, awaiting evidence") — created through the
  real submission service, then back-dated.
* Meetings: one closed consultation for the main demo student with notes, decisions, follow-ups and the next appointment.
* Identity: Lotus Bridge's legal name. Registrations stay NOT_RECORDED — no real registration exists for demo agencies.
"""
from __future__ import annotations

from collections import Counter
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    AgencyAssignment,
    Application,
    MessageTemplate,
    Organization,
    OrganizationMember,
    Program,
    StudentProfile,
    Task,
    University,
    User,
)
from app.models.base import utcnow
from app.models.enums import ApplicationStatus as S
from app.models.enums import OrgType, TaskType
from app.models.student import Appointment

LOTUS = "lotus-bridge"
NEW_KINDS = [
    ("PAYMENT", "payment_direct",
     "Payment: pay the university directly",
     "Hi {{student_name}}, when you pay {{university}}, transfer the money directly to the university's own account shown on the invoice, "
     "in your name (or your parent's). Please don't pay through a money changer or another person — the university may not be able to "
     "match the payment. Send us the receipt once it's done.",
     "납부 안내: 대학에 직접 납부",
     "{{student_name}}님, {{university}}에 납부하실 때는 고지서에 적힌 대학 계좌로 본인(또는 부모님) 명의로 직접 송금해 주세요. 환전상이나 "
     "다른 사람을 통해 보내면 대학에서 입금을 확인하지 못할 수 있습니다. 납부 후 영수증을 보내 주세요."),
    ("ARRIVAL", "arrival_first_days",
     "Arrival: your first days in Korea",
     "Hi {{student_name}}, before you fly: add your flight number in the app so we can confirm your pickup, keep your passport, admission "
     "letter and visa in your hand luggage, and plan to apply for your residence card within 90 days of arrival. We'll go through the rest together.",
     "입국 안내: 한국에서의 첫날",
     "{{student_name}}님, 출국 전에 앱에 항공편 번호를 입력해 주시면 픽업을 확정해 드립니다. 여권, 입학허가서, 비자는 기내 수하물에 넣어 두시고, "
     "입국 후 90일 이내에 외국인등록을 신청해야 한다는 점을 기억해 주세요. 나머지는 함께 준비해요."),
    ("HOUSING", "housing_dorm_or_room",
     "Housing: dormitory or a room nearby",
     "Hi {{student_name}}, {{university}}'s dormitory application has its own deadline and places are limited. Apply as soon as it opens. "
     "If you don't get a place, we'll help you compare rooms near campus — always check the contract with us before you pay a deposit.",
     "주거 안내: 기숙사 또는 학교 근처 방",
     "{{student_name}}님, {{university}} 기숙사 신청은 별도 마감이 있고 자리가 한정되어 있습니다. 신청이 열리면 바로 신청해 주세요. 배정을 받지 "
     "못하면 학교 근처 방을 함께 비교해 드릴게요. 보증금을 보내기 전에 계약서는 꼭 저희와 함께 확인해 주세요."),
]
# Group keys for the V3 organisation templates (one per kind).
GROUP_OF_KIND = {"DOCUMENT_CORRECTION": "doc_clearer_scan", "APOSTILLE": "apostille_needed", "ESSAY_FEEDBACK": "study_plan_next_draft",
                 "DEADLINE_REMINDER": "deadline_reminder", "UNIVERSITY_REQUEST": "university_extra_document", "VISA_REMINDER": "visa_bank_certificate"}
# Natural Vietnamese for every Lotus Bridge organisation template (by group key).
VI = {
    "doc_clearer_scan": ("Cần bản scan rõ hơn",
                         "Chào {{student_name}}, cảm ơn bạn đã tải lên {{document}}. Một vài chỗ hơi khó đọc. Bạn tải lại giúp mình bản scan rõ hơn "
                         "nhé — đủ tất cả các trang, đặt phẳng và thấy rõ cả bốn góc. Dùng ứng dụng scan trên điện thoại là được."),
    "apostille_needed": ("Cần chứng nhận Apostille",
                         "Chào {{student_name}}, {{university}} yêu cầu {{document}} của bạn phải có chứng nhận Apostille trước khi nộp hồ sơ. "
                         "Bạn mở giấy tờ này trong Hangyul Univ để xem đúng các bước cho Việt Nam nhé — khi bạn tải bản đã có Apostille lên, "
                         "mình sẽ kiểm tra ngay."),
    "study_plan_next_draft": ("Kế hoạch học tập — bản nháp tiếp theo",
                              "Chào {{student_name}}, mình đã để lại nhận xét trong kế hoạch học tập của bạn. Bố cục đã ổn; ở bản nháp tiếp theo, "
                              "bạn hãy nói cụ thể hơn vì sao chương trình này phù hợp với mục tiêu của bạn. Nhớ viết bằng lời văn của chính bạn nhé."),
    "deadline_reminder": ("Nhắc hạn nộp hồ sơ",
                          "Chào {{student_name}}, mình nhắc nhanh: hồ sơ vào {{university}} sẽ đóng vào ngày {{deadline}}. Mình cùng hoàn thành "
                          "các mục còn lại trong tuần này nhé."),
    "university_extra_document": ("Trường yêu cầu bổ sung giấy tờ",
                                  "Chào {{student_name}}, {{university}} vừa yêu cầu bổ sung một giấy tờ: {{document}}. Mục này đã có trong danh sách "
                                  "của bạn. Khi nào có, bạn tải lên giúp mình, mình sẽ chuyển cho trường."),
    "visa_bank_certificate": ("Visa: thời điểm xin giấy xác nhận số dư",
                              "Chào {{student_name}}, khi nộp hồ sơ visa, giấy xác nhận số dư ngân hàng phải được cấp gần ngày nộp. Bạn hãy xin giấy "
                              "này sát ngày hẹn nộp hồ sơ, đừng xin ngay bây giờ nhé."),
    "payment_direct": ("Thanh toán: chuyển thẳng cho trường",
                       "Chào {{student_name}}, khi đóng tiền cho {{university}}, bạn chuyển khoản trực tiếp vào tài khoản của trường ghi trên hóa đơn, "
                       "đứng tên bạn (hoặc bố mẹ bạn). Đừng chuyển qua dịch vụ đổi tiền hay nhờ người khác chuyển giúp — trường có thể không đối chiếu "
                       "được khoản tiền. Chuyển xong bạn gửi biên lai cho mình nhé."),
    "arrival_first_days": ("Nhập cảnh: những ngày đầu ở Hàn Quốc",
                           "Chào {{student_name}}, trước khi bay, bạn nhập số hiệu chuyến bay vào ứng dụng để mình xác nhận lịch đón nhé. Hãy để hộ chiếu, "
                           "giấy báo nhập học và visa trong hành lý xách tay, và nhớ đăng ký thẻ cư trú người nước ngoài trong vòng 90 ngày sau khi nhập "
                           "cảnh. Những việc còn lại mình sẽ cùng chuẩn bị."),
    "housing_dorm_or_room": ("Chỗ ở: ký túc xá hay phòng gần trường",
                             "Chào {{student_name}}, ký túc xá của {{university}} có hạn đăng ký riêng và số chỗ có hạn. Khi mở đăng ký, bạn nộp ngay nhé. "
                             "Nếu không có chỗ, mình sẽ giúp bạn so sánh các phòng gần trường — trước khi chuyển tiền đặt cọc, nhớ cùng mình xem kỹ hợp đồng."),
}
TEAM_TEMPLATE = ("GENERAL", "check_in",
                 ("Quick check-in", "Hi {{student_name}}, just checking in — is anything blocking you this week? Reply here and I'll help. — {{counselor_name}}"),
                 ("Hỏi thăm nhanh", "Chào {{student_name}}, mình hỏi thăm chút — tuần này có việc gì làm bạn bị vướng không? Bạn trả lời ở đây, "
                                    "mình sẽ hỗ trợ ngay. — {{counselor_name}}"))
PERSONAL_TEMPLATE = ("GENERAL", "meeting_reminder",
                     ("Nhắc lịch tư vấn", "Chào {{student_name}}, mình nhắc bạn lịch tư vấn sắp tới với mình. Nếu cần đổi giờ, bạn nhắn ở đây nhé."))
CAPACITY = {"counselor": 32, "counselor2": 32, "manager": 20, "owner": 10, "reviewer": 30}  # by e-mail prefix (V22: one role)


def _templates(db: Session) -> None:
    agencies = db.scalars(select(Organization).where(Organization.type == OrgType.AGENCY)).all()
    for t in db.scalars(select(MessageTemplate).where(MessageTemplate.scope == "ORG", MessageTemplate.group_key.is_(None))).all():
        t.group_key = GROUP_OF_KIND.get(t.kind)
    for t in db.scalars(select(MessageTemplate).where(MessageTemplate.locale == "ko", MessageTemplate.body.contains("한결"))).all():
        t.body = t.body.replace("한결", "한귤")
    for org in agencies:
        have = {(t.group_key, t.locale) for t in db.scalars(select(MessageTemplate).where(MessageTemplate.organization_id == org.id,
                                                                                        MessageTemplate.scope == "ORG")).all()}
        for kind, group, t_en, b_en, t_ko, b_ko in NEW_KINDS:
            for loc, title, body in (("en", t_en, b_en), ("ko", t_ko, b_ko)):
                if (group, loc) not in have:
                    db.add(MessageTemplate(organization_id=org.id, owner_user_id=None, scope="ORG", kind=kind, title=title, body=body, locale=loc,
                                           group_key=group))
        if org.slug != LOTUS:
            continue
        kinds = {g: k for k, g in GROUP_OF_KIND.items()} | {g: k for k, g, *_ in NEW_KINDS}
        for group, (title, body) in VI.items():
            if (group, "vi") not in have:
                db.add(MessageTemplate(organization_id=org.id, owner_user_id=None, scope="ORG", kind=kinds[group], title=title, body=body, locale="vi",
                                       group_key=group))
        counselor = db.scalar(select(User.id).where(User.email == "counselor@lotus.demo.hangyul.kr"))
        if counselor and not db.scalar(select(MessageTemplate.id).where(MessageTemplate.organization_id == org.id, MessageTemplate.group_key == TEAM_TEMPLATE[1])):
            kind, group, en, vi = TEAM_TEMPLATE
            db.add(MessageTemplate(organization_id=org.id, owner_user_id=counselor, scope="TEAM", kind=kind, title=en[0], body=en[1], locale="en", group_key=group))
            db.add(MessageTemplate(organization_id=org.id, owner_user_id=counselor, scope="TEAM", kind=kind, title=vi[0], body=vi[1], locale="vi", group_key=group))
        if counselor and not db.scalar(select(MessageTemplate.id).where(MessageTemplate.organization_id == org.id, MessageTemplate.group_key == PERSONAL_TEMPLATE[1])):
            kind, group, vi = PERSONAL_TEMPLATE
            db.add(MessageTemplate(organization_id=org.id, owner_user_id=counselor, scope="PERSONAL", kind=kind, title=vi[0], body=vi[1], locale="vi",
                                   group_key=group))


def _team(db: Session) -> None:
    today = utcnow().date()
    for org in db.scalars(select(Organization).where(Organization.type == OrgType.AGENCY)).all():
        members = db.scalars(select(OrganizationMember).where(OrganizationMember.organization_id == org.id)).all()
        for m in members:
            if m.capacity_points is None:
                m.capacity_points = CAPACITY.get(m.user.email.split("@")[0])
            if m.countries is not None:
                continue
            sids = list(db.scalars(select(AgencyAssignment.student_user_id).where(AgencyAssignment.organization_id == org.id,
                                                                                    AgencyAssignment.counselor_user_id == m.user_id)).all())
            if not sids:  # people without a caseload: the agency's market
                sids = list(db.scalars(select(AgencyAssignment.student_user_id).where(AgencyAssignment.organization_id == org.id)).all())
            nat = Counter(n for n in db.scalars(select(StudentProfile.nationality).where(StudentProfile.user_id.in_(sids))).all() if n)
            apps = db.execute(select(Application.university_id, Program.degree_level, Program.field).join(Program, Program.id == Application.program_id)
                              .where(Application.student_user_id.in_(sids))).all() if sids else []
            m.countries = [c for c, _n in nat.most_common(3)] or ([org.country_code] if org.country_code else [])
            m.university_ids = [str(u) for u, _n in Counter(a[0] for a in apps).most_common(3)]
            m.degrees = sorted({a[1].value for a in apps}) or ["BACHELOR"]
            m.majors = [f for f, _n in Counter(a[2] for a in apps).most_common(3)]
        if org.slug == LOTUS:
            org.legal_name = org.legal_name or "Lotus Bridge Education Co., Ltd."
            rev = next((m for m in members if m.user.email.startswith("reviewer@")), None)
            if rev and rev.on_leave_until is None:
                rev.on_leave_until, rev.leave_note = today + timedelta(days=7), "Annual leave"


def _submissions(db: Session) -> None:
    """Two Lotus guided submissions in flight, created through the submission service (so tasks and records are real)."""
    from app.models import ApplicationSubmission
    from app.services import submission
    from app.services.readiness import application_readiness

    org = db.scalar(select(Organization).where(Organization.slug == LOTUS))
    if org is None:
        return
    if db.scalar(select(ApplicationSubmission.id).join(Application, Application.id == ApplicationSubmission.application_id)
                 .where(Application.agency_org_id == org.id, ApplicationSubmission.status.in_(["HANDED_OFF", "SUBMITTED_UNCONFIRMED"]))):
        return  # already applied
    now = utcnow()
    picked, fallback = [], []
    for app in db.scalars(select(Application).where(Application.agency_org_id == org.id, Application.status == S.READY)
                          .order_by(Application.created_at)).all():
        conn = submission.connector_for(db, app)
        if not conn.can_student_handoff():
            continue
        prof = db.scalar(select(StudentProfile).where(StudentProfile.user_id == app.student_user_id))
        _pct, items = application_readiness(db, app, prof, now.date())
        if any(i["required"] and not i["ready"] for i in items):
            # V27: a real official guide (e.g. Pusan National 2027) asks for more than the seeded persona holds. The
            # scenario here is the *submission-tracking* states, so a READY application is still a valid stand-in.
            fallback.append(app)
            continue
        picked.append(app)
        if len(picked) == 2:
            break
    picked = (picked + fallback)[:2]
    counselor = db.scalar(select(User.id).where(User.email == "counselor@lotus.demo.hangyul.kr"))
    if picked:
        rec = submission.handoff(db, picked[0], counselor)
        rec.handed_off_at = now - timedelta(days=4, hours=3)
    if len(picked) > 1:
        rec = submission.handoff(db, picked[1], counselor)
        rec.handed_off_at = now - timedelta(days=1, hours=6)
        rec = submission.record_confirmation(db, picked[1], actor_id=picked[1].student_user_id, actor_role="STUDENT", external_reference=None,
                                             submitted_on=(now - timedelta(days=1)).date())
        rec.recorded_at = now - timedelta(days=1)
    db.flush()


def _meeting(db: Session) -> None:
    stu = db.scalar(select(User).where(User.email == "student@demo.hangyul.kr"))
    host = db.scalar(select(User).where(User.email == "counselor@lotus.demo.hangyul.kr"))
    if not stu or not host or db.scalar(select(Appointment.id).where(Appointment.student_user_id == stu.id, Appointment.decisions.is_not(None))):
        return
    org = db.scalar(select(Organization).where(Organization.slug == LOTUS))
    now = utcnow()
    app = db.scalar(select(Application).where(Application.student_user_id == stu.id).order_by(Application.created_at))
    a = Appointment(student_user_id=stu.id, organization_id=org.id if org else None, host_user_id=host.id, application_id=app.id if app else None,
                    kind="CONSULTATION", starts_at=now - timedelta(days=3, hours=2), duration_minutes=30, channel="VIDEO", status="COMPLETED",
                    notes="Plan the last documents before the deadline.",
                    outcome_notes="Went through the checklist together. The bank certificate stays for later (visa stage). Study plan: second draft next.",
                    decisions=["Apply to the first-choice program in this intake", "Request the bank certificate only after the admission letter"],
                    closed_at=now - timedelta(days=3), closed_by_user_id=host.id)
    db.add(a)
    db.flush()
    tasks = [Task(title="Send the study plan feedback summary", title_key="task.sendStudyPlanFeedback", task_type=TaskType.CONSULTATION, owner_user_id=host.id, owner_org_id=org.id if org else None,
                  student_user_id=stu.id, application_id=a.application_id, due_at=now + timedelta(days=2), source="MANUAL", created_by_id=host.id,
                  link=f"/students/{stu.id}?tab=tasks"),
             Task(title="Upload the second draft of your study plan",
                  # V24: keyed, so the student reads it in their own language (REPORT §290 V24-4)
                  title_key="task.reviseEssay", title_params={"essayType": "STUDY_PLAN", "university": (db.scalar(select(University.name_en).where(University.id == app.university_id)) if app else None) or "", "university_id": str(app.university_id) if app else None},
                  task_type=TaskType.CONSULTATION, owner_user_id=None, owner_org_id=org.id if org else None,
                  student_user_id=stu.id, application_id=a.application_id, due_at=now + timedelta(days=5), source="MANUAL", visible_to_student=True,
                  created_by_id=host.id, link="/essays")]
    for t in tasks:
        db.add(t)
    db.flush()
    nxt = Appointment(student_user_id=stu.id, organization_id=org.id if org else None, host_user_id=host.id, application_id=a.application_id,
                      kind="CONSULTATION", starts_at=(now + timedelta(days=6)).replace(hour=2, minute=0, second=0, microsecond=0), duration_minutes=30,
                      channel="VIDEO")
    db.add(nxt)
    db.flush()
    a.follow_up_task_id = tasks[0].id
    a.follow_up_task_ids = [str(t.id) for t in tasks]
    a.next_appointment_id = nxt.id


def apply(db: Session) -> None:
    _team(db)
    _templates(db)
    _submissions(db)
    _meeting(db)
    db.flush()


def seed(db: Session, ctx: dict) -> None:
    apply(db)

