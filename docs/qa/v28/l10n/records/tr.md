# V28 l10n review: tr (Türkçe)

Job `scripts/i18n/v28/jobs/tr.json` → `scripts/i18n/v28/tx/tr.json`. Register: "siz", warm and plain for students; short
and professional in the agency and university consoles. No case suffix is attached to a `{{placeholder}}`. Postpositions
("adına", "için") or a colon are used instead, so any university, student or document name reads correctly.

## Personas

1. **Elif, 18, İzmir (first-time visitor).** Finishing lise, lands on a university page from search. Wants to know quickly
   whether she can apply and what to do next.
2. **Emre, 26, Ankara (comparison shopper).** Engineer comparing English-taught yüksek lisans programmes and the
   pricing tiers across services. Reads every condition and every visa term.
3. **Ayşe, 49, Elif'in annesi.** Pays the fees. Wants no promises, clear money wording and a real team behind the service.

Console readers (counsellors at an agency in Istanbul, admissions staff in Seoul reading Turkish UI) were checked against
the same glossary.

## Glossary (reused from V27 tr, extended)

| English | Korean | Turkish |
|---|---|---|
| the Hangyul team | 한귤 상담팀 | Hangyul ekibi (never "danışmanınız") |
| consular legalization | 영사확인 | konsolosluk tasdiki |
| legalization (column / generic) | 공증·인증 | tasdik |
| apostille | 아포스티유 | apostil |
| admission guide | 모집요강 | başvuru kılavuzu |
| Global Korea Scholarship (GKS) | 정부초청장학 | Kore Hükümeti Bursu (GKS) |
| scholarship | 장학금 | burs |
| tuition | 등록금 | öğrenim ücreti |
| plan (paid) | 플랜 | paket |
| intake | 모집 학기 | dönem |
| deadline | 마감 | son tarih |
| offer (admission) | 합격 | kabul teklifi / teklif |
| enrollment | 등록 | kayıt |
| residence card | 외국인등록증 | ikamet kartı |
| proof of funds | 재정 증명 | maddi yeterlilik kanıtı |
| international office | 국제교류처 | uluslararası ofis |
| dormitory | 기숙사 | yurt |
| case owner | 담당자 | sorumlu / dosya sorumlusu |
| case | 건 | dosya |
| essay / Writing section | 에세이 / 글쓰기 | kompozisyon / Yazılar |
| interview | 면접 | mülakat |
| consulate / diplomatic post | 영사관 / 공관 | konsolosluk / temsilcilik |
| far quick-fit tier | 준비가 더 필요한 대학 | Daha fazla hazırlık gerekiyor |
| minimum | 최저 | asgari |
| pipeline | 파이프라인 | süreç |

## Pass A: meaning (30 strings changed)

All 22 "Danışmanınız" ("your counsellor") strings now name the Hangyul team; the fit tiers follow the V28 English; far tier
no longer says "the road is still long".

| Key | Before | After |
|---|---|---|
| common:fit.tier.UNCLEAR.title | Şimdilik yol hâlâ uzun | Daha fazla hazırlık gerekiyor |
| common:fit.tier.CHALLENGE.title | Daha yakından bakmaya değer | Bizimle birlikte kontrol edilmeli |
| concierge:help.route.MEDICAL | Danışmanınız, acil olarak | Hangyul ekibi, acilen |
| university:v22.stageHint.decision | Yedek listede — karar hâlâ bizde | Yedek listede. Karar henüz verilmedi |
| marketing:v15.pricing.premium.f5 | Yurt başvurusu, gelişten önce çevrim içi oryantasyon ve 30 günlük yerleşme desteği | Yurt, varış ve 30 gün yerleşme desteği (removed the orientation the English no longer offers) |

## Pass B: native naturalness (36 strings changed)

| Key | Before | After |
|---|---|---|
| agency:v9.ops.unpaid.q | Kim bir hizmet için ödeme yaptı ve dosyasının sorumlusu yok? | Hangi öğrenciler bir hizmet için ödeme yaptı ama dosya sorumlusu yok? |
| marketing:v20.city.Gyeonggi.body (para 2) | …kendi kendine yeterli olma eğilimindedir; ortak daireler sokağı yerine… | …kendi içinde her şeyi barındırır; öğrenciler kiralık daire sokakları yerine çoğunlukla üniversitenin kendi yurtlarında kalır. |
| marketing:v20.uni.ctaTitle | Buna ciddi olarak bakmaya hazır mısınız? | Buraya başvurmayı mı düşünüyorsunuz? |
| concierge:housing.honest | …gösteriyoruz — her biri etiketli. Asla uydurma ilan göstermeyiz. | …her birini etiketleyerek gösteriyoruz. Asla uydurma ilan eklemeyiz. |
| student:v9.money.note.RESIDENCE_CARD_90_DAYS | 90 günden uzun kalan herkes, varıştan sonraki 90 gün içinde. | 90 günden uzun kalışlar için. Varıştan sonraki 90 gün içinde başvurun. |

## Pass C: UI context, brevity, one term per concept (6 strings changed)

| Key | Before | After |
|---|---|---|
| agency:docs.sc.checks | Kontrol işaretle / gerekçe seç | Bir kontrol veya gerekçe seçin |
| university:v8.aq.need | Karar ihtiyacı | Karar için gerekenler |
| visaroute:help.who | Kim harekete geçiyor | Kim yapar |
| visaroute:form.source.missing | Hangyul'da yok | Kayıtlı değil |
| university:v28.pipe.rate (draft) | Önceki adımın %{{pct}}'i ({{den}}) | Önceki adıma göre %{{pct}} ({{den}}) (no suffix on a placeholder) |

