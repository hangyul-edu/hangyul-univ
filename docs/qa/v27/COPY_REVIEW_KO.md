# Korean copy review (V27)

Patch: `scripts/i18n/v27/ko-copy-patch.json` (format `{ ns: { dotted.key: { ko } } }`). The ko bundles were not edited.

## Method

1. A script flattened every `packages/i18n/locales/ko/*.json` bundle and flagged Korean strings with an em dash, an en dash, a `label: text` colon, a slash between Hangul words, a parenthesis that is not a particle pair (`을(를)`, `(으)로`), or one of the vague words in brief §6 (최적의, 완벽한, 효율적인, 종합적인, 원스톱, 스마트한, 혁신적). None of the vague words occur anywhere outside the gated copy.
2. Two more passes looked for developer language (enum names, `데이터 최신성`, English glosses such as `(Yield)`), literal translations (`여정` in running text, `교외` for "off-campus", `수율` for "yield", `이름이 붙은 가중치 요소`), three-part slogans in `marketing`, and em dashes in strings made only of placeholders.
3. Every flagged string was read and rewritten by hand, keeping the register of its namespace: 해요체 for student screens, 합니다체 where the namespace or the surrounding group already used it (university console, budget, visa route, agency console), and short noun phrases for console chips and queue rows.
4. Excluded: every `marketing` key starting with `v11.`, every key in `docs/qa/v11/koreanasha-copy.json`, and every key path containing `privacy`, `terms` or `legal`. The consent summaries (`register.consent.*`, `signup.consent.*`) were also left alone as legal text.
5. Validation (a script that rebuilt the patch from the hand-written rewrites): all 601 keys exist in the ko bundle as strings. The `{{placeholder}}` multiset and the tag set match the original exactly. No rewritten value contains an em dash, none equals its original, and none is a gated, `v11.`, or legal key. Plural suffixes (`_one`/`_other`) were patched as pairs. New particle pairs use only the forms `packages/i18n/src/particles.ts` resolves (`이(가)`, `을(를)`).

## Counts per namespace

“Examined” is every Korean UI string the script scanned. “Flagged” is the strings that matched a pattern in step 1. “Rewritten” includes 20 strings that no pattern caught (step 2). “Left” is flagged strings that were judged fine.

| Namespace | Examined | Excluded (gated/legal) | Flagged | Rewritten | Flagged, left as is | of which colon / paren / other |
|---|---:|---:|---:|---:|---:|---|
| agency | 2566 | 8 | 165 | 109 | 62 | 43 / 19 / 0 |
| common | 791 | 2 | 44 | 26 | 18 | 10 / 9 / 0 |
| concierge | 692 | 0 | 45 | 14 | 31 | 10 / 21 / 0 |
| dossier | 218 | 1 | 36 | 23 | 13 | 6 / 7 / 0 |
| marketing | 1532 | 302 | 85 | 54 | 38 | 17 / 20 / 1 |
| mobile | 1189 | 6 | 63 | 30 | 35 | 25 / 10 / 1 |
| student | 2622 | 32 | 208 | 109 | 103 | 45 / 58 / 0 |
| success | 500 | 0 | 121 | 84 | 37 | 30 / 8 / 0 |
| university | 1721 | 3 | 147 | 67 | 81 | 22 / 60 / 1 |
| visaroute | 550 | 0 | 71 | 37 | 34 | 7 / 27 / 0 |
| writing | 494 | 0 | 69 | 48 | 21 | 5 / 16 / 0 |
| **Total** | 12875 | 354 | 1054 | **601** | 473 | |

### Why flagged strings were left as is

