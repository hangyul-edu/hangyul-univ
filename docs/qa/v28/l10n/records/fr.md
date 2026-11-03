# V28 l10n review — French (fr)

Scope: every key of `scripts/i18n/v28/jobs/fr.json` (356 keys: 237 with no translation, 119 with an existing `current`). Output: `scripts/i18n/v28/tx/fr.json`.
Variant and register: metropolitan French, **vous** throughout, as in the bundle and V27 (*l'équipe Hangyul*, *Rédaction* for the Writing section, *téléverser* for upload, *formule* for plan). French typography: no-break space before `: ; ? ! %` and inside « ».

Method: each `current` was compared with the **current** English (Korean consulted where the English is terse) and kept verbatim only when it was correct, natural and still matched; everything else was rewritten. All null keys were translated fresh. Glossary carried over from `docs/qa/v27/l10n/fr.md`.

## Personas

| Persona | Who | Reads for |
| --- | --- | --- |
| **Chloé, 18, Lyon** | terminale student, first-time visitor, wants a licence in Seoul after a Korean language institute year | clear vous copy, short buttons |
| **Karim, 27, Paris** | data engineer comparing English-taught masters across services (comparison shopper) | precise criteria, dates, visa terms |
| **Sylvie, 50, Chloé's mother** | pays the fees and the bank balance | who pays whom, no promises |

## Glossary

| English | Korean | French | Note |
| --- | --- | --- | --- |
| scholarship | 장학금 | bourse |  |
| Global Korea Scholarship (GKS) | 정부초청장학 | Bourse du gouvernement coréen (GKS) |  |
| admission guide | 모집요강 | guide d'admission |  |
| apostille | 아포스티유 | apostille |  |
| consular legalization | 영사확인 | légalisation consulaire |  |
| certificate of enrollment | 재학증명서 | certificat de scolarité |  |
| Korean language institute | 어학당 | institut de langue coréenne |  |
| D-2 / D-4 visa | D-2 / D-4 | visa D-2 / D-4 |  |
| e-visa | 전자비자 | e-visa |  |
| residence card | 외국인등록증 | carte de résident |  |
| proof of funds | 재정 증빙 | justificatif de ressources |  |
| tuition | 등록금 | frais de scolarité |  |
| application fee | 전형료 | frais de candidature |  |
| application | 지원 | candidature |  |
| intake | 모집 시기 | rentrée | one word for 모집 시기 in the university console |
| program(me) | 과정 | programme |  |
| the Hangyul team | 한귤 상담팀 | l'équipe Hangyul | replaces every *votre conseiller* |
| plan (paid) | 플랜 | formule |  |
| match | 매칭 | correspondance |  |
| Recommended (sort) | 추천순 | Recommandées | browsing order, never a ranking |
| Needs more preparation (far tier) | 준비가 더 필요 | Plus de préparation nécessaire |  |
| Needs checking with us (unverified tier) | 추가 확인 필요 | À vérifier avec nous |  |
| dormitory | 기숙사 | résidence universitaire |  |
| enrollment | 등록 | inscription |  |
| consular post | 공관 | poste consulaire |  |
| upload | 업로드 | téléverser |  |

## Pass A — meaning (61 strings changed)

Student-facing *votre conseiller* → *l'équipe Hangyul* everywhere; fit tiers re-cut to the V28 English; pricing/dormitory labels follow the shorter English.

| Key | Before | After |
| --- | --- | --- |
| `common:docCategory.EMPLOYMENT_INCOME_PROOF` | Justificatif d'emploi / de revenus | Justificatif d'emploi ou de revenus |
| `concierge:help.route.HOUSING` | Votre conseiller | L'équipe Hangyul |
| `common:fit.tier.UNCLEAR.title` | Encore du chemin à faire | Plus de préparation nécessaire |
| `common:fit.tier.CHALLENGE.title` | À regarder de plus près | À vérifier avec nous |
| `visaroute:caveat.APOSTILLE_TRANSITION` | Le Viêt Nam délivre des apostilles depuis le 11 septembre 2026, mais les listes de l'ambassade pour le visa étudiant mentionnent encore la légalisation consulaire. Votre conseiller confirme laquelle est acceptée. | Le Viêt Nam délivre des apostilles depuis le 11 septembre 2026, mais les listes de l'ambassade pour le visa étudiant mentionnent encore la légalisation consulaire. L'équipe Hangyul confirme laquelle est acceptée. |

## Pass B — native naturalness (12 strings changed)

| Key | Before | After |
| --- | --- | --- |
| `agency:inbox.pickText` | Ou démarrez-en une avec un étudiant que vous accompagnez. | Ou démarrez-en une avec n'importe quel étudiant que vous suivez. |
| `agency:v25.today.student_silent` | étudiants sans nouvelles | étudiants qui ne répondent pas |
| `agency:v8.view.docs` | Correction de documents requise | Documents à corriger |
| `common:fit.tier.ONE_STEP.title` | À une étape près | À une étape |
| `concierge:residence.groupUnknown` | Demandez à votre bureau international s'il dépose les demandes de carte de séjour en groupe. Sinon, réservez vous-même votre rendez-vous sur HiKorea. | Demandez à votre bureau international s'il dépose les demandes de carte de résident en groupe. Sinon, réservez vous-même votre rendez-vous sur HiKorea. |

## Pass C — UI context, brevity, one term per concept (12 strings changed)

| Key | Before | After |
| --- | --- | --- |
| `writing:v6.queueKeys` | ] … appuyez sur ? pour les raccourcis (draft) | kept the existing string: here *?* is a key name, not punctuation, so no no-break space |
| `agency:v28.stage.next` | Suivante : {{stage}} (draft) | Prochaine étape : {{stage}} |
| `university:v28.pipe.step.OFFERED` | Offres (draft) | Offres émises |
| `agency:docs.sc.checks` | Cocher une vérification / choisir un motif | Choisir une vérification ou un motif |
| `agency:v11.manage.catalogHint` | Universités, programmes et leurs exigences | Universités, programmes et leurs critères |

