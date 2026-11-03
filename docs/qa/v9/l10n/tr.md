# Turkish (tr) — V9 student localization review

**synthetic review by an AI model — not a human review**

- Date: 2026-10-10
- Model: Claude Opus 5.5 (claude-opus-5-5[1m]), translator agent for `tr` (PIPELINE.md steps 0–3 and 5; step 4 leak check left to the coordinator)
- Status: NOT human-reviewed. Do not set `status` to `HUMAN_REVIEWED` on the basis of this record.
- Result: `v9-todo tr` → web 3,652 / 3,652 (0 missing, 0 identical, 0 stale); `v9-todo tr --native` → 4,160 / 4,160 (0 / 0 / 0).
- Data files: `scripts/i18n/v9-data/tr-1.json` … `tr-20.json` (translation), `tr-ident.json` (identical-OK list), `tr-review.json`, `tr-review2.json`, `tr-review3.json` (revisions below). Values recorded as `_identical_ok`: city and airport names that Turkish writes the same (Busan, Gwangju, Manila, Mumbai, Cebu …), TOPIK / IELTS / TOEFL iBT, Hangyul, Google Maps, messenger names (KakaoTalk, LINE, Telegram, WhatsApp, Zalo), "Program", "Terminal", "—". Turkish exonyms are used where they exist (Pekin, Şanghay, Taşkent, Almatı, Bişkek, Ulan Batur, Dakka, Cakarta, Karaçi, Katmandu, Yeni Delhi, Ho Chi Minh Kenti, İslamabad).
- Register: polite "siz" throughout (imperatives "-in/-ın", "-iniz" possessives), matching the existing `tr/common.json` and `tr/marketing.json`. Buttons use the short infinitive-less imperative already used in `common:actions.*` ("Kaydet", "Yükle").
- Plan names (`student:services.*.name`) translated like other locales: Free Explorer → **Ücretsiz Keşif**, Application Support → **Başvuru Desteği**, Premium Success → **Premium Başarı**.
- Grammar rule used for placeholders: Turkish case suffixes cannot be attached safely to `{{university}}` / `{{label}}` (vowel harmony, names that already end in "University"). Sentences are built so the suffix lands on a Turkish noun: "{{university}} kurumuna ödeyin", "{{label}} belgenizi yükleyin", "{{essay}} metninizi yazın", "{{university}} için".

## Sample read

- All 3,749 to-do strings (incl. plural forms `_one` / `_other`) were written by this agent in key order and read against the English while writing them (common, student, dossier, success, writing, visaroute, concierge, mobile).
- Second pass, read as the four profiles: `student:start.*`, `discover.*`, `verdict.*`, `universityV2.verdictLine.*`, `v4.verdictText.*`, `success:group.*`, `success:obs.*`, `mobile:v3.match.*`, `v3.quick.*`, `v3.university.verdict.*` (STATE_MAP); all `student:v9.money.*`, `v9.funds.*`, `v9.guard.*`, `v9.refund.*`, `v9.family.*`, `v9.sponsor.*`, `budget.*`, `v4.offer*`, `ws3.offer.*`, `ws3.tuition.*`, `applicationDetail.*`, `services*`, `success:submission.*` (fees and authorization), `visaroute:caveat.*`, `methodNote.*`, `funds`, `concierge:residence.*`, `lease.*`, `pickup.*` (about 700 strings).
- Automated checks over the whole locale (excluding marketing): admission-odds or reassurance wording ("şans", "garanti", "olasılık", "endişelenmeyin"). Every hit mirrors the English: `matches.method.noProbability`, `v3.*.notGuarantee`, `university.partner.guaranteeTitle` ("Conditional admission guarantee"), `footer.noGuarantee`, `applicationDetail.done.SUBMITTED` ("good luck!" → "bol şans!"). Two scholarship labels were changed from "olasılık" to "imkânı" (see below).
- Screens: none. This agent did not run a browser (brief: no browsers, the coordinator runs the leak check).

## STATE_MAP check