- **Console `label: value` rows** (most of the colon cases, mainly agency, success, mobile, university): `담당: {{name}}`, `기한 지남: {{title}}`, `출처: HCCH · 2026년 9월 27일 확인`, `다음: {{stage}}`. These are data rows on operational screens, where a short label and a value are the clearest form. Error lines that end in an interpolated message (`…하지 못했습니다: {{msg}}`) and examples (`예: …`) were kept for the same reason.
- **Parentheses that carry information, not the obvious**: units and periods (`등록금(2학기)`, `생활비(12개월)`), acronyms next to their Korean names (`건강보험(NHIS)`, `사회통합프로그램(KIIP)`, `인천(ICN)`), visa codes (`D-2(유학)`), `(선택)` on optional fields, formulas in KPI definitions (`수락(또는 이후 단계) ÷ 합격`), official grade names (`하위('컨설팅') 등급`), counts (`더 보기({{count}}곳)`), and keyboard hints (`(Ctrl+Enter로 전송)`).
- **State-contract labels**: `catalog3.verdict.REACH` (`아직 지원 불가 (한 단계 남음)`) follows `docs/STATE_MAP.md` and was not touched.
- **Em dashes kept on purpose**: `university.outcomes.note` uses `—` as the literal glyph that appears in empty table cells, and `visaroute.form.value.empty`, `visaroute.staff.none` and `writing.queue.next.NONE` are a lone `—` as an empty value. `marketing.v6.product.writing.p2` is part of a sample student essay inside a product illustration. Rewriting it would mean rewriting the illustration's fictional essay, so it was left.
- **`여정` as a short nav or eyebrow label** (`나의 유학 여정`, `유학 여정`) was kept. It is conventional on a heading. Where it appeared in running text it was rewritten (`login.aside.title`, `more.subtitle`, `mobile student.home.subtitle`).
- **Editorial city copy** (`marketing v20.city.*`): written deliberately, with fragments such as `더 싸고, 더 넓고, 지하철은 그대로 이어집니다.` that are a choice of voice, not machine artefacts. Only the run-on Gyeongbuk body was rewritten.
- **Dev-only strings** (`register.verify.consoleHint`, `signup.consoleHint`, `v21.testPay.cta`, `v22.team.devNote`) are never seen in production.

## Common rewrite patterns

- `A — B` became two sentences (`A예요. B…`) or a connective clause (`…해서`, `…지만`, `…이며`). It did not become `A, B`.
- In short console label pairs (`{{title}} — {{student}}`, `준비 완료 — 학생이 포털에서 제출`), `—` became ` · `. `{{student}} — {{doc}}` became `{{student}} 님의 {{doc}}`.
- `{{label}} — 수정 요청됨` became `{{label}} 수정 요청됨`. Korean needs no separator there.
- Numeric ranges `0–2일` and `{{from}} – {{to}}` became `0~2일` and `{{from}}~{{to}}`, the Korean convention.
- `(중앙값)`, `(환산)`, `(영어)` and `(직원용)` became plain modifiers: `…시간 중앙값`, `환산 GPA`, `영어 원문`, `직원용 메모`.
- `가/나` became `가·나`, or `가 또는 나` when it is a real choice.

## 40 representative examples

