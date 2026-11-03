# V27 l10n review — German (de)

Scope: all 729 strings of `scripts/i18n/v27/strings.json` (215 new, 514 changed). Output: `scripts/i18n/v27/tx/de.json`.
Register: informal **du**, matching the existing `packages/i18n/locales/de/` bundle ("Mach genau da weiter, wo du aufgehört hast").
Changed keys were translated fresh from the new English (Korean consulted for ambiguity), not patched from the old German.

## Personas

| Persona | Who | Reads for |
| --- | --- | --- |
| **Lena, 19, Köln** | Abiturientin, applying for a Bachelor's in Seoul after a K-culture gap year | warm, plain du-copy; no bureaucratic German; short buttons |
| **Jonas, 27, München** | Maschinenbauingenieur, applying for a Master's (English-taught) | precise visa/document terms (Apostille, Legalisation, Finanzierungsnachweis) |
| **Sabine, 52, Lenas Mutter** | pays tuition, reads the money and safety copy | clear payment/refund wording, no promises of admission |

## Glossary

| English | German (chosen) | Note |
| --- | --- | --- |
| scholarship | Stipendium | |
| Global Korea Scholarship (GKS) | Global Korea Scholarship (GKS, Regierungsstipendium) | no established German name; official name kept, gloss added once in the category label |
| admission guide (모집요강) | Bewerbungsleitfaden | |
| apostille | Apostille / Apostille-Übereinkommen | |
| consular legalization (영사확인) | konsularische Legalisation | bundle has "Konsularische Bestätigung" (= consular confirmation, which the brief forbids) — see "Unsure" |
| certificate of admission / admission letter | Zulassungsbescheid | matches bundle |
| Korean language institute | Sprachinstitut (für Koreanisch) | matches bundle "Sprachinstitute" |
| program(me) | Studiengang; Koreanisch-Sprachkurs for language programs | matches bundle |
| counselor | Berater/deine Beraterin (dein Berater/deine Beraterin) | matches bundle form |
| Hangyul team | Hangyul-Team | new English drops "Univ" |
| plan (paid) | Paket | matches bundle |
| deadline | Frist / Bewerbungsschluss | |
| proof of funds | Finanzierungsnachweis | |
| bank balance certificate | Kontostandsbescheinigung | matches bundle |
| residence card | Aufenthaltskarte | matches bundle |
| tuition | Studiengebühren | |
| match / strong match | Treffer / starker Treffer | matches bundle |
| Recommended (sort) | Empfohlen | explicitly "kein Ranking, sondern eine Reihenfolge zum Stöbern" |
| e-visa | E-Visum | |
| immigration office | Einwanderungsbehörde | |
| TB certificate | Tuberkulose-Attest | |
| My progress | Mein Fortschritt | |
| new / current students | Erstsemester / Eingeschriebene | |

## Pass A — meaning (21 strings changed)

| Key | Before | After |
| --- | --- | --- |
| common:uni27.service.COUNSELING | Psychologische Beratung | Beratung (draft added "psychological") |
| common:fit.tier.MEETS.short | Mindestens erfüllt | Minimum erfüllt ("at least met" ≠ "meets minimums") |
| student:v9.money.note.NHIS_D4 | …beginnt sie 6 Monate nach der Einreise… | …beginnt die staatliche Krankenversicherung 6 Monate nach der Einreise… (dangling pronoun) |
| student:v9.funds.kind.NOT_STATED | …das Hangyul-Team klärt den Rest. | …das Hangyul-Team klärt das. (draft added "the rest") |
| mobile:agency.reviews.changesDone | …Die Person wurde benachrichtigt | …Student/in wurde benachrichtigt ("student" was lost) |

Others: `intl.kli_named` made article-free for any institute name; GKS label no longer English-identical; Hangul removed from `v20.uni.why.breadthBody` (Daehak Allimi romanised); `reason.NEAR_TOO_OLD` and `timing.noDate` now say "issued within N days" instead of "at most N days old".

## Pass B — native naturalness (23 strings changed)

