# V28 localization review: id (Indonesian)

Scope: all 355 keys in `scripts/i18n/v28/jobs/id.json`. Output: `scripts/i18n/v28/tx/id.json`.
Register: *Anda* throughout, friendly-polite edtech tone for students, short professional labels for the agency and university consoles. V27 glossary reused unchanged. Main V28 change: every student-facing *Konselor Anda* became **tim Hangyul** (the brief: "the Hangyul team", never "your counselor").

## Personas

1. **Nadia, 18, Surabaya** (first-time visitor). Just finished SMA. Plans a year at a university Korean language institute (D-4-1), then S1. Reads on her phone.
2. **Rizky, 27, Bandung** (comparison shopper). Civil engineer comparing English-taught S2 programmes across Hangyul and two agents. Checks pricing, IEQAS status and whether a Korean score is needed.
3. **Ibu Sri, 50, Nadia's mother** (sponsor). Pays tuition, prepares the bank balance letter, wary of anything that sounds like a promised admission.
Console reader: **Mbak Dewi**, agency counselor in Jakarta, and an admissions officer at a Korean university reading the Indonesian UI.

## Glossary

| English | Korean | id rendering |
|---|---|---|
| the Hangyul team | 한귤 팀 | tim Hangyul |
| scholarship | 장학금 | beasiswa |
| Global Korea Scholarship (GKS) | 정부초청장학 | Beasiswa Pemerintah Korea (GKS) |
| admission guide | 모집요강 | panduan pendaftaran |
| apostille | 아포스티유 | apostille |
| consular legalization | 영사확인 | legalisasi konsuler |
| legalization (column) | 인증 | legalisasi |
| Korean language institute | 어학당 | lembaga bahasa Korea |
| enrollment | 등록 | pendaftaran ulang |
| application | 지원 | pendaftaran |
| offer | 합격 | tawaran (penerimaan) |
| intake | 모집 회차 | periode penerimaan |
| international seats | 외국인 정원 | kuota internasional |
| deadline | 마감 | tenggat |
| overdue | 기한 초과 | lewat tenggat |
| owner (case/task) | 담당자 | penanggung jawab |
| residence card | 외국인등록증 | kartu izin tinggal |
| proof of funds | 재정 증빙 | bukti dana |
| TB test | 결핵 검사 | tes TBC |
| police certificate | 범죄경력증명서 | SKCK |
| documents store / vault | 서류함 | penyimpanan dokumen |
| dormitory | 기숙사 | asrama |
| GPA | 평점 | IPK |
| plan (purchase) | 플랜 | paket |
| Needs more preparation (far tier) | 준비가 더 필요 | Perlu persiapan lebih |
| Pipeline and outcomes | 파이프라인·성과 | Alur dan hasil |
| embassy post | 공관 | perwakilan |

## Pass A: meaning (31 strings changed)

- `common:fit.tier.UNCLEAR.title`: *Masih cukup jauh untuk saat ini* → *Perlu persiapan lebih* (V28 English "Needs more preparation"; no distance or chance word).
- `common:fit.tier.CHALLENGE.title`: *Layak dilihat lebih jauh* → *Perlu dicek bersama kami* (V28 meaning: requirements not verified yet).
- `common:fit.tier.MEETS.lede`: dropped the extra "Ini bukan keputusan penerimaan" sentence the V28 English moved to `fit.summary.basis`.
- `concierge:help.route.*` (5), `dossier:*`, `success:*`, `visaroute:*` (12): *Konselor Anda* → *Tim Hangyul*.
- `student:v9.announced.rule.STUDY_DEPOSIT_SCHEME`: *yang belum bisa bahasa Korea* → *yang belum punya nilai tes bahasa Korea* (the rule is about a test result, not ability).
- `university:v22.stageHint.decision`: *keputusan masih di tangan kita* → *Keputusan masih tertunda* (old text read "the decision is in our hands").

## Pass B: native naturalness (14 strings changed)

- `concierge:emergency.note`: *telepon dulu — lalu beri tahu…* → *telepon dulu. Setelah itu, beri tahu tim Hangyul.* (dash chain removed).
- `marketing:v10.services.housing.p2`: *Apa arti deposit dan sewa bulanan sebenarnya* → *Arti sebenarnya deposit dan sewa bulanan* (English word order removed).
- `marketing:v20.uni.why.foundedBody`: *Menjadikannya salah satu…* → *Ini menjadikannya salah satu institusi tertua dalam daftar.* (subjectless fragment).
- `university:v22.manage.teamManage`: *Serahkan pendaftar milik anggota yang keluar* → *Alihkan pendaftar dari anggota yang keluar*.
- `agency:waiting.app.OFFERED`: *balasan tawaran* → *membalas tawaran* (status phrase, matches *menyiapkan dokumen*).

## Pass C: UI context, brevity, one term per concept (22 strings changed)

- `visaroute:step.slow_items.why`: *Pengesahan, tes TB, dan surat keterangan kepolisian* → *Legalisasi, tes TBC, dan SKCK* (one term for legalization; SKCK is what Indonesians call it).
- `marketing:v15.pricing.compare.row.dormitory`, `student:v15.services.scope.dormitory_support`: *Dukungan asrama* → *Asrama* (row label, V28 English "Dormitory").
- `university:v25.in.yield`: *Terdaftar dari yang diterima* → *Tawaran yang berlanjut ke pendaftaran ulang* (enrollment = *pendaftaran ulang* everywhere).
- `student:v26.now.owner.STUDENT`: *Tugas Anda* → *Anda* (owner chip).
- `visaroute:form.source.missing`: *Tidak ada di Hangyul* → *Belum ada datanya*.

## Final: source ↔ target comparison (16 strings changed)

