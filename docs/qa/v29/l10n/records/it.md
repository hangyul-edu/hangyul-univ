# V29 l10n record — Italian (it)

Scope: V29 service-contract strings (`scripts/i18n/v28/jobs-v29/it.json`, 158 keys: common 99, marketing 4, student 42,
mobile 13) → `scripts/i18n/v28/tx-v29/it.json`. Korean is the canonical meaning. Register: students `tu`, warm and plain.
Plan names stay Latin (Basic, All-in-One, Premium); team = "il team Hangyul Univ" / "il tuo team" (V28 glossary).

Validator: `JOBS=jobs-v29 TX=tx-v29 node scripts/i18n/v28/validate.mjs --only=it` → 158 strings valid, 0 problems.

## Personas
- Giulia, 19, Bologna (first-time visitor): reads the pricing cards on a phone, wants to know what each plan does.
- Marco, 26, Milano (comparison shopper): master's applicant comparing agencies line by line, reads the small print.
- Giulia's father: pays, checks that nothing is promised that cannot be kept.

## Key term decisions
| Concept (ko) | Italian | Why |
|---|---|---|
| 계약 서류 안에서 횟수 제한 없음 | *Revisioni senza limite di numero sui documenti previsti dal contratto*; note: *nell'ambito dei documenti di candidatura e del calendario previsti dal contratto* | limit is on rounds only, bound to contracted documents and schedule; never *revisioni illimitate* on its own |
| 대학 지원 최대 N곳 관리 | *Gestiamo fino a 2 candidature universitarie* / *Fino a 3 candidature gestite* | "manage", never "candidati a 3 università" or guarantee |
| 추천 대학 최대 N곳 | *fino a N consigli* / *Università consigliate* | kept distinct from *candidature gestite* |
| 별도 견적 | *Preventivo su misura* | standard Italian sales wording |
| 공항 픽업 연결 | *Organizzazione del transfer dall'aeroporto*; note: *organizzato tramite un servizio di trasporto partner* | Hangyul arranges, does not drive |
| 비자 지원 | *supporto per il visto … la decisione spetta all'autorità competente* | no issuing/guarantee wording |
| 첨삭 | *revisione* | one term |
| 모의 면접 | *simulazione di colloquio* | |
| 기숙사 | *residenza universitaria* | V28 glossary |
| 정착 지원 | *supporto all'inserimento* | |
| 유학 진단 상담 | *consulenza di orientamento* | "diagnosi" sounds medical |
| 추가 서비스 | *servizio aggiuntivo* | |
| 업그레이드 | *upgrade* | common in Italian SaaS |
| 1회 결제 | *pagamento una tantum* | |

## Passes
- Pass A (meaning vs Korean): 4 changes, e.g. draft *revisioni illimitate* → *senza limite di numero sui documenti previsti dal contratto*; *candidati fino a 3 università* → *Fino a 3 candidature gestite*; *ritiro in aeroporto* → *Organizzazione del transfer*; visa note made the authority the decider.
- Pass B (naturalness): 3 changes, e.g. *Diagnostico* → *consulenza di orientamento*; *Nessuna pressione* → *Se dici di no non cambia nulla*; marketing s3 title *Prezzo ragionevole* → *Un prezzo onesto, un servizio chiaro*.
- Pass C (UI brevity): mobile chips shortened (*Senza limite sui documenti del contratto*, *Da concordare all'avvio*, *Chiedi al team*).
- Marketing scorecard (v29.why): s1 26/30, s3 26/30.

## Unsure
- `v29.addon.unit.ARRANGEMENT` *1 prenotazione* (booking) — generic unit; fine for pickup, may need a better word if used for other services.

Counts: job keys 158 · kept verbatim 0 · newly translated 158 · extra plural forms 0.

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
