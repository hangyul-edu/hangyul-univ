# V27 localization review: id (Indonesian)

Scope: all 729 strings in `scripts/i18n/v27/strings.json` (215 `new`, 514 `changed`; `changed` strings were translated again from the V27 English, not patched from the bundle).
Output: `scripts/i18n/v27/tx/id.json`.
Register: *Anda* everywhere (same as the bundle), friendly-polite tone of Indonesian edtech and study-abroad sites, CTAs in plain imperative (*Cek…*, *Unggah…*, *Lihat…*). Everyday words students use are kept: *HP*, *pulsa*, *kos*, *SIM card*, *upgrade*, *personal statement*. Established bundle terms kept: *legalisasi konsuler* (title), *Konvensi Apostille*, *surat penerimaan (standar)*, *e-visa*, *kartu izin tinggal*, *kantor imigrasi*, *bukti dana*, *surat keterangan saldo bank*, *konselor*, *tim Hangyul*, *rencana studi*, *daftar periksa*. Bundle terms fixed in this output: *konfirmasi konsuler* → **legalisasi konsuler** (영사확인 is a legalization, not a "confirmation"), *Perjalananku* → *Progres saya* (V27 English "My progress"), GKS → *Beasiswa Pemerintah Korea (GKS)*.

## Personas

1. **Nadia, 18, Surabaya.** Just graduated from SMA. She plans a year at a university Korean language institute (D-4-1), then S1. Reads on her phone and knows *TOPIK*, *LoA*, *apostille* from Korea-study groups.
2. **Rizky, 27, Bandung.** Civil engineer applying for an English-taught S2. Wants exact requirements, deadlines and the Jakarta embassy procedure.
3. **Ibu Sri, 50, Nadia's mother.** Pays tuition and prepares the bank balance letter. She is wary of agents, money transfers and anything that sounds like a promised admission.

## Glossary

| English | Korean | id rendering |
|---|---|---|
| scholarship | 장학(금) | beasiswa |
| Global Korea Scholarship (GKS) | 정부초청장학 | Beasiswa Pemerintah Korea (GKS) |
| admission guide | 모집요강 | panduan pendaftaran |
| apostille | 아포스티유 | apostille; Konvensi Apostille |
| consular legalization | 영사확인 | legalisasi konsuler |
| notarized | 공증 | dilegalisasi notaris |
| Korean language institute | 어학당 | lembaga bahasa Korea (milik universitas) |
| certificate of admission | 표준입학허가서 | surat penerimaan (standar) |
| CCVI | 사증발급인정서 | Sertifikat Konfirmasi Penerbitan Visa (CCVI) |
| e-visa | 전자비자 | e-visa |
| residence card | 외국인등록증 | kartu izin tinggal |
| immigration office | 출입국관리사무소 | kantor imigrasi |
| proof of funds / bank balance certificate | 재정 증빙 / 잔고증명서 | bukti dana / surat keterangan saldo bank |
| TB certificate | 결핵 진단서 | surat keterangan (tes) TBC |
| tuition / application fee | 등록금 / 전형료 | biaya kuliah / biaya pendaftaran |
| counselor / Hangyul team | 상담사 / 한귤 상담팀 | konselor / tim Hangyul |
| agency | 유학원 | agen |
| offer | 합격 | tawaran penerimaan |
| Bachelor's / Master's / Doctorate / Associate | 학사 / 석사 / 박사 / 전문학사 | Sarjana (S1) / Magister (S2) / Doktor (S3) / Diploma (D3) |
| GPA | 평균 성적 | IPK |
| deadline | 마감 | tenggat |
| Recommended (sort) | 추천순 | Rekomendasi (`fit.order` says it is not a ranking, *bukan peringkat*) |
| documents store | 서류함 | penyimpanan dokumen |

## Pass A: meaning (5 strings changed)

- `student:v9.money.note.VISA_FEE_AS_PUBLISHED`: *dalam bentuk kata-kata* → *dengan kata-kata, bukan angka*. The draft did not make clear why the reader should check the wording.
- `student:home.docAction.TOO_OLD`: *Terlalu lama. Minta salinan baru* → *Terbit terlalu lama. Urus salinan baru*. The draft read as "takes too long" rather than "issued too long ago".
- `student:matches.tierText.COMPETITIVE`: *membuatnya kurang pasti* → *membuat hasilnya kurang pasti*. Uncertain outcome, without a probability.
- `visaroute:doc.business_registration.why`: *Surat registrasi usaha* → *Sertifikat registrasi badan usaha*. This is the document the embassy list names.
- `common:uni27.schol.renewal`: *Agar tetap menerimanya* → *Agar tetap bisa menerimanya*. It introduces conditions, not a statement that you keep it.

