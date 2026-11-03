# V31 locale review: Turkish (tr)

Variety: Turkey Turkish as written by education-consulting services. **Siz-form** throughout: earlier marketing passes
(`v11.*`, `start.result.createWhy`, `v24.dir.title`, task labels such as `belgeni düzelt`) used *sen* and were moved to
*siz*. Buttons keep the short Turkish UI imperative (Kaydet, Başla, Gör), as the rest of the app does. Brand stays
"Hangyul" / "Hangyul Univ"; "the Hangyul team" = **Hangyul ekibi** (strings whose English says "Hangyul Univ team" keep
"Hangyul Univ ekibi"). Plan names stay in Latin; "plan" (service product) = **paket**, so it never collides with
*çalışma planı* (study plan). Apostille = **apostil**, consular legalization = **konsolosluk tasdiki**, notarization =
**noter onayı**. "Editing" = **düzenleme** and "fixing" = **düzeltme**, kept apart on purpose. Terms: `glossary/tr.json`.
Turkish CLDR plurals are `one`/`other` only, so no extra plural forms were added.

Job: `scripts/i18n/v28/jobs-v31/tr.json` · output `scripts/i18n/v28/tx-v31/tr.json`.

## Counts

| | keys |
|---|---|
| Job keys reviewed | 1,729 (three passes plus the back-check) |
| Kept verbatim | 1,420 |
| Rewritten, total | 309 |
| · new source (`v31` keys, re-translated from the new en/ko; 3 had no `current`) | 253 (35 of them came out the same as `current`) |
| · meaning | 5 |
| · naturalness | 20 (siz-form, em-dash connectors, literal word order) |
| · terminology | 24 (Hangyul ekibi, kompozisyon → yazı, follow-up, review vs check, Korece dil enstitüsü) |
| · quality | 7 (UI role, `SSS` for the FAQ nav, empty `v15.pricing.compare.item`, title length) |

## Critical semantic issues found in `current`

