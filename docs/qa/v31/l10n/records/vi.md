# V31 locale review — Vietnamese (vi)

Status: `SYNTHETIC_NATIVE_REVIEWED_V31`

Job: `scripts/i18n/v28/jobs-v31/vi.json` · Output: `scripts/i18n/v28/tx-v31/vi.json` · Glossary: `docs/qa/v31/l10n/glossary/vi.json`
Validator: `JOBS=jobs-v31 TX=tx-v31 node scripts/i18n/v28/validate.mjs --only=vi` → `V28 l10n (1 locales): 1729 strings valid, 0 problems`

## Counts

| | keys |
|---|---|
| Reviewed | 1,729 (common 310, concierge 181, dossier 66, marketing 384, student 590, success 33, visaroute 164, writing 1) |
| Kept verbatim | 1,482 |
| Rewritten | 247 |
| — new source (`v31`) | 132 (plus 70 `v31` keys re-checked against the new source and kept, because `current` already said the same thing) |
| — meaning | 34 |
| — terminology | 43 |
| — naturalness | 31 |
| — quality (UI role / tone) | 7 |

Vietnamese has one plural category (`other`); no extra CLDR forms were added. Existing `_one` keys are translated as job keys.

## Terminology decisions (applied in every key)

- Support window = "thời gian được hỏi thêm sau buổi tư vấn" (never "thời gian tư vấn").
- Managed application = "hồ sơ ứng tuyển Hangyul cùng bạn quản lý" / "cùng bạn quản lý hồ sơ ứng tuyển"; never the passive "hồ sơ được quản lý", and never wording in which Hangyul submits.
- Recommended = "được gợi ý" (not "giới thiệu" or "đề xuất").
- Document review = "kiểm tra giấy tờ"; correction notes = "chỉ ra điểm cần sửa"; editing = "chỉnh sửa" / "lượt chỉnh sửa".
- Personal statement = "bài luận cá nhân" (the older "bài tự giới thiệu" was removed); study plan = "kế hoạch học tập".
- Apostille = "chứng nhận Apostille"; consular legalization = "hợp pháp hóa lãnh sự". These are two separate procedures and are never merged.
- Sponsor = "người bảo lãnh" (no more "người bảo trợ").
- The student-facing team is "đội ngũ Hangyul". "Đội ngũ Hangyul Univ" is used only where the English says "Hangyul Univ team".
- Visa is "visa" everywhere. "Thị thực" was removed so the term stays the same across the app.
- Academyinfo replaces the Hangul "대학알리미", which the validator does not allow.

## Critical semantic issues found in `current`

| Key | `current` said | Now says |
|---|---|---|
| common:v29.pricing.compare.row.support | "Thời gian tư vấn" (consultation time: read as minutes or sessions) | "Thời gian được hỏi thêm sau buổi tư vấn" |
| common:v29.pricing.compare.scopeNote | Premium no-limit editing; left out that writing new documents, translation and notarization are NOT included | Full scope sentence plus the exclusion sentence |
| student:v4.ws.team.final | "Kiểm tra lần cuối, rồi gửi hồ sơ của bạn đến {{university}}" (Hangyul sends the application) | "Kiểm tra lần cuối trước khi bạn nộp hồ sơ cho {{university}}" |
| student:v15.services.allowance.unlimited | "Liên hệ không giới hạn với đội ngũ Hangyul Univ" ("unlimited" with no scope) | "Hỏi đội ngũ Hangyul bất cứ lúc nào trong thời hạn dịch vụ" |
| student:v15.services.scope.consultation | "Thời lượng tư vấn" (consultation duration, the V15 minutes wording) | "Tư vấn" |
| marketing:v12.privacy.collect.documents.items | "hợp pháp hóa lãnh sự (apostille)" (treats apostille as consular legalization) | "chứng nhận Apostille, công chứng và bản dịch công chứng" |
| student:register.privacyNote | Data shared only with "chuyên viên tư vấn" and universities (no mention of the partner agency) | Shared with the Hangyul team that supports you, including its partner agency, and the universities you choose |
| common:v29.addon.item.airport_pickup | "Sắp xếp xe đón sân bay" (as if Hangyul provides the car) | "Đón sân bay qua đối tác" |
| concierge:step.pickup.sub | "Có người đón bạn ở sảnh đến" (no partner) | "Đối tác đón sân bay sẽ gặp bạn tại sảnh đến" |
| common:v29.pricing.basic.f1 | "Tư vấn đánh giá du học riêng + 1 buổi theo dõi" (follow-up read as monitoring) | "1 buổi tư vấn đánh giá cá nhân + 1 buổi tư vấn tiếp theo" |
| common:v29.pricing.all_in_one.f5 | "Chuẩn bị hồ sơ visa" (Hangyul prepares the visa file) | "Hỗ trợ chuẩn bị hồ sơ visa · theo dõi lịch đăng ký ký túc xá" |
| common:v29.pricing.all_in_one.f2 / premium.f2 | "Quản lý tối đa N hồ sơ" (Hangyul manages alone) | "Cùng bạn quản lý hồ sơ ứng tuyển vào tối đa N trường" |
| common:v29.pricing.compare.row.managed / addon.item.extra_application | Passive "Hồ sơ được quản lý" | "Hồ sơ ứng tuyển Hangyul cùng bạn quản lý" |
| common:uni27.schol.youMay | Unfinished phrase "Bạn có thể đáp ứng điều kiện của" | "Học bổng bạn có thể đáp ứng điều kiện" |
| marketing:v15.pricing.compare.item | "Hạng mục" (the source is intentionally empty) | "" (empty) |
| marketing:v20.city.Gyeonggi.body/.line | Said Gyeonggi campuses have their own dorms "instead of rows of rooms"; "roomier" rendered as "greener" | More students live in dormitories rather than renting rooms outside; "rộng rãi hơn" |
| marketing:v23.privacy.retention.sendgrid | "ẩn danh hóa" (anonymized) for pseudonymized data | "bí danh hóa" |
| marketing:v11.hero.title / hero.lede / why.* / services.* | Old exaggerated Korean source ("rất dễ!", "biến giấc mơ thành hiện thực", "lo trọn quy trình", "kết quả tốt nhất") | Transcreated from the corrected V31 source with no promises |
| dossier:page.summary | "giấy tờ đã sẵn sàng cho mọi hồ sơ" (added "for every application") | "Đã sẵn sàng {{ready}}/{{total}}" |
| success:group.possible / student:discover.verdict.reach | "Có thể phù hợp" (lost "meets requirements, needs checking") | "Đáp ứng yêu cầu, cần kiểm tra thêm" |
| visaroute:step.slow_items.title | Broken phrase "lâu có nhất" | "Bắt đầu với những giấy tờ mất nhiều thời gian nhất" |
| marketing:v11.faq.q6.a | "Trường nào cũng có học bổng" (every university) | "Phần lớn các trường đều có" |