All 355 compared with English and Korean for meaning, numbers, test names, placeholders and the no-guarantee / no-ranking rule.
- `marketing:v20.uni.why.ieqasBody`: *dinilai dengan kriteria visa yang lebih longgar* → *menjalani pemeriksaan visa yang lebih sederhana* ("simpler screening", not "looser criteria").
- `marketing:v6.unis.title`: *Universitas yang layak untuk dituju.* → *Universitas di seluruh Korea.* (V28 English; old text implied a quality ranking).
- `marketing:v20.uni.ctaTitle`: *Siap mempertimbangkannya dengan serius?* → *Tertarik mendaftar di sini?*
- `common:task.visa.other_passport_record`: *catatan paspor* → *catatan penerbitan paspor* (also in `visaroute:doc.other_passport_record.name`).
- `student:v9.money.note.RESIDENCE_CARD_90_DAYS`: *Wajib bagi semua orang…* → *Untuk tinggal lebih dari 90 hari. Ajukan dalam 90 hari setelah tiba.*

Validator: `node scripts/i18n/v28/validate.mjs --only=id` reports 355 strings valid, 0 problems.

## Marketing scorecard (30 points: clarity, trust, naturalness, brevity, CTA, cultural fit)

| Section | Before | After | Notes |
|---|---|---|---|
| Pricing (`v15.pricing.*`) | 22 | 27 | lede restructured around "Pilih seberapa jauh kami mendampingi Anda"; *Diagnosis* replaced by *penilaian awal* |
| University page CTA (`v20.uni.cta*`) | 21 | 27 | *Tertarik mendaftar di sini?* is how Indonesian campus sites phrase it |
| University "why" cards (`v20/v28.uni.why.*`) | 23 | 26 | IEQAS made concrete, GKS name per glossary, scholarship cards short |
| Cities (`v20.city.*`) | 26 | 26 | kept; new Seoul line written natively |
| Universities list title / journey (`v6.unis.title`, `journey.eyebrow`) | 20 | 26 | no ranking wording; *Langkah demi langkah* |
| FAQ languages (`v9.faq.languagesA`) | n/a | 25 | honest about machine translation, no human review |

## Unsure

- `marketing:v20.city.Seoul.line` *Separuh universitas riset Korea ada di sini, saling berjarak tak sampai satu jam*: slightly long for a one-line card; meaning kept.
- `university:eduLevel.HIGH_SCHOOL` *SMA/sederajat*: natural for Indonesians, but Korean admissions staff may expect plain *SMA*.
- `visaroute:staff.post` *Perwakilan* (embassy/consulate post): correct in diplomatic usage, less obvious to new staff.
- `dossier:agency.title` *Berkas* for "Dossier"; *Dosir* exists but is rare.
- `agency:misc.breadcrumb` *Navigasi jejak*: screen-reader label, there is no common Indonesian term.

## Counts

- Job keys: 355
- Kept verbatim: 40
- Rewritten: 83
- Newly translated: 232

## Second pass (jobs2)

Scope: all 532 keys in `scripts/i18n/v28/jobs2/id.json` (leak families: student workspace, success/submission queue, dossier, agency student workspace and readiness blockers, university outcomes). Output: `scripts/i18n/v28/tx2/id.json`. Same personas, register (*Anda*; consoles concise) and glossary as above; added console terms: submission = *pengiriman*, authorise = *memberi kuasa*, consent withdrawn = *menarik persetujuan*, package = *paket berkas*, receipt = *tanda terima*, portfolio = *portofolio*, agency = *agensi*, student (console) = *mahasiswa*.

Passes: every key was new (no `current`), so the passes revised the draft. A meaning 1 changed · B naturalness 0 · C UI/brevity/one term 2 · Final comparison 0.

Examples (draft → final, or source → target):

1. `dossier:page.privacy` draft *Hanya Anda, tim Hangyul, dan Hangyul…* → *Hanya Anda dan tim Hangyul yang dapat melihat file ini.* (en says "your counselor"; brief requires the Hangyul team, and the draft repeated Hangyul).
2. `dossier:upload.status.NEEDS_REVIEW` (en/ko empty) draft *menunggu tinjauan* → *belum dicek* (fits `berstatus {{status}}` and the 12-char limit).
3. `dossier:upload.status.NEEDS_CORRECTION` draft *perlu perbaikan* → *perlu revisi* (same limit).
4. `success:agencyItem.DOC_LEGALIZE` "{{label}} — consular legalization pending" → *{{label}}: legalisasi konsuler belum selesai* (glossary term; colon instead of em dash).
5. `success:queue.col.package` "Package" → *Paket berkas* (keeps *paket* = purchase plan unambiguous).

Marketing scorecard (2 keys, `v20.uni.intl.*`): officeLine *Ada kantor internasional dengan jalur kontak sendiri.* clarity 5, trust 5, naturalness 4, brevity 5, CTA 3, cultural fit 4 = 26 · none *Hangyul belum menemukan halaman khusus mahasiswa internasional… Mulailah dari situs resmi di bawah.* 5/5/4/4/4/4 = 26.

Unsure:

- `dossier:upload.status.*` *belum dicek / terunggah / perlu revisi*: en and ko are empty (adjective intentionally dropped); short Indonesian words were needed to pass validation.
- `success:queue.fixture` kept *Fixture* (test-data marker; staff-only).
- `agency:ws.level.ASSOCIATE` *Diploma*: nearest Indonesian equivalent of an associate degree.
- `university:outcomes.step.RETAINED` *Bertahan*: plain, but *Retensi* would be more technical.
- Validator: `success:agency.questions.too_few` is reported as "plural form without too_other" because the key name ends in `_few`; the string itself is present and valid (validator false positive).

Counts: job keys 532 · kept verbatim 0 · rewritten 0 · newly translated 532.

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
