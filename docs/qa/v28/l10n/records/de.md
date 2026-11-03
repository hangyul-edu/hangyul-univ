# V28 l10n review — German (de)

Scope: every key of `scripts/i18n/v28/jobs/de.json` (370 keys: 254 with no translation, 116 with an existing `current`). Output: `scripts/i18n/v28/tx/de.json`.
Register: informal **du** for students and for the agency and university consoles, matching the bundle (`de/university.json`, `de/agency.json` use du). Terms from V27 kept: *Studiengang*, *Bewerbung*, *Paket*, *Hangyul-Team*, *Schreiben* for the Writing section.

Method: each `current` was compared with the **current** English (Korean consulted where the English is terse) and kept verbatim only when it was correct, natural and still matched; everything else was rewritten. All null keys were translated fresh. Glossary carried over from `docs/qa/v27/l10n/de.md`.

## Personas

| Persona | Who | Reads for |
| --- | --- | --- |
| **Lena, 19, Köln** | Abiturientin, first-time visitor, wants a Bachelor in Seoul after a gap year | warm du copy, short buttons |
| **Jonas, 27, München** | engineer comparing English-taught Master offers across services (comparison shopper) | exact visa/document terms: Apostille, konsularische Legalisation, Finanzierungsnachweis |
| **Sabine, 52, Lenas Mutter** | pays fees | clear money wording, no admission promises |

## Glossary

| English | Korean | German | Note |
| --- | --- | --- | --- |
| scholarship | 장학금 | Stipendium |  |
| Global Korea Scholarship (GKS) | 정부초청장학 | Global Korea Scholarship (GKS) | no established German name; official name kept |
| admission guide | 모집요강 | Bewerbungsleitfaden |  |
| apostille | 아포스티유 | Apostille |  |
| consular legalization | 영사확인 | konsularische Legalisation | **never** *konsularische Bestätigung* (known defect, validator-enforced) |
| certificate of enrollment | 재학증명서 | Immatrikulationsbescheinigung |  |
| Korean language institute | 어학당 | Sprachinstitut (für Koreanisch) |  |
| D-2 / D-4 visa | D-2 / D-4 | Visum D-2 / D-4 |  |
| e-visa | 전자비자 | E-Visum |  |
| residence card | 외국인등록증 | Aufenthaltskarte |  |
| proof of funds | 재정 증빙 | Finanzierungsnachweis |  |
| tuition | 등록금 | Studiengebühren |  |
| application fee | 전형료 | Bewerbungsgebühr |  |
| application | 지원 | Bewerbung |  |
| intake | 모집 시기 | Aufnahmetermin |  |
| program(me) | 과정 | Studiengang |  |
| the Hangyul team | 한귤 상담팀 | das Hangyul-Team | replaces every *dein Berater/deine Beraterin* |
| plan (paid) | 플랜 | Paket |  |
| match | 매칭 | Treffer |  |
| Recommended (sort) | 추천순 | Empfohlen |  |
| Needs more preparation (far tier) | 준비가 더 필요 | Braucht mehr Vorbereitung |  |
| Needs checking with us (unverified tier) | 추가 확인 필요 | Mit uns zu klären |  |
| dormitory | 기숙사 | Wohnheim |  |
| enrollment | 등록 | Einschreibung |  |
| consular post | 공관 | Auslandsvertretung |  |
| upload | 업로드 | hochladen |  |

## Pass A — meaning (58 strings changed)

Known defect fixed: `visaroute:step.slow_items.why` said *Bestätigungen* for 확인 절차 (the legalizations) → *Legalisationen*; `caveat.APOSTILLE_TRANSITION` already used *konsularische Legalisation* and keeps it. No string in the output contains *Bestätigung* in the 영사확인 sense (grep: 0). Other rewrites: every *dein Berater/deine Beraterin* → *das Hangyul-Team* (20 strings), fit tiers re-cut to the V28 English.

| Key | Before | After |
| --- | --- | --- |
| `visaroute:step.slow_items.why` | Bestätigungen, der Tuberkulosetest und Führungszeugnisse dauern Wochen. | Legalisationen, der Tuberkulosetest und Führungszeugnisse dauern Wochen. |
| `common:docCategory.EMPLOYMENT_INCOME_PROOF` | Beschäftigungs-/Einkommensnachweis | Beschäftigungs- oder Einkommensnachweis |
| `concierge:help.route.HOUSING` | Dein Berater/deine Beraterin | Das Hangyul-Team |
| `common:fit.tier.UNCLEAR.title` | Noch ein weiter Weg | Braucht mehr Vorbereitung |
| `common:fit.tier.CHALLENGE.title` | Einen genaueren Blick wert | Mit uns zu klären |