| Key | Before | After |
| --- | --- | --- |
| student:login.aside.title | Ein ruhiger Ort für jeden Schritt an eine koreanische Hochschule. | Ein ruhiger Ort für jeden Schritt auf dem Weg an eine koreanische Hochschule. |
| marketing:hero.lede | …und bring Visum und Ankunft hinter dich… | …und meistere Visum und Ankunft… (bundle wording, less grudging) |
| marketing:v20.city.Ulsan.body | Ingenieurabsolventen werden hier eingestellt. | Wer Ingenieurwesen studiert hat, findet hier Arbeit. |
| common:task.writeEssay | Schreib dein {{essayType}} für {{university}} | {{essayType}} für {{university}} schreiben (no gendered article before an unknown noun) |
| student:v4.docs.essayReading | …Jetzt nichts hochzuladen. | …Du musst gerade nichts hochladen. |

Others: track labels Koreanischsprachig/Englischsprachig and the two `_track` reasons rebuilt around them; Sie/ihr slip in `agenciesPage.lede` unified to du; payment guard text simplified ("auf den Namen der Studierenden selbst").

## Pass C — UI context, brevity, consistency (46 strings changed)

| Key | Before | After |
| --- | --- | --- |
| visaroute:route.feeUnknown | …Deine Beratung prüft den aktuellen Betrag. | …Dein Berater/deine Beraterin prüft den aktuellen Betrag. (bundle term, applied to 33 visaroute/mobile strings) |
| marketing:proof.app.text | …die deiner Beratung… | …die deines Beraters/deiner Beraterin… |
| common:uni27.stage.NEW | Studienanfänger | Erstsemester (short, gender-neutral; also in `strongest`/`strongestFor`/`BOTH`) |
| common:fit.level.COMBINED | Master + Promotion | Integrierter Master + Promotion (consistent with `degree.COMBINED`) |
| student:legalFlow.step.consular.title | Konsularische Legalisation … in {{country}} | Konsularische Legalisation … in {{country}} einholen (step titles are actions) |

## Final comparison (source ↔ target)

All 729 strings re-read against English (and Korean where the English was ambiguous). One further fix came out of this
comparison: `student:start.result.none` "Noch passt kein gelisteter Studiengang zu allen veröffentlichten Anforderungen…" →
"Noch erfüllst du bei keinem gelisteten Studiengang alle veröffentlichten Anforderungen…" (it is the student who meets the
requirements, not the programme). Automated cross-check: every test name,
visa code, office name, number and email in the English is present in the German (0 flagged). No admission-probability or
guarantee wording; "Empfohlen" is described as a browsing order. Placeholders and `<em>` identical. Validator:
`node scripts/i18n/v27/validate.mjs --only=de` → 729 valid, 0 problems.

## Unsure

- **Bundle conflict:** `common:legalization.CONSULAR_LEGALIZATION` is now "Konsularische Legalisation"; many untouched bundle
  strings still say "Konsularische Bestätigung". Those should be aligned in a later pass (not edited here, per brief).
- `fit.level.TRANSFER` "Bachelor (Quereinstieg)": German has no exact term for Korean 편입; "Quereinstieg" is the closest common word.
- `v9.funds.longer_*`: the government tier name 'consulting' (컨설팅 대학) rendered literally as „Beratung“ in quotes.
- `uni27.schol.count` / `fit.unlock` / `group.readyCount` base keys use a "label: {{count}}" form so they work for any count.
- `fit.reason.met_track` / `needed_track` put `{{track}}` in parentheses to avoid inflecting the label.

## Follow-up (5 keys)

Added after the main pass (two new reasons; the UNCLEAR tier re-sourced as "far above current result"). Meaning, naturalness and brevity passes applied; no wording implies admission probability.

- `fit.reason.noneRequiredLater` → Für die Bewerbung ist kein Sprachnachweis nötig. Nach der Zulassung brauchst du {{tests}} oder höher.
- `fit.reason.far` → Erfordert {{options}} oder höher – deutlich über deinem aktuellen Ergebnis.
- `fit.tier.UNCLEAR.title` → Noch ein weiter Weg
- `fit.tier.UNCLEAR.short` → Mehr Vorbereitung
- `fit.tier.UNCLEAR.lede` → Dein aktuelles Ergebnis liegt deutlich unter der veröffentlichten Anforderung. Plane mehr Zeit für die Vorbereitung ein und schau dann wieder rein.

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
