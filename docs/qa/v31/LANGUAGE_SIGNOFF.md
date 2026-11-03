# V31 language sign-off

Status for every market locale is **`SYNTHETIC_NATIVE_REVIEWED_V31`** — a model reviewer, briefed per locale (BRIEF.md), three passes + back-check.
**No locale is `HUMAN_REVIEWED`.** A human native-speaker review remains an external release item.

Scope per locale: the 1,729 customer-critical keys (V28 rendered-key census `keys-A` + every key whose ko/en source changed in V31 + new V31 keys),
across common, marketing, student, concierge, visaroute, dossier, success, writing. "Changed" = keys whose merged text differs from the pre-V31 text
(computed from the job `current` vs the reviewed output, not self-reported). Critical semantic issues = rows the locale record lists as
meaning errors in the pre-V31 text (blank = the record states them as prose without a single total).

| Locale | Keys reviewed | Keys changed | Missing before | Critical semantic issues found | Fallback leaks after merge | Notes / unresolved | Status |
|---|---|---|---|---|---|---|---|
| ar | 1,729 | 308 | 2 | see record | 0 (gate) | RTL: ranges/counters listed for layout review; U+200F on Latin-led strings | SYNTHETIC_NATIVE_REVIEWED_V31 |
| bn | 1,729 | 295 | 3 | see record | 0 (gate) | — | SYNTHETIC_NATIVE_REVIEWED_V31 |
| cs | 1,729 | 256 | 4 | 26 | 0 (gate) | — | SYNTHETIC_NATIVE_REVIEWED_V31 |
| de | 1,729 | 316 | 4 | 27 | 0 (gate) | du register kept for consistency with ~780 non-job strings (a Sie pass was reverted) | SYNTHETIC_NATIVE_REVIEWED_V31 |
| el | 1,729 | 651 | 4 | 39 | 0 (gate) | switched to the formal σας register (≈300 strings were εσύ) | SYNTHETIC_NATIVE_REVIEWED_V31 |
| es | 1,729 | 299 | 3 | 37 | 0 (gate) | neutral Spanish, tú | SYNTHETIC_NATIVE_REVIEWED_V31 |
| fil | 1,729 | 334 | 3 | see record | 0 (gate) | — | SYNTHETIC_NATIVE_REVIEWED_V31 |
| fr | 1,729 | 309 | 3 | see record | 0 (gate) | vous register; consistent non-breaking spaces before : ; ? ! | SYNTHETIC_NATIVE_REVIEWED_V31 |
| hi | 1,729 | 318 | 3 | 25 | 0 (gate) | — | SYNTHETIC_NATIVE_REVIEWED_V31 |
| hu | 1,729 | 320 | 4 | 27 | 0 (gate) | te register | SYNTHETIC_NATIVE_REVIEWED_V31 |
| id | 1,729 | 291 | 4 | 28 | 0 (gate) | — | SYNTHETIC_NATIVE_REVIEWED_V31 |
| it | 1,729 | 284 | 4 | see record | 0 (gate) | tu kept (existing copy consistent) | SYNTHETIC_NATIVE_REVIEWED_V31 |
| ja | 1,729 | 265 | 2 | 24 | 0 (gate) | — | SYNTHETIC_NATIVE_REVIEWED_V31 |
| kk | 1,729 | 301 | 3 | 30 | 0 (gate) | — | SYNTHETIC_NATIVE_REVIEWED_V31 |
| ky | 1,729 | 296 | 3 | 31 | 0 (gate) | — | SYNTHETIC_NATIVE_REVIEWED_V31 |
| mn | 1,729 | 316 | 2 | 30 | 0 (gate) | — | SYNTHETIC_NATIVE_REVIEWED_V31 |
| my | 1,729 | 353 | 2 | see record | 0 (gate) | — | SYNTHETIC_NATIVE_REVIEWED_V31 |
| ne | 1,729 | 366 | 2 | see record | 0 (gate) | — | SYNTHETIC_NATIVE_REVIEWED_V31 |
| nl | 1,729 | 286 | 4 | 31 | 0 (gate) | je kept (existing copy consistent); FAQ nav label shortened to "FAQ" (validator length) | SYNTHETIC_NATIVE_REVIEWED_V31 |
| pl | 1,729 | 284 | 4 | 28 | 0 (gate) | Ty/Twój (capitalised) register, as gov.pl and university applicant sites use; owner may prefer impersonal | SYNTHETIC_NATIVE_REVIEWED_V31 |
| pt | 1,729 | 355 | 4 | 37 | 0 (gate) | European Portuguese; Brazilian forms removed (validator-checked) | SYNTHETIC_NATIVE_REVIEWED_V31 |
| ro | 1,729 | 807 | 4 | 40 | 0 (gate) | switched to the formal dumneavoastră register; comma-below diacritics | SYNTHETIC_NATIVE_REVIEWED_V31 |
| ru | 1,688 | 200 | 3 | 24 | 0 (gate) | 41 owner-verbatim Koreanasha homepage keys kept unchanged (V11 fidelity gate); their guarantee wording is flagged for the owner | SYNTHETIC_NATIVE_REVIEWED_V31 |
| sr | 1,729 | 308 | 4 | 30 | 0 (gate) | — | SYNTHETIC_NATIVE_REVIEWED_V31 |
| sv | 1,729 | 301 | 4 | 28 | 0 (gate) | du | SYNTHETIC_NATIVE_REVIEWED_V31 |
| th | 1,729 | 303 | 4 | 25 | 0 (gate) | — | SYNTHETIC_NATIVE_REVIEWED_V31 |
| tr | 1,729 | 274 | 3 | 35 | 0 (gate) | — | SYNTHETIC_NATIVE_REVIEWED_V31 |
| uk | 1,729 | 284 | 3 | 32 | 0 (gate) | — | SYNTHETIC_NATIVE_REVIEWED_V31 |
| ur | 1,729 | 271 | 3 | 35 | 0 (gate) | RTL: add-on price ranges from the formatter need an LTR isolate (§430) | SYNTHETIC_NATIVE_REVIEWED_V31 |
| uz | 1,729 | 317 | 2 | see record | 0 (gate) | — | SYNTHETIC_NATIVE_REVIEWED_V31 |
| vi | 1,729 | 247 | 2 | 22 | 0 (gate) | Vietnam FAQ q1 still says apostille; Viet Nam began issuing apostilles on 2026-09-11 — a country note may be needed | SYNTHETIC_NATIVE_REVIEWED_V31 |
| zh-Hans | 1,729 | 279 | 2 | see record | 0 (gate) | — | SYNTHETIC_NATIVE_REVIEWED_V31 |