| # | Namespace · key | Problem | Before | After |
|---:|---|---|---|---|
| 1 | `agency` `login.asideTitle` | em dash | 누가, 왜, 언제까지 — 오늘 할 일부터 보여 드립니다. | 오늘 할 일부터, 누가 왜 언제까지 해야 하는지 보여 드립니다. |
| 2 | `agency` `kpi.tooFew` | em dash | {{den}}건 중 {{num}}건 — 비율을 보고하기에는 사례가 너무 적습니다 | {{den}}건 중 {{num}}건으로, 비율을 내기에는 사례가 너무 적습니다 |
| 3 | `agency` `templates.message.essayFeedback.body` | em dashes as parentheses | 에세이에 코멘트를 남겼습니다. 제안 사항을 검토해 보시고 — 수정 여부는 직접 결정하시면 됩니다 — 준비되면 다시 제출해 주세요. | 에세이에 코멘트를 남겼습니다. 제안을 살펴보시고 무엇을 고칠지는 직접 정하세요. 준비되면 다시 제출해 주세요. |
| 4 | `agency` `docs.bulkFailed_other` | explanatory parenthesis | {{count}}건은 변경하지 못했습니다(이미 처리되었거나 담당 학생이 아님) | {{count}}건은 이미 처리되었거나 담당 학생이 아니어서 변경하지 못했습니다 |
| 5 | `agency` `today.docsDetail` | label pair dash | 가장 오래됨: {{student}} — {{doc}}, {{wait}} 대기 | 가장 오래 기다린 서류: {{student}} 님의 {{doc}}, {{wait}} 대기 |
| 6 | `agency` `outcome.key.time_to_ready` | parenthetical qualifier | 지원 준비 완료까지 걸린 시간(중앙값) | 지원 준비 완료까지 걸린 시간 중앙값 |
| 7 | `agency` `v8.ops.sub` | colon list sentence | 운영이 어디서 막히는지 봅니다: 적체, 멈춘 건, 과부하, 지키지 못한 약속, 마감 위험, 느린 단계. 모든 숫자는 해당 기록으로 이어집니다. | 적체, 멈춘 건, 과부하, 지키지 못한 약속, 마감 위험, 느린 단계처럼 운영이 막히는 곳을 봅니다. 숫자를 누르면 해당 기록이 열립니다. |
| 8 | `agency` `v9.viewDef.waiting_hangyul` | colon list sentence | 한귤 운영팀이 다음 할 일을 맡고 있습니다: 결제했지만 에이전시 미배정, 또는 결제 문제. | 결제 후 에이전시가 배정되지 않았거나 결제에 문제가 있어 한귤 운영팀이 처리할 차례입니다. |
| 9 | `agency` `v9.tpl.scopeHelp` | colon-heavy label: text | 개인: 나만 사용. 팀: 유학원 전원이 사용하고 수정합니다. 조직: 유학원 표준 문구입니다. | 개인은 나만, 팀은 유학원 전원이 쓰고 고칠 수 있습니다. 조직은 유학원 표준 문구입니다. |
| 10 | `agency` `audit.prefix.freshness` | developer language | 데이터 최신성 | 정보 확인 시점 |
| 11 | `common` `matchReason.SLIGHTLY_OVER_BUDGET` | em dash | 예산을 조금 초과 — 장학금으로 보완 가능 | 예산을 조금 넘지만 장학금으로 메울 수도 있어요 |
| 12 | `common` `task.doc.LEGALIZE` | slash + parenthesis | {{university}} 지원용 {{category}} 인증(아포스티유/영사확인) 받기 | {{university}} 지원용 {{category}} 아포스티유·영사확인 받기 |
| 13 | `common` `task.reviewEssay` | em dash, word order | {{essayType}} 검토 — {{university}} | {{university}} {{essayType}} 검토 |
| 14 | `concierge` `help.sideText` | em dash | 숙소, 학교, 비자·서류, 결제 — 한곳에서 물어보세요. | 숙소, 학교, 비자·서류, 결제까지 한곳에서 물어보세요. |
| 15 | `concierge` `housing.searchExplain.INTERESTED` | parenthesis | 팀이 업체에 연락해 방 보기(방문 또는 영상)를 잡고 있어요. | 팀이 업체에 연락해 방문이나 영상으로 방을 볼 일정을 잡고 있어요. |
| 16 | `dossier` `reason.NEAR_EXPIRY_DATE` | em dash | {{date}}에 만료돼요 — {{university}} 마감 전이에요. 곧 새로 발급받으세요. | {{university}} 마감 전인 {{date}}에 만료돼요. 곧 새로 발급받으세요. |
| 17 | `dossier` `reason.TOO_OLD` | parenthesis | {{university}}는 최근 {{days}}일 이내에 발급된 서류가 필요해요 (지금 서류는 {{issued}} 발급). | {{university}}는 최근 {{days}}일 이내에 발급된 서류가 필요한데, 지금 서류는 {{issued}}에 발급됐어요. |
| 18 | `dossier` `v9.who.consent` | leading em dash | — {{date}}에 동의했기 때문 | {{date}}에 내가 동의함 |
| 19 | `marketing` `home.hero.lede` | em dash + three-part list | 현실적으로 지원 가능한 한국 대학을 확인하고, 모든 서류를 올바르게 준비하고, 비자와 입국까지 — 검증된 정보와 실제 상담사가 함께합니다. | 지원할 수 있는 한국 대학 확인부터 서류 준비, 비자와 입국까지. 검증된 정보와 실제 상담사가 함께합니다. |
| 20 | `marketing` `v6.product.lede` | em dash | 대학 홈페이지, 출입국 안내, 엑셀, 메신저 대화 — 지금 내 상황을 아는 하나의 계획으로 바뀝니다. | 대학 홈페이지, 출입국 안내, 엑셀, 메신저 대화에 흩어진 정보가 내 상황에 맞춘 계획 하나로 정리됩니다. |
| 21 | `marketing` `proof.lede` | slogan ("one question" + three) | 모든 화면은 한 가지 질문에 답합니다. 지금 상태, 부족한 것, 그리고 다음에 누가 무엇을 하는지. | 모든 화면에서 지금 상태와 부족한 것, 다음에 누가 무엇을 하는지 바로 알 수 있습니다. |
| 22 | `marketing` `v6.cta.lede` | fragment slogan | 세 가지 답, 30초, 가입 없이. 결정은 그다음에. | 가입 없이 30초면 세 가지에 답할 수 있어요. 결정은 그다음에. |
| 23 | `marketing` `v10.services.housing.text` | literal translation (교외) | 기숙사든 교외든, 월 비용과 보증금이 실제로 어떤 의미인지 알려 드립니다. 없는 매물을 만들어내지 않습니다 — 확인된 것만 보여 드립니다. | 기숙사든 학교 밖이든, 월 비용과 보증금이 실제로 무엇을 뜻하는지 알려 드립니다. 없는 매물은 만들지 않고 확인된 것만 보여 드립니다. |
| 24 | `marketing` `v15.pricing.compare.excluded` | colon list | 베이직에 포함되지 않는 범위: 개별 제출 서류의 상세 검토, 대학 지원서 작성·제출 지원, 자기소개서 첨삭, 비자 신청 대행. | 베이직에는 개별 제출 서류의 상세 검토, 대학 지원서 작성·제출 지원, 자기소개서 첨삭, 비자 신청 대행이 포함되지 않습니다. |
| 25 | `mobile` `university.cohorts.riskHint` | parenthesis | 조기 경보는 대학 시스템에서 공유된 데이터(출석, 학사 상태, 등록, 비자 만료일)로만 생성됩니다. 상담을 위한 알림일 뿐 예측이 아닙니다. | 조기 경보는 대학 시스템이 공유한 출석, 학사 상태, 등록, 비자 만료일 데이터로만 만듭니다. 상담을 돕는 알림일 뿐 예측이 아닙니다. |
| 26 | `student` `essay.placeholder` | literal translation | 여기에 써 보세요. 완벽하지 않아도 괜찮아요 — 첫 초안은 존재하기만 하면 돼요. | 여기에 써 보세요. 완벽하지 않아도 괜찮아요. 첫 초안은 일단 써 두는 게 중요해요. |
| 27 | `student` `matches.method.stage2` | colon + literal translation | 2단계 — 적합도: 자격을 갖춘 프로그램을 전공, 예산, 장학금, 지역, 주거 등 이름이 붙은 가중치 요소로 순위를 매겨요. 카드를 열면 점수를 모두 볼 수 있어요. | 2단계는 적합도예요. 자격을 갖춘 프로그램을 전공, 예산, 장학금, 지역, 주거 같은 요소별 가중치로 순위를 매겨요. 카드를 열면 점수를 모두 볼 수 있어요. |
| 28 | `student` `onboarding.education.method` | developer language | 성적 비교 방법: GPA를 단순 선형 방식(내 GPA ÷ 만점)으로 0~100% 점수로 환산해요. 대학마다 환산 방식이 다를 수 있으며, 학교가 특수한 척도를 쓰는 경우 한귤 상담팀이 메모를 남길 수 있어요. | 내 GPA를 만점으로 나눠 0~100% 점수로 환산해 비교해요. 대학마다 환산 방식이 다를 수 있고, 학교가 특수한 척도를 쓰면 한귤 상담팀이 메모를 남길 수 있어요. |
| 29 | `student` `budget.scholarshipCounted` | nested parenthesis | 총액에 반영했습니다(받을 수 있는 가장 큰 장학금 1개. 보통 등록금 장학금은 하나만 받습니다). | 받을 수 있는 가장 큰 장학금 1개를 총액에 반영했습니다. 등록금 장학금은 보통 하나만 받을 수 있습니다. |
| 30 | `student` `v9.funds.title` | parenthesis | 보여 줘야 하는 돈 (내는 돈 아님) | 내는 돈이 아니라 보여 줘야 하는 돈 |
| 31 | `student` `v26.explore.otherLevel` | literal translation (조용하게) | 희망 과정이 아닌 과정은 조용하게 표시했어요 ({{count}}개). | 희망 과정이 아닌 과정 {{count}}개는 흐리게 표시했어요. |
| 32 | `success` `obs.FEW_OPTIONS` | em dash | 지원한 과정이 하나예요 — 현실적인 선택지를 하나 더 두면 결과가 좋지 않을 때 대비할 수 있어요. | 지원한 과정이 하나뿐이에요. 현실적인 선택지를 하나 더 두면 결과가 좋지 않을 때 대비할 수 있어요. |
| 33 | `success` `submission.authorize.payer.UNKNOWN` | broken composed sentence | — 누가 내는지는 상담사가 확인해요 | 누가 낼지 상담사가 확인한 뒤 |
| 34 | `success` `agencyItem.DOC_FIX` | label dash | {{label}} — 수정 요청됨 | {{label}} 수정 요청됨 |
| 35 | `university` `kpi.yield` | mistranslation (수율) | 등록률(수율) | 등록률 |
| 36 | `university` `def.applicants` | enum in copy | 제출(SUBMITTED) 단계에 도달한 한귤 지원서 수 (작성 중·준비 중 지원서는 학생에게만 공개됩니다). | 제출 단계에 도달한 한귤 지원서 수입니다. 작성 중이거나 준비 중인 지원서는 학생에게만 공개됩니다. |
| 37 | `university` `v6.facts.foot` | colon definitions | 1차 검토 완결: 추가 서류를 요청하지 않은 지원서. 검증 완료: 공유 전 Hangyul 검토자가 확인한 서류. 결정 소요: 제출부터 첫 결정까지의 중앙값(일). 표본이 {{min}}건 미만이면 값을 표시하지 않습니다. | 1차 검토 완결은 추가 서류를 요청하지 않은 지원서, 검증 완료는 공유 전 한귤 검토자가 확인한 서류, 결정 소요는 제출부터 첫 결정까지 걸린 일수의 중앙값입니다. 표본이 {{min}}건 미만이면 값을 표시하지 않습니다. |
| 38 | `visaroute` `methodNote.INTAKE_WINDOWS` | parenthesis + en dash | 학생 비자는 정해진 기간에만 접수합니다 (봄학기: 12월 1일–2월 15일, 가을학기: 6월 1일–8월 14일). | 학생 비자는 봄학기 12월 1일~2월 15일, 가을학기 6월 1일~8월 14일에만 접수합니다. |
| 39 | `writing` `finding.OTHER_UNIVERSITY` | em dash, order | {{name}}이(가) 언급되어 있습니다 — 이 글은 {{target}}용입니다. 다른 지원서에서 옮겨 온 문장이 아닌지 확인하세요. | {{target}}용 글인데 {{name}}이(가) 언급되어 있습니다. 다른 지원서에서 옮겨 온 문장이 아닌지 확인하세요. |
| 40 | `writing` `insights.breachesDef` | dash inside parenthesis | 예정 시간(첫 검토 48시간, 수정본 48시간, 최종 24시간 — 정책이 다르면 그 기준) 안에 응답하지 못한 검토 차수. | 예정 시간 안에 응답하지 못한 검토 차수입니다. 기준은 첫 검토 48시간, 수정본 48시간, 최종 24시간이며, 정책이 다르면 그 기준을 따릅니다. |

