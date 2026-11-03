# V29 service-contract l10n record — th (Thai)

Job: `scripts/i18n/v28/jobs-v29/th.json` (158 keys, all `current: null`) → `scripts/i18n/v28/tx-v29/th.json`.
Validator: `JOBS=jobs-v29 TX=tx-v29 node scripts/i18n/v28/validate.mjs --only=th` → 158 strings valid, 0 problems (EXIT=0). Not applied.

## Personas

- First-time visitor: Bangkok high-school senior (18) comparing study-abroad agents on mobile
- Comparison shopper: parent/sponsor checking what each package really includes and what costs extra
- Graduate applicant (26) who wants only document editing and visa help

## Key term decisions

- No round limit within contracted documents: “ไม่จำกัดรอบ ภายในเอกสารตามสัญญา” (rounds only; bounded by the contracted documents). Long form adds “และกำหนดการตามที่ทำสัญญาไว้”. Never “ไม่จำกัด” on its own.
- Up to N managed applications: “ดูแลการสมัคร…สูงสุด N แห่ง” (we look after the application), distinct from recommendations “แนะนำ…สูงสุด N แห่ง”.
- Custom quote: “ประเมินราคาเฉพาะราย” (priced case by case).
- Airport pickup arrangement: “ประสานงานรถรับที่สนามบิน” — Hangyul coordinates; the note names the partner transport provider.
- Package = แพ็กเกจ (matches v15.pricing); 첨삭 = ขัดเกลา; personal statement = เรียงความแนะนำตนเอง; study plan = แผนการศึกษา (existing docCategory terms).

## Glossary

| Concept | Korean (canonical) | th |
|---|---|---|
| Contracted-docs no round limit (card) | 계약 서류 안에서 횟수 제한 없음 | ไม่จำกัดรอบ ภายในเอกสารตามสัญญา |
| Premium scope note | 계약한 지원 서류와 지원 일정 안에서 횟수 제한 없이 | การขัดเกลาเอกสารของ Premium ไม่จำกัดจำนวนรอบ ภายในเอกสารสมัครและกำหนดการตามที่ทำสัญญาไว้ |
| Premium feature f3 | 계약한 지원 서류 첨삭 · 횟수 제한 없음 | ขัดเกลาเอกสารสมัครตามสัญญา ไม่จำกัดจำนวนรอบ |
| Up to N managed applications | 대학 지원 최대 2곳 관리 | ดูแลการสมัครมหาวิทยาลัยสูงสุด 2 แห่ง |
| Applications managed (row) | 대학 지원 관리 | การสมัครที่เราดูแล |
| Universities recommended (row) | 추천 대학·어학당 | มหาวิทยาลัยที่แนะนำ |
| Recommend up to 3 | 대학·어학당 최대 3곳 추천 | แนะนำมหาวิทยาลัยหรือสถาบันภาษาเกาหลีสูงสุด 3 แห่ง |
| Custom quote | 별도 견적 | ประเมินราคาเฉพาะราย |
| Airport pickup arrangement | 공항 픽업 연결 | ประสานงานรถรับที่สนามบิน |
| Pickup note | 제휴 운송 업체를 연결 | บริการรับที่สนามบินเป็นการประสานงานกับผู้ให้บริการขนส่งที่เป็นพันธมิตร |
| Visa decision | 발급 여부는 해당 기관이 결정 | การช่วยเรื่องวีซ่าคือการช่วยเตรียมและยื่นคำร้อง ส่วนผลการอนุมัติเป็นการตัดสินของหน่วยงานที่เกี่ยวข้อง |
| Additional service | 추가 서비스 | บริการเพิ่มเติม |
| Mock interview | 모의 면접 | สัมภาษณ์จำลอง |
| Statement & study-plan editing | 자기소개서·학업계획서 첨삭 | ขัดเกลาเรียงความและแผนการศึกษา |
| Editing round | 1회 (첨삭) | 1 รอบ |
| Dormitory | 기숙사 | หอพัก |
| Settling in | 정착 지원 | ดูแลการตั้งตัวเพิ่มเติม |
| Consultation support period | 상담 지원 기간 | ระยะเวลาให้คำปรึกษา |
| Contract term | 계약 기간 | ระยะเวลาสัญญา |
| Priority response | 우선 응대 | ตอบกลับเป็นลำดับแรก |
| Dedicated team | 전담 팀 | ทีมดูแลเฉพาะ · ตอบกลับก่อน |
| Responsible team follow-up | 담당 팀 후속 지원 | ทีมที่ดูแลติดตามต่อ |
| Agreed scope | 협의한 범위 | ตามขอบเขตที่ตกลงกัน |
| Before you buy | 이용 안내 | ก่อนตัดสินใจซื้อ |
| Decline add-on | 괜찮아요 | ไม่เป็นไร |

