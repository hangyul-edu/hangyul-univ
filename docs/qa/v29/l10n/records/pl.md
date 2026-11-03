# V29 l10n record — pl (Polish)

Scope: V29 service-contract strings (`scripts/i18n/v28/jobs-v29/pl.json` → `scripts/i18n/v28/tx-v29/pl.json`). Korean is canonical, English second reference. Validator: `JOBS=jobs-v29 TX=tx-v29 node scripts/i18n/v28/validate.mjs --only=pl` → 0 problems.

## Personas

- Maturzysta (19) z Krakowa, który pierwszy raz sprawdza studia w Korei
- Rodzic porównujący trzy pakiety i szukający ukrytych kosztów
- Kandydatka na studia magisterskie (25), która chce wiedzieć, ile rund redakcji dostanie

## Key term decisions

- **No round limit within the contracted documents**: "Bez limitu rund dla dokumentów objętych umową"; nota: "w ramach dokumentów rekrutacyjnych i harmonogramu objętych umową". Bez "nielimitowany/bez ograniczeń".
- **Up to N managed applications**: "Prowadzimy do N rekrutacji na uczelnie" (wiersz: "Prowadzone rekrutacje") — "rekrutacja prowadzona przez nas" zamiast kalki "aplikacja"; oddzielone od "Polecane uczelnie".
- **Custom quote**: "Wycena indywidualna".
- **Airport pickup arrangement**: "Organizacja odbioru z lotniska"; nota: "przez partnerską firmę przewozową".
- **Plurals**: `_one` (klucz bazowy), `_few`, `_many`, `_other` dla każdego klucza z `_other` (dzień/dni/dnia; konsultacja/-e/-i/-i; rundy/rund/rund/rundy).
- **Day counts**: "Dni od pierwszej konsultacji: {{count}}", "pozostało dni: {{count}}" — support_window_days is 1 or 3 (packages/types/src/plans.ts) and the job has no plural pair for these keys.

## Glossary

| Concept | EN | pl |
|---|---|---|
| Plan names | Everything in Basic · up to 5 recommendations | Wszystko z Basic · do 5 rekomendacji |
| No round limit within contracted documents | No round limit within your contracted documents | Bez limitu rund dla dokumentów objętych umową |
| Premium editing scope note | Premium editing has no round limit within your contracted application documents and schedule. | W pakiecie Premium redakcja nie ma limitu rund w ramach dokumentów rekrutacyjnych i harmonogramu objętych umową. |
| Up to N managed applications | Up to 2 university applications managed | Prowadzimy do 2 rekrutacji na uczelnie |
| Applications managed (row) | Applications managed | Prowadzone rekrutacje |
| Universities recommended (row) | Universities recommended | Polecane uczelnie |
| Custom quote | Custom quote | Wycena indywidualna |
| Airport pickup arrangement | Airport pickup arrangement | Organizacja odbioru z lotniska |
| Pickup note | Airport pickup is arranged through a partner transport provider. | Odbiór z lotniska organizujemy przez partnerską firmę przewozową. |
| Diagnostic consultation | Schedule the diagnostic consultation | Umów konsultację diagnostyczną |
| Follow-up consultation | {{count}} follow-up consultation | {{count}} konsultacja uzupełniająca |
| Statement & study-plan editing | Statement & study-plan editing | List motywacyjny i plan studiów |
| Editing round | 1 round | 1 runda |
| Mock interview | Mock interview | Próbna rozmowa |
| Dormitory | Dormitory | Akademik |
| Settling in | Arrival & settling in | Przyjazd i zadomowienie |
| Additional service (add-on) | Additional services | Usługi dodatkowe |
| Agreed scope | Agreed scope | Uzgodniony zakres |
| Dedicated team · priority | Dedicated team · priority | Stały zespół · priorytet |
| Priority response | Priority response | Odpowiedzi priorytetowe |
| Contract term | Contract term | Okres umowy |
| Service period | Service period | Okres usługi |
| Visa decision disclaimer | Visa support means help preparing and applying; the decision is the authority's. | Wsparcie wizowe to pomoc w przygotowaniu i złożeniu wniosku; decyzję podejmuje właściwy urząd. |
| Upgrade | Ask the team about upgrading | Zapytaj zespół o zmianę planu |
| Not included / Included | Not included | Brak |
| Notarization | Writing a new document, translation and notarization may cost extra. | Napisanie nowego dokumentu, tłumaczenie i poświadczenie notarialne mogą wiązać się z dodatkowymi kosztami. |

## Review passes

### Pass A — meaning vs Korean — 4 strings changed

- "{{count}} dni od pierwszej konsultacji" → "Dni od pierwszej konsultacji: {{count}}"
- "Do 2 aplikacji na uczelnie" → "Prowadzimy do 2 rekrutacji na uczelnie"
- "Nielimitowana redakcja" → "…bez limitu rund"
- "decyzję podejmuje urząd" → "decyzję podejmuje właściwy urząd"
- "Odbiór z lotniska" → "Organizacja odbioru z lotniska"

### Pass B — native naturalness — 3 strings changed

- "przygotowania były jasne i do ogarnięcia" → "…przejrzyste i łatwe do opanowania"
- "Sprawiedliwa cena" → "Uczciwa cena"
- "Kwota pobrana z karty" → "Kwota obciążenia karty"
- "Nie dziękuję" → "Nie, dziękuję"
- "Koszty stron trzecich są oddzielne" → "Koszty po stronie innych podmiotów są osobne"

### Pass C — UI brevity / one term per concept — 2 strings changed

- "Redakcja listu motywacyjnego i planu studiów" → wiersz: "List motywacyjny i plan studiów"
- "Nie zawiera" → "Brak"
- "Ustalimy go razem na starcie usługi" → mobile: "Ustalany na starcie usługi"
- "Dalsze wsparcie Twojego zespołu" → mobile: "Wsparcie zespołu"
- "Próbny wywiad" → "Próbna rozmowa" (istniejący termin)

## Final source↔target comparison

Every key re-read against Korean: no "unlimited" rendering, managed applications never phrased as a guarantee or as "apply to any N", recommended vs managed kept as two different nouns, visa decision attributed to the authority, airport pickup phrased as arranged through a partner, no currency amount translated; all {{placeholders}} and <br> kept.

## Marketing scorecard (marketing:v29.why.*)

| Section | Clarity | Trust | Naturalness | Brevity | CTA | Cultural fit | Total |
|---|---|---|---|---|---|---|---|
| v29.why.s1 (title + text) | 5 | 4 | 5 | 4 | 4 | 4 | 26/30 |
| v29.why.s3 (title + text) | 5 | 5 | 4 | 4 | 4 | 4 | 26/30 |

## Unsure

- "1 zlecenie" jako jednostka odbioru z lotniska.
- "rekrutacja" vs. "wniosek" — na kartach "rekrutacja", jednostka APPLICATION = "1 wniosek".
- "zadomowienie się" (istniejący termin) dla 정착.

## Counts

- Job keys: 158 (all had `current: null`)
- Kept verbatim: 0
- Rewritten: 0
- Newly translated: 158
- Extra CLDR plural forms added: 6 (_few, _many)

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