| key | what it said | what it says now |
|---|---|---|
| student `v4.ws.team.final` | Son kontrolü yapar, ardından başvurunuzu {{university}} kurumuna **gönderir** (Hangyul submits) | {{university}} başvurunuzu **kendiniz göndermeden önce** son kontrol |
| common `v29.pricing.compare.row.support` | Danışmanlık süresi (support window read as consultation length) | Görüşme sonrası soru sorma süresi |
| student `v15.services.scope.consultation` | Görüşme **süresi** (the V15 "minutes" idea) | Danışmanlık görüşmesi |
| marketing `v11.services.s2.text` | **Vize alımı**, … her aşamasında (Hangyul obtains the visa) | Kabulden sonraki adımlarda, yani vize başvurunuzda… yardım ediyoruz |
| marketing `v11.services.s1.text` | …sürecin **tamamını üstleniyoruz**, "tam olarak uyan" | …belgelerinizi hazırlamanıza ve üniversiteyle iletişiminize yardım ediyoruz |
| marketing `v11.hero.lede` | Hayalini gerçeğe dönüştürüyoruz ("we turn your dream into reality") | Size uygun Kore üniversitesini bulun, her adımı yanınızdaki bir ekiple tamamlayın. |
| marketing `v11.why.*` (s1–s3, titles) | "her aşamanın sorumluluğunu üstleniyoruz", "başarıya giden yolda ortağın", "%100 sana özel", "potansiyelini sonuna kadar", "en iyi sonuç" | the V31 claims: same team throughout, plan from grades/goals/budget, fair price with scope shown before payment |
| marketing `v11.faq.q6.a` | **Her** üniversite burs sunuyor | **Çoğu** veriyor… |
| common `v29.pricing.compare.scopeNote` | no round limit within the contract, **exclusions missing** | adds: Yeni belge yazımı, çeviri ve noter onayı dahil değildir |
| common `v29.pricing.compare.value.visa.DOCUMENT_PREP`, `all_in_one.f5` | Belge hazırlığı / Vize belgelerinin hazırlanması (Hangyul prepares) | Vize belgelerinizi hazırlamanıza yardım |
| common `v29.pricing.notes.visaDecision` | karar yetkili makama aittir (vague) | Vizenin verilip verilmeyeceğine Kore göç makamları karar verir |
| common `v29.pricing.compare.value.documents.*`, `all_in_one.f4` | Yoğun inceleme (no notes) / düzeltme rehberliği | (Derinlemesine) inceleme ve düzeltilmesi gerekenlere dair notlar |
| common `v29.pricing.compare.row.managed`, student `v15.services.allowance.key.max_managed_applications` | Yönetilen başvurular (passive count label, gate term) | Sizinle birlikte yönettiğimiz başvurular |
| common `v29.pricing.all_in_one.f1`, `premium.f1` | en fazla 5/7 **öneri** (what is recommended is unclear) | en fazla 5/7 önerilen üniversite |
| student `v15.services.allowance.key.max_recommended_institutions` | Önerilen **okullar** | Önerilen üniversiteler |
| common `v29.pricing.premium.position` | application stage dropped (only visa, arrival, first weeks) | Başvurudan vizeye, varışa ve Kore'deki ilk haftalarına kadar |
| common `v29.addon.item.airport_pickup` | Havalimanı karşılama ayarlaması (no partner) | Havalimanı karşılaması (bir iş ortağıyla ayarlanır) |
| student `v15.services.allowance.unlimited` | Hangyul Univ ekibiyle **sürekli** iletişim (no scope) | Hizmet süreniz boyunca Hangyul ekibine istediğiniz zaman sorun |
| student `phase.prepare.text` | niyet mektubunuzu… Hangyul ekibiyle **birlikte yazın** (co-writing) | Hangyul ekibinin **geri bildirimleriyle**… yazın |
| student `register.privacyNote` | yalnızca seçtiğiniz **danışman** ve üniversitelerle (partner agency left out) | size destek olan Hangyul ekibiyle (ortak ajansı dahil) ve seçtiğiniz üniversitelerle |
| student `messages.visibility` | **Yalnızca** siz ve … (adds "only") | Siz ve Hangyul ekibi görebilir |
| concierge `status.DORMITORY.ASSIGNED` | Oda **teklif edildi** ("offered") | Oda tahsis edildi |
| concierge `moveIn.checkIn` | Giriş nasıl yapılır (reads as "how to log in") | Giriş işlemleri nasıl yapılır |
| concierge `moveIn.item.address_report.text` | "if you move" condition dropped | İkamet kartınızı aldıktan sonra taşınırsanız… |
| dossier `page.summary` | …hazır **her başvuru için** (claim not in source) | {{total}} belgeden {{ready}} tanesi hazır |
| visaroute `step.slow_items.why` | Tasdikler (no apostille / consular named) | Apostil veya konsolosluk tasdiki… haftalar sürebilir |
| visaroute `help.ask` | Bir insana sorun ("ask a human") | Hangyul ekibine sorun |
| student `compare.legalCount_*`, `profileV3.why.basics` | apostil veya **tasdik** (bare "certification") | apostil veya konsolosluk tasdiki |
| common `fit.level.COMBINED` | Bütünleşik doktora (in Türkiye: bachelor's → PhD) | Bütünleşik yüksek lisans ve doktora |
| marketing `v12.privacy.collect.verification.purpose` | **otomatik** kayıtları önleme | **sahte** kayıtları önleme |
| marketing `v12.privacy.collect.profile.purpose` | çalışma planı hazırlama (the study-plan document) | yurt dışı eğitiminizi planlama |
| marketing `v12.terms.universityInfo.p` | contained Hangul (대학알리미) | Academy Info |
| marketing `v15.pricing.compare.item` | Kalem (the English is intentionally empty) | empty |
| marketing `v20.city.Gyeonggi.line` / `.body` | daha **yeşil** ("greener"); "students mostly live in dorms" | daha ferah; **more** students live in university dormitories |
| marketing `v20.uni.why.ieqasBody` | daha **esnek** vize kriterleri ("looser criteria") | daha basit bir vize incelemesi |

**Three worst:** (1) `v4.ws.team.final`: the Hangyul team appeared to submit the application, which Korean law reserves
to the applicant. (2) `compare.row.support` / `scope.consultation`: the support window read as consultation time.
(3) `v11.services.s2.text` "Vize alımı": Hangyul presented as obtaining the visa.

## Marketing scorecard (after rewrite)

CLARITY / NATURALNESS / SPECIFICITY / TRUST / PERSUASION / BREVITY, each out of 5. This is an internal review tool, not a
measurement.

| area | C | N | S | T | P | B | total |
|---|---|---|---|---|---|---|---|
| Hero (`v11.hero.*`, `seo.home.*`) | 5 | 5 | 4 | 5 | 4 | 5 | 28 |
| Why section (`v11.why.*`, `v29.why.*`) | 5 | 4 | 5 | 5 | 4 | 4 | 27 |
| Services rows (`v11.services.*`) | 5 | 4 | 5 | 5 | 4 | 4 | 27 |
| Pricing: plan cards and comparison (`v29.pricing.*`, `v15.pricing.*`) | 5 | 4 | 5 | 5 | 4 | 4 | 27 |
| Add-ons and purchase notes (`v29.addon.*`, `v29.pricing.notes.*`, `v31.pricing.notes.*`) | 5 | 5 | 5 | 5 | 4 | 4 | 28 |
| FAQ (`v11.faq.*`) | 5 | 5 | 5 | 5 | 4 | 4 | 28 |
| Closing CTA (`v11.cta.*`, `v13/v14.cta.*`) | 5 | 5 | 4 | 5 | 4 | 5 | 28 |
| Directory and discovery (`v12.directory.*`, `v12.map.*`, `v20.*`, `v21.*`, `v23.dir.*`, `v24.dir.*`) | 5 | 5 | 5 | 5 | 4 | 4 | 28 |

Total 221/240. Before the rewrite: hero, why section and services scored about 17–19/30 (TRUST 1–2: "dream into
reality", "we take on the whole process", "visa obtaining", "%100"), and the *sen* register clashed with the *siz* app.
Pricing comparison was about 20/30 (support window as consultation time, missing exclusions, passive "Yönetilen
başvurular"). All rewritten.

## Product scorecard (student app, after rewrite)

ACTION CLARITY / SEMANTIC ACCURACY / NATURALNESS / CONSISTENCY / BREVITY, out of 5.

| area | AC | SA | N | C | B | notes |
|---|---|---|---|---|---|---|
| Home (`home.*`, `v22.home.*`, `v26.now.*`, `dashboard.*`) | 5 | 5 | 5 | 5 | 5 | Fixed: Hangyul ekibi naming, `documentsSub_one` added, "services in progress" title |
| Applications (`applications.*`, `v4.ws.*`, `stage.*`, success) | 5 | 5 | 4 | 5 | 4 | Fixed: "you submit yourself" in the final check, siz-form task labels |
| Documents (dossier, `docCategory.*`, `compare.*`) | 5 | 5 | 4 | 5 | 4 | Fixed: summary claim, consular legalization named, "yazı" instead of "kompozisyon" |
| Services (`v15.services.*`, `v16.pay.*`) | 5 | 5 | 5 | 5 | 4 | Fixed: consultation ≠ duration, managed ≠ recommended, düzenleme vs düzeltme, external costs list |
| Visa and housing (visaroute, concierge, `v9.*`) | 5 | 5 | 4 | 5 | 4 | Fixed: room assigned ≠ offered, check-in ≠ login, pickup partner, slow-documents step |

## Unresolved ambiguity (source-level, not guessed)

- `marketing:v12.privacy.retention.advertising.record`: 표시·광고 is a Korean e-commerce statutory record category.
  Rendered literally as *Etiketleme ve reklamla ilgili kayıtlar*; legal should confirm.
- `student:register.consent.CROSS_BORDER_VERIFICATION.summary`: the existing Turkish lists "data, time, retention and how
  to refuse" where the English says only "details, including how to refuse". Kept because it matches the legal Korean;
  owner to confirm.
- `visaroute:doc.business_registration.*` (사업자등록증): no exact Turkish equivalent. Used *işletme tescil belgesi*
  (not *vergi levhası*, which is a tax document).
- `marketing:v14.legal.representative` (대표이사): rendered *Genel müdür*; the company's registered Turkish title, if
  any, should replace it.
- `common:uni27.service.COUNSELING`: the English does not say whether this is psychological counselling or general
  advice; kept *Danışmanlık desteği*.

## Validation

`JOBS=jobs-v31 TX=tx-v31 node scripts/i18n/v28/validate.mjs --only=tr` → `V28 l10n (1 locales): 1729 strings valid, 0 problems`
(not run with `--apply`).

Status: `SYNTHETIC_NATIVE_REVIEWED_V31`