## Strings whose meaning looks wrong or unclear

### Not changed. These need an owner's decision.

1. **`university` `enrollment.TRANSFERRED` = `편입(전출)`, `university` `cohorts.mixSub` (`… 자퇴, 편입(전출) 학생`), `mobile` `university.enrollment.TRANSFERRED` = `편입/전출` (the one slash left in the flagged set).** The English is "Transferred", a status of an already-enrolled student, so it means *transferred out* (전출). 편입 means transferring *in*, so the label reads as both directions at once. Suggested: `전출` (or `타교 전출`) if only outgoing transfers are recorded.
2. **Hard-coded particles after name placeholders** (about 40 strings, untouched because they have no §6 problem): for example `{{agency}}가 공식 포털에서…` (`success.submission.authorize.whoValueNoName`, `.withdraw`, `.check`, `.activeTextNoName`, `.failure`), `{{agency}}는` (`.withdrawText`), `{{org}}는 통합 로그인…` (`university.login.sso*`), `{{org}}와 함께` (`student.home.counselorAt`, `v22.home.withAgency`, `mobile v23.team.withAgency`), `{{name}}으로 변경` (`student.v15.services.upgrade`), `{{track}}은` (`common.fit.reason.needed_track`), `{{level}}을` (`student.start.result.unlock.IELTS_*`), and `{{other}}와`/`{{category}}와` (`dossier.finding.*DUPLICATE`). These are wrong whenever the interpolated name ends the other way (`ABC유학원가`, `…Center는`). The `이(가)`/`은(는)`/`과(와)`/`(으)로` forms are already resolved by `packages/i18n/src/particles.ts` and would fix them. University names ending in 교 are unaffected.
3. **`mobile` `signup.quickLevel` = `급/점수`** (patched only to `급·점수`): the English is just "Level". The Korean adds "score", which may be intentional (TOPIK level or IELTS score) but differs from the source.
4. **`agency` `catalog3.verdict.REACH` = `아직 지원 불가 (한 단계 남음)`**: the Korean says "not eligible" and "one step away" at once. STATE_MAP fixes the label, so it was not touched, but the parenthesis reads as a contradiction to a Korean reader.

