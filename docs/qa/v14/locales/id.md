# Indonesian — `id`

| | |
|---|---|
| Target market | Indonesia (ID) · Indonesia · 인도네시아 |
| Primary native language | Bahasa Indonesia (Indonesian) |
| Writing direction | LTR |
| Flag asset | `apps/flags/ID.svg` → served as `/flags/ID.svg` |
| Homepage coverage | 49/49 keys |
| Locale status | `MACHINE_DRAFT` |
| Visual QA (320 / 390 / 768 / 1440) | clean |

## Source and method

Translated **from the Korean source**, which is the owner-approved original and the canonical semantic
reference (brief Part 41). English was read as a second opinion on meaning and was never the source — the
distinction matters because Koreanasha's English is itself a translation, and translating a translation
compounds its choices.

Every string passed `scripts/i18n/v14-merge.mjs` before being written: interpolations preserved, markup limited to the four tags the renderer understands, not byte-identical to the English source, and free of characters from writing systems this locale does not use.

## Synthetic reviewer personas

These are **synthetic** reviews — a model reading its own output against a written rubric. They are useful and
they are not a human review. Nothing here raises this locale's status to `HUMAN_REVIEWED`.

**A · prospective student, 18–22.** Does this sound like something a person my age would say, or like a form?
Would I trust it enough to hand over my documents? Is any sentence a Korean construction wearing my
language's vocabulary?

**B · parent or sponsor.** Is it clear what this company does and does not do? Are the money and document
sentences precise enough to act on? Does anything promise an outcome a university decides?

**C · native digital-product editor.** Is the register consistent across the page — buttons, headings and body
all addressing the reader the same way? Is the terminology what this market's own universities and ministries
use? Would this ship?

## Findings carried into the text

- **Register.** The Korean source addresses the reader directly and warmly ("시작하세요!"). This locale uses
  the form a consumer service in this market would actually use rather than the one closest to Korean —
  informal second person where that is the norm for this audience, polite-neutral where it is not.
- **Sentence shape.** Korean marketing copy stacks clauses before its verb. Rendered clause-for-clause that
  produces sentences which are grammatical and unmistakably translated, so the long `why` and `services`
  bodies were re-broken along this language's own rhythm while keeping every claim the source makes.
- **Claims.** The source says Hangyul 보장합니다 a successful student life. Kept as a statement about the
  service's support and never re-pointed at an admission outcome, which no agent can guarantee and which
  `docs/LEGAL_DEPENDENCIES.md` treats as a representation risk.
- **`<br>` positions** are layout, not prose: each sits where this language's line wants to break, not where
  Korean's did.
- **Recorded cognates** (identical to English by decision, not omission): `nav.menu` → "Menu" — Standard Indonesian; 'daftar' would mean a list of items, not a navigation menu.; `v14.legal.email` → "Email" — Indonesian uses 'email' unchanged; 'surel' is a coinage almost nobody writes.

## Terminology decisions

| Korean source term | Decision |
|---|---|
| 한귤 (the brand) | Latin **Hangyul** in every locale except Korean — the same choice the owner's own Russian bundle makes. Never transliterated into the local script, so the brand is one string worldwide. |
| 어학당 | *language institute / language school*, not "academy" — it is a university-attached Korean-language programme and the student will meet the phrase again on a university's own site. |
| TOPIK · TOEFL · IELTS | never translated or transliterated; they are the names on the certificates. |
| 아포스티유 (apostille) | kept as this market's own term for the Hague apostille, because it is the word the student must ask their own ministry for. |
| 외국인등록증 | the destination term (*alien registration card* and its local equivalents) rather than a literal rendering. |
| 세종학당 | King Sejong Institute, by its official English name in Latin-script locales and its established local rendering elsewhere. |
| 전문대 | *junior college / vocational college*, kept distinct from 대학교 — the FAQ's answer depends on the difference. |

## Date, number and figure formatting

Formatted by `Intl` through `@hangyul/utils` with this locale's own rules. `copyLocale()` keeps a figure in the
script of the sentence around it — the reason "200+" is not rendered in Bengali digits inside an English
fallback sentence. The university count is rounded **down** to one significant figure (`marketingScale`), so
the "+" stays true whichever way the national register moves.

## Untranslated, and why

- **University directory and detail pages** (`v12.*`, 225 keys) — Korean and English only. The largest
  remaining gap on the public site, and not papered over: the homepage is fully Indonesian and the university
  pages behind it are English.
- **Privacy policy and terms** — deliberately excluded. A privacy policy is a legal instrument; a
  machine-drafted one would be worse than a correct English one. Translated when a reviewer with legal
  standing signs off per market.
- **Agency and university consoles** — not offered in this locale's selector, so nothing incomplete is shown.

## Result

**SYNTHETIC_REVIEWED** — homepage and site chrome complete, visual QA at four widths, no English leakage, no mixed
script. **Not human-reviewed.**
