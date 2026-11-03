"""V29 source strings (ko + en) for the new service contract. Run: python3 scripts/i18n/v29/source.py

Writes into packages/i18n/locales/{ko,en}/<ns>.json. Every key here is new in V29 (the contract changed, so the V15
keys were not re-used — see packages/types/src/plans.ts PLAN_COPY). Other locales get these through the V29 l10n jobs.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3] / "packages/i18n/locales"

KO = {
 "common": {"v29.pricing": {
  "basic": {"position": "유학 방향을 정하고, 나에게 맞는 대학부터 고르고 싶은 학생",
            "f1": "맞춤 유학 진단 상담 + 후속 상담 1회", "f2": "대학·어학당 최대 3곳 추천", "f3": "입학 조건·학비·주요 일정 비교",
            "f4": "기본 입학 서류 체크리스트", "f5": "국적별 비자 준비 절차 안내"},
  "all_in_one": {"position": "대학 지원과 입학 서류 준비까지 함께 받고 싶은 학생",
                 "f1": "베이직 전체 포함 · 추천 대학 최대 5곳", "f2": "대학 지원 최대 2곳 관리", "f3": "자기소개서·학업계획서 첨삭 최대 2회",
                 "f4": "입학 서류 검토·보완 가이드", "f5": "비자 서류 준비 · 기숙사 신청 일정 관리"},
  "premium": {"position": "지원부터 비자, 입국 준비, 한국 초기 정착까지 함께하고 싶은 학생",
              "f1": "올인원 전체 포함 · 추천 대학 최대 7곳", "f2": "대학 지원 최대 3곳 관리 · 모의 면접 1회",
              "f3": "계약한 지원 서류 첨삭 · 횟수 제한 없음", "f4": "비자 일정 집중 관리 · 기숙사 신청 지원",
              "f5": "입국 30일 전부터 정착 30일까지 · 전담 팀 우선 응대"},
  "compare": {
   "group": {"consult": "상담과 추천", "apply": "실제 지원", "settle": "비자 · 정착"},
   "row": {"support": "상담 지원 기간", "followUp": "후속 지원", "recommended": "추천 대학·어학당", "managed": "대학 지원 관리",
           "documents": "서류 검토", "essay": "자기소개서·학업계획서 첨삭", "interview": "모의 면접", "visa": "비자 준비",
           "dormitory": "기숙사", "arrival": "입국 후 정착", "dedicated": "전담 팀 · 우선 응대"},
   "value": {"none": "미포함", "yes": "포함", "supportDays": "{{count}}일", "supportTerm": "계약 기간 내 상시",
             "followUpOnce": "후속 상담 {{count}}회", "followUp": {"TEAM": "담당 팀 후속 지원", "PRIORITY": "우선 응대"},
             "places": "최대 {{count}}곳", "rounds": "최대 {{count}}회", "essayContract": "계약 범위 내 제한 없음",
             "mockIncluded": "{{count}}회 포함", "addOn": "추가 서비스",
             "documents": {"CHECKLIST": "기본 체크리스트", "REVIEW_GUIDANCE": "검토·보완 가이드", "INTENSIVE": "집중 검토·보완"},
             "visa": {"GUIDANCE": "절차 안내", "DOCUMENT_PREP": "신청 서류 준비 지원", "INTENSIVE": "서류·주요 일정 집중 관리"},
             "dormitory": {"INFORMATION": "정보 안내", "SCHEDULE": "신청 일정 관리", "APPLICATION": "신청 지원 · 대안 숙소 안내"},
             "settlement": "입국 {{before}}일 전부터 정착 {{count}}일", "livingInfo": "기본 생활 정보"},
   "scopeNote": "프리미엄 첨삭은 계약한 지원 서류와 지원 일정 안에서 횟수 제한 없이 제공됩니다."},
  "notes": {"title": "이용 안내", "usd": "모든 요금은 미국 달러(USD) 기준 1회 결제 금액입니다.",
            "exchange": "실제 청구 금액은 환율과 카드사·결제사 수수료에 따라 달라질 수 있습니다.",
            "external": "대학 전형료, 등록금, 비자 수수료, 번역·공증, 국제 배송 같은 제3자 비용은 별도입니다.",
            "documentsVary": "필요한 서류는 국적, 학력, 지원 과정에 따라 달라집니다.",
            "visaDecision": "비자 지원은 준비와 신청 절차를 돕는 서비스이며, 발급 여부는 해당 기관이 결정합니다.",
            "agreement": "세부 일정, 첨삭 범위, 응답 시간과 서비스 범위는 서비스 계약서나 주문서에서 정할 수 있습니다.",
            "premiumScope": "프리미엄의 첨삭은 계약한 지원 서류와 지원 일정 안에서 횟수 제한이 없습니다.",
            "newDocuments": "새 서류 작성, 번역, 공증에는 별도 비용이 들 수 있습니다."},
  "addons": {"title": "추가 서비스", "lede": "필요할 때만 더하세요. 담당 팀이 범위와 금액을 먼저 안내하고, 동의하신 뒤에 결제합니다.",
             "col": {"service": "서비스", "unit": "단위", "price": "금액"},
             "item": {"extra_application": "대학 지원 관리 추가", "extra_edit": "자기소개서·학업계획서 첨삭 추가", "mock_interview": "모의 면접",
                      "dormitory": "기숙사 신청 지원", "airport_pickup": "공항 픽업 연결", "settlement": "추가 정착 지원"},
             "unit": {"UNIVERSITY": "대학 1곳", "EDIT_ROUND": "1회", "SESSION": "1회", "APPLICATION": "신청 1건",
                      "ARRANGEMENT": "연결 1회", "AGREED_SCOPE": "협의한 범위"},
             "range": "{{min}}–{{max}}", "quote": "별도 견적",
             "pickupNote": "공항 픽업은 제휴 운송 업체를 연결해 드리는 서비스입니다.",
             "premiumMock": "프리미엄은 첫 모의 면접이 포함되어 있습니다."}}},
}

EN = {
 "common": {"v29.pricing": {
  "basic": {"position": "For students who want to set a direction and choose the right universities first",
            "f1": "Personal diagnostic consultation + 1 follow-up", "f2": "Up to 3 universities or language institutes recommended",
            "f3": "Entry requirements, tuition and key dates compared", "f4": "Admission document checklist",
            "f5": "Visa preparation steps for your nationality"},
  "all_in_one": {"position": "For students who want support through applying and preparing admission documents",
                 "f1": "Everything in Basic · up to 5 recommendations", "f2": "Up to 2 university applications managed",
                 "f3": "Up to 2 rounds of statement and study-plan editing", "f4": "Document review with correction guidance",
                 "f5": "Visa documents prepared · dormitory deadlines tracked"},
  "premium": {"position": "For students who want support through visa, arrival and the first weeks in Korea",
              "f1": "Everything in All-in-One · up to 7 recommendations", "f2": "Up to 3 applications managed · 1 mock interview",
              "f3": "Editing of your contracted application documents, no round limit",
              "f4": "Intensive visa scheduling · dormitory application support",
              "f5": "30 days before arrival to 30 days after · dedicated team, priority replies"},
  "compare": {
   "group": {"consult": "Consultation & recommendations", "apply": "Applying", "settle": "Visa & settling in"},
   "row": {"support": "Consultation support", "followUp": "Follow-up", "recommended": "Universities recommended",
           "managed": "Applications managed", "documents": "Document review", "essay": "Statement & study-plan editing",
           "interview": "Mock interview", "visa": "Visa preparation", "dormitory": "Dormitory", "arrival": "After you arrive",
           "dedicated": "Dedicated team · priority"},
   "value": {"none": "Not included", "yes": "Included", "supportDays": "{{count}} day", "supportDays_other": "{{count}} days",
             "supportTerm": "Throughout your contract", "followUpOnce": "{{count}} follow-up consultation",
             "followUpOnce_other": "{{count}} follow-up consultations",
             "followUp": {"TEAM": "Responsible-team follow-up", "PRIORITY": "Priority response"},
             "places": "Up to {{count}}", "rounds": "Up to {{count}} round", "rounds_other": "Up to {{count}} rounds",
             "essayContract": "No round limit within your contract", "mockIncluded": "{{count}} included", "addOn": "Add-on",
             "documents": {"CHECKLIST": "Checklist", "REVIEW_GUIDANCE": "Review and correction guidance", "INTENSIVE": "Intensive review"},
             "visa": {"GUIDANCE": "Process guidance", "DOCUMENT_PREP": "Document preparation", "INTENSIVE": "Documents and key dates, closely managed"},
             "dormitory": {"INFORMATION": "Information", "SCHEDULE": "Application deadlines managed", "APPLICATION": "Application support and alternatives"},
             "settlement": "{{before}} days before arrival to {{count}} days after", "livingInfo": "Basic living information"},
   "scopeNote": "Premium editing has no round limit within your contracted application documents and schedule."},
  "notes": {"title": "Before you buy", "usd": "All prices are one-time payments in US dollars (USD).",
            "exchange": "The amount your card is charged can vary with exchange rates and card or payment-provider fees.",
            "external": "Third-party costs are separate: university application fees, tuition, visa fees, translation and notarization, international delivery.",
            "documentsVary": "The documents you need depend on your nationality, education and study level.",
            "visaDecision": "Visa support means help preparing and applying; the decision is the authority's.",
            "agreement": "The detailed schedule, editing scope, response times and service scope can be set in your service agreement or order.",
            "premiumScope": "Premium editing has no round limit within your contracted application documents and schedule.",
            "newDocuments": "Writing a new document, translation and notarization may cost extra."},
  "addons": {"title": "Additional services", "lede": "Add them only when you need them. Your team explains the scope and the price first, and you pay only after you agree.",
             "col": {"service": "Service", "unit": "Unit", "price": "Price"},
             "item": {"extra_application": "Extra managed application", "extra_edit": "Extra statement or study-plan edit",
                      "mock_interview": "Mock interview", "dormitory": "Dormitory application support",
                      "airport_pickup": "Airport pickup arrangement", "settlement": "Extra settling-in support"},
             "unit": {"UNIVERSITY": "1 university", "EDIT_ROUND": "1 round", "SESSION": "1 session", "APPLICATION": "1 application",
                      "ARRANGEMENT": "1 arrangement", "AGREED_SCOPE": "Agreed scope"},
             "range": "{{min}}–{{max}}", "quote": "Custom quote",
             "pickupNote": "Airport pickup is arranged through a partner transport provider.",
             "premiumMock": "Premium already includes your first mock interview."}}},
}


def put(tree: dict, dotted: str, value) -> None:
    parts = dotted.split(".")
    for p in parts[:-1]:
        tree = tree.setdefault(p, {})
    tree[parts[-1]] = value


def merge(dst: dict, src: dict) -> None:
    for k, v in src.items():
        if isinstance(v, dict) and isinstance(dst.get(k), dict):
            merge(dst[k], v)
        else:
            dst[k] = v


def apply(loc: str, data: dict) -> None:
    for ns, tops in data.items():
        f = ROOT / loc / f"{ns}.json"
        d = json.loads(f.read_text())
        for dotted, sub in tops.items():
            node = d
            for p in dotted.split("."):
                node = node.setdefault(p, {})
            merge(node, sub)
        f.write_text(json.dumps(d, ensure_ascii=False, indent=2) + "\n")


def split_addons(data: dict) -> None:
    """Add-on names/units are shown by every app (the agency console does not load `marketing`) → `common:v29.addon`."""
    a = data["common"]["v29.pricing"]["addons"]
    shared = {k: a.pop(k) for k in ("item", "unit", "range", "quote", "pickupNote", "premiumMock")}
    data["common"]["v29.addon"] = shared


if __name__ == "__main__":
    split_addons(KO)
    split_addons(EN)
    apply("ko", KO)
    apply("en", EN)
    # Plan names are unchanged by V29: carry each locale's own translation into the new key space.
    for locdir in sorted(p for p in ROOT.iterdir() if p.is_dir()):
        f, src = locdir / "common.json", locdir / "marketing.json"
        if not f.exists() or not src.exists():
            continue
        d = json.loads(f.read_text())
        old = json.loads(src.read_text()).get("v15", {}).get("pricing", {})
        new = d.setdefault("v29", {}).setdefault("pricing", {})
        for slug in ("basic", "all_in_one", "premium"):
            name = old.get(slug, {}).get("name")
            if name:
                new.setdefault(slug, {})["name"] = name
        f.write_text(json.dumps(d, ensure_ascii=False, indent=2) + "\n")
    print("v29 source strings written")


# ------------------------------------------------------------------ surfaces (student / agency / mobile / common)
SURF_KO = {
 "student": {"v29.services": {
  "unrationed": {"CONTRACTED_DOCUMENTS": "계약 서류 안에서 횟수 제한 없음", "TEAM": "담당 팀 후속 지원", "PRIORITY": "우선 응대", "ROUNDS": "포함"},
  "legacyContract": "이 플랜은 구매 당시({{version}}) 서비스 계약 기준으로 제공됩니다.",
  "term": {"title": "서비스 기간", "started": "서비스 시작", "notStarted": "첫 상담일에 시작돼요", "support": "상담 지원 기간",
           "supportLeft": "{{date}}까지 · {{count}}일 남음", "supportEnded": "{{date}}에 끝났어요", "supportFromStart": "첫 상담일부터 {{count}}일",
           "term": "계약 기간", "termUntil": "{{date}}까지", "termToAgree": "서비스를 시작할 때 함께 정해요", "arrival": "입국 준비·정착 지원",
           "arrivalWindow": "{{from}}부터 준비 · {{arrive}} 입국 · {{until}}까지 정착 지원", "arrivalToConfirm": "입국일이 정해지면 일정이 잡혀요",
           "status": "상태", "ended": "계약 기간이 끝났어요. 더 필요한 지원은 담당 팀과 상의해 주세요."},
  "addOn": {"title": "추가 서비스", "qty": "{{unit}} × {{count}}",
            "status": {"ACTIVE": "결제 완료 · 진행 중", "COMPLETED": "완료", "APPROVED": "이용 중", "DECLINED": "선택하지 않음"},
            "approve": "{{amount}} 결제하고 진행", "decline": "괜찮아요", "awaiting": "동의해 주셨어요. 결제가 끝나면 바로 시작해요.",
            "pay": "{{amount}} 결제하기", "noPressure": "선택하지 않아도 지금 플랜은 그대로 이어집니다.",
            "failed": "처리하지 못했어요. 잠시 후 다시 시도해 주세요."},
  "catalogue": {"title": "추가 서비스 보기", "premiumEditing": "프리미엄은 계약 서류 첨삭이 이미 포함되어 있어요.", "ask": "담당 팀에 추가 서비스 문의하기"},
  "upgrade": {"title": "{{from}} → {{to}} 업그레이드 시 달라지는 점", "used": "이미 진행한 지원과 사용한 횟수는 새 플랜에서도 그대로 계산돼요.",
              "pricePending": "업그레이드 금액은 아직 정해지지 않았어요. 한귤 유니브 팀이 직접 안내해 드릴게요.",
              "ask": "팀에 업그레이드 문의하기", "amountPending": "한귤 유니브 팀이 안내",
              "sheetLede": "지금까지 진행한 내용은 그대로 유지돼요. 업그레이드 금액은 한귤 유니브 팀이 직접 안내해 드려요."},
  "history": {"addOn": "추가 서비스"}}},
 "agency": {"v29.plan": {
  "unrationed": {"CONTRACTED_DOCUMENTS": "계약 서류 내 무제한", "TEAM": "담당 팀 후속 지원", "PRIORITY": "우선 응대", "ROUNDS": "포함"},
  "usedSoFar": "{{count}}회 진행", "legacy": "구매 당시 계약({{version}})",
  "offer": {"open": "추가 서비스 제안", "service": "서비스", "quantity": "수량 ({{unit}})", "unitPrice": "단가 (USD)",
            "range": "권장 범위 {{min}}–{{max}}", "quote": "별도 견적 — 금액과 범위를 직접 입력", "scope": "범위 메모 (학생에게 보여요)",
            "scopeRequired": "제공 범위 (필수, 학생에게 보여요)", "total": "학생 결제 금액 {{amount}}", "send": "학생에게 제안",
            "howItWorks": "학생이 금액과 범위를 확인하고 동의·결제한 뒤에만 적용돼요."},
  "duty": {"visa": {"GUIDANCE": "비자: 절차 안내", "DOCUMENT_PREP": "비자: 서류 준비 지원", "INTENSIVE": "비자: 서류·일정 집중 관리"},
           "dorm": {"INFORMATION": "기숙사: 정보 안내", "SCHEDULE": "기숙사: 신청 일정 관리", "APPLICATION": "기숙사: 신청 대행·대안 안내"},
           "settle": {"NONE": "정착: 미포함", "INFORMATION": "정착: 기본 생활 정보", "FULL": "정착: D-30 준비~D+30 지원"},
           "docs": {"CHECKLIST": "서류: 체크리스트", "REVIEW_GUIDANCE": "서류: 검토·보완 가이드", "INTENSIVE": "서류: 집중 검토"},
           "dedicated": "전담 담당·우선 응대"},
  "term": {"title": "서비스 기간", "since": "{{date}} 시작", "notStarted": "첫 상담 전", "until": "{{date}}까지", "toAgree": "계약 기간 미정",
           "support": "상담 지원 {{date}}까지", "supportDays": "첫 상담부터 {{count}}일", "ended": "기간 종료", "arrival": "입국·정착",
           "arrivalWindow": "{{from}} 준비 시작 · {{arrive}} 입국 · {{until}} 종료", "arrivalUnknown": "입국일 미확인",
           "set": "기간 저장", "endsLabel": "계약 종료일", "arrivalLabel": "입국 예정일", "saved": "서비스 기간을 저장했어요."},
  "addOnStatus": {"OFFERED": "제안됨", "AWAITING_PAYMENT": "결제 대기", "ACTIVE": "진행 중", "COMPLETED": "완료", "APPROVED": "이용 중 (이전 방식)"}}},
 "mobile": {"v29.plan": {
  "term": "서비스 기간", "termUntil": "{{date}}까지", "termToAgree": "시작할 때 함께 정해요", "supportUntil": "상담 지원 {{date}}까지",
  "supportDays": "첫 상담부터 {{count}}일", "arrival": "입국·정착 지원", "arrivalWindow": "{{from}} ~ {{until}}",
  "unrationed": {"CONTRACTED_DOCUMENTS": "계약 서류 내 제한 없음", "TEAM": "담당 팀 지원", "PRIORITY": "우선 응대", "ROUNDS": "포함"},
  "upgradePending": "업그레이드 금액은 아직 정해지지 않았어요. 한귤 유니브 팀이 직접 안내해 드릴게요.", "askTeam": "팀에 문의하기"}},
 "common": {"task.v29": {"scheduleDiagnostic": "유학 진단 상담 일정 잡기", "dormSchedule": "기숙사 신청 일정 확인·안내",
                         "housingAlternatives": "대안 숙소 안내 준비", "visaDocuments": "비자 신청 서류 함께 준비하기",
                         "visaSchedule": "비자 주요 일정 점검", "confirmArrival": "입국 예정일 확인", "preArrival": "입국 전 준비 지원 시작",
                         "studentPreArrival": "한국 입국 준비 점검하기", "settlement": "초기 정착 지원 진행"},
            "notify.v29": {"addonOffered": "한귤 유니브 팀이 추가 서비스를 제안했어요"}},
}
SURF_EN = {
 "student": {"v29.services": {
  "unrationed": {"CONTRACTED_DOCUMENTS": "No round limit within your contracted documents", "TEAM": "Responsible-team follow-up", "PRIORITY": "Priority response", "ROUNDS": "Included"},
  "legacyContract": "This plan is provided under the service contract in force when you bought it ({{version}}).",
  "term": {"title": "Service period", "started": "Service started", "notStarted": "Starts with your first consultation", "support": "Consultation support",
           "supportLeft": "Until {{date}} · {{count}} day left", "supportLeft_other": "Until {{date}} · {{count}} days left", "supportEnded": "Ended on {{date}}", "supportFromStart": "{{count}} day from your first consultation", "supportFromStart_other": "{{count}} days from your first consultation",
           "term": "Contract term", "termUntil": "Until {{date}}", "termToAgree": "Agreed with you when the service starts", "arrival": "Arrival & settling in",
           "arrivalWindow": "Preparation from {{from}} · arrival {{arrive}} · settling-in support until {{until}}", "arrivalToConfirm": "Scheduled once your arrival date is set",
           "status": "Status", "ended": "Your contract term has ended. Talk to your team about any further support."},
  "addOn": {"title": "Additional services", "qty": "{{unit}} × {{count}}",
            "status": {"ACTIVE": "Paid · in progress", "COMPLETED": "Done", "APPROVED": "Active", "DECLINED": "Not taken"},
            "approve": "Agree and pay {{amount}}", "decline": "No thanks", "awaiting": "Thanks for agreeing. We start as soon as the payment is through.",
            "pay": "Pay {{amount}}", "noPressure": "Saying no changes nothing — your plan continues as it is.",
            "failed": "That didn't go through. Please try again in a moment."},
  "catalogue": {"title": "See additional services", "premiumEditing": "Premium already includes editing of your contracted documents.", "ask": "Ask your team about an additional service"},
  "upgrade": {"title": "What changes from {{from}} to {{to}}", "used": "Support already delivered and allowances already used still count on the new plan.",
              "pricePending": "Upgrade pricing hasn't been set yet. The Hangyul Univ team will arrange it with you directly.",
              "ask": "Ask the team about upgrading", "amountPending": "Arranged by the Hangyul Univ team",
              "sheetLede": "Everything you've done so far stays. The Hangyul Univ team will tell you the upgrade price directly."},
  "history": {"addOn": "Additional service"}}},
 "agency": {"v29.plan": {
  "unrationed": {"CONTRACTED_DOCUMENTS": "No limit within contracted documents", "TEAM": "Responsible-team follow-up", "PRIORITY": "Priority response", "ROUNDS": "Included"},
  "usedSoFar": "{{count}} done", "legacy": "Bought under {{version}}",
  "offer": {"open": "Propose an additional service", "service": "Service", "quantity": "Quantity ({{unit}})", "unitPrice": "Unit price (USD)",
            "range": "Recommended range {{min}}–{{max}}", "quote": "Custom quote — enter the price and scope", "scope": "Scope note (shown to the student)",
            "scopeRequired": "Scope (required, shown to the student)", "total": "Student pays {{amount}}", "send": "Propose to student",
            "howItWorks": "Applies only after the student has seen the price and scope, agreed and paid."},
  "duty": {"visa": {"GUIDANCE": "Visa: process guidance", "DOCUMENT_PREP": "Visa: prepare documents", "INTENSIVE": "Visa: documents + key dates"},
           "dorm": {"INFORMATION": "Dorm: information", "SCHEDULE": "Dorm: track application window", "APPLICATION": "Dorm: run application + alternatives"},
           "settle": {"NONE": "Settling in: not included", "INFORMATION": "Settling in: basic information", "FULL": "Settling in: D-30 to D+30"},
           "docs": {"CHECKLIST": "Documents: checklist", "REVIEW_GUIDANCE": "Documents: review + correction", "INTENSIVE": "Documents: intensive review"},
           "dedicated": "Dedicated owner · priority"},
  "term": {"title": "Service term", "since": "Started {{date}}", "notStarted": "Before first consultation", "until": "Until {{date}}", "toAgree": "Term not set",
           "support": "Support until {{date}}", "supportDays": "{{count}} day from first consultation", "supportDays_other": "{{count}} days from first consultation", "ended": "Term ended", "arrival": "Arrival",
           "arrivalWindow": "Prep from {{from}} · arrives {{arrive}} · ends {{until}}", "arrivalUnknown": "Arrival date not confirmed",
           "set": "Save dates", "endsLabel": "Contract end", "arrivalLabel": "Arrival date", "saved": "Service dates saved."},
  "addOnStatus": {"OFFERED": "Proposed", "AWAITING_PAYMENT": "Awaiting payment", "ACTIVE": "In progress", "COMPLETED": "Done", "APPROVED": "Active (legacy)"}}},
 "mobile": {"v29.plan": {
  "term": "Service period", "termUntil": "Until {{date}}", "termToAgree": "Agreed when the service starts", "supportUntil": "Support until {{date}}",
  "supportDays": "{{count}} day from your first consultation", "supportDays_other": "{{count}} days from your first consultation", "arrival": "Arrival & settling in", "arrivalWindow": "{{from}} – {{until}}",
  "unrationed": {"CONTRACTED_DOCUMENTS": "No limit within contracted documents", "TEAM": "Team follow-up", "PRIORITY": "Priority response", "ROUNDS": "Included"},
  "upgradePending": "Upgrade pricing hasn't been set yet. The Hangyul Univ team will arrange it with you directly.", "askTeam": "Ask the team"}},
 "common": {"task.v29": {"scheduleDiagnostic": "Schedule the diagnostic consultation", "dormSchedule": "Track the dormitory application window",
                         "housingAlternatives": "Prepare alternative accommodation options", "visaDocuments": "Prepare the visa documents with the student",
                         "visaSchedule": "Check the visa key dates", "confirmArrival": "Confirm the arrival date", "preArrival": "Start pre-arrival support",
                         "studentPreArrival": "Get ready to arrive in Korea", "settlement": "Run initial settling-in support"},
            "notify.v29": {"addonOffered": "The Hangyul Univ team has proposed an additional service"}},
}

if __name__ == "__main__":
    apply("ko", SURF_KO)
    apply("en", SURF_EN)
    print("v29 surface strings written")


# ------------------------------------------------------------------ V28 §378.10 — no outcome promises in the why section
WHY_KO = {"marketing": {"v29.why": {
  "s1": {"title": "필요한 만큼,<br>처음부터 끝까지", "text": "대학 선택부터 서류, 비자, 입국 준비까지 원하는 단계만큼 함께합니다. 플랜마다 해 드리는 일이 정해져 있어, 무엇을 받게 될지 미리 알 수 있습니다."},
  "s3": {"title": "합리적인 비용,<br>분명한 서비스 범위", "text": "제공 범위를 먼저 밝히고, 미국 달러 기준 1회 결제로 시작합니다. 한귤은 결과를 약속하기보다 준비 과정을 분명하고 편하게 만드는 데 집중합니다."}}}}
WHY_EN = {"marketing": {"v29.why": {
  "s1": {"title": "As much help as you need,<br>start to finish", "text": "From choosing a university to documents, visa and arrival, we work with you for the stages you choose. Each plan states what we do, so you know what you are getting before you start."},
  "s3": {"title": "A fair price,<br>a clear scope", "text": "We state the scope up front, and you pay once, in US dollars, to start. Rather than promise outcomes, Hangyul focuses on making your preparation clear and manageable."}}}}

if __name__ == "__main__":
    apply("ko", WHY_KO)
    apply("en", WHY_EN)
    print("v29 why strings written")


GUIDE_KO = {"agency": {"v29.guide": {"verifyRequired": "관리 지원 전 확인 필요: {{fields}}",
  "field": {"current_intake": "이번 모집 회차 요강", "checklist": "제출 서류 목록", "deadline": "마감일", "submission_method": "제출 방법",
            "source_url": "공식 출처", "verified_date": "확인일"}}}}
GUIDE_EN = {"agency": {"v29.guide": {"verifyRequired": "Verification required before managing: {{fields}}",
  "field": {"current_intake": "this round's guide", "checklist": "document checklist", "deadline": "deadline", "submission_method": "submission method",
            "source_url": "official source", "verified_date": "verification date"}}}}

if __name__ == "__main__":
    apply("ko", GUIDE_KO)
    apply("en", GUIDE_EN)


LABEL_KO = {"student": {"v15.services.allowance.key": {"consultation_sessions": "진단 상담"}},
            "agency": {"v15.scope.key": {"consultation_sessions": "진단 상담"}},
            "mobile": {"plan.allowance": {"consultation_sessions": "진단 상담"}}}
LABEL_EN = {"student": {"v15.services.allowance.key": {"consultation_sessions": "Diagnostic consultation"}},
            "agency": {"v15.scope.key": {"consultation_sessions": "Diagnostic consultation"}},
            "mobile": {"plan.allowance": {"consultation_sessions": "Diagnostic consultation"}}}

if __name__ == "__main__":
    apply("ko", LABEL_KO)
    apply("en", LABEL_EN)


MFA_KO = {"mobile": {"v29.mfa": {"codeLabel": "인증 코드", "codeHint": "인증 앱의 6자리 코드나 복구 코드를 입력하세요.", "verify": "확인하고 로그인",
                                  "wrongCode": "코드가 맞지 않거나 만료됐어요. 새 코드로 다시 입력해 주세요.",
                                  "enrollOnWeb": "이 계정은 2단계 인증 등록이 필요해요. 웹 콘솔에서 먼저 등록한 뒤 앱에서 로그인해 주세요."}}}
MFA_EN = {"mobile": {"v29.mfa": {"codeLabel": "Verification code", "codeHint": "Enter the 6-digit code from your authenticator app, or a recovery code.",
                                  "verify": "Verify and sign in", "wrongCode": "That code is wrong or has expired. Enter a new one.",
                                  "enrollOnWeb": "This account needs two-step verification. Set it up in the web console first, then sign in here."}}}

if __name__ == "__main__":
    apply("ko", MFA_KO)
    apply("en", MFA_EN)
