# V29 l10n record — Hungarian (hu)

Scope: V29 service-contract strings (`scripts/i18n/v28/jobs-v29/hu.json`, 158 keys) → `scripts/i18n/v28/tx-v29/hu.json`.
Korean is canonical. Register: tegező (te), as in the V28 bundle. Plan names stay Latin; team = "a Hangyul Univ csapata" /
"a csapatod"; plan = *csomag* (V28 glossary).

Validator: `JOBS=jobs-v29 TX=tx-v29 node scripts/i18n/v28/validate.mjs --only=hu` → 158 strings valid, 0 problems.

## Personas
- Réka, 18, Debrecen (first-time visitor), K-culture fan, reads cards on mobile.
- Bence, 25, Budapest (comparison shopper), master's applicant comparing agency offers.
- Réka's mother, pays and reads the "before you buy" notes.

## Key term decisions
| Concept (ko) | Hungarian | Why |
|---|---|---|
| 계약 서류 안에서 횟수 제한 없음 | *A szerződésben rögzített jelentkezési dokumentumok lektorálása, körlimit nélkül*; note: *nincs körlimitje a szerződésben rögzített jelentkezési dokumentumokon és ütemterven belül* | limit only on rounds, scoped; never *korlátlan* |
| 대학 지원 최대 N곳 관리 | *Legfeljebb 2 egyetemi jelentkezés kezelése* | "kezelése" = managed, no guarantee |
| 추천 대학 | *ajánlás / Ajánlott egyetemek* | distinct from *kezelt jelentkezések* |
| 별도 견적 | *Egyedi árajánlat* | |
| 공항 픽업 연결 | *Reptéri transzfer megszervezése*; note: *partner szállítási szolgáltatón keresztül szervezzük meg* | arranged, not driven |
| 비자 지원 | *segít … a döntést az illetékes hatóság hozza meg* | |
| 첨삭 | *lektorálás* (round = *kör*) | |
| 자기소개서·학업계획서 | *motivációs levél és tanulmányi terv* | |
| 모의 면접 | *próbainterjú* | |
| 기숙사 | *kollégium* | V28 glossary |
| 정착 지원 | *beilleszkedési támogatás* | |
| 유학 진단 상담 | *felmérő konzultáció* | |
| 번역·공증 | *fordítás és közjegyzői hitelesítés* | |
| 업그레이드 | *csomagváltás / váltás* | |

## Passes
- Pass A (meaning): 4 changes, e.g. *korlátlan lektorálás* → *körlimit nélkül … szerződésben rögzített*; *3 egyetemre jelentkezhetsz* → *Legfeljebb 3 jelentkezés kezelése*; *reptéri felvétel* → *Reptéri transzfer megszervezése*.
- Pass B (naturalness): 3 changes; premium.position draft (ungrammatical *kísérnél kérsz*) → *Ha a vízumban, az érkezésben és az első koreai hetekben is segítséget szeretnél*; *Nem, köszönöm* → *Köszönöm, nem*.
- Pass C (UI): date strings rewritten to colon form (*Lejár: {{date}}*, *Konzultáció eddig: {{date}}*, *… vége: {{until}}*) so no case suffix attaches to an app-formatted date; mobile chips shortened.
- Marketing scorecard (v29.why): s1 25/30, s3 26/30.
- Plurals: Hungarian uses the singular noun after numerals, so `_one`/`_other` are identical (*{{count}} nap*).

## Unsure
- `v29.addon.unit.ARRANGEMENT` *1 szervezés* — acceptable as a table unit, slightly abstract.

Counts: job keys 158 · kept verbatim 0 · newly translated 158 · extra plural forms 0.

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
