# V27 l10n review — Polish (pl)

Scope: all 729 strings of `scripts/i18n/v27/strings.json` (215 new, 514 changed). Output: `scripts/i18n/v27/tx/pl.json`.
Register: informal **Ty** with capitalised pronouns (Twój, Ci, Cię), matching the existing `packages/i18n/locales/pl/` bundle
("Sprawdź, gdzie możesz aplikować"). Second-person past-tense and conditional forms are avoided because they are gendered in
Polish (e.g. "spełniałbyś", "skończyłem" were rewritten). Changed keys were translated fresh from the new English (Korean
consulted for ambiguity), not patched from the old Polish.

## Personas

| Persona | Who | Reads for |
| --- | --- | --- |
| **Zuzia, 19, Kraków** | po maturze, wants a year at a Korean language institute, then a licencjat | friendly Ty-copy, short buttons, no gendered forms that assume "he" |
| **Michał, 27, Wrocław** | software engineer, applying for an English-taught magisterium | correct visa/document terms (apostille, legalizacja konsularna, dowód posiadania środków) |
| **Pani Ewa, 50, mama Zuzi** | pays czesne, reads payment and refund copy | clear money wording, nothing that sounds like a guaranteed place |

## Glossary

| English | Polish (chosen) | Note |
| --- | --- | --- |
| university | uczelnia | matches bundle |
| scholarship | stypendium | matches bundle |
| Global Korea Scholarship (GKS) | Global Korea Scholarship (GKS), stypendium rządowe | no established Polish name; official name kept, gloss in the category label |
| admission guide (모집요강) | zasady rekrutacji | what Polish universities publish |
| apostille / Apostille Convention | apostille (indeclinable) / konwencja apostille | matches bundle |
| consular legalization (영사확인) | legalizacja konsularna | matches bundle |
| certificate of admission / admission letter | list przyjęcia | matches bundle |
| Korean language institute | (uczelniany) instytut języka koreańskiego | matches bundle |
| program(me) | program; kurs języka koreańskiego for language programs | matches bundle |
| counselor | doradca ("Twój doradca") | matches bundle |
| Hangyul team | zespół Hangyul | |
| plan (paid) | plan | matches bundle |
| deadline | termin | matches bundle |
| proof of funds | dowód posiadania środków | |
| bank balance certificate | zaświadczenie o saldzie konta | matches bundle |
| residence card | karta pobytu | matches bundle |
| tuition | czesne | matches bundle |
| match / strong match | dopasowanie / mocne dopasowanie | matches bundle |
| Recommended (sort) | Polecane | matches bundle; defined as "nie ranking, kolejność przeglądania" |
| immigration office | urząd imigracyjny | matches bundle |
| TB certificate | zaświadczenie o badaniu na gruźlicę | |
| application | wniosek | |

## Pass A — meaning (9 strings changed)

| Key | Before | After |
| --- | --- | --- |
| student:legalFlow.note.JOINED | {{country}}: przystąpienie do konwencji apostille {{date}}… | {{country}}: przystąpienie do konwencji apostille nastąpiło {{date}}… (JOINS and JOINED read the same; now future vs past) |
| common:fit.reason.unverifiedIeqas | Certyfikat w zakresie kształcenia międzynarodowego… | Ma certyfikat w zakresie kształcenia międzynarodowego… (the university is certified) |
| visaroute:docs.readyCount | Gotowe: {{count}}, z Twoich dokumentów: {{reused}} | Gotowe: {{count}}, ponownie użyte z Twoich dokumentów: {{reused}} ("reused" was lost) |
| dossier:home.checkDetails_more | …i jeszcze {{more}} inne… | …i pozostałe ({{more}})… (number agreement broke for 1) |
| common:uni27.service.COUNSELING | Doradztwo i wsparcie | Poradnictwo (draft added "support") |

Others: NHIS line names "państwowe ubezpieczenie zdrowotne"; `JOINS` marked as "planowane"; `v4.gap.degree` adds the missing subject; `agenciesPage.valueLede` "dopytywania" → "ponaglania" (follow-up chasing).

## Pass B — native naturalness (18 strings changed)