One term per concept: "paket" for plan everywhere (student pay subtitle changed from "plan"), "dönem" for intake,
"asgari" for minimum, "tasdik" for legalization (slow_items.why: "Onaylar" → "Tasdikler").

## Marketing scorecard (30 points: clarity, trust, naturalness, brevity, CTA, cultural fit)

| Section | Score | Notes |
|---|---|---|
| SEO / home description | 26 | two sentences instead of one long chain |
| Pricing (lede, premium f5, dormitory rows) | 26 | lede leads with the choice, as Turkish pricing pages do |
| City pages (Busan, Gyeonggi, Seoul, Gyeongnam) | 25 | Gyeonggi paragraph 2 transcreated; Seoul line new |
| University page (why, CTA, GKS, English, scholarships) | 26 | CTA title is now a direct question; "Onu farklı kılan ne" |
| Universities index + FAQ languages | 25 | "Kore'nin dört bir yanından üniversiteler." |

## Unsure

- `marketing:v20.uni.why.ieqasExcellent` «IEQAS: mükemmel düzey»: there is no official Turkish name for the grade.
- `agency:misc.breadcrumb` «Sayfa yolu»: Turkish sites also say «İçerik haritası»; screen-reader only.
- `university:documents.legalization` «Tasdik»: covers both apostille and consular legalization only loosely.
- `marketing:v20.uni.philosophySource` «{{name}} resmî sitesinde okuyun» has no genitive suffix on the name, which
  reads as a compound. It is acceptable in UI but stiff.

## Final source↔target comparison

Every key was checked against its current English and the Korean. All placeholders, numbers (1.500 won), test names,
GKS/IEQAS/SLA/OCR and the ÷ and → symbols are preserved. Turkish only has `one`/`other`, so no extra plural forms were
added. The three `_one`-only job keys (`v8.ops.deadlines.inDays_one`, `v9.waiting.reason.task_one`,
`ws.block.deadline_one`) are translated without a hard-coded number. Validator: `354 strings valid, 0 problems`.

## Counts

Job keys 354 · kept verbatim 51 · rewritten 72 · newly translated 231.

## Second pass (jobs2): leak families

Job `scripts/i18n/v28/jobs2/tr.json`, customer families only (marketing 2, student 39, success 204, dossier 27). Every key had `current: null` and was showing English fallback, so all of them are newly translated. Same personas and glossary as the first pass. Pass A (meaning against en + ko), Pass B (naturalness), Pass C (UI brevity, one term per concept). Then a final source↔target check.

| Job keys | Kept verbatim | Rewritten | Newly translated | Intentionally empty |
|---|---|---|---|---|
| 272 | 0 | 0 | 269 | 3 (`dossier:upload.status.*`, empty in en/ko) |

Every key was drafted once and then checked in passes A–C. Changes after the draft: A: 0. B: 2 (`queue.detail.openPortal` *{{portal}} aç* → *Aç: {{portal}}*; `agencyItem.DOC_RENEW` *{{label}} süresi doldu* → *{{label}}: süresi doldu*). C: 3 (`upload.status.*` emptied).

Examples (before → after):

| Key | Before | After |
|---|---|---|
| `student:workspace.owner.prep.you` | Upload the missing documents and finish your essays. (missing → English fallback) | Eksik belgeleri yükleyin ve kompozisyonlarınızı bitirin. |
| `success:item.ESSAY_WRONG_NAME.why` | An essay addressed to another university is the most common avoidable rejection. (missing → English fallback) | Başka bir üniversiteye yazılmış kompozisyon, önlenebilir retlerin en yaygın nedenidir. |
| `success:agencyItem.DOC_LEGALIZE` | {{label}} — consular legalization pending (missing → English fallback) | {{label}}: konsolosluk tasdiki bekleniyor |
| `success:agency.evidenceRule` | Confirmed only with a confirmation number or receipt. Moves the application to Submitted. (missing → English fallback) | Yalnızca onay numarası veya makbuzla doğrulanır. Başvuru Gönderildi'ye geçer. |
| `dossier:page.privacy` | Only you, your counselor and Hangyul can see these files. A university sees a document only when it is sent for your application to that university. (missing → English fallback) | Bu dosyaları yalnızca siz ve Hangyul ekibi görebilir. Bir üniversite, bir belgeyi yalnızca o üniversiteye yaptığınız başvuru için gönderildiğinde görür. |

Marketing scorecard (`marketing:v20.uni.intl.officeLine` / `.none`; clarity, trust, naturalness, brevity, CTA, cultural fit):

| Section | Text | Cl | Tr | Na | Br | CTA | Cu | Total |
|---|---|---|---|---|---|---|---|---|
| University page, international office lines | Kendi iletişim kanalı olan bir uluslararası ofis var. / Hangyul bu üniversitenin kendi sitesinde uluslararası öğrencilere ayrılmış bir sayfa henüz bulamadı. Başlamak için aşağıdaki resmi siteye bakın. | 5 | 5 | 4 | 4 | 4 | 4 | **26** |

Terms are identical to the first-pass glossary above. The student-facing `dossier:page.privacy` says “the Hangyul team”, never “your counselor”. *Counselor* appears only in the agency console role label.

Unsure (second pass):

- `dossier:upload.status.*` left empty as in en/ko. The existing tr `upload.haveTitle` puts `{{status}}` in quotes (durumu “{{status}}”), so an empty status shows empty quotes. That template should be checked.
- `success:queue.detail.openPortal` written *Aç: {{portal}}* to avoid an accusative suffix that depends on the portal name.
- `success:queue.term.*` *Bahar / Yaz / Güz / Kış*: *Güz* is the academic word; some sites say *Sonbahar*.

Validator: `JOBS=jobs2 TX=tx2 node scripts/i18n/v28/validate.mjs --only=tr` → 272 strings valid, 0 problems.

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
