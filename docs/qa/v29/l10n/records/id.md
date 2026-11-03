# V29 l10n record — Indonesian (id)

Scope: V29 service-contract strings (`scripts/i18n/v28/jobs-v29/id.json`, 158 keys) → `scripts/i18n/v28/tx-v29/id.json`.
Korean is canonical. Register: *Anda*, friendly-polite edtech tone. Plan names stay Latin; team = "tim Hangyul Univ" /
"tim Anda"; plan = *paket* (V28 glossary).

Validator: `JOBS=jobs-v29 TX=tx-v29 node scripts/i18n/v28/validate.mjs --only=id` → 158 strings valid, 0 problems.

## Personas
- Nadia, 18, Bandung (first-time visitor), SMA graduate reading the pricing page on her phone.
- Raka, 25, Surabaya (comparison shopper), S2 applicant comparing agents' packages.
- Nadia's father, pays by card and worries about hidden costs.

## Key term decisions
| Concept (ko) | Indonesian | Why |
|---|---|---|
| 계약 서류 안에서 횟수 제한 없음 | *Penyuntingan dokumen pendaftaran sesuai kontrak, tanpa batas putaran*; note: *tanpa batas putaran, dalam cakupan dokumen pendaftaran dan jadwal yang tercantum di kontrak* | never *tak terbatas/unlimited* alone |
| 대학 지원 최대 N곳 관리 | *Kami kelola hingga 2 pendaftaran universitas* / *Hingga 3 pendaftaran dikelola* | managed, not "daftar ke 3 kampus" or guaranteed |
| 추천 대학 | *rekomendasi / Universitas yang direkomendasikan* | distinct from *pendaftaran yang dikelola* |
| 별도 견적 | *Penawaran harga khusus* | |
| 공항 픽업 연결 | *Pengaturan penjemputan bandara*; note: *diatur melalui penyedia transportasi mitra kami* | arranged, not driven |
| 비자 지원 | *membantu persiapan dan pengajuan; keputusan ada di tangan otoritas yang berwenang* | |
| 첨삭 | *penyuntingan* (round = *putaran*) | |
| 자기소개서 | *esai pribadi* | |
| 모의 면접 | *simulasi wawancara* | |
| 기숙사 | *asrama* | V28 glossary |
| 정착 지원 | *pendampingan adaptasi* | |
| 유학 진단 상담 | *konsultasi penilaian awal* | V28 replaced *diagnosis* |
| 번역·공증 | *terjemahan dan legalisasi notaris* | |
| 마감 | *tenggat* | V28 glossary |

## Passes
- Pass A (meaning): 4 changes, e.g. *penyuntingan tak terbatas* → *tanpa batas putaran … sesuai kontrak*; *daftar hingga 3 universitas* → *Hingga 3 pendaftaran dikelola*; *antar-jemput bandara* → *Pengaturan penjemputan bandara*.
- Pass B (naturalness): 3 changes, e.g. *Diagnosis* → *penilaian awal*; *Tidak ada tekanan* → *Menolak tidak mengubah apa pun*; s3 title *Harga wajar, cakupan yang jelas*.
- Pass C (UI): mobile chips shortened (*Tanpa batas untuk dokumen sesuai kontrak*, *Tanya tim*).
- Marketing scorecard (v29.why): s1 26/30, s3 26/30.
- Plurals: Indonesian has only `other`; `_one` and `_other` identical.

## Unsure
- *upgrade* kept as a loanword (common in Indonesian apps); *peningkatan paket* is the formal alternative.

Counts: job keys 158 · kept verbatim 0 · newly translated 158 · extra plural forms 0.

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
