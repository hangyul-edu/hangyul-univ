# V28 localization review: fil (Filipino)

Scope: all 354 keys in `scripts/i18n/v28/jobs/fil.json` (11 namespaces; 231 without a current translation).
Output: `scripts/i18n/v28/tx/fil.json`.
Register (reused from V27 `docs/qa/v27/l10n/fil.md`): conversational Taglish with *ka / mo* for students, the way Philippine schools, apps and study-abroad agencies write. English is kept where Philippine higher education uses it (*tuition*, *deadline*, *requirements*, *intake*, *offer*, *apostille*, *consular legalization*, *proof of funds*). Agency and university consoles use short, neutral professional Taglish.
Two defects in the old bundle were fixed throughout: (1) *kumpirmasyon* for 영사확인 / legalization is now **consular legalization**; (2) *iyong tagapayo* / *counselor mo* in student-facing strings is now **Team Hangyul** (the V27 established form of "the Hangyul team"). Brief rule: the team is never "your counselor".

## Personas

1. **Andrea, 18, Quezon City (first-time visitor).** Senior high STEM graduate. She lands on a university page from a TikTok link, wants a Korean language institute year (D-4) and then a bachelor's. Mobile-first, reads Taglish.
2. **Paolo, 26, Cebu (comparison shopper).** IT professional comparing Hangyul with two Manila agencies for an English-taught master's (D-2). Reads the pricing and "what makes it different" sections closely and distrusts vague claims.
3. **Tita Marites, 52, OFW in Dubai.** Andrea's mother and sponsor. Pays tuition and show money. Watches for scams, "guaranteed" promises and hidden fees.
Console readers: **Jun, agency counselor in Makati**, and **an admissions officer at a Korean university** reading the university console in Filipino.

## Glossary

| English | Korean | fil rendering |
|---|---|---|
| the Hangyul team | 한귤 상담팀 | Team Hangyul |
| consular legalization | 영사확인 | consular legalization |
| apostille | 아포스티유 | apostille |
| certificate of enrollment | 재학증명서 | certificate of enrollment |
| Korean language institute | 어학당 | Korean language institute |
| D-2 / D-4 visa | 유학 / 어학연수 비자 | D-2 / D-4 visa |
| Global Korea Scholarship | 정부초청장학 | Global Korea Scholarship (GKS) |
| admission guide | 모집요강 | admission guide |
| requirements / minimum | 요건 / 기본 조건 | requirements / minimum |
| needs more preparation (far tier) | 준비가 더 필요한 | Kailangan pa ng paghahanda |
| one step away | 한 가지 보완 | Isang hakbang na lang |
| Recommended (order) | 추천순 | Inirerekomenda (order lang, hindi ranking) |
| offer | 합격 | offer |
| enrollment | 등록 / 입학 | enrolment / mag-enrol |
| intake | 모집 학기 | intake |
| program | 과정 / 학과 | programa |
| documents | 서류 | mga dokumento |
| dormitory | 기숙사 | dormitoryo |
| campus | 캠퍼스 | campus |
| residence card | 외국인등록증 | residence card |
| proof of funds | 재정 증명 | proof of funds |
| embassy / consulate | 대사관 / 영사관 | embassy / consulate |
| international office | 국제교류처 | international office |
| case owner | 담당자 | may hawak (ng kaso) |
| task | 할 일 / 업무 | task |
| stage | 단계 | yugto |
| deadline / overdue | 마감 / 기한 지남 | deadline / lampas na sa deadline |
| verified | 검증 | verified / na-verify |

## Pass A: meaning (48 strings changed)

Current translations that no longer matched the V28 English, or misread it. Includes 20 strings that said *iyong tagapayo* / *counselor mo* where the source is "the Hangyul team".
- `common:fit.tier.UNCLEAR.title`: *Malayo pa sa ngayon* → *Kailangan pa ng paghahanda*
- `student:v9.announced.rule.STUDY_DEPOSIT_SCHEME`: *Ang mga estudyanteng walang kaalaman sa Korean mula sa ilang bansa ay magdedeposito ng pera para sa pag-aaral sa isang bangko, na ilalabas bawat semestre.* → *Ang mga estudyante mula sa ilang bansa na walang resulta sa Korean test ay magdedeposito ng pondo para sa pag-aaral sa bangko, na ilalabas bawat semestre.*
- `university:v8.aq.need`: *Kailangang desisyon* → *Kailangan para sa desisyon*
- `marketing:v20.uni.ctaTitle`: *Handa ka na bang seryosohin ito?* → *Iniisip mo bang mag-apply dito?*
- `dossier:package.bucket.counselor`: *Hinihintay ang iyong tagapayo* → *Hinihintay ang Team Hangyul*

