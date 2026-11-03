"""V9 agency + Hangyul operations strings (en + ko together), merged into packages/i18n/locales/{en,ko}/agency.json under `v9`.

    python3 scripts/i18n/v9-agency.py

Each section lives in its own dict so a page's strings stay together. Korean brand = 한귤. Other locales are filled by the
localization workstream (they fall back to English).
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2] / "packages" / "i18n" / "locales"

EN: dict = {}
KO: dict = {}


def section(name: str, en: dict, ko: dict) -> None:
    EN[name] = en
    KO[name] = ko


# ------------------------------------------------------------------------------------------- waiting model (A1)
section("waiting", {
    "party": {"counselor": "Counselor", "agency": "Agency team", "hangyul": "Hangyul", "student": "Student", "university": "University",
              "external": "Outside party", "none": "No one"},
    "on": {"counselor": "Waiting on a counselor", "agency": "Waiting on the agency team", "hangyul": "Waiting on Hangyul",
           "student": "Waiting on the student", "university": "Waiting on the university", "external": "Waiting on an outside party",
           "us": "Waiting on us (counselor or team)"},
    "title": "Waiting on",
    "reason": {
        "paid_no_agency": "paid, no agency assigned yet", "unassigned_case": "no counselor assigned", "first_contact": "first contact due",
        "reply_owed": "the student is waiting for a reply",
        "review_one": "{{count}} document to review", "review_other": "{{count}} documents to review",
        "review_unassigned_one": "{{count}} document to review · no reviewer", "review_unassigned_other": "{{count}} documents to review · no reviewer",
        "essay_review": "essay waiting for review", "essay_unassigned": "essay review · no reviewer",
        "task_one": "{{count}} overdue task", "task_other": "{{count}} overdue tasks",
        "task_unassigned_one": "{{count}} overdue task · no owner", "task_unassigned_other": "{{count}} overdue tasks · no owner",
        "submit": "authorised to submit", "profile_check": "profile check", "final_check": "final check before submission",
        "service": "service case", "service_unassigned": "service case · no owner", "payment_issue": "payment issue",
        "university_request": "university asked for a document",
        "fix_one": "{{count}} document to fix", "fix_other": "{{count}} documents to fix",
        "submit_on_portal": "to submit on the official portal",
        "student_task_one": "{{count}} task to do", "student_task_other": "{{count}} tasks to do",
        "rail_confirmation": "confirmation number missing", "visa_decision": "visa decision (embassy)", "provider": "provider to confirm",
    },
}, {
    "party": {"counselor": "담당 상담사", "agency": "에이전시 팀", "hangyul": "한귤", "student": "학생", "university": "대학", "external": "외부 기관",
              "none": "없음"},
    "on": {"counselor": "담당 상담사 대기", "agency": "에이전시 팀 대기", "hangyul": "한귤 대기", "student": "학생 대기", "university": "대학 대기",
           "external": "외부 기관 대기", "us": "우리 쪽 대기(상담사 또는 팀)"},
    "title": "대기 주체",
    "reason": {
        "paid_no_agency": "결제 완료 · 에이전시 미배정", "unassigned_case": "담당 상담사 미배정", "first_contact": "첫 연락 필요",
        "reply_owed": "학생이 답장을 기다리는 중",
        "review_one": "검토할 서류 {{count}}건", "review_other": "검토할 서류 {{count}}건",
        "review_unassigned_one": "검토할 서류 {{count}}건 · 검토자 없음", "review_unassigned_other": "검토할 서류 {{count}}건 · 검토자 없음",
        "essay_review": "에세이 검토 대기", "essay_unassigned": "에세이 검토 · 검토자 없음",
        "task_one": "기한 지난 업무 {{count}}건", "task_other": "기한 지난 업무 {{count}}건",
        "task_unassigned_one": "기한 지난 업무 {{count}}건 · 담당자 없음", "task_unassigned_other": "기한 지난 업무 {{count}}건 · 담당자 없음",
        "submit": "제출 위임 받음", "profile_check": "프로필 확인", "final_check": "제출 전 최종 확인",
        "service": "서비스 건", "service_unassigned": "서비스 건 · 담당자 없음", "payment_issue": "결제 문제",
        "university_request": "대학의 추가 서류 요청",
        "fix_one": "수정할 서류 {{count}}건", "fix_other": "수정할 서류 {{count}}건",
        "submit_on_portal": "공식 포털에서 제출 예정",
        "student_task_one": "할 일 {{count}}건", "student_task_other": "할 일 {{count}}건",
        "rail_confirmation": "접수 번호 미등록", "visa_decision": "비자 결정(대사관)", "provider": "제공업체 확인 대기",
    },
})

section("next", {
    "first_contact": "Make first contact", "reply_owed": "Reply to the student", "unassigned_case": "Assign a counselor",
    "review_one": "Review {{count}} document", "review_other": "Review {{count}} documents",
    "review_unassigned_one": "Assign a reviewer for {{count}} document", "review_unassigned_other": "Assign a reviewer for {{count}} documents",
    "essay_review": "Review the essay", "essay_unassigned": "Assign an essay reviewer",
    "task_one": "Do the overdue task", "task_other": "Do {{count}} overdue tasks", "taskTitle": "Overdue: {{title}}",
    "task_unassigned_one": "Give the overdue task an owner", "task_unassigned_other": "Give {{count}} overdue tasks an owner",
    "submit": "Submit for the student and record the reference", "profile_check": "Check the profile for {{university}}",
    "final_check": "Final check and hand-off · {{university}}", "service": "Move the service case forward", "service_unassigned": "Give the service case an owner",
    "paid_no_agency": "Hangyul: assign an agency", "payment_issue": "Hangyul: sort out the payment",
    "rail_confirmation": "Official portal: confirmation number not recorded yet", "visa_decision": "Embassy: visa decision", "provider": "Provider: confirm the service",
    "studentSays": "Student: {{what}}", "universitySays": "University: {{what}}", "uniDecision": "decision",
    "student": {"university_request": "upload the document {{university}} asked for", "fix_one": "fix {{count}} document", "fix_other": "fix {{count}} documents",
                "submit_on_portal": "submit on the official portal and record the reference", "student_task_one": "{{count}} open task",
                "student_task_other": "{{count}} open tasks", "generic": "their next step"},
    "app": {"DRAFT": "start the application", "DOCUMENT_PREPARATION": "upload the remaining documents", "OFFERED": "reply to the offer",
            "TUITION_PENDING": "pay tuition", "ADMISSION_CERTIFICATE_ISSUED": "start the visa", "VISA_PREPARATION": "gather visa documents",
            "VISA_ISSUED": "plan arrival"},
}, {
    "first_contact": "첫 연락하기", "reply_owed": "학생에게 답장하기", "unassigned_case": "담당 상담사 배정하기",
    "review_one": "서류 {{count}}건 검토하기", "review_other": "서류 {{count}}건 검토하기",
    "review_unassigned_one": "서류 {{count}}건 검토자 지정하기", "review_unassigned_other": "서류 {{count}}건 검토자 지정하기",
    "essay_review": "에세이 검토하기", "essay_unassigned": "에세이 검토자 지정하기",
    "task_one": "기한 지난 업무 처리하기", "task_other": "기한 지난 업무 {{count}}건 처리하기", "taskTitle": "기한 지남: {{title}}",
    "task_unassigned_one": "기한 지난 업무 담당자 지정하기", "task_unassigned_other": "기한 지난 업무 {{count}}건 담당자 지정하기",
    "submit": "학생 대신 제출하고 접수 번호 기록하기", "profile_check": "{{university}} 프로필 확인하기",
    "final_check": "최종 확인 후 인계 · {{university}}", "service": "서비스 건 진행하기", "service_unassigned": "서비스 건 담당자 지정하기",
    "paid_no_agency": "한귤: 에이전시 배정", "payment_issue": "한귤: 결제 문제 해결",
    "rail_confirmation": "공식 포털: 접수 번호 아직 미등록", "visa_decision": "대사관: 비자 결정", "provider": "제공업체: 서비스 확인",
    "studentSays": "학생: {{what}}", "universitySays": "대학: {{what}}", "uniDecision": "결정",
    "student": {"university_request": "{{university}}가 요청한 서류 올리기", "fix_one": "서류 {{count}}건 수정하기", "fix_other": "서류 {{count}}건 수정하기",
                "submit_on_portal": "공식 포털에서 제출하고 접수 번호 기록하기", "student_task_one": "남은 할 일 {{count}}건",
                "student_task_other": "남은 할 일 {{count}}건", "generic": "다음 단계"},
    "app": {"DRAFT": "지원 시작하기", "DOCUMENT_PREPARATION": "남은 서류 올리기", "OFFERED": "합격 제안에 답하기", "TUITION_PENDING": "등록금 납부하기",
            "ADMISSION_CERTIFICATE_ISSUED": "비자 준비 시작하기", "VISA_PREPARATION": "비자 서류 모으기", "VISA_ISSUED": "입국 계획 세우기"},
})

section("owner", {
    "agency": "Agency team", "hangyul": "Hangyul operations", "embassy": "Embassy", "rail": "Official portal", "railOf": "Official portal · {{university}}",
    "provider": "Provider", "unassigned": "Unassigned", "label": "Owner",
}, {
    "agency": "에이전시 팀", "hangyul": "한귤 운영팀", "embassy": "대사관", "rail": "공식 포털", "railOf": "공식 포털 · {{university}}",
    "provider": "제공업체", "unassigned": "미배정", "label": "담당",
})

# ------------------------------------------------------------------------------------------- Today (A2)
section("today", {
    "howOrdered": "How is this ordered?", "types": "Work types", "due": "Due", "side": "Waiting and upcoming",
    "nobodyType": "Nobody needs you for {{type}} right now.",
}, {
    "howOrdered": "정렬 기준", "types": "업무 유형", "due": "기한", "side": "대기 현황과 다가오는 일정",
    "nobodyType": "지금 {{type}} 관련해 처리할 학생이 없습니다.",
})
section("types", {
    "all": "All", "documents": "Documents", "writing": "Writing", "applications": "Applications", "messages": "Messages",
    "university_requests": "University requests", "visa": "Visa", "services": "Services", "deadlines": "Deadlines", "tasks": "Tasks",
}, {
    "all": "전체", "documents": "서류", "writing": "에세이", "applications": "지원서", "messages": "메시지", "university_requests": "대학 요청",
    "visa": "비자", "services": "서비스", "deadlines": "마감", "tasks": "업무",
})
section("action", {
    "reply": "Reply", "prepare": "Open applications", "review": "Review", "essay": "Review essay", "request": "See request", "task": "Open tasks",
    "nudge": "Nudge", "submit": "Submit", "confirm": "Chase confirmation", "handoff": "Final check", "check": "Final review", "visa": "Open visa",
    "service": "Open case",
}, {
    "reply": "답장", "prepare": "지원서 열기", "review": "검토", "essay": "에세이 검토", "request": "요청 보기", "task": "업무 열기", "nudge": "연락하기",
    "submit": "제출", "confirm": "접수 확인 요청", "handoff": "최종 확인", "check": "최종 검토", "visa": "비자 열기", "service": "건 열기",
})
section("reason", {
    "submission_issue": "Submission attempt failed · {{university}}",
    "confirmation_missing_one": "Handed off {{count}} day ago · no confirmation number · {{university}}",
    "confirmation_missing_other": "Handed off {{count}} days ago · no confirmation number · {{university}}",
    "submit_authorized": "Student authorised us to submit · {{university}}", "ready_to_submit": "Ready · final check and hand-off · {{university}}",
    "final_review": "Every item ready · final review next · {{university}}",
    "visa": {"appointment_soon": "Visa appointment on {{date}}", "request_due": "Embassy request due {{date}}", "pack_ready": "Visa pack ready to review",
             "other": "Visa step needs attention"},
    "service": {"overdue": "{{type}} is past its response time", "urgent": "{{type}} marked urgent", "flight_delayed": "{{type}}: flight delayed",
                "reconfirm": "{{type}}: changed details to re-confirm", "pickup_soon": "{{type}} today or tomorrow",
                "needs_assignment": "{{type}} needs an owner", "other": "{{type}} needs attention"},
    "essay_due": "{{essay}} review due within 48 h", "document_check": "Document check needs a person · {{doc}}",
}, {
    "submission_issue": "제출 시도 실패 · {{university}}",
    "confirmation_missing_one": "{{count}}일 전 인계 · 접수 번호 없음 · {{university}}",
    "confirmation_missing_other": "{{count}}일 전 인계 · 접수 번호 없음 · {{university}}",
    "submit_authorized": "학생이 제출을 위임함 · {{university}}", "ready_to_submit": "준비 완료 · 최종 확인 후 인계 · {{university}}",
    "final_review": "모든 항목 준비됨 · 최종 검토 필요 · {{university}}",
    "visa": {"appointment_soon": "비자 접수 예약 {{date}}", "request_due": "대사관 요청 기한 {{date}}", "pack_ready": "비자 서류 검토 대기",
             "other": "비자 단계 확인 필요"},
    "service": {"overdue": "{{type}} 응답 시간 초과", "urgent": "{{type}} 긴급", "flight_delayed": "{{type}}: 항공편 지연",
                "reconfirm": "{{type}}: 변경 사항 재확인 필요", "pickup_soon": "{{type}} 오늘 또는 내일", "needs_assignment": "{{type}} 담당자 필요",
                "other": "{{type}} 확인 필요"},
    "essay_due": "{{essay}} 검토 48시간 내 마감", "document_check": "서류 확인 필요 · {{doc}}",
})

# ------------------------------------------------------------------------------------------- workspace (A3, A8, A12) + views
section("strip", {"why": "Why it is not moving", "next": "Next action", "deadline": "Deadline"},
        {"why": "멈춰 있는 이유", "next": "다음 할 일", "deadline": "마감"})
section("viewDef", {
    "waiting_counselor": "A named person on the team owns the next action: first contact, a reply, their review, their task or a final check.",
    "waiting_agency": "The agency team owns the next action but nobody is assigned: an unassigned case, review or task.",
    "waiting_hangyul": "Hangyul operations owns the next action: paid with no agency, or a payment issue.",
}, {
    "waiting_counselor": "팀의 특정 담당자가 다음 할 일을 맡고 있습니다: 첫 연락, 답장, 본인 검토, 본인 업무, 최종 확인.",
    "waiting_agency": "에이전시 팀이 맡아야 하지만 담당자가 없습니다: 미배정 학생, 검토, 업무.",
    "waiting_hangyul": "한귤 운영팀이 다음 할 일을 맡고 있습니다: 결제했지만 에이전시 미배정, 또는 결제 문제.",
})
section("meet", {
    "title": "Meetings", "recordTitle": "Record a meeting", "closeTitle": "Close the meeting", "closeShort": "Record outcome", "save": "Save meeting record",
    "saved": "Meeting saved — follow-ups created.", "notes": "What was discussed", "decisions": "Decisions", "oneper": "One per line.",
    "staffTasks": "Follow-ups for the team", "studentTasks": "To-dos for the student", "studentHint": "One per line — the student sees these.",
    "scheduleNext": "Schedule the next meeting", "followUps": "Follow-ups", "done": "done", "next": "Next meeting {{when}}",
}, {
    "title": "상담 기록", "recordTitle": "상담 기록하기", "closeTitle": "상담 마무리", "closeShort": "결과 기록", "save": "상담 기록 저장",
    "saved": "상담이 저장되고 후속 업무가 만들어졌습니다.", "notes": "논의한 내용", "decisions": "결정 사항", "oneper": "한 줄에 하나씩.",
    "staffTasks": "팀 후속 업무", "studentTasks": "학생 할 일", "studentHint": "한 줄에 하나씩 — 학생에게 보입니다.",
    "scheduleNext": "다음 상담 예약", "followUps": "후속 업무", "done": "완료", "next": "다음 상담 {{when}}",
})
section("identity", {
    "title": "Responsible agency", "none": "No agency is assigned to this student.", "legal": "Legal name", "trading": "Trading name",
    "registration": "Licence / registration", "notRecorded": "Not recorded", "counselor": "Responsible counselor", "subAgent": "Sub-agent",
    "noSub": "None", "reg": {"RECORDED": "self-declared", "VERIFIED": "verified by Hangyul"},
    "note": "Universities see this record. Korea has announced (draft, not yet law) that agency details will appear on the Certificate of Admission.",
}, {
    "title": "담당 에이전시", "none": "이 학생에게 배정된 에이전시가 없습니다.", "legal": "법인명", "trading": "상호",
    "registration": "등록·인허가", "notRecorded": "기록 없음", "counselor": "담당 상담사", "subAgent": "하위 에이전트",
    "noSub": "없음", "reg": {"RECORDED": "자체 신고", "VERIFIED": "한귤 확인"},
    "note": "대학도 이 기록을 봅니다. 한국 정부는 표준입학허가서에 에이전시 정보를 기재하는 방안을 발표했습니다(초안, 아직 시행 전).",
})

# ------------------------------------------------------------------------------------------- Team (A4)
section("team", {
    "question": "Who can take more, and who needs help?", "people": "People", "person": "Person", "expertise": "Expertise", "load": "Load vs capacity",
    "slaRisk": "SLA risk", "points": "pts", "noCapacity": "No capacity set", "available": "Available", "onLeave": "On leave until {{date}}",
    "onLeaveShort": "on leave", "left": "Left {{date}}", "noExpertise": "No expertise recorded",
    "cases_one": "{{count}} case", "cases_other": "{{count}} cases", "overloadedN_one": "{{count}} over capacity", "overloadedN_other": "{{count}} over capacity",
    "awayN_one": "{{count}} on leave", "awayN_other": "{{count}} on leave",
    "weights": "Load weights", "workKind": "Open work", "weight": "Weight", "default": "default {{n}}",
    "weightsReadOnly": "Owners and managers can change the weights.",
    "work": {"active_applications": "Active applications", "deadlines_14d": "Deadlines within 14 days", "document_reviews": "Document reviews",
             "writing_reviews": "Writing reviews", "visa_cases": "Visa cases", "service_cases": "Service cases", "conversations_waiting": "Conversations waiting"},
    "workShort": {"active_applications": "apps", "deadlines_14d": "deadlines", "document_reviews": "doc reviews", "writing_reviews": "essays",
                  "visa_cases": "visa", "service_cases": "services", "conversations_waiting": "replies"},
    "engineTitle": "How new students are assigned",
    "engine": "The assignment engine skips people on leave and people over capacity, prefers a counselor who knows the student's country and "
              "language, then picks the lowest load against capacity (the same numbers as this page).",
    "editTitle": "Edit {{name}}", "languages": "Languages", "codesHint": "Language codes, comma-separated (vi, ko, en).",
    "countries": "Countries", "countryHint": "Country codes, comma-separated (VN, KH).", "capacity": "Personal capacity (points)",
    "capacityHint": "In the same points as the load weights.", "fields": "Fields of study", "fieldsHint": "Comma-separated (business, computer_science).",
    "degrees": "Degree levels", "universities": "University expertise", "uniHint": "Hold Ctrl / Cmd to choose several.",
    "leaveUntil": "On leave until", "leaveHint": "No new students are assigned until this date.", "leaveNote": "Leave note",
    "leaveShort": "Member leaves", "leaveTitle": "{{name}} leaves the team", "leaveConfirm": "Move everything and deactivate",
    "leaveIntro_one": "{{count}} open item would be orphaned. Choose where each kind goes.",
    "leaveIntro_other": "{{count}} open items would be orphaned. Choose where each kind goes.",
    "leaveNothing": "Nothing open — the account can be deactivated safely.", "moveTo": "Move to",
    "toAuto": "Assignment engine (availability + load)", "toQueue": "Back to the team queue", "andMore": "and {{count}} more",
    "kind": {"students_one": "{{count}} student", "students_other": "{{count}} students", "reviews_one": "{{count}} document review",
             "reviews_other": "{{count}} document reviews", "essays_one": "{{count}} essay review", "essays_other": "{{count}} essay reviews",
             "tasks_one": "{{count}} open task", "tasks_other": "{{count}} open tasks", "services_one": "{{count}} service case", "services_other": "{{count}} service cases"},
    "reason": "Reason (kept in the audit log)", "leaveAudit": "Every move is recorded in the audit log with this reason.",
    "leaveDone_one": "{{count}} item moved — the member is deactivated.", "leaveDone_other": "{{count}} items moved — the member is deactivated.",
    "reactivate": "Reactivate",
}, {
    "question": "누가 더 맡을 수 있고, 누가 도움이 필요한가요?", "people": "구성원", "person": "구성원", "expertise": "전문 분야", "load": "업무량 대비 역량",
    "slaRisk": "SLA 위험", "points": "점", "noCapacity": "역량 미설정", "available": "근무 중", "onLeave": "{{date}}까지 휴가",
    "onLeaveShort": "휴가 중", "left": "{{date}} 퇴사", "noExpertise": "등록된 전문 분야 없음",
    "cases_one": "학생 {{count}}명", "cases_other": "학생 {{count}}명", "overloadedN_one": "역량 초과 {{count}}명", "overloadedN_other": "역량 초과 {{count}}명",
    "awayN_one": "휴가 {{count}}명", "awayN_other": "휴가 {{count}}명",
    "weights": "업무량 가중치", "workKind": "진행 중인 업무", "weight": "가중치", "default": "기본값 {{n}}",
    "weightsReadOnly": "가중치는 대표와 매니저만 바꿀 수 있습니다.",
    "work": {"active_applications": "진행 중인 지원서", "deadlines_14d": "14일 내 마감", "document_reviews": "서류 검토", "writing_reviews": "에세이 검토",
             "visa_cases": "비자 건", "service_cases": "서비스 건", "conversations_waiting": "답장 대기 대화"},
    "workShort": {"active_applications": "지원서", "deadlines_14d": "마감", "document_reviews": "서류", "writing_reviews": "에세이", "visa_cases": "비자",
                  "service_cases": "서비스", "conversations_waiting": "답장"},
    "engineTitle": "신규 학생 배정 방식",
    "engine": "배정 엔진은 휴가 중이거나 역량을 넘은 사람을 제외하고, 학생의 국가와 언어를 아는 상담사를 우선한 뒤, 역량 대비 업무량이 가장 낮은 사람을 고릅니다"
              "(이 페이지와 같은 수치).",
    "editTitle": "{{name}} 정보 수정", "languages": "언어", "codesHint": "언어 코드, 쉼표로 구분(vi, ko, en).",
    "countries": "국가", "countryHint": "국가 코드, 쉼표로 구분(VN, KH).", "capacity": "개인 역량(점)",
    "capacityHint": "업무량 가중치와 같은 점수 단위입니다.", "fields": "전공 분야", "fieldsHint": "쉼표로 구분(business, computer_science).",
    "degrees": "학위 과정", "universities": "대학 전문성", "uniHint": "Ctrl / Cmd를 누른 채 여러 개를 선택하세요.",
    "leaveUntil": "휴가 종료일", "leaveHint": "이 날짜까지 신규 학생을 배정하지 않습니다.", "leaveNote": "휴가 메모",
    "leaveShort": "구성원 퇴사", "leaveTitle": "{{name}} 님 퇴사 처리", "leaveConfirm": "모두 이관하고 비활성화",
    "leaveIntro_one": "담당자가 없어질 업무가 {{count}}건 있습니다. 종류별로 넘길 곳을 고르세요.",
    "leaveIntro_other": "담당자가 없어질 업무가 {{count}}건 있습니다. 종류별로 넘길 곳을 고르세요.",
    "leaveNothing": "진행 중인 업무가 없어 바로 비활성화할 수 있습니다.", "moveTo": "이관 대상",
    "toAuto": "배정 엔진(근무 여부 + 업무량)", "toQueue": "팀 대기열로", "andMore": "외 {{count}}건",
    "kind": {"students_one": "학생 {{count}}명", "students_other": "학생 {{count}}명", "reviews_one": "서류 검토 {{count}}건", "reviews_other": "서류 검토 {{count}}건",
             "essays_one": "에세이 검토 {{count}}건", "essays_other": "에세이 검토 {{count}}건", "tasks_one": "진행 중 업무 {{count}}건",
             "tasks_other": "진행 중 업무 {{count}}건", "services_one": "서비스 건 {{count}}건", "services_other": "서비스 건 {{count}}건"},
    "reason": "사유(감사 기록에 남습니다)", "leaveAudit": "모든 이관은 이 사유와 함께 감사 기록에 남습니다.",
    "leaveDone_one": "{{count}}건을 이관하고 구성원을 비활성화했습니다.", "leaveDone_other": "{{count}}건을 이관하고 구성원을 비활성화했습니다.",
    "reactivate": "다시 활성화",
})

# ------------------------------------------------------------------------------------------- Templates (A5) + Messages (A11)
section("tpl", {
    "sub": "One template, every language it exists in. Inserting picks the student's language when a version exists.",
    "language": "Language", "versions": "Language versions", "addLang": "Add a language", "studentLang": "Student's language: {{lang}}",
    "nLangs_one": "{{count}} language", "nLangs_other": "{{count}} languages",
    "scopeHelp": "Personal: only you. Team: everyone in your agency can use it; you and managers can edit it. Organisation templates are set by owners and managers.",
    "scopeHelpMgr": "Personal: only you. Team: everyone can use it. Organisation: your agency's standard text — only owners and managers edit it.",
    "groupsSub": {"PERSONAL": "Only you see these.", "TEAM": "Shared with your whole agency.", "ORG": "Your agency's standard texts — owners and managers edit them."},
    "kinds": {"PAYMENT": "Payment", "ARRIVAL": "Arrival", "HOUSING": "Housing"},
}, {
    "sub": "하나의 템플릿에 여러 언어 버전이 있습니다. 삽입하면 학생의 언어 버전이 있을 때 그 버전을 고릅니다.",
    "language": "언어", "versions": "언어 버전", "addLang": "언어 추가", "studentLang": "학생 언어: {{lang}}",
    "nLangs_one": "{{count}}개 언어", "nLangs_other": "{{count}}개 언어",
    "scopeHelp": "개인: 나만 사용. 팀: 에이전시 전원이 사용하고 작성자와 매니저가 수정합니다. 조직 템플릿은 대표와 매니저가 정합니다.",
    "scopeHelpMgr": "개인: 나만 사용. 팀: 전원이 사용. 조직: 에이전시 표준 문구로, 대표와 매니저만 수정합니다.",
    "groupsSub": {"PERSONAL": "나에게만 보입니다.", "TEAM": "에이전시 전체와 공유됩니다.", "ORG": "에이전시 표준 문구 — 대표와 매니저가 수정합니다."},
    "kinds": {"PAYMENT": "납부", "ARRIVAL": "입국", "HOUSING": "주거"},
})
section("msg", {
    "state": {"SENT": "Sent", "READ": "Read", "FAILED": "Not delivered"},
    "link": "Link to an application", "changeLink": "Change application", "unlink": "Remove the link",
}, {
    "state": {"SENT": "보냄", "READ": "읽음", "FAILED": "전달 실패"},
    "link": "지원서에 연결", "changeLink": "연결된 지원서 변경", "unlink": "연결 해제",
})

# ------------------------------------------------------------------------------------------- Submissions (A7)
section("sub", {
    "title": "Submissions", "question": "Which applications are stuck between ready and received?", "method": "Method", "since": "In this state",
    "days_one": "{{count}} day", "days_other": "{{count}} days", "evidence": "Evidence", "noEvidence": "No reference yet",
    "empty": "Nothing in “{{state}}”.",
    "honest": "Hangyul never stores portal passwords and never submits on its own. Evidence (a reference number or receipt) is what moves an application to “received”.",
    "state": {"issue": "Issue", "confirmation_missing": "Confirmation missing", "authorized": "Authorized", "ready": "Ready",
              "needs_final_review": "Needs final review", "submitted": "Submitted", "received": "University received"},
    "def": {"issue": "A failed attempt is recorded (portal error, payment declined…) and nothing has been submitted since.",
            "confirmation_missing": "Handed off or reported submitted more than 2 days ago — still no reference number or receipt. Chase it.",
            "authorized": "The student authorised the agency to submit (recorded legal basis). Submit on the official portal and record the reference.",
            "ready": "Ready and nothing recorded yet: do the final check and hand it off (the student submits on the official portal).",
            "needs_final_review": "Every required item is ready, but the application is not marked Ready yet: the final review is next.",
            "submitted": "Handed off or reported submitted in the last 2 days; waiting for the reference or receipt.",
            "received": "Evidence is recorded and the application is with the university."},
    "methods": {"GUIDED_EXTERNAL": "Official portal (student)", "APPLICATION_PROVIDER": "Application provider (student)", "MANUAL": "Paper / e-mail",
                "AUTHORIZED_AGENCY": "Authorised agency", "DIRECT_API": "University API", "PARTNER_API": "Partner API"},
}, {
    "title": "제출 현황", "question": "준비 완료와 대학 접수 사이에서 멈춘 지원서는?", "method": "제출 방식", "since": "현재 상태 기간",
    "days_one": "{{count}}일", "days_other": "{{count}}일", "evidence": "증빙", "noEvidence": "접수 번호 없음",
    "empty": "“{{state}}” 상태인 지원서가 없습니다.",
    "honest": "한귤은 포털 비밀번호를 저장하지 않으며 스스로 제출하지 않습니다. 접수 번호나 영수증 같은 증빙이 있어야 ‘대학 접수’로 바뀝니다.",
    "state": {"issue": "문제 발생", "confirmation_missing": "접수 확인 누락", "authorized": "제출 위임", "ready": "제출 준비",
              "needs_final_review": "최종 검토 필요", "submitted": "제출함", "received": "대학 접수"},
    "def": {"issue": "제출 시도 실패(포털 오류, 결제 거절 등)가 기록되었고 이후 제출되지 않았습니다.",
            "confirmation_missing": "인계하거나 제출했다고 한 지 2일이 넘었는데 접수 번호나 영수증이 없습니다. 확인을 요청하세요.",
            "authorized": "학생이 에이전시 제출을 위임했습니다(법적 근거 기록됨). 공식 포털에서 제출하고 접수 번호를 기록하세요.",
            "ready": "준비 완료, 아직 기록 없음: 최종 확인 후 인계하세요(학생이 공식 포털에서 제출).",
            "needs_final_review": "필수 항목은 모두 준비되었지만 아직 ‘준비 완료’가 아닙니다: 최종 검토가 다음입니다.",
            "submitted": "최근 2일 내 인계 또는 제출 보고됨. 접수 번호나 영수증을 기다리는 중입니다.",
            "received": "증빙이 기록되었고 지원서가 대학에 있습니다."},
    "methods": {"GUIDED_EXTERNAL": "공식 포털(학생)", "APPLICATION_PROVIDER": "원서접수 대행사(학생)", "MANUAL": "우편 / 이메일",
                "AUTHORIZED_AGENCY": "에이전시 위임 제출", "DIRECT_API": "대학 API", "PARTNER_API": "파트너 API"},
})

# ------------------------------------------------------------------------------------------- Providers (A6)
section("prov", {
    "types": "Service types", "open": "Open", "late": "Late", "lastIssue": "Last issue", "noIssue": "None recorded",
    "none": "No agreement recorded", "inactive": "Agreement not active",
    "issue": {"NO_SHOW": "No-show", "CANCELLED": "Cancelled", "NOT_ASSIGNED": "Dormitory not assigned", "NEGATIVE_FEEDBACK": "Negative feedback"},
}, {
    "types": "서비스 유형", "open": "진행", "late": "지연", "lastIssue": "최근 문제", "noIssue": "기록 없음",
    "none": "계약 기록 없음", "inactive": "계약 비활성",
    "issue": {"NO_SHOW": "노쇼", "CANCELLED": "취소", "NOT_ASSIGNED": "기숙사 미배정", "NEGATIVE_FEEDBACK": "부정적 피드백"},
})

# ------------------------------------------------------------------------------------------- Operations (A9) + quality (A10)
section("ops", {
    "questions": "Six questions", "none": "None", "tooFew": "Too few stays", "days_one": "{{count}} day", "days_other": "{{count}} days",
    "q": {"blocked": "Oldest blocked case", "overloaded": "Over capacity", "sla": "SLA breaches", "deadlines": "Deadlines at risk",
          "stage": "Slowest stage", "unpaid": "Unassigned paid cases"},
    "weightsLink": "Weights", "noneOver": "Nobody is over capacity.", "pointsOf": "{{n}} / {{cap}} pts", "points": "{{n}} pts",
    "cases_one": "{{count}} case", "cases_other": "{{count}} cases", "slaRisk_one": "{{count}} at SLA risk", "slaRisk_other": "{{count}} at SLA risk",
    "blocked": {"title": "Blocked cases", "q_one": "Which cases wait on someone and have not moved for more than {{count}} day?",
                "q_other": "Which cases wait on someone and have not moved for more than {{count}} days?",
                "none_one": "No case has been stuck for more than {{count}} day.", "none_other": "No case has been stuck for more than {{count}} days."},
    "unpaid": {"title": "Unassigned paid cases", "q": "Who paid for a service and has nobody owning their case?", "none": "Every paid case has an owner.",
               "no_counselor": "no counselor", "no_agency": "no agency"},
}, {
    "questions": "여섯 가지 질문", "none": "없음", "tooFew": "표본 부족", "days_one": "{{count}}일", "days_other": "{{count}}일",
    "q": {"blocked": "가장 오래 멈춘 건", "overloaded": "역량 초과", "sla": "SLA 위반", "deadlines": "마감 위험", "stage": "가장 느린 단계",
          "unpaid": "미배정 결제 건"},
    "weightsLink": "가중치", "noneOver": "역량을 넘은 사람이 없습니다.", "pointsOf": "{{n}} / {{cap}}점", "points": "{{n}}점",
    "cases_one": "학생 {{count}}명", "cases_other": "학생 {{count}}명", "slaRisk_one": "SLA 위험 {{count}}건", "slaRisk_other": "SLA 위험 {{count}}건",
    "blocked": {"title": "멈춘 건", "q_one": "누군가를 기다리며 {{count}}일 넘게 움직이지 않은 건은?", "q_other": "누군가를 기다리며 {{count}}일 넘게 움직이지 않은 건은?",
                "none_one": "{{count}}일 넘게 멈춘 건이 없습니다.", "none_other": "{{count}}일 넘게 멈춘 건이 없습니다."},
    "unpaid": {"title": "미배정 결제 건", "q": "서비스를 결제했는데 담당자가 없는 학생은?", "none": "결제한 모든 건에 담당자가 있습니다.",
               "no_counselor": "상담사 없음", "no_agency": "에이전시 없음"},
})
section("q", {
    "tab": "Process quality", "title": "Process quality", "question": "Where does our process create rework?", "period": "Period", "d": "{{n}} days",
    "withheld": "Withheld (n = {{n}})", "hours": "{{n}} h", "rounds": "{{n}} rounds", "numden": "{{num}} of {{den}}", "n": "n = {{n}}",
    "cohort": "last {{days}} days", "records_one": "{{count}} record", "records_other": "{{count}} records", "noRecords": "No records to show",
    "foot": "Each figure counts only records in the period. Below n = {{n}} the figure is withheld, never estimated. These describe the process — not people, and not causes.",
    "m": {"correction_loops": "Correction loops (documents)", "first_pass_quality": "Documents right first time", "essay_revision_loops": "Essay revision rounds",
          "completeness_at_submission": "Complete at submission", "university_extra_documents": "University asked for more",
          "missed_deadlines": "Missed deadlines", "deadline_compliance": "Deadlines met", "review_turnaround": "Document review turnaround",
          "student_response_time": "Student response time", "first_response_time": "First response time", "visa_extra_documents": "Embassy asked for more",
          "arrival_issues": "Arrival issues", "arrival_completion": "Arrival services completed"},
}, {
    "tab": "프로세스 품질", "title": "프로세스 품질", "question": "우리 프로세스의 어디에서 재작업이 생기나요?", "period": "기간", "d": "{{n}}일",
    "withheld": "비공개(n = {{n}})", "hours": "{{n}}시간", "rounds": "{{n}}회", "numden": "{{den}}건 중 {{num}}건", "n": "n = {{n}}",
    "cohort": "최근 {{days}}일", "records_one": "기록 {{count}}건", "records_other": "기록 {{count}}건", "noRecords": "표시할 기록 없음",
    "foot": "각 수치는 기간 내 기록만 셉니다. n = {{n}} 미만이면 추정하지 않고 비공개합니다. 사람이나 원인이 아니라 프로세스를 보여 줍니다.",
    "m": {"correction_loops": "서류 수정 반복", "first_pass_quality": "한 번에 통과한 서류", "essay_revision_loops": "에세이 수정 횟수",
          "completeness_at_submission": "제출 시 완비", "university_extra_documents": "대학 추가 서류 요청", "missed_deadlines": "놓친 마감",
          "deadline_compliance": "마감 준수", "review_turnaround": "서류 검토 소요 시간", "student_response_time": "학생 응답 시간",
          "first_response_time": "첫 응답 시간", "visa_extra_documents": "대사관 추가 서류 요청", "arrival_issues": "입국 서비스 문제",
          "arrival_completion": "입국 서비스 완료"},
})

# ------------------------------------------------------------------------------------------- HQ (H1–H3)
section("hq", {
    "records_one": "{{count}} record", "records_other": "{{count}} records",
    "detail": {},
    "f": {
        "application_blocked": {"line_one": "{{n}} application due within 7 days still misses required items",
                                "line_other": "{{n}} applications due within 7 days still miss required items", "short": "application blockers"},
        "submission_issue": {"line_one": "{{n}} submission attempt failed and was not retried", "line_other": "{{n}} submission attempts failed and were not retried",
                             "short": "failed submissions"},
        "confirmation_missing": {"line_one": "{{n}} hand-off has no confirmation number after 2 days", "line_other": "{{n}} hand-offs have no confirmation number after 2 days",
                                 "short": "missing confirmations"},
        "arrival_failed": {"line_one": "{{n}} arrival or housing case failed (no-show, dormitory not assigned)",
                           "line_other": "{{n}} arrival or housing cases failed (no-show, dormitory not assigned)", "short": "arrival / housing failures"},
        "integrations": {"line_one": "{{n}} required integration is not working in production", "line_other": "{{n}} required integrations are not working in production",
                         "short": "integration failures"},
    },
}, {
    "records_one": "기록 {{count}}건", "records_other": "기록 {{count}}건",
    "detail": {},
    "f": {
        "application_blocked": {"line_one": "7일 내 마감인데 필수 항목이 빠진 지원서 {{n}}건", "line_other": "7일 내 마감인데 필수 항목이 빠진 지원서 {{n}}건",
                                "short": "지원서 장애"},
        "submission_issue": {"line_one": "실패 후 다시 시도하지 않은 제출 {{n}}건", "line_other": "실패 후 다시 시도하지 않은 제출 {{n}}건", "short": "제출 실패"},
        "confirmation_missing": {"line_one": "인계 후 2일이 지나도 접수 번호가 없는 건 {{n}}건", "line_other": "인계 후 2일이 지나도 접수 번호가 없는 건 {{n}}건",
                                 "short": "접수 확인 누락"},
        "arrival_failed": {"line_one": "실패한 입국·주거 건 {{n}}건(노쇼, 기숙사 미배정)", "line_other": "실패한 입국·주거 건 {{n}}건(노쇼, 기숙사 미배정)",
                           "short": "입국·주거 실패"},
        "integrations": {"line_one": "운영 환경에서 작동하지 않는 필수 연동 {{n}}개", "line_other": "운영 환경에서 작동하지 않는 필수 연동 {{n}}개", "short": "연동 장애"},
    },
})
section("pq", {
    "title": "Partner quality — process, not admissions", "students_one": "{{count}} student", "students_other": "{{count}} students",
    "foot": "Last {{days}} days. Each figure has its own cohort; below n = 5 it is withheld. Agencies are listed by name, never ranked, and never by admission rate. Satisfaction is not shown — there is no verified survey data.",
}, {
    "title": "파트너 품질 — 입학 결과가 아닌 프로세스", "students_one": "학생 {{count}}명", "students_other": "학생 {{count}}명",
    "foot": "최근 {{days}}일. 수치마다 모집단이 있으며 n = 5 미만은 비공개합니다. 에이전시는 이름순이며 순위를 매기지 않고, 합격률로 비교하지 않습니다. 검증된 설문 자료가 없어 만족도는 표시하지 않습니다.",
})
section("ready", {
    "question": "What still blocks launch? Every item is classified from the running configuration and real records.",
    "yes": "Nothing required blocks launch", "no_one": "{{count}} required item blocks launch", "no_other": "{{count}} required items block launch",
    "blocking": "Blocking launch", "other": "Optional or done", "required": "Required for launch", "optional": "Optional",
    "cat": {"CODE_COMPLETE": "Code-complete", "NEEDS_CREDENTIALS": "Needs credentials", "NEEDS_PROVIDER_AGREEMENT": "Needs provider agreement",
            "NEEDS_BUSINESS_DATA": "Needs business data", "NEEDS_LEGAL_APPROVAL": "Needs legal approval", "NEEDS_HUMAN_REVIEW": "Needs human review",
            "NEEDS_INFRASTRUCTURE": "Needs infrastructure"},
    "legend": {"CODE_COMPLETE": "Works with the current configuration, or needs nothing outside the code.",
               "NEEDS_CREDENTIALS": "The code exists; production keys or secrets must be issued and set.",
               "NEEDS_PROVIDER_AGREEMENT": "A contract with an outside provider is required before anything can be sent or shown.",
               "NEEDS_BUSINESS_DATA": "Real prices, listings, registrations or verified catalogue data must be entered.",
               "NEEDS_LEGAL_APPROVAL": "Counsel or a regulator must approve the text or the practice.",
               "NEEDS_HUMAN_REVIEW": "A named person must review it (translations, research with real users).",
               "NEEDS_INFRASTRUCTURE": "A production service must be deployed (storage, scanning, workers, environment)."},
    "item": {"channel_zalo": "Zalo messages", "ocr": "Reading scanned documents (OCR)", "housing_inventory": "Housing inventory", "provider_agreements": "Provider agreements",
             "scheduled_jobs_worker": "Scheduled jobs (exports, reminders, scans)", "university_rail_apis": "University / application-provider APIs",
             "legal_pages": "Terms and privacy text", "pipa_cross_border": "Cross-border data consent (PIPA)", "moe_standard_agreement": "MOE standard university–agency agreement",
             "verified_catalogue": "Verified catalogue data", "service_pricing": "Service prices", "agency_registration": "Agency registrations",
             "translation_review": "Human translation review", "usability_research": "Usability research with real users"},
}, {
    "question": "출시를 막는 것은 무엇인가요? 모든 항목을 현재 설정과 실제 기록으로 분류합니다.",
    "yes": "출시를 막는 필수 항목이 없습니다", "no_one": "출시를 막는 필수 항목 {{count}}개", "no_other": "출시를 막는 필수 항목 {{count}}개",
    "blocking": "출시 차단", "other": "선택 또는 완료", "required": "출시 필수", "optional": "선택",
    "cat": {"CODE_COMPLETE": "코드 완료", "NEEDS_CREDENTIALS": "인증 정보 필요", "NEEDS_PROVIDER_AGREEMENT": "제공업체 계약 필요",
            "NEEDS_BUSINESS_DATA": "실제 데이터 필요", "NEEDS_LEGAL_APPROVAL": "법률 검토 필요", "NEEDS_HUMAN_REVIEW": "사람 검토 필요",
            "NEEDS_INFRASTRUCTURE": "인프라 필요"},
    "legend": {"CODE_COMPLETE": "현재 설정으로 작동하거나 코드 밖의 준비가 필요 없습니다.",
               "NEEDS_CREDENTIALS": "코드는 있으며, 운영용 키나 비밀값을 발급해 설정해야 합니다.",
               "NEEDS_PROVIDER_AGREEMENT": "외부 제공업체와 계약해야 무언가를 보내거나 보여 줄 수 있습니다.",
               "NEEDS_BUSINESS_DATA": "실제 가격, 매물, 등록 정보, 검증된 카탈로그 데이터를 입력해야 합니다.",
               "NEEDS_LEGAL_APPROVAL": "변호사나 규제 기관의 승인이 필요합니다.",
               "NEEDS_HUMAN_REVIEW": "지정된 사람이 검토해야 합니다(번역, 실제 사용자 조사).",
               "NEEDS_INFRASTRUCTURE": "운영 서비스를 배포해야 합니다(저장소, 검사, 작업 실행기, 환경)."},
    "item": {"channel_zalo": "Zalo 메시지", "ocr": "스캔 문서 판독(OCR)", "housing_inventory": "주거 매물", "provider_agreements": "제공업체 계약",
             "scheduled_jobs_worker": "예약 작업(내보내기, 알림, 점검)", "university_rail_apis": "대학 / 원서접수 대행사 API",
             "legal_pages": "이용약관·개인정보 문구", "pipa_cross_border": "국외 이전 동의(개인정보보호법)", "moe_standard_agreement": "교육부 대학–유학원 표준 협약",
             "verified_catalogue": "검증된 카탈로그 데이터", "service_pricing": "서비스 가격", "agency_registration": "에이전시 등록 정보",
             "translation_review": "번역 사람 검토", "usability_research": "실제 사용자 사용성 조사"},
})


def merge() -> None:
    for loc, data in (("en", EN), ("ko", KO)):
        p = ROOT / loc / "agency.json"
        d = json.loads(p.read_text(encoding="utf-8"))
        d["v9"] = data
        p.write_text(json.dumps(d, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"agency v9: {sum(1 for _ in _leaves(EN))} en keys, {sum(1 for _ in _leaves(KO))} ko keys")


def _leaves(d, pre=""):
    for k, v in d.items():
        if isinstance(v, dict):
            yield from _leaves(v, f"{pre}{k}.")
        else:
            yield pre + k


if __name__ == "__main__":
    missing = set(_leaves(EN)) ^ set(_leaves(KO))
    assert not missing, f"en/ko keys differ: {sorted(missing)[:20]}"
    merge()