## Pass B — native naturalness (5 strings changed)

| Key | Before | After |
| --- | --- | --- |
| `agency:v8.view.docs` | Dokumentkorrektur erforderlich | Unterlagen müssen korrigiert werden |
| `marketing:v15.pricing.compare.value.dormitory_support.APPLICATION` | Hilfe beim Antrag und Alternativen | Hilfe beim Antrag, dazu Alternativen |
| `student:v9.family.scope.family_documents` | Von der Familie bereitgestellte Unterlagen | Unterlagen, die deine Familie bereitstellt |
| `visaroute:step.apply.title` | Antrag stellen und festhalten | Antrag stellen und Quittung festhalten |
| `visaroute:step.slow_items.title` | Langwierige Unterlagen zuerst angehen | Mit den langwierigsten Unterlagen anfangen |

## Pass C — UI context, brevity, one term per concept (12 strings changed)

| Key | Before | After |
| --- | --- | --- |
| `agency:consult.notifyNote` | Die Person erhält eine Benachrichtigung … (draft) | Studierende erhalten eine Benachrichtigung … |
| `agency:v9.meet.studentTasks` | To-dos für die Person (draft) | To-dos für Studierende |
| `university:documents.sharingRule` | Studierende teilen Dokumente mit Ihnen … (draft, Sie) | Studierende teilen Dokumente mit dir … (du, as the university bundle) |
| `university:programs.emptyText` | … für Ihre Hochschule einträgt. (draft) | … für deine Hochschule einträgt. |
| `visaroute:staff.needsAnswer` | Person muss die Region wählen … (draft) | Studierende/r muss die Region wählen … |

