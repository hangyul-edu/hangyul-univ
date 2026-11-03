# V31 locale review — Indonesian (id)

Job: `scripts/i18n/v28/jobs-v31/id.json` · Output: `scripts/i18n/v28/tx-v31/id.json` · Glossary: `glossary/id.json`
Register: formal-friendly **Anda** throughout (all `kamu` / `-mu` marketing copy converted), concise consultancy tone.

## Counts

| | |
|---|---|
| Keys reviewed | 1,729 (common 310 · concierge 181 · dossier 66 · marketing 384 · student 590 · success 33 · visaroute 164 · writing 1) |
| Kept verbatim | 1,438 (includes 35 `v31` keys whose re-translation from the new source came out identical to `current`) |
| Rewritten | 291 |
| — new source (`v31`) | 193 |
| — meaning | 31 |
| — terminology | 35 (incl. 14 "tim Hangyul Univ" → "tim Hangyul" where the source says "the Hangyul team"; submit = *mengajukan*, not *mengirim*) |
| — naturalness | 26 (em-dash connectors, slash-joined phrases, literal word order) |
| — quality | 6 (UI role, empty-string rule, missing space in `fit.or`) |

All 252 `v31` keys were re-translated from the new source (217 changed, 35 identical).

## Critical semantic issues found in `current`

| Key | Said | Now says |
|---|---|---|
| common `v29.pricing.compare.row.support` | "Masa konsultasi" (consultation period: support window read as sessions) | "Masa tanya jawab setelah konsultasi" |
| common `v29.pricing.compare.scopeNote` | Premium "no limit" note dropped the second sentence (new documents, translation, notarization NOT included) | Full scope + exclusions restored |
| common `v29.pricing.all_in_one.f5` | "Dokumen visa disiapkan" (implies Hangyul prepares the visa documents) | "Bantuan menyiapkan dokumen visa · jadwal pendaftaran asrama dipantau" |
| common `v29.pricing.premium.f4` | "Jadwal visa dipantau ketat" (visa documents dropped) | "Dokumen visa dan tanggal penting dipantau ketat · bantuan pendaftaran asrama" |
| common `v29.pricing.compare.value.documents.INTENSIVE` | "Pemeriksaan mendalam" (lost the notes on what to fix) | "Pemeriksaan mendalam, dengan catatan perbaikan" |
| common `v29.pricing.notes.visaDecision` | "otoritas yang berwenang" (vague) | Decision explicitly with the immigration authorities |
| student `v4.ws.team.final` | "Pemeriksaan akhir, lalu mengirim pendaftaran Anda ke {{university}}" (Hangyul submits) | "Pemeriksaan akhir sebelum Anda mengajukan ke {{university}}" |
| student `v15.services.allowance.unlimited` | "Bisa menghubungi tim Hangyul Univ kapan saja" (no scope) | "… kapan saja selama masa layanan Anda" |
| student `v15.services.scope.consultation` | "Durasi konsultasi" (V15 minutes wording) | "Konsultasi" |
| student `v15.services.level.document_review.STANDARD` | "Pemeriksaan dasar" (basic ≠ standard) | "Pemeriksaan standar" |
| student `phase.prepare.text` | "tulis … bersama tim Hangyul Univ" (co-writing) | write it yourself, with feedback from the Hangyul team |
| student `register.privacyNote` | shared with "konselor" only (partner agency omitted) | Hangyul team incl. its partner agency + chosen universities |
| student `register.consent.PRIVACY.summary` | password "terenkripsi" (hash ≠ encryption) | "hash kata sandi" |
| student `budget.beforeArrivalHint` | dropped first month's living costs / "first semester" of dormitory | complete list |
| student `phase.admission.label` | "Penerimaan" (admission process) for "Admitted" | "Diterima" |
| marketing `v11.services.s1.text` | "kami menangani seluruh prosesnya" (overclaim; Hangyul handles everything) | suggest, go through scholarships, help prepare documents and deal with the university |
| marketing `v11.why.s1.text` / `s2.text` / `s3.text` | "partner yang mengantarmu sampai berhasil", "memaksimalkan potensimu", "dukungan yang benar-benar berbeda" (outcome promises, old KO hype) | V31 source: same team start to finish; realistic universities; scope seen before paying |
| marketing `v11.why.s3.title` | "Biaya paling masuk akal, hasil terbaik" (promises best results) | "Harga wajar, tanpa biaya kejutan" |
| marketing `v11.faq.q6.a` | "Setiap universitas menyediakan beasiswa" (every university) | "Sebagian besar ya …" |
| marketing `v12.terms.definitions.support.def`, `v12.terms.intro`, `v12.terms.services.writing` | "peninjauan" for 첨삭 (editing ≠ review) | "penyuntingan" |
| marketing `v12.privacy.collect.verification.purpose` | "pendaftaran otomatis" for fraudulent sign-ups | "pendaftaran palsu" |
| marketing `v20.uni.why.foundedBody` | "salah satu institusi tertua" (oldest) for "one of the older" | "tergolong tua" |
| marketing `v20.uni.why.dormitoryBody` | "tempat tinggal yang sudah pasti" (reads as guaranteed housing) | simplest way to have somewhere to live on arrival |
| marketing `v12.terms.universityInfo.p` | contained Hangul (대학알리미) | "Academy Info" |
| marketing `v15.pricing.compare.item` | "Rincian" where the source is intentionally empty | "" |
| visaroute `step.slow_items.why` | "Legalisasi, tes TBC, dan SKCK" (apostille vs consular legalization lost) | "Apostille atau legalisasi konsuler, tes TBC, dan SKCK …" |
| concierge `step.pickup.title` | "Pesan penjemputan" (book with Hangyul) | "Atur penjemputan bandara" (partner arranges; Hangyul does not run transport) |
| common `appStatus.WITHDRAWN` | "Mengundurkan diri" (person resigns) for an application status | "Ditarik" |

