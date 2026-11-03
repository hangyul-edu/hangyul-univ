# Korean copy review (V28, brief §32 §38 §44 §45)

Patch: `scripts/i18n/v28/ko-copy-patch.json`. Format: `{ ns: { dotted.key: { ko } } }`. **121 keys.** The ko bundles were not edited.
Scope: the keys in `docs/qa/v28/l10n/keys-A.txt` (customer-facing, 1,740) and `keys-B.txt` (operational, 851), and nothing else.

## Method

1. Every listed key was resolved against `packages/i18n/locales/ko/<ns>.json`. Each Korean string was read by hand, one sentence at a time, with the English source next to it wherever the meaning was in doubt. The pass was not driven by regex.
2. Excluded without reading for edits:
   - every `marketing` key starting with `v11.`, and every `hangyulKey` in `docs/qa/v11/koreanasha-copy.json`;
   - every key whose path contains `privacy`, `terms` or `consent` (`marketing v12.privacy.*`, `v12.terms.*`, `register.consent.*`, `settings.privacy.*`, `profileV3.privacy` and others);
   - the company-identity block `marketing v14.legal.*` and `footer.legal`.

   Document *legalization* keys (`legalization.*`, `compare.legalCount_other`, `v27.doc.legal.APOSTILLE`, `documents.legalization`) are not legal copy, so they were examined. None of them needed a change.
3. Not rewritten on purpose:
   - STATE_MAP labels: `appStatus.*`, `stage.*`, `v4.status*`, `waiting.*`, `v9.waiting.*`, `verdict.*`, `discover.verdict.*`, tier labels.
   - Data-row colons on consoles (`담당: …`, `기한 지남: {{title}}`).
   - Parentheses that carry information: acronyms, units, `(선택)`.
   - V27's editorial city copy (`v20.city.*`).
   - Retention and deletion statements (`dossier v9.who.kept*`, `settings.data.confirmText`). These stay neutral legal copy.
   - Every particle that follows a placeholder (`{{x}}이(가)`, `{{org}}와`, `{{name}}으로`). Where a rewritten sentence contains one, it was copied byte for byte.
4. Register by surface:
   - **Student**: 해요체. The visa route (`visaroute` A keys) was still entirely 합니다체 and used `귀하`. It was moved to 해요체 and `귀하` → `내 국적`. The same move was made for the profile "why" lines, sign-up hints, scholarships and writing.
   - **Exceptions kept**: budget and money (`student budget.*`, `v9.money.*`, `v9.funds.*`) stay in the 합니다체 V27 chose for that page. Phase texts (`phase.*.text`) stay 합니다체 because five of their seven siblings are outside this key set.
   - **Marketing**: 해요체 for the 404 and the SEO description. The `v20.uni.*` university pages stay in their editorial 합니다체.
   - **Agency**: short operational lines.
   - **University**: precise 합니다체.
5. Empty and error states got the next action where one exists. For example:
   - `apps.empty`: "…필터를 바꾸거나 지워 보세요"
   - `review.noPdfViewer`: "새 탭에서 열어 주세요"
   - `settings.noTeam`: "구성원 추가는 한귤에 요청하세요"
   - `scholarships.empty`: "프로필을 채우면 …"

   Every action named is one the same screen or a sibling string already offers.
6. Validation (script, re-run on the written file):
   - All 121 keys exist in the ko bundle as strings, and each new value differs from the old one.
   - `{{placeholder}}` and `<tag>` multisets are identical before and after.
   - No new value contains `—` or `–`, and none is a gated, `v11.`, privacy, terms or consent key.
   - Brand: one real error was fixed. `marketing v20.uni.ctaBody` said **한글과 함께**; it now says **한귤과 함께**. No new value contains 한결.
7. Plurals: three `_other` keys were patched (`discover.otherDegree_other`, `v9.announced.title_other`, `v9.discovery.scholarship_other`). Korean resolves only `_other`, and their `_one` siblings are not in keys-A/B, so the `_one` siblings were left. They are listed below as a follow-up.

## Counts per surface

"Examined" means the Korean value exists and the key is not excluded. "Missing in ko" means the key is listed but has no ko string, so it cannot be patched (see the last section).

| Surface | Namespaces (class) | Listed | Excluded (gated / legal) | Missing in ko | Examined | Rewritten |
|---|---|---:|---:|---:|---:|---:|
| Marketing | marketing (A) | 438 | 258 | 0 | 180 | 10 |
| Student | student, common, concierge, dossier, visaroute, success, writing (A) | 1,302 | 32 | 15 | 1,255 | 87 |
| Agency | agency, writing, visaroute, dossier, concierge (B) | 456 | 0 | 0 | 456 | 18 |
| Shared console | common (B) | 124 | 0 | 13 | 111 | 1 |
| University | university (B) | 271 | 1 | 0 | 270 | 5 |
| **Total** | | **2,591** | **291** | **28** | **2,272** | **121** |

