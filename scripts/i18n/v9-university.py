"""V9 university workstream strings (en + ko together). Merges the `v9` subtree into packages/i18n/locales/{en,ko}/university.json.
Run: python3 scripts/i18n/v9-university.py"""
import json, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2] / "packages/i18n/locales"

def P(one, other):  # i18next plural pair
    return {"_one": one, "_other": other}

EN = {
  "ov": {"also": "Also today"},
  "rv": {
    "agency": "Agency", "legalName": "Legal name", "registration": "Registration (Korean mission)", "counselor": "Responsible counselor",
    "notRecorded": "Not recorded", "reg": {"RECORDED": "Recorded", "VERIFIED": "Verified"}, "submitted": "Submitted",
    "evidenceFirst": "Check the evidence above first — the decision options become active once you have seen it.",
    "belowHint": "A published minimum is not met. The committee decides; no option is pre-selected.",
    "openNext": P("Open the next applicant after deciding or requesting documents ({{count}} waiting)", "Open the next applicant after deciding or requesting documents ({{count}} waiting)"),
    "showEarlier": P("Show {{count}} earlier request", "Show {{count}} earlier requests"),
  },
  "bulk": {
    "selectAll": P("Select all {{count}} matching", "Select all {{count}} matching"),
    "allSelected": P("All {{count}} matching applicant selected", "All {{count}} matching applicants selected"),
    "onlyPage": P("Only this page ({{count}})", "Only this page ({{count}})"),
    "previewing": "Counting the matching applicants…",
    "matching": P("{{count}} applicant matches the current filters.", "{{count}} applicants match the current filters."),
    "skipped": P("{{count}} will be skipped (its status does not allow this).", "{{count}} will be skipped (their status does not allow this)."),
    "firstRows": "First matching applicants", "willSkip": "Skipped",
    "andMore": P("…and {{count}} more", "…and {{count}} more"),
    "scopeAll": "Every applicant matching the current filters, across all pages. Each one is checked and reported separately.",
    "exportTitle": "Export all matching applicants", "exportConfirm": P("Download {{count}} row", "Download {{count}} rows"),
  },
  "chip": {"key": "Requirements", "eligibility": {"MEETS": "Meets published minimums", "BELOW": "Below a minimum", "TO_CHECK": "To check"}},
  "co": {"total": P("{{count}} student", "{{count}} students")},
  "an": {
    "tabsLabel": "Analytics questions",
    "tab": {"overview": "Overview", "recruitment": "Recruitment", "quality": "Admissions quality", "outcomes": "Post-admission outcomes"},
    "q": {
      "dropping": "Where are applicants dropping?", "countries": "Which countries convert to enrollment?",
      "programs": "Which programs attract qualified demand?", "agencies": "Which partner agencies send complete applications?",
      "outcomes": "How many admitted students receive visas, arrive and remain enrolled?", "when": "When do applications arrive?",
      "prepared": "How prepared do applications arrive?", "byGroup": "Which groups stay after admission?",
    },
    "col": {"submitted": "Submitted", "offered": "Offered", "enrolled": "Enrolled"},
    "conversion": "Submitted → enrolled", "qualified": "Qualified share", "qualifiedN": "Meet minimums",
    "minN": "Rates below n = {{min}} are withheld.", "allIntakesNote": "All intakes; filters above do not apply to these four facts.",
  },
  "impact": {
    "stop": P("{{n}} of {{total}} currently matching prospective students would stop meeting this requirement.", "{{n}} of {{total}} currently matching prospective students would stop meeting this requirement."),
    "start": P("{{n}} more would start meeting it.", "{{n}} more would start meeting it."),
    "empty": "No prospective students match this program right now, so no one would be affected today.",
    "insufficient": P("Not enough data to estimate ({{n}} of {{of}} profiles lacks {{fields}}).", "Not enough data to estimate ({{n}} of {{of}} profiles lack {{fields}})."),
    "population": "Counted: {{matched}} matched as Strong or Possible · {{active}} preparing an application · {{saved}} saved the program.",
    "field": {"GPA": "a GPA", "PRIOR_EDUCATION": "prior education", "TOPIK": "a TOPIK score", "IELTS": "an IELTS score", "TOEFL_IBT": "a TOEFL iBT score"},
  },
  "rules": {"priorEducation": "Minimum prior education"},
  "pv": {
    "title": "What the partnership delivers, measured", "cohort": "{{cohort}} · n = {{n}}",
    "foot": "Every number shows numerator, denominator and cohort. Rates with fewer than {{min}} in the denominator are withheld.",
    "medianN": "median of {{n}} decisions",
    "group": {"quality": "Application quality", "admission": "Offer to tuition", "after": "After admission"},
    "m": {
      "complete_on_first_review": "Complete on first review", "additional_document_request_rate": "Extra documents requested",
      "median_review_days": "Median review time", "offer_rate": "Offer rate (decided applications)", "acceptance_rate": "Offers accepted",
      "tuition_paid_rate": "Tuition paid", "visa_conversion": "Visa issued", "arrival_rate": "Arrived in Korea", "enrollment_rate": "Enrolled",
      "retention": "Still enrolled after the second term", "graduation": "Graduated on time",
    },
    "visaTitle": "Visa outcome by agency", "visaNone": "No application from an agency has reached tuition paid yet.",
    "issued": "Issued", "refused": "Refused", "pending": "No decision recorded", "refusal": "Refusal rate",
  },
  "team": {
    "remove": "Remove access", "restore": "Restore access", "restored": "Access restored.", "inactive": "Access removed",
    "removeTitle": "Remove access for {{name}}",
    "removeDesc": "They will no longer sign in to this console. Their open applicants move to the person you choose, in the same step.",
    "noOpen": "They hold no open applicants.", "holds": P("They hold {{n}} open applicant:", "They hold {{n}} open applicants:"),
    "holdsShort": P("{{count}} open applicant", "{{count}} open applicants"), "holdsNone": "No open applicants",
    "handTo": "Hand over to", "choose": "Choose a reviewer", "note": "Reason (kept in the audit log)",
    "removeAndMove": P("Remove and move {{count}} applicant", "Remove and move {{count}} applicants"),
    "removed": P("{{name}} removed; {{count}} applicant moved.", "{{name}} removed; {{count}} applicants moved."),
    "orphans": P("{{count}} open applicant is assigned to someone without access", "{{count}} open applicants are assigned to someone without access"),
    "orphansDone": "Applicants reassigned.", "reassign": "Reassign",
  },
}