## Pass B: native naturalness (15 strings changed)

Read as Andrea, Paolo and Tita Marites; removed English word order, em dashes and misleading words.
- `marketing:v20.city.Busan.body`: *Ang Busan ang ikalawang lungsod ng Korea at hindi ito parang mas maliit na Seoul. Nasa pagitan ng mga dalampasigan at bundok ang mga unibersidad, naaabot ng subway ang karamihan sa mga ito, at mas mababa nang malaki ang upa kaysa sa kabisera.
Narito ang pinakamalaking pantalan ng bansa, isang matagal nang film festival, at tag-init na dinarayo ng buong Korea. Ang taglamig dito ang pinakamaluwag sa mainland.* → *Ang Busan ang ikalawang pinakamalaking lungsod ng Korea, at hindi ito parang maliit na Seoul. Nasa pagitan ng dagat at bundok ang mga unibersidad, naaabot ng subway ang karamihan sa mga ito, at mas mura nang malaki ang upa kaysa sa kabisera.
Narito ang pinakamalaking pantalan ng bansa, isang matagal nang film festival, at tag-init na dinarayo ng buong Korea. Dito rin ang pinakabanayad na taglamig sa mainland.*
- `student:profileV3.why.goals`: *Dahil sa kung ano at kailan mo gustong mag-aral, nananatili sa listahan mo ang mga programang nasa tamang antas at intake.* → *Kapag alam namin kung ano at kailan mo gustong mag-aral, mga programang nasa tamang level at intake lang ang nasa listahan mo.*
- `concierge:housing.honest`: *Ipinapakita lang namin ang mga impormasyon tungkol sa dormitoryo kasama ang source nito, at ang mga kuwartong talagang ibinigay sa amin ng provider — bawat isa ay may label. Hindi kami kailanman nag-iimbento ng listing.* → *Ipinapakita lang namin ang impormasyon sa dormitoryo na may source, at ang mga kuwartong talagang inalok ng provider, bawat isa ay may label. Hindi kami nag-iimbento ng listing.*
- `university:v22.in.q.settle`: *Nakakapag-angkop ba sila pagkatapos mag-enrol?* → *Maayos ba silang nakaka-settle pagkatapos mag-enrol?*
- `agency:v9.ops.unpaid.q`: *Sino ang nagbayad para sa serbisyo pero walang humahawak sa kanyang kaso?* → *Aling mga estudyante ang nagbayad para sa serbisyo pero walang may hawak ng kaso?*
(Busan: *pinakamaluwag* "loosest" for the mildest winters became *pinakabanayad*; "second city" became "second-largest city".)

## Pass C: UI context, brevity, one term per concept (17 strings changed)

One term each for offer (*offer*, not *alok*), documents (*dokumento*, not *papeles*), campus (*campus*, not *kampus*), embassy, consultation (*konsultasyon*, not *pagpapayo*), enrolment spelling (*mag-enrol*).
- `university:v22.in.byProgram`: *Rate ng alok ayon sa programa* → *Offer rate ayon sa programa*
- `agency:waiting.app.OFFERED`: *sagot sa alok* → *sagot sa offer*
- `marketing:v24.uni.academicTitle`: *Mga programa at kampus* → *Mga programa at campus*
- `visaroute:step.fresh_items.title`: *Kunin sa huli ang mga papeles na may limitadong bisa* → *Kunin sa huli ang mga dokumentong may limitadong bisa*
- `agency:v22.stage.counselling`: *Pagpapayo* → *Konsultasyon*

## Final: source ↔ target comparison (5 strings changed)