| Key | English | tr | STATE_MAP group |
|---|---|---|---|
| `student:verdict.STRONG`, `common:tier.STRONG` | Strong match | Güçlü eşleşme | Strong match |
| `student:verdict.COMPETITIVE`, `common:tier.COMPETITIVE` | Possible match | Olası eşleşme | Possible match. **Fixed** `common:tier.COMPETITIVE`, which was "Rekabetçi eşleşme" ("competitive") |
| `student:verdict.REACH`, `common:tier.REACH` | Not eligible yet | Henüz uygun değil | Not eligible yet. **Fixed** `common:tier.REACH`, which was "Zorlayıcı" ("challenging / reach") |
| `student:verdict.NOT_ELIGIBLE`, `common:tier.NOT_ELIGIBLE` | Not eligible yet | Henüz uygun değil | Not eligible yet |
| `student:discover.verdict.eligible / reach / notyet / check` | Strong / Possible / Not eligible yet / Needs your grades | Güçlü eşleşme / Olası eşleşme / Henüz uygun değil / Notlarınız gerekli | same |
| `student:start.tier.POSSIBLE`, `mobile:v3.quick.tier.POSSIBLE` | One step away | Bir adım kaldı | Not eligible yet (one step away). It does not reuse the *Possible match* term and has no odds wording |
| `mobile:v3.match.close` | Not eligible yet — close | Henüz uygun değil — yakın | same |
| `success:group.*` | Strong / Possible / Not eligible yet | Güçlü eşleşme / Olası eşleşme / Henüz uygun değil | same |

"Olası" is the everyday Turkish for "possible". It describes the fit, not the chance of admission. `matches.method.noProbability` says in plain words that we never estimate the chance of admission.

## Scores (1–5): comprehension / naturalness / trust / action clarity / tone

| Profile | Before revisions | After revisions |
|---|---|---|
| A. Student 18–20, first time abroad | 4 / 3 / 4 / 4 / 4 | 5 / 4 / 4 / 5 / 4 |
| B. Graduate applicant 23–29 | 4 / 4 / 4 / 4 / 4 | 5 / 4 / 5 / 4 / 4 |
| C. Parent 35–49, pays tuition | 3 / 4 / 3 / 4 / 4 | 4 / 4 / 5 / 5 / 5 |
| D. Parent 50–65, low digital confidence | 4 / 4 / 3 / 4 / 4 | 4 / 4 / 4 / 4 / 5 |

**Minimum after revisions: 4.**

Scores below 4 before revisions:
- C comprehension 3: the money lines said "{{university}} için {{amount}} ödersiniz" ("you pay X *for* the university"). A parent could read this as paying someone else on the university's behalf, which is the scam the tuition warning is about.
- C and D trust 3: the shared `common:tier.*` labels still said "Rekabetçi eşleşme" / "Zorlayıcı". These sound like admission odds and contradict the verdict labels on the same screens. "Burs olasılığı" (scholarship probability) also read as a prediction.
- A naturalness 3: `notFound.title` was a literal idiom ("Bu sayfa yolunu kaybetti").

## Issues found and fixed (merged with `v9-merge.mjs`)

| Key | Before → After | Why |
|---|---|---|
| `common:tier.COMPETITIVE` | Rekabetçi eşleşme → Olası eşleşme | STATE_MAP *Possible match*, no odds wording (`tr-1.json`) |
| `common:tier.REACH` | Zorlayıcı → Henüz uygun değil | STATE_MAP *Not eligible yet* (`tr-1.json`) |
| `student:v4.offer.pay`, `v4.offer.payNoDate`, `v4.ws.you.tuition`, `v9.refund.title` | "{{university}} için … ödersiniz" → "{{amount}} tutarını … {{university}} kurumuna ödersiniz" | Says without doubt that the money goes to the university itself |
| `success:submission.authorize.check`, `submission.next.AUTHORIZED_AGENCY / DIRECT_API / PARTNER_API`, `v4.ws.team.final`, `v4.ws.you.request`, `dashboard.nextAction.APPLICATION_ITEM.REQUEST.title`, `mobile:v4.home.item.REQUEST.title`, `common:task.submitProgramApplication`, `mobile:v3.appStatus.SUBMITTED` | "{{university}} için / adresine / üniversitesine gönder" → "{{university}} kurumuna gönder" | Clear recipient. No double "University üniversitesine". The authorization sentence is a consent statement, so it must be exact |
| `student:compareV3.bestScholarship`, `v9.discovery.scholarship_one/_other` | Burs olasılığı → Burs imkânı | No probability wording |
| `student:notFound.title` | Bu sayfa yolunu kaybetti → Bu sayfa bulunamadı | Literal idiom; plain wording for profile D |
| `student:v9.refund.trigger.WITHDRAWN_AFTER_TUITION` | Öğrenim ücretinden sonra yerden vazgeçildi → Öğrenim ücreti ödendikten sonra kontenjandan vazgeçildi | The first version was ungrammatical and unclear |

