# Indonesian (id) — V9 student localization review

**synthetic review by an AI model — not a human review**

- Date: 2026-10-10
- Model: Claude Opus 5.5 (claude-opus-5-5[1m]), translator agent for `id` (PIPELINE.md steps 0–3 and 5; step 4 leak check left to the coordinator)
- Status: NOT human-reviewed. Do not set `status` to `HUMAN_REVIEWED` on the basis of this record.
- Result: `v9-todo id` → web 3,563 / 3,563 (0 missing, 0 identical, 0 stale); `v9-todo id --native` → 4,057 / 4,057 (0 / 0 / 0).
- Data files: `scripts/i18n/v9-data/id-1.json` … `id-11.json` (translation), `id-review.json` (revisions below). 69 values are recorded as `_identical_ok` (city and airport names, TOPIK/IELTS/TOEFL iBT, Visa, Transfer, Apostille, Program, Terminal, messenger app names, "Korea Visa Application Centre, {{city}}").
- Register: polite "Anda" throughout, matching the existing `id/common.json` and `id/marketing.json` (no "kamu"). Indonesian education terms are used where they exist: S1 / S2 / S3, IPK, SMA/SMK sederajat, ijazah, transkrip nilai, terjemahan tersumpah, salinan yang dilegalisasi, SKCK.

## Sample read

- All 3,657 to-do strings were written by this agent in key order and read against the English while writing them (common, student, dossier, success, writing, visaroute, concierge, mobile).
- Second pass, read as the four profiles: `student:start.*`, `discover.*`, `verdict.*`, `universityV2.verdictLine.*`, `v4.verdictText.*`, `success:group.*`, `mobile:v3.match.*` / `v3.quick.tier.*` (STATE_MAP), all `student:v9.money.*`, `v9.funds.*`, `v9.guard.*`, `v9.refund.*`, `v9.family.*`, `v9.sponsor.*`, `budget.*`, `v4.offer*`, `ws3.tuition.*`, `applicationDetail.*`, `services*`, `success:submission.*` (fees and authorization), `visaroute:caveat.*`, `methodNote.*`, `concierge:residence.*` and `lease.*` (about 650 strings).
- Automated checks over the whole locale: leftover English words (none), "kamu"/"-mu" register drift (none), admission-odds or reassurance wording ("peluang", "pasti", "dijamin", "jangan khawatir"): each hit mirrors the English (`noProbability`, `notGuarantee`, `guaranteeTitle`, `obs.ADMITTED`; "uang jaminan" = deposit).
- Screens: none. This agent did not run a browser (brief: no browsers, leak check is run by the coordinator).

## STATE_MAP check (the bug reported in other locales)

| Key | English | id | STATE_MAP group |
|---|---|---|---|
| `student:verdict.STRONG` | Strong match | Sangat cocok | Strong match |
| `student:verdict.COMPETITIVE` | Possible match | Mungkin cocok | Possible match (not "competitive") |
| `student:verdict.REACH` | Not eligible yet | Belum memenuhi syarat | Not eligible yet (one step away), not "reach/ambitious" |
| `student:verdict.NOT_ELIGIBLE` | Not eligible yet | Belum memenuhi syarat | Not eligible yet |
| `student:discover.verdict.eligible / reach / notyet / check` | Strong / Possible / Not eligible yet / Needs your grades | Sangat cocok / Mungkin cocok / Belum memenuhi syarat / Perlu nilai Anda | same |
| `student:start.tier.POSSIBLE`, `mobile:v3.quick.tier.POSSIBLE` | One step away | Tinggal satu langkah | Not eligible yet (one step away). It does not reuse the *Possible match* term |
| `mobile:v3.match.close` | Not eligible yet — close | Belum memenuhi syarat — tinggal sedikit lagi | same |

## Scores (1–5): comprehension / naturalness / trust / action clarity / tone

| Profile | Before revisions | After revisions |
|---|---|---|
| A. Student 18–20, first time abroad | 4 / 3 / 4 / 4 / 4 | 5 / 4 / 4 / 5 / 4 |
| B. Graduate applicant 23–29 | 4 / 4 / 4 / 4 / 4 | 5 / 4 / 5 / 4 / 4 |
| C. Parent 35–49, pays tuition | 3 / 4 / 4 / 4 / 4 | 4 / 4 / 5 / 4 / 5 |
| D. Parent 50–65, low digital confidence | 3 / 4 / 4 / 4 / 4 | 4 / 4 / 4 / 4 / 5 |

**Minimum after revisions: 4.**

