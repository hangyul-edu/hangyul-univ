# V31 visual sign-off (brief Parts 64–66)

Manual review of every required BEFORE/AFTER pair in `docs/qa/v31/before/` and `docs/qa/v31/after/` (same data, same
viewports; captured by `scripts/qa/v31/capture.mjs`), plus the gate screenshots in `docs/qa/v31/stage/`,
`docs/qa/v31/pricing/` and the device screenshots in `docs/qa/v31/native/`. "First read" = what the eye lands on
first. This is a designer's self-critique, not an owner approval.

| Screen | Before — first read | After — first read | Verdict | Still weak |
|---|---|---|---|---|
| Marketing pricing tail 1440 (`mk-pricing-tail-1440`) | A table on the left, a lone `이용 안내` accordion on the right over ~400 px of empty column | One warm-paper panel the width of the plan row: title, lede, two aligned columns of add-ons (name/unit left, price right), the Premium note, then a full-width "구매 전에 확인해 주세요" disclosure with a summary line | Fixed | ~100 px of white between the compare control and the panel is generous; acceptable |
| Pricing tail 390 | Same parts stacked, accordion floating after the table | One column of rows; the disclosure is the panel's last row; 4 labelled groups when open | Fixed | — |
| Pricing tail, ar/ur 1440 | — | Mirrored layout; prices at the inline end. Ranges read right-to-left with the minimum on the right ("$ 35–$ 20" / "$50–$30" visually = 20→35 / 30→50). An LTR isolate was tried and REVERTED: it broke Intl's RLM-marked Arabic output | Correct by RTL convention | A native Arabic/Urdu reader should confirm the range convention (`pricing/addons-{ar,ur}-1440.png`) |
| Marketing home 1440 (`mk-home-full-1440`) | Rhythm held except the pricing tail | Same sections; the tail no longer breaks the rhythm | Improved | Owner-verbatim Korean promises (완벽/최고/보장) unchanged by rule |
| Agency Today 1440 (`ag-today-1440`) | Grey canvas, three white slabs; chevron strip with 전체 as a stage; 긴급 alone; 종료 stranded | White canvas, paper nav panel; 긴급 7 (red count) and 전체 19 as bordered views, then a nine-stage rail with counts and a share segment, 종료 0 at the end; table follows directly | Fixed | The 4 filter selects + search are one more row than ideal |
| Agency rail close-up (`ag-stage-rail-1440`, `stage/rail-1440`) | Text + 14 px chevrons, thin outline selection | Label / 22 px count / segment, one button; selection = tint + tangerine segment; zero quiet | Fixed | — |
| Agency Today 1280 | — (V31 interim: last stage cut through its label) | All nine stages fit (72 px minimum); found and fixed by `qa:v31-stage` during the final run | Fixed | — |
| Agency Today 1024 (`ag-today-1024`) | Rail overflowed the page (982 px in 784) | Rail scrolls inside its band; the edge fades after 합격 so more stages are signalled; 종료 stays visible | Fixed | — |
| Agency workspace 1440 (`ag-workspace-1440`) | Grey canvas around white cards | White canvas; header card + 7-segment progress; work list and conversation side by side | Improved | "기한 지난: 에세이 검토 기한 초과" says overdue twice (escalation task whose own due date passed) — copy item |
| University home + pipeline 1440 (`un-home`, `un-pipeline`) | Same grey shell; stage strip like Agency | Same shell as Agency; applicant stages on the same rail; the conversion strip is now titled "지금까지의 누적 결과" so "5 합격 통보" above "합격 1" no longer reads as a contradiction | Fixed | Two adjacent horizontal summaries (KPI row + cumulative strip) before the rail — dense but legible |
| Student home 1440/390 (`st-home-*`) | Next action dominant; Upcoming panel mixed English programme names | Same hierarchy; Upcoming fully Korean; grouped lines name the documents ("가족관계증명서 · 자기소개서 · …") instead of fragments ("지원용 …") | Fixed | — |
| Student applications / documents 1440 | Warm surfaces, cool hairlines | Warm hairlines; rows with outlined secondary buttons; reviewer notes in the counselor's own language (user content) | Improved | — |
| Native student ko (`native/student-home-ko-after`) | English university/programme + English checklist label | "부산대학교 · 경영학과 지원용 성적증명서 수정하기"; upcoming fully Korean | Fixed | Photo placeholder is a flat grey block until the image arrives |
| Native agency ko (`native/agency-home-ko`) | "(Đặng Thảo Vy)" repeated after a title naming her | Name appears once | Fixed | — |
| Native university ko (`native/university-home-ko`) | — | Fully Korean; counts, attention list, review list | Reviewed | 2×2 count grid shows two zeros ("this week") at equal weight to the 6 that needs action |

**Not reviewed visually in V31:** every locale × every route (the V30 crawl covers geometry/mixed-locale mechanically
for ko/en/vi/zh-Hans/ar); native flows beyond the home screens (upload, messaging, decisions).