| Key | Before | After |
| --- | --- | --- |
| student:v4.unlock.topik | Z TOPIK na poziomie {{level}} spełniałbyś warunki. | Z TOPIK na poziomie {{level}} warunki byłyby spełnione. (gender-neutral; same for IELTS) |
| marketing:v10.account.continue | Kontynuuj tam, gdzie skończyłem | Kontynuuj od miejsca, w którym przerwano (masculine-only form; bundle wording) |
| student:register.verify.delivery.UNREACHABLE.email | …Wszystko, co wpisano, jest zapisane… | …Wszystkie wpisane dane są zapisane… (8 sign-up error strings, web + mobile) |
| student:dashboard.nextAction.PROFILE_UNLOCK.budget.text | Spełniasz wymagania programów w liczbie: {{count}}. | Liczba programów, których wymagania spełniasz: {{count}}. |
| student:dashboard.stageText.VISA | Masz przyjęcie na studia. | Przyjęto Cię na studia. |

Others: declaration form "sam lub sama" → "osobiście"; "rozliczani z pracy" → "z efektów"; tuition paid "na własne nazwisko".

## Pass C — UI context, brevity, consistency (11 strings changed)

| Key | Before | After |
| --- | --- | --- |
| marketing:v20.city.Incheon.body | To w Inczonie wylądujesz… | To w Incheonie wylądujesz… (one spelling across the app; students know the airport as Incheon) |
| common:fit.tier.ONE_STEP.short | Jeden krok | Krok od celu |
| common:fit.sort.label | Sortuj | Sortuj według |
| student:legalFlow.step.consular.title | …w ambasadzie lub konsulacie Korei w kraju: {{country}} | …w ambasadzie lub konsulacie Korei ({{country}}) (no case agreement needed for the country name) |
| student:home.docAction.TOO_OLD | Za stary. Zdobądź nowy egzemplarz | Za stary. Zdobądź nowy (chip length) |

## Final comparison (source ↔ target)

All 729 strings re-read against English (and Korean where the English was ambiguous); no further changes. Automated
cross-check flags only intentional Polish exonyms/inflections (Ałmaty, Mumbaj, Ćennaj, w Manili) and "1500" for "1,500"
(Polish number format). No gendered second-person forms remain (grep for -łeś/-łaś/-byś). No admission-probability or
guarantee wording. Placeholders and `<em>` identical. Validator: `node scripts/i18n/v27/validate.mjs --only=pl` → 729 valid, 0 problems.

## Unsure

- **Plurals:** Polish needs `_few`/`_many`; only `_one`/`_other` exist in the source. All `_other` and base keys with `{{count}}`
  are written count-neutral ("Zapowiedziane zmiany ({{count}})", "Liczba miesięcy: {{count}}"), so they read correctly for 2–4
  and 5+ alike. Existing `_few`/`_many` keys in the bundle for these ids (e.g. `compare.legalCount_few`) were made from the old
  English and are not part of this set; they should be regenerated with the merge.
- Exonyms: Ałmaty, Mumbaj, Ćennaj are standard Polish; a reviewer may prefer the Latin forms used on embassy pages.
- `fit.level.ASSOCIATE` "Studia krótkiego cyklu" (EQF level 5) is the closest Polish category for a Korean 전문학사.
- Government tier names „excellent” / „certified” / „consulting” kept in English, as in the source.
- `agency.reviews.changesDone` / `messages.internalToggle` use generic masculine "student" (staff-facing UI).

## Follow-up (5 keys)

Added after the main pass (two new reasons; the UNCLEAR tier re-sourced as "far above current result"). Meaning, naturalness and brevity passes applied; no wording implies admission probability.

- `fit.reason.noneRequiredLater` → Do złożenia wniosku nie jest wymagany wynik językowy. Po przyjęciu na studia będzie wymagany {{tests}} lub wyżej.
- `fit.reason.far` → Wymaga {{options}} lub wyżej – znacznie powyżej twojego obecnego wyniku.
- `fit.tier.UNCLEAR.title` → Na razie jeszcze daleka droga
- `fit.tier.UNCLEAR.short` → Więcej przygotowań
- `fit.tier.UNCLEAR.lede` → Twój obecny wynik jest znacznie poniżej opublikowanego wymagania. Daj sobie więcej czasu na przygotowanie i sprawdź ponownie.

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