Scores below 4 before revisions:
- C and D, comprehension 3: the existing `common:appStatus.OFFERED` said "Tawaran diterima", which reads as both "offer received" and "offer accepted". OFFER_ACCEPTED is "Tawaran disetujui", so a parent could think the offer was already accepted. Also, "money changer" was left in English in the tuition-safety warning, and announced visa rules said "semester pertama 2027", which reads as an academic term, not a half-year.
- A, naturalness 3: `notFound.title` was a literal "Halaman ini salah belok" ("took a wrong turn"), and "Coming up" was "Segera" ("soon"), which does not work as a heading over a list of dates.

## Issues found and fixed (`scripts/i18n/v9-data/id-review.json`, merged with `v9-merge.mjs`, 18 values)

| Key | Before → After | Why |
|---|---|---|
| `common:appStatus.OFFERED`, `common:notify.application.OFFERED`, `student:stage.OFFERED` | Tawaran diterima → Mendapat tawaran | Was ambiguous with "offer accepted". Now matches `common:pipeline.OFFERED`. |
| `student:applicationDetail.done.OFFER_ACCEPTED` | Tawaran diterima — selamat! → Tawaran sudah Anda terima — selamat! | Makes it clear that the student accepted it. |
| `student:v9.guard.text`, `student:v9.refund.noAgents` | money changer → tempat penukaran uang | No English in a money warning meant for parents. |
| `student:v9.announced.target.H1_2027 / H2_2026` | semester pertama/kedua → paruh pertama/kedua | A calendar half-year, not an academic semester. |
| `common:task.visa.tb_test`, `visaroute:doc.tb_test.name` | surat keterangan bebas TB → surat keterangan tes TB | The English says "TB certificate". "Bebas TB" (TB-free) added a claim the English does not make. |
| `student:v4.offer.calc` | "Tagihan dari universitas yang berlaku." → "Jumlah akhir mengikuti tagihan resmi dari universitas." | Says clearly that the university's invoice is the final amount. |
| `student:home.comingUp`, `mobile:v3.home.upcoming` | Segera → Akan datang | Works as a heading. |
| `concierge:housing.room.Single / Double / Quad` | Sendiri / Berdua / Berempat → Kamar sendiri / Kamar berdua / Kamar berempat | Clearer as room-type labels. |
| `student:notFound.title`, `student:discover.why` | literal idiom / short phrase → plain wording | More natural for parents. |

## Terminology (id)

| English (STATE_MAP / core) | id |
|---|---|
| Strong match | Sangat cocok |
| Possible match | Mungkin cocok |
| Not eligible yet (one step away) | Belum memenuhi syarat (Tinggal satu langkah) |
| Needs your grades | Perlu nilai Anda |
| Counselor / reviewer | Konselor / peninjau |
| Application / apply | Pendaftaran / mendaftar |
| Offer / offer received / offer accepted | Tawaran / Mendapat tawaran / Tawaran disetujui |
| (Standard) admission letter / certificate of admission | Surat penerimaan (standar) |
| Tuition / application fee | Biaya kuliah / biaya pendaftaran |
| Money you must show (not pay) | Dana yang harus ditunjukkan (bukan dibayar) |
| Bank balance certificate / bank statement | Surat keterangan saldo bank / rekening koran |
| Apostille / consular legalization / certified translation | apostille / legalisasi konsuler / terjemahan tersumpah |
| Residence card | Kartu izin tinggal |
| Deposit (housing) | Uang jaminan |
| Document vault | Brankas dokumen |
| Deadline | Tenggat |

## Residual risks (what a native reviewer should check first)

1. `common:tier.COMPETITIVE` = "Cocok kompetitif" and `common:tier.REACH` = "Target ambisius" were already there before this agent. They follow the English source ("Competitive match", "Reach"), but STATE_MAP uses *Possible match* / *Not eligible yet*. If any student screen shows `common:tier.*`, the English source should be aligned first, then id. I did not change them.
2. "Program" is shown in English form in several places, and so is the official proper name "Korea Visa Application Centre/Center" (recorded as `_identical_ok`). A Latin-script leak scan may flag the Centre name. It is the official name.
3. The register is "Anda" everywhere, the same as the existing marketing site. Some 18–20-year-olds may find it formal. Parents should be fine with it.
4. Visa wording for consulates other than Jakarta (`visaroute:caveat.*`, `methodNote.*`) was translated closely but not checked against the embassies' own Indonesian pages. A human should read the Indonesia route first (Jakarta embassy, D-2/D-4, bank balance rules).
5. Words borrowed from English that Indonesians use every day are kept: check-in, e-visa, e-Form, eSIM, browser, portal, IELTS band. A reviewer should confirm they are acceptable for profile D.
6. "Surat penerimaan" is used both for the offer stage (admission letter) and for the visa document (standard admission letter / 표준입학허가서). This is consistent with the existing `common:appStatus`, but a reviewer may want "Surat penerimaan standar" everywhere the visa document is meant.