(5 of these are corrections to this review's own first draft of new strings; the rest change an existing `current`.)

## Final source ↔ target comparison

All keys re-read against `en`/`ko`; placeholders/tags identical; no Hangul; *konsularische Legalisation* / *Legalisationen* for 영사확인 throughout; no *Berater* left. Lengths checked against the 2.2× limit (German longest: `fit.tier.CHALLENGE.lede`).

## Marketing scorecard (30 points: clarity, trust, naturalness, brevity, CTA strength, cultural fit; 5 each)

39 `marketing:` keys in the job. Sections touched, scored after the last rewrite (first-draft score in brackets where a rewrite was needed):

| Section | Keys | Clar. | Trust | Nat. | Brev. | CTA | Fit | Total |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SEO / home description | seo.home.description | 5 | 4 | 4 | 4 | 4 | 5 | **26** |
| Pricing (v15.pricing.*) | lede, premium.f5, compare rows | 5 | 5 | 4 | 4 | 5 | 4 | **27** (22: draft kept the old order "Eine Ersteinschätzung, … Du wählst …"; now leads with *Wähle, wie viel Hilfe du möchtest*) |
| City pages (v20.city.*) | Busan, Gyeonggi, Gyeongnam, Seoul | 4 | 5 | 5 | 4 | 4 | 5 | **27** |
| University page (v20.uni.*, v24, v28.uni.why.*, v12) | ctaTitle/Body, intlTitle, whyTitle, why.* | 5 | 5 | 4 | 4 | 4 | 4 | **26** (21: *Bereit, dich ernsthaft damit zu beschäftigen?* → *Überlegst du, dich hier zu bewerben?*) |
| FAQ languages (v9.faq.languagesA) | languagesA | 5 | 5 | 4 | 3 | 4 | 4 | **25** |
| Journey / universities strip, services, footer | journey.eyebrow, v6.unis.title, v10 housing.p2, v23 footer | 5 | 4 | 4 | 5 | 4 | 4 | **26** |

All touched sections ≥ 25 after rewrite.

## Strings I am unsure of

- `university:eduLevel.HIGH_SCHOOL` — *Oberstufe / Sekundarschule* covers foreign systems but is longer than a filter label usually is.
- `university:documents.student` — *Studierende/r* — slash form chosen to stay neutral; some teams prefer *Studierende* as a column label.
- `university:v28.pipe.label` — *Pipeline* kept as an English loan, common in German CRM UIs.
- `visaroute:staff.post` — *Auslandsvertretung* for 공관 (embassy or consulate) — correct but formal.

## Counts

| Job keys | Kept verbatim | Rewritten | Newly translated |
| --- | --- | --- | --- |
| 370 | 46 | 70 | 254 |

Legalization fixes: 1 rewritten `current` (`visaroute:step.slow_items.why`); 2 new strings use the term (`university:documents.legalization` *Legalisation*, `caveat.APOSTILLE_TRANSITION` kept).

Validator: `node scripts/i18n/v28/validate.mjs --only=de` → `370 strings valid, 0 problems`.

## Second pass (jobs2): leak families the crawl missed

Input `scripts/i18n/v28/jobs2/de.json` → output `scripts/i18n/v28/tx2/de.json`. Same personas, glossary and method as the first pass. Every student-facing *your counselor* → *das Hangyul-Team* (18 strings); the console label `agency.ownerShort.counselor` keeps the console term. Placeholders `{{counselor}}`/`{{name}}` stay the person's name.

| Job keys | Kept verbatim | Rewritten | Newly translated |
| --- | --- | --- | --- |
| 630 (marketing 2 · student 39 · success 465 · dossier 124) | 0 | 0 | 630 (all `current` were null; 3 keys whose English is empty stay empty) |

- Pass A (meaning): 18 strings changed (*your counselor* → team; consular legalization and apostille kept apart: `item.DOC_LEGALIZE*` vs `item.DOC_LEGALIZE_APOSTILLE*`, `dossier:path.*`).
- Pass B (naturalness): 4 (`obs.SOME_OVER_BUDGET_*` re-cut from a literal *liegt schon zu Beginn* that read as "at the start of the application"; `page.privacy` 담당 상담사 → *dein zuständiges Beratungsteam*; essay pronoun agreement).
- Pass C (UI context, one term per concept): 14 (`{{labelLower}}`/`{{doc}}`/`{{category}}` strings restructured to "Label: {{x}}" so no article or case agrees with a placeholder; status chips *(geprüft)*/*(abgelaufen)* in brackets after `{{doc}}`; *Freigeben* for the action, *Vollmacht* for the legal object, one term each).
- Final comparison: every key checked against en and ko. The three keys whose English is empty (`dossier:upload.status.NEEDS_REVIEW/UPLOADED/NEEDS_CORRECTION`) stay empty.

### 5 examples (English shown on the page before → after)

- `success:item.DOC_LEGALIZE.title`: *{{label}} still needs consular legalization* → *{{label}} braucht noch die konsularische Legalisation*
- `success:item.ESSAY_REVISE.why`: *Your counselor asked for changes.* → *Das Hangyul-Team hat um Änderungen gebeten.*
- `success:submission.authorize.check`: *I authorize {{agency}} to submit this application to {{university}} on my behalf.* → *Ich bevollmächtige {{agency}}, diese Bewerbung in meinem Namen bei {{university}} einzureichen.*
- `dossier:reason.NEEDS_LEGALIZATION_CONSULAR_LEGALIZATION`: *… needs it with consular legalization (Korean embassy or consulate in {{country}}).* → *{{university}} braucht es mit konsularischer Legalisation (koreanische Botschaft oder Konsulat in {{country}}).*
- `success:obs.SOME_OVER_BUDGET_other`: *{{count}} of your applications start above your budget.* → *Bei {{count}} deiner Bewerbungen liegen schon die Mindestkosten über deinem Budget.*

### Marketing scorecard (2 keys)

| Section | Clarity | Trust | Naturalness | Brevity | CTA | Cultural fit | Total |
| --- | --- | --- | --- | --- | --- | --- | --- |
| v20.uni.intl (officeLine, none) | 5 | 5 | 4 | 4 | 4 | 5 | 27 |

### Unsure

- `{{labelLower}}` strings (`item.DOC_MISSING.title`, `item.REQUEST_OPEN.title`, `item.ESSAY_REVISE.title`, `agencyItem.DOC_UPLOAD_APPROVED`): German nouns are capitalised, so a lower-cased label (*reisepass*) will look wrong. I used the colon pattern of the first pass; the code should pass `{{label}}` for de.
- `dossier:page.privacy`: 담당 상담사 may be an agency counselor, so I wrote *dein zuständiges Beratungsteam* rather than *das Hangyul-Team* (which would also duplicate "Hangyul").
- `dossier:upload.haveTitle*`: *Bereits vorhanden: {{doc}} {{status}}* with status *(geprüft)* / *(abgelaufen)* / empty. Natural only if `{{doc}}` is a bare label.
- `success:queue.fixture` *Testdaten*: the note then says entries marked *Testdaten* are test data (tautology inherited from the English).
- Console *Studierende/r* (`ownerShort.student`, `queue.col.student`, `queue.payer.STUDENT`) vs. *Studierende* plural elsewhere.

Validator: `JOBS=jobs2 TX=tx2 node scripts/i18n/v28/validate.mjs --only=de` → `630 strings valid, 0 problems`.

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