**Totals:** 55,287 key reviews, **10,394 strings changed** across 32 locales; plus 310 ko/en source strings revised (`source-audit.json`) and 143 console English strings.

## Issues every locale found (systemic — fixed in all 32)

- "Support window" rendered as consultation time/sessions (`compare.row.support`, `services.scope.consultation`).
- Premium "no limit" without its exclusions (`compare.scopeNote` dropped "new documents, translation, notarization").
- Hangyul submitting the application (`v4.ws.team.final`) — Korean law: applicants submit personally.
- Hangyul preparing / issuing visas (`DOCUMENT_PREP`, `services.s2`), airport pickup without the partner.
- Privacy note omitting the partner agency that receives the data (`register.privacyNote`).
- Homepage outcome promises inherited from the old promotional copy (dream, success, best result, every university offers scholarships).
- Hangul (대학알리미) inside the English source of `v12.terms.universityInfo.p` → leaked into every translation.

## Unresolved, recorded per locale (not guessed)

- `_one` strings whose English has no `{{count}}` (`v8.compare.budget_one`, `v9.discovery.scholarship_one`, `v22.home.appsQuiet_one`) read wrong for fr (0) and ru/uk/sr (21, 31…): needs a source change.
- Keys with only `_other` in the job cannot receive `_one` through the V28 pipeline.
- Associate degree / junior college, 표시·광고 legal category, 사업자등록증: no exact local equivalents.
- Owner-verbatim Korean and Russian homepage copy (V11 fidelity gate) still contains guarantee/superlative language — owner decision.

## Approved plan copy — restored (found by `plan-content.test.ts` in the final regression)

The V31 ko/en source pass had rewritten 18 owner-approved plan lines (each plan's description + five benefits,
한귤 UNIV_20261019 §3, pinned since V21 b). That is the owner's contract text, not ours to edit: ko and en were
restored verbatim (`approved-restored.json`). The V31 audit had called "Visa documents prepared" an entitlement
broadening — wrong: the approved Korean says 비자 서류 준비. The 32 translations, reviewed against the draft, were
re-aligned to the approved meaning (133 strings; `approved-align-notes.md`): "managed with you" → managed;
"help preparing visa documents" → visa document preparation; Premium f4 back to the visa *schedule* (no "documents");
Basic f1 counts only the follow-up. Comparison-table rows, notes and add-on lede (V29 product copy, not pinned) keep
the V31 fixes.

Open for the owner: Basic f4 in most locales reads "checklist of the documents you need" where the Korean says a
*basic admission* document checklist (slightly broader); Arabic writes 2 and 1 as dual/“واحدة” forms (grammatical).