Per namespace (rewritten): student 43, visaroute 38, agency 16, marketing 10, university 5, common 3, concierge 2, dossier 2, writing 2.

Most of the set was already in good shape after V27, which rewrote 601 Korean strings. The forbidden patterns were nearly gone:
- no `~가능합니다` / `~제공됩니다` sentence remained in scope;
- only three `—`, all deliberate lone empty-value glyphs.

This pass therefore found mostly register drift, translated phrasing, redundancy and bare empty states.

## Character count, A set (customer-facing)

Measured over the 1,725 A keys that have a ko string, counting the excluded ones unchanged:

| | Characters |
|---|---:|
| Before | 32,447 |
| After | 32,364 (−83, −0.3 %) |
| The 97 rewritten A strings only | 3,425 → 3,342 (−2.4 %) |

B set: 8,606 → 8,679 (+73). Almost all of it comes from next-action sentences added to six empty and error states. Two clarity rewrites (`v8.ops.load.q`, `v22.manage.teamManage`) add the rest.

22 of the 121 strings are longer than before. Most are those empty states, plus +1–2 characters from grammar fixes such as `가능한 빨리` → `가능한 한 빨리` and `보내드립니다` → `보내 드려요`.

## 40 representative rewrites

| Key | Before | After |
|---|---|---|
| `marketing:seo.home.description` | 나에게 맞는 한국 대학 찾기부터 서류 준비, 비자와 입국까지. 검증된 정보와 함께하는 사람들, 한곳에서 모두. | 한국 대학 찾기부터 서류 준비, 비자, 입국까지. 검증된 정보와 상담팀이 한곳에서 함께해요. |
| `marketing:v20.uni.ctaBody` | 로그인하면 이 대학에서 지금 지원할 수 있는 모집 단위, 필요한 서류, 그리고 어떤 순서로 준비하면 되는지 한글과 함께 확인할 수 있습니다. | 로그인하면 이 대학에서 지금 지원할 수 있는 모집 단위와 필요한 서류, 준비 순서를 한귤과 함께 확인할 수 있습니다. |
| `marketing:v20.uni.ctaTitle` | 진지하게 알아볼 준비가 되었나요? | 본격적으로 준비해 볼까요? |
| `marketing:notFound.text` | 페이지가 옮겨졌거나 링크가 오래되었을 수 있습니다. 아래에서 이어서 둘러보세요. | 주소가 바뀌었거나 오래된 링크일 수 있어요. 아래에서 다시 찾아보세요. |
| `marketing:notFound.title` | 페이지를 찾을 수 없습니다. | 찾으시는 페이지가 없어요 |
| `marketing:v15.pricing.all_in_one.f4` | 서류 검토 · 입학처 커뮤니케이션 | 서류 검토 · 입학처 연락 |
| `common:notify.empty` | 새 알림이 없습니다. | 새 알림이 없어요. 새 소식이 생기면 여기에서 알려 드릴게요. |
| `common:table.pageOf` | {{pages}}페이지 중 {{page}} | 전체 {{pages}}페이지 중 {{page}}페이지 |
| `concierge:housing.honest` | 기숙사 정보는 출처와 함께, 방은 업체가 실제로 제공한 것만 표시하고 모두 출처를 밝혀요. 매물을 지어내지 않아요. | 기숙사 정보는 출처와 함께 보여 드리고, 방은 업체가 실제로 내놓은 것만 올려요. 없는 매물은 만들지 않아요. |
| `concierge:step.sim_esim.title` | 휴대폰 번호와 데이터 (유심/eSIM) | 휴대폰 번호와 데이터(유심·eSIM) |
| `dossier:page.summary` | 모든 지원서에 쓸 준비 완료 {{ready}}/{{total}} | {{total}}개 중 {{ready}}개 준비 완료 |
| `dossier:summary.S_READY_ALL` | 지원서 {{total}}개 중 {{ready}}개에 사용 가능 | 지원서 {{total}}개 중 {{ready}}개에 쓸 수 있어요 |
| `student:applications.subtitle` | 지원서마다 체크리스트가 따로 있어요. 이미 인증된 서류는 자동으로 재사용돼요. | 지원서마다 체크리스트가 따로 있어요. 확인된 서류는 자동으로 다시 쓰여요. |
| `student:budget.empty` | 아직 계획할 선택지가 없습니다 | 아직 비용을 계산할 프로그램이 없습니다 |
| `student:discover.otherDegree_other` | 다른 학위 과정의 프로그램 {{count}}개는 여기에 표시되지 않습니다. | 다른 학위 과정 프로그램 {{count}}개는 여기에서 빠져 있어요. |
| `student:forgot.text` | 계정 이메일을 입력해 주세요. 계정이 있으면 6자리 인증번호를 보내드립니다. | 가입한 이메일을 입력해 주세요. 계정이 있으면 6자리 인증번호를 보내 드려요. |
| `student:profileV3.subtitle` | 답변에 따라 매칭 결과, 서류 준비 방법, 비자 체크리스트가 정해집니다. 가능한 것부터 추가하세요. 각 항목에 이유와 달라지는 점을 적어 두었습니다. | 답변에 따라 매칭 결과와 서류 준비 방법, 비자 체크리스트가 달라져요. 아는 것부터 채워 주세요. 항목마다 묻는 이유와 달라지는 점을 적어 두었어요. |
| `student:profileV3.why.language` | 대부분의 프로그램은 TOPIK이나 IELTS 최소 기준을 공개합니다. 점수에 따라 지금 지원 가능한 곳이 정해집니다. | 대부분의 프로그램이 TOPIK이나 IELTS 최소 기준을 공개해요. 점수에 따라 지금 지원할 수 있는 곳이 정해져요. |
| `student:scholarships.empty` | 아직 보여드릴 장학금이 없어요. | 아직 보여 드릴 장학금이 없어요. 프로필을 채우면 받을 수 있는 장학금을 찾아 드려요. |
| `student:scholarshipsV3.note` | 금액은 제공 기관이 공개한 기준입니다. 확정하기 전에 한귤 상담팀이 최신 조건을 확인해 드립니다. | 금액은 제공 기관이 공개한 기준이에요. 확정 전에 한귤 상담팀이 최신 조건을 확인해 드려요. |
| `student:scholarshipsV3.summaryOnly` | 확인 가능한 정보 기준으로 받을 수 있는 장학금이 {{eligible}}개 있습니다. | 지금 확인된 정보로는 받을 수 있는 장학금이 {{eligible}}개 있어요. |
| `student:settingsV3.translation.SOURCE_APPROVED` | 영어는 한귤의 원래 언어입니다. | 한귤 유니브의 원문은 영어예요. |
| `student:v15.services.external` | 서비스 이용료에 포함되지 않는 비용: 대학 전형료 · 등록금 · 번역·공증·아포스티유 · 비자 수수료 · 숙소 비용. | 대학 전형료, 등록금, 번역·공증·아포스티유, 비자 수수료, 숙소 비용은 서비스 이용료에 포함되지 않아요. |
| `student:v8.compare.noWinner` | 한귤은 승자를 정하지 않고 차이만 보여 드립니다. 무엇이 가장 중요한지는 학생이 결정합니다. | 한귤은 순위를 매기지 않고 차이만 보여 드려요. 무엇이 가장 중요한지는 직접 정하세요. |
| `student:v9.family.never` | 절대 보이지 않는 것: 메시지, 에세이, 한귤 상담팀 메모, 서류 파일. | 메시지, 에세이, 한귤 상담팀 메모, 서류 파일은 절대 보이지 않아요. |
| `student:writing.promise` | 한귤은 대신 글을 쓰거나 내용을 지어내지 않습니다. 피드백은 구성, 명확성, 문법, 답하지 않은 질문을 짚어 드립니다. | 한귤은 대신 글을 쓰거나 내용을 지어내지 않아요. 피드백에서는 구성과 명확성, 문법, 답하지 않은 질문을 짚어 드려요. |
| `student:writing.subtitle` | 자기소개서와 학업계획서입니다. 한귤 상담팀이 구성과 명확성에 대해 의견을 드리며, 생각과 문장은 온전히 학생의 것입니다. | 내 자기소개서와 학업계획서예요. 한귤 상담팀이 구성과 명확성에 의견을 드리고, 생각과 문장은 온전히 내 것으로 남아요. |
| `visaroute:doc.generic.why` | 귀하 국적 학생에게 대사관이 요구하는 서류입니다. | 내 국적의 학생에게 대사관이 요구하는 서류예요. |
| `visaroute:doc.tb_test.why` | 90일 초과 체류 시 귀하의 국적에 필요하며 대사관 지정 병원에서 받아야 합니다. | 내 국적은 90일 넘게 머물 때 필요해요. 대사관이 지정한 병원에서 받아야 해요. |
| `visaroute:form.notice` | 준비용입니다. 공식 신청서는 본인이 직접 작성하고 서명하며, 전자비자는 대학이 신청하기도 합니다. 한귤은 대신 제출하거나 신고하지 않습니다. | 준비용 화면이에요. 공식 신청서는 본인이 직접 작성하고 서명하며, 전자비자는 대학이 신청하기도 해요. 한귤은 대신 제출하거나 신고하지 않아요. |
| `visaroute:help.askHint` | 문의는 상담사의 비자 업무함이나 한귤 비자팀으로 전달됩니다. | 문의는 상담사나 한귤 비자팀에 전달돼요. |
| `visaroute:question.why` | 각 대사관·총영사관은 담당 지역 학생만 접수합니다. 이 답으로 신청 장소가 정해집니다. | 대사관·총영사관은 담당 지역 학생의 신청만 받아요. 이 답으로 신청할 곳이 정해져요. |
| `agency:apps.empty` | 조건에 맞는 지원서가 없습니다. | 조건에 맞는 지원서가 없습니다. 필터를 바꾸거나 지워 보세요. |
| `agency:review.noPdfViewer` | 이 브라우저는 페이지 안에서 PDF를 표시할 수 없습니다. | 이 브라우저에서는 PDF를 바로 볼 수 없습니다. 새 탭에서 열어 주세요. |
| `agency:review.verifyHint` | 먼저 항목을 확인하거나, 확인 없이 인증을 선택하세요 | 먼저 항목을 확인하거나, 확인 없이 승인을 선택하세요 |
| `agency:v22.ws.noConversation` | 아직 대화가 없습니다. | 아직 대화가 없습니다. 첫 메시지를 보내 보세요. |
| `agency:v8.ops.ageing.caption` | 단계와 마지막 진행 이후 일수별 진행 중인 건 | 단계·정체 일수별 진행 중인 건 |
| `common:states.noResults` | 필터에 맞는 결과가 없습니다. | 필터에 맞는 결과가 없습니다. 필터를 줄이거나 초기화해 보세요. |
| `university:settings.noTeam` | 팀 구성원이 없습니다. | 팀 구성원이 없습니다. 구성원 추가는 한귤에 요청하세요. |
| `writing:v6.escalatedTo` | {{name}}에게 에스컬레이션됨 | {{name}}에게 이관됨 |