## Terminology (tr)

| English (STATE_MAP / core) | tr |
|---|---|
| Strong match | Güçlü eşleşme |
| Possible match | Olası eşleşme |
| Not eligible yet (one step away) | Henüz uygun değil (Bir adım kaldı) |
| Needs your grades | Notlarınız gerekli |
| Counselor / reviewer | Danışman / inceleyici |
| Agency / partner agency | Ajans / ortak ajans |
| Application / apply / submit | Başvuru / başvurmak / göndermek |
| Offer / offer received / offer accepted | Kabul teklifi / Kabul teklifi alındı / Teklif kabul edildi |
| (Standard) admission letter | (Standart) kabul belgesi |
| Tuition / application fee | Öğrenim ücreti / başvuru ücreti |
| Money you must show (not pay) | Göstermeniz (ödemeniz değil) gereken para |
| Proof of money | Maddi yeterlilik kanıtı |
| Bank balance certificate / bank statement | Banka bakiye belgesi / banka hesap dökümü |
| Apostille / consular legalization / certified translation | Apostil / konsolosluk tasdiki / yeminli tercüme |
| Essay / personal statement / study plan | Kompozisyon / niyet mektubu / çalışma planı |
| Residence card / immigration office | İkamet kartı / göç idaresi |
| Dormitory / deposit | Yurt / depozito |
| Document vault | Belge kasası |
| Deadline | Son tarih |
| Intake | Alım dönemi |
| GPA | Not ortalaması |

## Residual risks (what a native reviewer should check first)

1. `tr/marketing.json` (public website, not in the student manifest) still uses the old tier words: "güçlü, rekabetçi veya zorlayıcı" (`…p1`) and similar. They contradict STATE_MAP. I did not change them because marketing keys are outside this to-do list. The website owner should align them.
2. "Olası eşleşme" for *Possible match*: a reviewer should confirm that parents do not read "olası" as a probability. A possible alternative is "Uygun olabilir".
3. Visa and legalization wording (`visaroute:*`, `student:legalFlow.*`, `v9.funds.*`) follows the English closely. It has not been checked against the Korean Embassy in Ankara's own Turkish pages. "Konsolosluk tasdiki" vs "konsolosluk onayı" are both used: tasdik for the formal legalization route, onay for the general idea. A human should unify them if needed. Türkiye is an Apostille Convention member, so the apostille strings matter most.
4. `university.partner.guaranteeTitle` is "Koşullu kabul garantisi", a faithful rendering of the English "Conditional admission guarantee". A legal reviewer should confirm the wording, because "garanti" carries weight in Turkish consumer law.
5. Borrowed words kept because Turkish uses them every day: portal, e-vize, e-Form, eSIM, SIM kart, T-money, persona (dev-only screen). Profile D readers may need "portal" explained.
6. Sentences built around placeholders (`{{label}} belgenizi`, `{{essay}} metninizi`, `{{university}} kurumuna`) are safe grammatically, but if `{{label}}` is itself an essay type (e.g. "Niyet mektubu belgenizi"), the noun can read as doubled. A reviewer should look at the application workspace with real data.