### Fixed in the patch. The meaning changed slightly, so they are listed here and were not fixed silently.

5. **`university` `kpi.yield` `등록률(수율)`** and **`mobile` `university.kpi.yield`/`kpiName.yield` `등록률(Yield)`**: 수율 is manufacturing yield, a mistranslation. Now `등록률`. `kpi.noShow` `미등록(노쇼)률` became `미등록률`, and the English glosses `(No-show)` were dropped.
6. **`marketing` `v10.services.housing.text`**: `기숙사든 교외든` used 교외 ("suburbs") for "off-campus". Now `기숙사든 학교 밖이든`.
7. **`student` `matches.method.stage2`**: `이름이 붙은 가중치 요소` was a literal rendering of "named weighted factors". Now `요소별 가중치`.
8. **`student` `onboarding.education.method`**: `단순 선형 방식(내 GPA ÷ 만점)` is developer phrasing. Now `내 GPA를 만점으로 나눠 0~100% 점수로 환산해`. The formula is unchanged.
9. **`success` `submission.authorize.payer.UNKNOWN`**: the value `— 누가 내는지는 상담사가 확인해요` is interpolated into `feeValue`/`feeValueNoPayee` (`{{amount}} — {{payer}} {{payee}}에 납부`), which rendered `50,000원 — — 누가 내는지는 상담사가 확인해요 납부`. Now `누가 낼지 상담사가 확인한 뒤`, so the composed line reads `50,000원 · 누가 낼지 상담사가 확인한 뒤 납부`.
10. **`visaroute` `track.waitingText`**: `결과 기록을 알려 드립니다` was ambiguous. The English says "we'll remind you to record the result". Now `결과를 기록하도록 알려 드립니다`.
11. **`student` `settingsV3.translation.*` and `common` `i18n.machine`**: `(이 앱의 {{percent}}%)` was rewritten as "앱의 {{percent}}%가 번역되어 있고…". This assumes `percent` is translation coverage, which matches the English "({{percent}}% of this app)". Please confirm.
12. **`university` `v6.facts.foot`, `v6.partner.subtitle`**: these were the only university strings that wrote `Hangyul` in Latin letters inside Korean prose. They now say `한귤`, like the rest of the namespace.
13. **`success` `submission.next.AUTHORIZED_AGENCY`, `submission.authorize.done/activeTitle/changed`**: `{{agency}}가` was changed to `{{agency}}이(가)` or `{{agency}}에서` as part of the rewrite (see item 2).