All 354 strings compared with English and Korean for meaning, numbers, dates, test/visa codes, `{{placeholders}}` and the no-guarantee / no-ranking rule. Grep of all output for *kumpirmasyon*, *tagapayo*, *counselor mo*, *ambisyoso*, *tsansa*: 0 hits.
- `visaroute:step.slow_items.why`: *Inaabot ng ilang linggo ang mga kumpirmasyon, ang TB test at ang police certificate.* → *Inaabot ng ilang linggo ang consular legalization, ang TB test at ang police certificate.*
- `visaroute:caveat.APOSTILLE_TRANSITION`: *Nagsimulang mag-issue ng apostille ang Vietnam noong 11 Set 2026, pero consular legalization pa rin ang nakasulat sa student visa lists ng embassy. Kukumpirmahin ng counselor mo kung alin ang tinatanggap.* → *Nagsimulang mag-issue ng apostille ang Viet Nam noong 11 Set 2026, pero consular legalization pa rin ang nakasulat sa student visa lists ng embassy. Kukumpirmahin ng Team Hangyul kung alin ang tinatanggap.*
- `visaroute:caveat.EVISA_TIER_UNKNOWN`: *Kung may 'excellent' na certification ng gobyerno ang {{university}} (o 'certified' para sa master's at doctoral), ang unibersidad ang puwedeng mag-apply ng e-visa para sa iyo. Hindi pa namin nakukumpirma ang level nito. Susuriin ng counselor mo.* → *Kung may 'excellent' na certification ng gobyerno ang {{university}} (o 'certified' para sa master's at doctoral), ang unibersidad ang puwedeng mag-apply ng e-visa para sa iyo. Hindi pa namin nakukumpirma ang level nito. Susuriin ito ng Team Hangyul.*
- `university:kpi.insufficientDetail`: *Batay sa {{n}} tala — ipinapakita mula {{min}}* → *Batay sa {{n}} tala. Ipapakita kapag may {{min}} na.*
- `university:v22.stageHint.decision`: *Nasa waitlist — tayo pa ang magpapasya* → *Nasa waitlist. Hinihintay pa ang desisyon.*

## Marketing scorecard (30 points: clarity, trust, naturalness, brevity, CTA strength, cultural fit; 5 each)

| Section (keys) | Before | After | Notes |
|---|---|---|---|
| seo.home.description | 22 | 26 | *lampasan ang visa* ("get past the visa") → *asikasuhin ang visa* |
| journey.eyebrow | 20 | 26 | *Journey ng estudyante* did not match "Step by step" → *Hakbang-hakbang* |
| v15.pricing (lede, compare, premium.f5) | 21 | 26 | lede reordered so the choice comes first; f5 no longer lists items the source dropped |
| v20.city (Busan, Gyeonggi, Seoul, Gyeongnam) | 23 | 26 | Busan winter mistranslation fixed; Gyeonggi rewritten as Filipino, not English order; Seoul.line added |
| v20.uni (cta, why*, office, philosophy, intl) | 22 | 26 | CTA now asks *Iniisip mo bang mag-apply dito?*; em dash removed; new IEQAS/office lines |
| v28.uni.why (english, gks, scholarships) | new | 26 | GKS uses the official English name; "verified" kept as Filipino students say it |
| v6.unis.title, v12/v24 campuses, footer | 22 | 25 | *sulit puntahan* replaced by the V28 meaning "across Korea"; *campus* unified |
| v9.faq.languagesA | new | 25 | states plainly that no language has had a human review (trust for Tita Marites) |

## Unsure

- **Team Hangyul** vs *ang Hangyul team*: V27 established *Team Hangyul*; both read naturally in Taglish.
- `marketing:v28.uni.why.gksBody`: the English says "Korean Government Scholarship Program". There is no established Filipino name, so the brief's *Global Korea Scholarship (GKS)* is used. Filipinos also know it by its old name *KGSP*.
- `marketing:v20.uni.why.ieqasExcellent` *IEQAS: outstanding na grado*: the government grade name was kept in English (as in V27 for 'excellent').
- `university:documents.legalization`, `agency:ws.consulate`, `visaroute:money.title`, `agency:misc.breadcrumb`, `dossier:agency.title`: kept as the English term (≤ 3 words). This is normal Philippine usage, but a stricter Filipino style would translate them.
- `university:programs.seats` *Slot para sa int'l*: an abbreviation in a narrow table column. *Upuan* would be a calque.
- `visaroute:caveat.APOSTILLE_TRANSITION` *11 Set 2026*: Filipino month abbreviation, kept from V27.

