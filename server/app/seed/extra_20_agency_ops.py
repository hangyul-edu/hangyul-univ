"""Agency operations demo data (V3): organization message templates (en + ko) and example saved views."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import MessageTemplate, OrganizationMember, SavedView, User

TEMPLATES = [
    ("DOCUMENT_CORRECTION", "Clearer scan needed",
     "Hi {{student_name}}, thanks for uploading your {{document}}. Some parts are hard to read. Could you upload a clearer scan — all pages, "
     "flat, with every corner visible? A phone scan app works well.",
     "명확한 스캔본 필요",
     "{{student_name}}님, {{document}}를 올려 주셔서 감사합니다. 일부 내용을 알아보기 어렵습니다. 모든 페이지가 잘리지 않고 반듯하게 보이도록 "
     "다시 스캔해 올려 주시겠어요? 휴대폰 스캔 앱을 쓰시면 편합니다."),
    ("APOSTILLE", "Apostille needed",
     "Hi {{student_name}}, {{university}} needs your {{document}} with an apostille before we can submit. Open the document in Hangyul Univ "
     "to see the exact steps for your country — we'll check it as soon as you upload the apostilled copy.",
     "아포스티유 필요",
     "{{student_name}}님, {{university}} 지원서를 제출하려면 {{document}}에 아포스티유가 필요합니다. 한결 유니브에서 서류를 열면 "
     "국가별 절차를 확인할 수 있습니다. 아포스티유 받은 사본을 올려 주시면 바로 확인하겠습니다."),
    ("ESSAY_FEEDBACK", "Study plan — next draft",
     "Hi {{student_name}}, I left comments on your study plan. The structure works; the next draft should say more specifically why this "
     "program fits your goals. Keep it in your own words.",
     "학업계획서 — 다음 초안",
     "{{student_name}}님, 학업계획서에 코멘트를 남겼습니다. 구성은 좋습니다. 다음 초안에서는 이 전공이 목표와 왜 맞는지 더 구체적으로 "
     "적어 주세요. 표현은 꼭 본인의 말로 써 주세요."),
    ("DEADLINE_REMINDER", "Deadline reminder",
     "Hi {{student_name}}, a quick reminder: the {{university}} application closes on {{deadline}}. Let's finish the remaining items this week.",
     "마감 안내",
     "{{student_name}}님, {{university}} 지원 마감은 {{deadline}}입니다. 남은 항목을 이번 주 안에 함께 마무리해요."),
    ("UNIVERSITY_REQUEST", "The university asked for a document",
     "Hi {{student_name}}, {{university}} asked for one more document: {{document}}. It's in your checklist now. Upload it when you can "
     "and we'll send it on.",
     "대학의 추가 서류 요청",
     "{{student_name}}님, {{university}}에서 추가 서류({{document}})를 요청했습니다. 체크리스트에 추가해 두었으니 준비되는 대로 "
     "올려 주세요. 저희가 대학에 전달하겠습니다."),
    ("VISA_REMINDER", "Visa: bank certificate timing",
     "Hi {{student_name}}, for your visa the bank balance certificate must be recent when you apply. Please request it close to your "
     "appointment date, not now.",
     "비자: 잔고증명서 발급 시기",
     "{{student_name}}님, 비자 신청 시 잔고증명서는 최근 발급분이어야 합니다. 지금 말고 신청일 가까이에 발급받아 주세요."),
]


def seed(db: Session, ctx: dict) -> None:
    for org in ctx["agencies"].values():
        for kind, t_en, b_en, t_ko, b_ko in TEMPLATES:
            db.add(MessageTemplate(organization_id=org.id, owner_user_id=None, scope="ORG", kind=kind, title=t_en, body=b_en, locale="en"))
            db.add(MessageTemplate(organization_id=org.id, owner_user_id=None, scope="ORG", kind=kind, title=t_ko, body=b_ko, locale="ko"))
        manager = db.scalar(select(OrganizationMember.user_id).join(User, User.id == OrganizationMember.user_id).where(OrganizationMember.organization_id == org.id,
                                                                     User.email.like("manager@%")))
        if manager:
            db.add(SavedView(organization_id=org.id, owner_user_id=manager, scope="TEAM", name="Vietnam · deadline in 14 days · documents missing",
                             filters={"nationality": ["VN"], "deadline_within_days": 14, "missing_documents": True}, sort="deadline"))
            db.add(SavedView(organization_id=org.id, owner_user_id=manager, scope="PERSONAL", name="Waiting for us, oldest first",
                             filters={"waiting_on": "us"}, sort="activity"))