Total critical semantic issues: **22** (rows above, counting grouped keys once per row).

## Marketing scorecard (after rewrite; CLARITY / NATURALNESS / SPECIFICITY / TRUST / PERSUASION / BREVITY)

| Area | C | N | S | T | P | B | Total |
|---|---|---|---|---|---|---|---|
| Hero (v11.hero.*, seo.home.*) | 5 | 5 | 4 | 5 | 4 | 5 | 28 |
| Why section (v11.why.*, v29.why.*) | 5 | 5 | 5 | 5 | 4 | 4 | 28 |
| Services rows (v11.services.*) | 5 | 4 | 5 | 5 | 4 | 4 | 27 |
| Pricing (v29.pricing plan cards + comparison, v15.pricing.*) | 5 | 4 | 5 | 5 | 4 | 4 | 27 |
| Add-ons and purchase notes (v29.addon.*, notes.*, v31.pricing.notes.*) | 5 | 5 | 5 | 5 | 4 | 4 | 28 |
| FAQ (v11.faq.*) | 5 | 5 | 5 | 5 | 4 | 4 | 28 |
| Closing CTA (v11.cta.*, v20.uni.cta*) | 5 | 5 | 4 | 5 | 5 | 5 | 29 |
| Directory/discovery (v12.directory, v20/v21/v23/v24 dir, uni pages) | 5 | 5 | 5 | 5 | 4 | 5 | 29 |

No area is below 26/30.

## Product scorecard (student app; ACTION CLARITY / SEMANTIC ACCURACY / NATURALNESS / CONSISTENCY / BREVITY, out of 5)

| Area | AC | SA | N | Co | B | Fixes made |
|---|---|---|---|---|---|---|
| Home | 5 | 5 | 5 | 5 | 4 | team name, next consultation, lane labels |
| Applications | 5 | 5 | 4 | 5 | 4 | the final check is now before the student submits; checklist subtitle |
| Documents | 5 | 5 | 4 | 5 | 4 | package line and summary, OCR method, privacy roles |
| Services | 5 | 5 | 4 | 5 | 4 | allowance labels, scoped "any time", no "duration", external costs |
| Visa / housing | 5 | 5 | 5 | 5 | 4 | slow-documents step, pickup partner, embassy wording, Apostille vs legalization |

## Unresolved ambiguity (source unclear; not guessed)

- `marketing:v11.faq.q1.a`: the English and Korean both say "translated into English, notarized and apostilled". Viet Nam only started issuing apostilles on 11 Sep 2026 (see `visaroute:caveat.APOSTILLE_TRANSITION`), and the embassy lists still describe consular legalization. The FAQ follows the source, so the source may need a note that is specific to Vietnam.
- `marketing:v12.terms.refunds.commercial`: "how delivered consultations and reviews are deducted". It is unclear whether "reviews" means document review, essay editing rounds or both. It is rendered as "lần xem xét".
- `marketing:v9.funds.longer_other`: "rated 'consulting'" is the government's 컨설팅 tier. It is kept as "tư vấn" in quotes; no official Vietnamese name exists.
- `student:product` "Student": unclear whether this is a role label or an app name. It is kept as "Sinh viên".