(3 of these are corrections to this review's own first draft of new strings; the rest change an existing `current`.)

## Final source ↔ target comparison

All keys re-read against `en`/`ko`; placeholders and tags identical; no Hangul; *légalisation consulaire* for 영사확인; no *conseiller* left for the student team (the agency stage *Accompagnement* names an activity, not a person).

## Marketing scorecard (30 points: clarity, trust, naturalness, brevity, CTA strength, cultural fit; 5 each)

39 `marketing:` keys in the job. Sections touched, scored after the last rewrite (first-draft score in brackets where a rewrite was needed):

| Section | Keys | Clar. | Trust | Nat. | Brev. | CTA | Fit | Total |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SEO / home description | seo.home.description | 5 | 4 | 5 | 4 | 4 | 4 | **26** |
| Pricing (v15.pricing.*) | lede, premium.f5, compare rows | 5 | 5 | 4 | 4 | 4 | 4 | **26** |
| City pages (v20.city.*) | Busan, Gyeonggi, Gyeongnam, Seoul | 4 | 5 | 5 | 4 | 4 | 5 | **27** |
| University page (v20.uni.*, v24, v28.uni.why.*, v12) | ctaTitle/Body, intlTitle, whyTitle, why.* | 5 | 5 | 4 | 4 | 4 | 4 | **26** (23: *Prêt(e) à vous y intéresser sérieusement ?* replaced by *Vous pensez à candidater ici ?*) |
| FAQ languages (v9.faq.languagesA) | languagesA | 5 | 5 | 4 | 3 | 4 | 4 | **25** |
| Journey / universities strip, services, footer | journey.eyebrow, v6.unis.title, v10 housing.p2, v23 footer | 5 | 4 | 4 | 5 | 4 | 4 | **26** |

All touched sections ≥ 25 after rewrite.

## Strings I am unsure of

- `university:v28.pipe.label` — *Parcours et résultats* for "Pipeline and outcomes"; *entonnoir* is more literal but reads as sales jargon to admissions staff.
- `university:programs.seats` — *Places int.* — abbreviation may be too terse.
- `marketing:v20.uni.why.ieqasExcellent` — *IEQAS : excellence* — the official French label of the grading, if any, is unknown.
- `agency:v22.stage.counselling` — *Accompagnement* rather than *Conseil* (which can read as "board").

## Counts

| Job keys | Kept verbatim | Rewritten | Newly translated |
| --- | --- | --- | --- |
| 356 | 37 | 82 | 237 |

Validator: `node scripts/i18n/v28/validate.mjs --only=fr` → `356 strings valid, 0 problems`.

## Second pass (jobs2): leak families

Job `scripts/i18n/v28/jobs2/fr.json`, customer families only (marketing 2, student 39, success 204, dossier 27). Every key had `current: null` and was showing English fallback, so all of them are newly translated. Same personas and glossary as the first pass. Pass A (meaning against en + ko), Pass B (naturalness), Pass C (UI brevity, one term per concept). Then a final source↔target check.

| Job keys | Kept verbatim | Rewritten | Newly translated | Intentionally empty |
|---|---|---|---|---|
| 272 | 0 | 0 | 269 | 3 (`dossier:upload.status.*`, empty in en/ko) |

Every key was drafted once and then checked in passes A–C. Changes after the draft: A: 0. B: 0. C: 3 (`upload.status.*` emptied to match en).

Examples (before → after):

| Key | Before | After |
|---|---|---|
| `student:workspace.owner.prep.you` | Upload the missing documents and finish your essays. (missing → English fallback) | Envoyez les documents manquants et terminez vos essais. |
| `success:item.ESSAY_WRONG_NAME.why` | An essay addressed to another university is the most common avoidable rejection. (missing → English fallback) | Un essai adressé à une autre université est la cause de refus évitable la plus fréquente. |
| `success:agencyItem.DOC_LEGALIZE` | {{label}} — consular legalization pending (missing → English fallback) | {{label}} : légalisation consulaire en attente |
| `success:agency.evidenceRule` | Confirmed only with a confirmation number or receipt. Moves the application to Submitted. (missing → English fallback) | Confirmé uniquement avec un numéro de confirmation ou un reçu. La candidature passe alors à Envoyée. |
| `dossier:page.privacy` | Only you, your counselor and Hangyul can see these files. A university sees a document only when it is sent for your application to that university. (missing → English fallback) | Seuls vous et l'équipe Hangyul pouvez voir ces fichiers. Une université ne voit un document que s'il est envoyé pour votre candidature chez elle. |

Marketing scorecard (`marketing:v20.uni.intl.officeLine` / `.none`; clarity, trust, naturalness, brevity, CTA, cultural fit):

| Section | Text | Cl | Tr | Na | Br | CTA | Cu | Total |
|---|---|---|---|---|---|---|---|---|
| University page, international office lines | Un bureau international dispose de son propre point de contact. / Hangyul n'a pas encore trouvé de page dédiée aux étudiants internationaux sur le site de cette université. Commencez par son site officiel ci-dessous. | 5 | 5 | 4 | 4 | 4 | 4 | **26** |

Terms are identical to the first-pass glossary above. The student-facing `dossier:page.privacy` says “the Hangyul team”, never “your counselor”. *Counselor* appears only in the agency console role label.

Unsure (second pass):

- `dossier:upload.status.*` left empty as in en/ko. The existing fr `upload.haveTitle` wraps `{{status}}` as “({{doc}}, {{status}})”, so an empty status shows “(Passeport, )”. That template should be checked (it is not in this job).
- `success:agency.colFit` *Adéquation*; `student:workspace.tabs.timeline` *Historique*.
- `success:queue.fixture` rendered *Test*.

Validator: `JOBS=jobs2 TX=tx2 node scripts/i18n/v28/validate.mjs --only=fr` → 272 strings valid, 0 problems.

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