## Marketing scorecard (after rewrite; CLARITY / NATURALNESS / SPECIFICITY / TRUST / PERSUASION / BREVITY)

| Area | C | N | S | T | P | B | Total |
|---|---|---|---|---|---|---|---|
| Hero (`v11.hero.*`, `seo.home.*`) | 5 | 5 | 4 | 5 | 4 | 5 | 28 |
| Why section (`v11.why.*`, `v29.why.*`) | 5 | 5 | 5 | 5 | 4 | 4 | 28 |
| Services rows (`v11.services.*`) | 5 | 4 | 5 | 5 | 4 | 4 | 27 |
| Pricing: plan cards + comparison (`v29.pricing.*`, `v15.pricing.*`) | 5 | 4 | 5 | 5 | 4 | 4 | 27 |
| Add-ons and purchase notes | 5 | 5 | 5 | 5 | 4 | 4 | 28 |
| FAQ (`v11.faq.*`) | 5 | 5 | 5 | 5 | 4 | 4 | 28 |
| Closing CTA (`v11.cta.*`, `v13/v14.cta.*`) | 5 | 5 | 4 | 5 | 4 | 5 | 28 |
| Directory / discovery copy (`v12/v20/v21/v23/v24.dir.*`, `v20.uni.*`) | 5 | 5 | 5 | 5 | 4 | 5 | 29 |

Pre-rewrite the hero, why and services rows scored 18–21/30 (old KO hype, `kamu` register, em-dash chains, outcome promises); all rewritten.

## Product scorecard (student app; ACTION CLARITY / SEMANTIC ACCURACY / NATURALNESS / CONSISTENCY / BREVITY)

| Area | AC | SA | N | C | B | Fixed |
|---|---|---|---|---|---|---|
| Home | 5 | 5 | 5 | 5 | 5 | team name, documents counter, next-consultation label |
| Applications | 5 | 5 | 5 | 5 | 5 | submit = *mengajukan* everywhere; final check no longer implies Hangyul submits; offer statuses |
| Documents | 5 | 5 | 5 | 5 | 4 | dossier v31 strings, method note, "tersimpan" group |
| Services | 5 | 5 | 4 | 5 | 4 | allowance labels use glossary terms; support scope; external costs list |
| Visa / housing | 5 | 5 | 5 | 5 | 4 | apostille vs consular legalization, sponsor documents, partner pickup, room assigned |

## Unresolved ambiguity (listed, not guessed)

- `marketing v11.faq.q1.a` — "High school or junior college graduation certificate" is rendered "Ijazah SMA atau diploma". For Indonesian applicants a Korean university may also accept the *Surat Keterangan Lulus*; the source does not say which, so the glossary term (ijazah) is used.
- `common term.FALL / term.SPRING` — kept "Musim gugur / Musim semi" (Korean academic intakes); the source has no intake-month alternative.
- `visaroute step.slow_items.why` — "police certificates" rendered with the Indonesian name SKCK; the visaroute flows are country-specific (currently Viet Nam), so a non-Indonesian route would want the generic term. Source does not distinguish.
- `marketing v20.uni.why.foundedBody` — "one of the older institutions" has no threshold in the source.

Status: `SYNTHETIC_NATIVE_REVIEWED_V31`