KO = {
  "ov": {"also": "오늘 함께 볼 것"},
  "rv": {
    "agency": "유학원", "legalName": "법인명", "registration": "등록 (재외공관)", "counselor": "담당 상담사",
    "notRecorded": "기록 없음", "reg": {"RECORDED": "기록됨", "VERIFIED": "확인됨"}, "submitted": "제출일",
    "evidenceFirst": "먼저 위의 근거를 확인하세요. 근거를 본 뒤에 결정 버튼이 활성화됩니다.",
    "belowHint": "공개된 최소 기준에 미달하는 항목이 있습니다. 위원회가 판단하며, 미리 선택된 결정은 없습니다.",
    "openNext": P("결정 또는 서류 요청 후 다음 지원자 열기 (대기 {{count}}명)", "결정 또는 서류 요청 후 다음 지원자 열기 (대기 {{count}}명)"),
    "showEarlier": P("이전 요청 {{count}}건 보기", "이전 요청 {{count}}건 보기"),
  },
  "bulk": {
    "selectAll": P("조건에 맞는 {{count}}명 모두 선택", "조건에 맞는 {{count}}명 모두 선택"),
    "allSelected": P("조건에 맞는 지원자 {{count}}명 전체 선택됨", "조건에 맞는 지원자 {{count}}명 전체 선택됨"),
    "onlyPage": P("이 페이지만 ({{count}})", "이 페이지만 ({{count}})"),
    "previewing": "조건에 맞는 지원자를 세는 중…",
    "matching": P("현재 필터에 맞는 지원자는 {{count}}명입니다.", "현재 필터에 맞는 지원자는 {{count}}명입니다."),
    "skipped": P("{{count}}명은 상태상 이 작업을 할 수 없어 건너뜁니다.", "{{count}}명은 상태상 이 작업을 할 수 없어 건너뜁니다."),
    "firstRows": "조건에 맞는 첫 지원자", "willSkip": "건너뜀",
    "andMore": P("…외 {{count}}명", "…외 {{count}}명"),
    "scopeAll": "현재 필터에 맞는 모든 페이지의 지원자 전체입니다. 한 명씩 확인하고 결과를 따로 보고합니다.",
    "exportTitle": "조건에 맞는 지원자 전체 내보내기", "exportConfirm": P("{{count}}행 다운로드", "{{count}}행 다운로드"),
  },
  "chip": {"key": "요건", "eligibility": {"MEETS": "공개 최소 기준 충족", "BELOW": "최소 기준 미달", "TO_CHECK": "확인 필요"}},
  "co": {"total": P("학생 {{count}}명", "학생 {{count}}명")},
  "an": {
    "tabsLabel": "분석 질문",
    "tab": {"overview": "개요", "recruitment": "모집", "quality": "입학 품질", "outcomes": "입학 후 성과"},
    "q": {
      "dropping": "지원자는 어느 단계에서 이탈하나요?", "countries": "어느 국가가 등록으로 이어지나요?",
      "programs": "어느 전공에 자격을 갖춘 수요가 몰리나요?", "agencies": "어느 협력 유학원이 완비된 지원서를 보내나요?",
      "outcomes": "합격자 중 몇 명이 비자를 받고, 입국하고, 재학을 유지하나요?", "when": "지원서는 언제 들어오나요?",
      "prepared": "지원서는 얼마나 준비된 상태로 들어오나요?", "byGroup": "입학 후 어느 집단이 남아 있나요?",
    },
    "col": {"submitted": "제출", "offered": "합격", "enrolled": "등록"},
    "conversion": "제출 → 등록", "qualified": "자격 충족 비율", "qualifiedN": "최소 기준 충족",
    "minN": "n = {{min}} 미만인 비율은 표시하지 않습니다.", "allIntakesNote": "전체 학기 기준이며, 위 필터는 이 네 가지 지표에 적용되지 않습니다.",
  },
  "impact": {
    "stop": P("현재 매칭되는 예비 지원자 {{total}}명 중 {{n}}명이 이 요건을 더 이상 충족하지 못합니다.", "현재 매칭되는 예비 지원자 {{total}}명 중 {{n}}명이 이 요건을 더 이상 충족하지 못합니다."),
    "start": P("{{n}}명이 새로 충족하게 됩니다.", "{{n}}명이 새로 충족하게 됩니다."),
    "empty": "현재 이 전공에 매칭되는 예비 지원자가 없어 오늘 영향을 받는 사람은 없습니다.",
    "insufficient": P("추정할 데이터가 부족합니다 (프로필 {{of}}개 중 {{n}}개에 {{fields}} 없음).", "추정할 데이터가 부족합니다 (프로필 {{of}}개 중 {{n}}개에 {{fields}} 없음)."),
    "population": "집계 대상: 매칭 Strong·Possible {{matched}}명 · 지원 준비 중 {{active}}명 · 전공 저장 {{saved}}명.",
    "field": {"GPA": "GPA", "PRIOR_EDUCATION": "최종 학력", "TOPIK": "TOPIK 점수", "IELTS": "IELTS 점수", "TOEFL_IBT": "TOEFL iBT 점수"},
  },
  "rules": {"priorEducation": "최소 이전 학력"},
  "pv": {
    "title": "파트너십 성과 (실측)", "cohort": "{{cohort}} · n = {{n}}",
    "foot": "모든 수치는 분자, 분모, 코호트를 함께 표시합니다. 분모가 {{min}} 미만인 비율은 표시하지 않습니다.",
    "medianN": "결정 {{n}}건의 중앙값",
    "group": {"quality": "지원서 품질", "admission": "합격부터 등록금까지", "after": "입학 후"},
    "m": {
      "complete_on_first_review": "첫 검토에서 서류 완비", "additional_document_request_rate": "추가 서류 요청",
      "median_review_days": "검토 소요 일수 (중앙값)", "offer_rate": "합격률 (결정된 지원서 기준)", "acceptance_rate": "합격 수락",
      "tuition_paid_rate": "등록금 납부", "visa_conversion": "비자 발급", "arrival_rate": "한국 입국", "enrollment_rate": "등록",
      "retention": "2학기 이후 재학 유지", "graduation": "제때 졸업",
    },
    "visaTitle": "유학원별 비자 결과", "visaNone": "등록금 납부 단계에 이른 유학원 지원서가 아직 없습니다.",
    "issued": "발급", "refused": "거절", "pending": "결과 기록 없음", "refusal": "거절률",
  },
  "team": {
    "remove": "접근 해제", "restore": "접근 복원", "restored": "접근이 복원되었습니다.", "inactive": "접근 해제됨",
    "removeTitle": "{{name}}의 접근 해제",
    "removeDesc": "이 콘솔에 더 이상 로그인할 수 없습니다. 담당 중인 진행 지원자는 같은 단계에서 선택한 담당자에게 넘어갑니다.",
    "noOpen": "담당 중인 진행 지원자가 없습니다.", "holds": P("진행 중인 지원자 {{n}}명을 담당하고 있습니다:", "진행 중인 지원자 {{n}}명을 담당하고 있습니다:"),
    "holdsShort": P("진행 지원자 {{count}}명", "진행 지원자 {{count}}명"), "holdsNone": "진행 지원자 없음",
    "handTo": "인계 대상", "choose": "검토자 선택", "note": "사유 (감사 기록에 보관)",
    "removeAndMove": P("해제하고 지원자 {{count}}명 이관", "해제하고 지원자 {{count}}명 이관"),
    "removed": P("{{name}} 해제, 지원자 {{count}}명 이관됨.", "{{name}} 해제, 지원자 {{count}}명 이관됨."),
    "orphans": P("접근 권한이 없는 담당자에게 배정된 진행 지원자 {{count}}명", "접근 권한이 없는 담당자에게 배정된 진행 지원자 {{count}}명"),
    "orphansDone": "지원자가 재배정되었습니다.", "reassign": "재배정",
  },
}

def flat(d):
    out = {}
    for k, v in d.items():
        if isinstance(v, dict) and set(v) == {"_one", "_other"}:
            out[k + "_one"], out[k + "_other"] = v["_one"], v["_other"]
        elif isinstance(v, dict):
            out[k] = flat(v)
        else:
            out[k] = v
    return out

def keys(d, pre=""):
    for k, v in d.items():
        if isinstance(v, dict):
            yield from keys(v, pre + k + ".")
        else:
            yield pre + k

en, ko = flat(EN), flat(KO)
assert set(keys(en)) == set(keys(ko)), set(keys(en)) ^ set(keys(ko))
for loc, data in (("en", en), ("ko", ko)):
    p = ROOT / loc / "university.json"
    j = json.loads(p.read_text())
    j["v9"] = data
    p.write_text(json.dumps(j, ensure_ascii=False, indent=2) + "\n")
print("ok", len(list(keys(en))))