## STATE_MAP labels I would change (not changed)

- `success:group.possible` = **지원 가능**. STATE_MAP (V9 addendum) says *Possible match* must read **요건 충족·확인 필요**, never as odds or as 가능. `student:discover.verdict.reach` already uses 요건 충족·확인 필요. Suggest aligning `success:group.possible`.
- `success:group.not_yet` = **아직 자격 미달**. The contract wording for *Not eligible yet* elsewhere is **아직 지원 불가** (`student:verdict.NOT_ELIGIBLE`). Suggest aligning.

## Meaning questions

1. **"Your counselor" on student screens.** 23 student keys still name 상담사 / 담당 상담사, and their English also says "Your counselor". Examples: `visaroute` `caveat.*`, `cond.OTHER`, `help.*`; `dossier` `reason.IN_REVIEW`, `package.counselor`; `success` `owner.counselor`; `concierge` `help.route.*`, `emergency.note`. STATE_MAP (V22 team identity) says student-facing copy shows *the Hangyul Univ team* (한귤 유니브 상담팀) instead. Kept as 상담사 to match the English. Should both languages move to the team wording?
2. **`student:budget.scholarshipAlternative`** (`대안이라 중복으로 빼지 않았습니다`, EN "Alternative, not added on top"). Is it "this scholarship cannot be combined with the counted one", or "shown as an alternative, so not subtracted twice"? Left unchanged until that is clear.
3. **`student:v9.funds.longer_other`** (`대학이 하위('컨설팅') 등급이면`). Is '컨설팅' the official Korean name of the IEQAS lower tier (컨설팅 대학)? If not, the label is wrong.

## Follow-ups outside this key set

- 28 listed keys have no Korean string, so they could not be patched. 15 are A keys, for example `compare.bestTag.year`, `notFound.browse`, `v26.now.empty.*_support` and `v9.visa.caveat.*`. 13 are B keys: `v4.statusShort.*` and `waiting.reason.*` in `common`. These keys either do not exist in `common` or live in another namespace (the namespace-less line was taken as `common` per the brief). Census owners should confirm where they live.
- The `_one` siblings of the three patched `_other` keys still carry the old wording. Korean never renders them, but syncing them keeps the bundle tidy.