Plan names stay Latin (Basic, All-in-One, Premium) as in `common.json v29.pricing.<slug>.name`; brand is “Hangyul Univ” / “Hangyul” in Latin.

## Passes

**Pass A — meaning vs Korean** — 4 strings changed during the pass.

- Draft “แก้ไขเอกสารได้ไม่จำกัด” → “ขัดเกลาเอกสารสมัครตามสัญญา ไม่จำกัดจำนวนรอบ”
- Draft “สมัครได้ 3 มหาวิทยาลัย” → “ดูแลการสมัครสูงสุด 3 แห่ง”
- Draft “บริการรับส่งสนามบิน” → “ประสานงานรถรับที่สนามบิน”
- Draft “วีซ่าผ่านแน่นอน” tone → “ผลการอนุมัติเป็นการตัดสินของหน่วยงานที่เกี่ยวข้อง”
- task.v29.dormSchedule “ตรวจสอบหอพัก” → “ติดตามและแจ้งช่วงเวลาสมัครหอพัก” (KO 확인·안내)

**Pass B — native naturalness** — 3 strings changed during the pass.

- “ทีม Hangyul Univ ได้เสนอ…” → “ทีม Hangyul Univ เสนอบริการเพิ่มเติมให้คุณ”
- “ไม่ ขอบคุณ” → “ไม่เป็นไร”
- “การปฏิเสธไม่เปลี่ยนอะไร” → “ถ้าไม่เลือก ก็ไม่มีอะไรเปลี่ยน”
- “ราคายุติธรรม” → “ราคาสมเหตุสมผล”
- “เริ่มการปรึกษาแรก” → “เริ่มนับตั้งแต่วันปรึกษาครั้งแรก”

**Pass C — UI brevity, one term per concept** — 3 strings changed during the pass.

- mobile CONTRACTED_DOCUMENTS (long form) → “ไม่จำกัดรอบ ในเอกสารตามสัญญา”
- mobile PRIORITY “ตอบกลับเป็นลำดับแรก” → “ตอบกลับก่อน”
- row.dedicated long → “ทีมดูแลเฉพาะ · ตอบกลับก่อน”
- “บริการเสริม/บริการเพิ่มเติม” mixed → บริการเพิ่มเติม for add-on titles; บริการเสริม only for the compare cell
- mobile TEAM → “ทีมติดตามต่อ”

## Marketing scorecard (30-point: clarity, trust, naturalness, brevity, CTA strength, cultural fit)

| Section | Cl | Tr | Na | Br | CTA | Cu | Total |
|---|---|---|---|---|---|---|---|
| why.s1 | 5 | 4 | 4 | 4 | 4 | 5 | 26 |
| why.s3 | 5 | 5 | 4 | 4 | 4 | 4 | 26 |

## Unsure

- “ขัดเกลา” vs “แก้ไข” for 첨삭 — chose ขัดเกลา (polishing) to avoid implying we rewrite the essay.
- compare.value.addOn uses บริการเสริม (short cell) while titles use บริการเพิ่มเติม; merge if one term is preferred.

## Counts

- Job keys: 158; strings written: 158
- Kept verbatim from `current`: 0 (none existed)
- Rewritten: 0
- Newly translated: 158

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