## Counts

- Job keys: 354
- Kept verbatim: 38
- Rewritten: 85
- Newly translated: 231
- Validator: `node scripts/i18n/v28/validate.mjs --only=fil` reports 354 strings valid, 0 problems.

## Second pass (jobs2): leak families

Job `scripts/i18n/v28/jobs2/fil.json`, customer families only (marketing 2, student 39, success 204, dossier 27). Every key had `current: null` and was showing English fallback, so all of them are newly translated. Same personas and glossary as the first pass. Pass A (meaning against en + ko), Pass B (naturalness), Pass C (UI brevity, one term per concept). Then a final source↔target check.

| Job keys | Kept verbatim | Rewritten | Newly translated | Intentionally empty |
|---|---|---|---|---|
| 272 | 0 | 0 | 269 | 3 (`dossier:upload.status.*`, empty in en/ko) |

Every key was drafted once and then checked in passes A–C. Changes after the draft: A: 0. B: 2 (`queue.fixture` / `queue.fixtureNote` *Fixture* → *Test*). C: 0.

Examples (before → after):

| Key | Before | After |
|---|---|---|
| `student:workspace.owner.prep.you` | Upload the missing documents and finish your essays. (missing → English fallback) | I-upload ang mga kulang na dokumento at tapusin ang iyong mga sanaysay. |
| `success:item.ESSAY_WRONG_NAME.why` | An essay addressed to another university is the most common avoidable rejection. (missing → English fallback) | Ang sanaysay na para sa ibang unibersidad ang pinakakaraniwang dahilan ng rejection na madali sanang naiwasan. |
| `success:agencyItem.DOC_LEGALIZE` | {{label}} — consular legalization pending (missing → English fallback) | {{label}}: hinihintay ang consular legalization |
| `success:agency.evidenceRule` | Confirmed only with a confirmation number or receipt. Moves the application to Submitted. (missing → English fallback) | Kumpirmado lang kapag may numero ng kumpirmasyon o resibo. Ililipat nito ang aplikasyon sa Naisumite. |
| `dossier:page.privacy` | Only you, your counselor and Hangyul can see these files. A university sees a document only when it is sent for your application to that university. (missing → English fallback) | Ikaw at ang Team Hangyul lang ang nakakakita ng mga file na ito. Makikita lang ng unibersidad ang isang dokumento kapag ipinadala ito para sa aplikasyon mo sa unibersidad na iyon. |

Marketing scorecard (`marketing:v20.uni.intl.officeLine` / `.none`; clarity, trust, naturalness, brevity, CTA, cultural fit):

| Section | Text | Cl | Tr | Na | Br | CTA | Cu | Total |
|---|---|---|---|---|---|---|---|---|
| University page, international office lines | May international office ito na may sariling paraan ng pakikipag-ugnayan. / Wala pang nahahanap ang Hangyul na hiwalay na page para sa international students sa sariling site ng unibersidad na ito. Magsimula sa opisyal na website sa ibaba. | 5 | 5 | 4 | 4 | 4 | 4 | **26** |

Terms are identical to the first-pass glossary above. The student-facing `dossier:page.privacy` says “the Hangyul team”, never “your counselor”. *Counselor* appears only in the agency console role label.

Unsure (second pass):

- `dossier:upload.status.*` left empty as in en/ko.
- Short console labels kept in English as Taglish UIs do (Status, Timeline, Fit, Deadline, Package, Intake, Spring/Summer/Fall/Winter). PH universities use semesters, so there is no native season word.
- The glossary term *consular legalization* is used, though older bundle strings say *legalisasyon ng konsulado*.
- `success:method.APPLICATION_PROVIDER` kept as *Application provider* (2 words, an industry term).

Validator: `JOBS=jobs2 TX=tx2 node scripts/i18n/v28/validate.mjs --only=fil` → 272 strings valid, 0 problems.

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