## Pass B: native naturalness (9 strings changed)

Each string was read as Nadia, Rizky and Ibu Sri.
- `student:register.subtitle`: *tetap aman milik Anda* → *tetap menjadi milik Anda*. Removes a broken calque.
- `student:documentsV2.group.todoSub`: *Masing-masing sedang menahan satu pendaftaran* → *Tiap dokumen ini sedang menghambat satu pendaftaran.*
- `student:v17.upgrade.whyDefault`: *Upgrade tetap menyimpan…* → *Dengan upgrade, semua yang sudah Anda kerjakan tetap tersimpan.*
- `mobile:v3.home.stageLine.admission`: *mengamankan tempat Anda* → *mengamankan kursi Anda*, the phrase Indonesian students use for securing a place.
- `marketing:v20.city.Gyeongnam.line`: *Pesisir selatan yang industrial* → *Kawasan industri di pesisir selatan*. English word order removed.

## Pass C: UI context and brevity (7 strings changed)

- `marketing:v6.product.match.r2`: was identical to the English → *TOPIK level 4 (syarat minimum: level 3)*. The validator flagged it as left in English.
- `student:compare.legalCount_one/_other`: *legalisasi* → *legalisasi konsuler*, one full term everywhere.
- `dossier:upload.sendText`, `visaroute:reason.VISA_ONLY`, `visaroute:docs.readyCount`: *dokumen Anda* → *penyimpanan dokumen (Anda)* where the English means the documents store.
- `mobile:v3.docAction.TOO_OLD`: aligned with the web label *Terbit terlalu lama. Urus salinan baru*.

## Final: source ↔ target comparison (4 strings changed)

The whole set was compared with the English and Korean for meaning, numbers, test and code names, placeholders/tags and the no-guarantee / no-ranking rule (a script also checked numbers and Latin test/code names).
- `fit.track.KOREAN/ENGLISH` → *Diajarkan dalam bahasa Korea / Inggris*, and `fit.reason.met_track` / `needed_track` → *{{track}}: …*. The draft *untuk program Berbahasa Korea* put a capitalised chip mid-sentence.

No string implies admission probability or a guarantee. All placeholders and the `<em>` tag are preserved. The Hangul 대학알리미 in the English `v20.uni.why.breadthBody` was dropped, keeping *Academy Info* (no Hangul outside ko). Thousands use the Indonesian dot (*1.500 won*).
Validator: `node scripts/i18n/v27/validate.mjs --only=id` reports 729 strings valid, 0 problems.

## Unsure

- `fit.level.ASSOCIATE` *Diploma (D3)*: Korean 전문학사 programmes are 2–3 years. *D3* is the closest familiar label, but it is not an exact equivalent.
- `uni27.cat.GKS` *Beasiswa Pemerintah Korea (GKS)*: many Indonesian students simply say *Beasiswa GKS*. The bundle's running text elsewhere keeps "Global Korea Scholarship (GKS)".
- `v9.funds.longer_*`: 컨설팅 tier rendered *'konsultasi'*. There is no Indonesian term for this audit tier.
- `student:writing.subtitle` / `v10.faq.documents.a` keep *personal statement* in English, which is how Indonesian applicants write it. *Pernyataan pribadi* (the bundle term) is more formal.
- `fit.gpa.placeholder` *mis. 3.6*: Indonesian IPK is written *3,60*. The dot was kept until it is confirmed that the field accepts commas.

## Follow-up (5 keys)

Added after the main pass (two new reasons; the UNCLEAR tier re-sourced as "far above current result"). Meaning, naturalness and brevity passes applied; no wording implies admission probability.

- `fit.reason.noneRequiredLater` → Tidak perlu nilai bahasa untuk mendaftar. Setelah diterima, Anda perlu {{tests}} atau lebih.
- `fit.reason.far` → Perlu {{options}} atau lebih, jauh di atas nilai Anda saat ini.
- `fit.tier.UNCLEAR.title` → Masih cukup jauh untuk saat ini
- `fit.tier.UNCLEAR.short` → Perlu persiapan
- `fit.tier.UNCLEAR.lede` → Nilai Anda saat ini masih jauh di bawah persyaratan yang dipublikasikan. Sediakan waktu persiapan lebih lama, lalu cek lagi.

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
