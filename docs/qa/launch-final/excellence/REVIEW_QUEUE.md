# Human translation review queue (prioritised, 2026-11-22)

No locale has been reviewed by a human. Every non-Korean string — including the strings written in this pass — is
machine-drafted and model-reviewed only ([`../../../LOCALIZATION.md`](../../../LOCALIZATION.md)). This queue is the order in which a
native-speaker reviewer should spend the first hours, by harm if wrong, not by volume. Counts are English source
keys; each must be read in every offered Student locale.

**Locales first:** vi, ne, my, ja, zh-Hans, ru, ar (largest expected markets and the scripts most likely to break),
then the other 13 Student locales. Korean console copy (Operations, University) is first-language and needs no review.

| Priority | Journey | Keys (en) | Where (namespace › prefix) | Why first |
|---|---|---|---|---|
| 1 | Errors and failed actions | 18 | `common › errors.*`, `states.*`, `v32.unavailable.*`; `student › messages.notSent` | Read when something already went wrong; a wrong word here loses trust or work |
| 2 | Legal, consent, who sees my documents | 23 | `common › consent*`; `dossier › v9.who.*`; `student › v9.who.*` | Legal meaning must survive translation; counsel review is separate and still open |
| 3 | Sign-up and sign-in | 125 | `common › auth.*`, `identity.*`; `student › register.*`, `forgot*` | First contact; codes, password rules, verification |
| 4 | Payment and plans | 229 | `student › v29.services.*`, `billing.*`, `payment*`, `services.*`; `common › v29.pricing.*` | Money: what is paid, once, to whom, refund wording |
| 5 | Matching verdicts | 103 | `common › matchReason.*`, `tier.*`; `student › discover.verdict.*`, `v4.verdictText.*`, `matches.*`, `gap.*` | Must never read as a probability ("가능성", "chance"); STATE_MAP eligibility rules |
| 6 | Document correction | 81 | `dossier › item.*`, `summary.*`, `view.*`, `upload.*`; `student › home.docAction.*` | A student must understand exactly what to fix (apostille, translation, re-issue) |
| 7 | Application status | 278 | `student › stage.*`, `applicationDetail.*`, `v4.ws.*`, `ws3.*`; `common › appStatus.*` | The five student-facing states and what happens next |
| 8 | Visa warnings | 550 | `visaroute › *` | Large; read the warnings (`*.warn*`, `*.caveat*`, `v5.moreCaveats_*`) before the guides |

## Known points to check first (from model review)

- `visaroute › v5.moreCaveats_*` has only `_one/_other`; Arabic and Russian need their other plural forms.
- Nepali uses plain rather than honorific verbs for the team; decide the register once and apply it.
- Bengali `mobile › student.home.noCounselor` is a literal rendering.
- The 86 student strings rewritten on 2026-11-21 from "your counselor" to "the Hangyul team" (21 locales).
- This pass (2026-11-22) added 21 Student strings in 21 locales: `student › v34.*` (journey fold, home upload line,
  message day lines and deep links, profile chapters) and `dossier › view.*` (해야 할 일 · 검토 중 · 완료 · 전체).
  Read them in context on the Home, Documents, Messages and Profile screens.
- Two stale plural forms that overrode corrected text were deleted in `ko` and `my` (`dossier › package.*`,
  `group.extraCount`, `agency.suggestions`); a reviewer should confirm the remaining singular forms read naturally.
