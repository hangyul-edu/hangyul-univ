# V29 l10n record — ar (Arabic)

Scope: V29 service-contract strings (`scripts/i18n/v28/jobs-v29/ar.json` → `scripts/i18n/v28/tx-v29/ar.json`). Brief: docs/qa/v29/l10n/BRIEF.md + docs/qa/v28/l10n/BRIEF.md. Korean used as canonical meaning.

Validator: `JOBS=jobs-v29 TX=tx-v29 node scripts/i18n/v28/validate.mjs --only=ar` → 0 problems (170 strings). Not applied (`--apply` left to the merge owner).

## Personas

- Omar, 18, first-time visitor from Amman
- Noor, 25, graduate applicant from Cairo comparing packages
- A parent in Riyadh paying by card

## Register and conventions

Modern Standard Arabic, masculine singular address as in existing ar strings. Plan = باقة (existing). Team = "فريق Hangyul Univ". Latin digits (existing). Added _zero/_two/_few/_many for all three plural keys; non-plural count strings made agreement-safe ('الأيام المتبقية: {{count}}').

## Key term decisions

- No round limit within contracted documents: "تحرير مستندات التقديم المتعاقد عليها دون حدّ لعدد الجولات"; never غير محدود/بلا حدود.
- Up to N managed applications: "إدارة حتى N طلبات تقديم" (dual: "ما يصل إلى طلبَي تقديم") / "طلبات التقديم المُدارة" vs "الجامعات المرشّحة".
- Custom quote: "عرض سعر مخصص".
- Airport pickup arrangement: "ترتيب الاستقبال من المطار" (existing 'الاستقبال من المطار'); note "يُرتَّب ... عبر شركة نقل شريكة".
- Units written as words ('جامعة واحدة') instead of '1 جامعة'.

## Glossary (as written in the output)

| Concept | Rendering |
|---|---|
| Hangyul Univ team | اقترح عليك فريق Hangyul Univ خدمة إضافية |
| Additional service / add-on | خدمات إضافية |
| Add-on (compare cell) | خدمة إضافية |
| Custom quote (별도 견적) | عرض سعر مخصص |
| Airport pickup arrangement (공항 픽업 연결) | ترتيب الاستقبال من المطار |
| Partner-provider pickup note | يُرتَّب الاستقبال من المطار عبر شركة نقل شريكة. |
| Mock interview | مقابلة تجريبية |
| Diagnostic consultation | استشارة تقييم شخصية + جلسة متابعة واحدة |
| Recommended universities (추천) | الجامعات المرشّحة |
| Managed applications (지원 관리) | طلبات التقديم المُدارة |
| Up to N managed applications | إدارة ما يصل إلى طلبَي تقديم للجامعات |
| Up to N rounds | حتى {{count}} جولة |
| Statement & study-plan editing | تحرير البيان الشخصي وخطة الدراسة |
| No round limit within contracted documents (card) | تحرير مستندات التقديم المتعاقد عليها دون حدّ لعدد الجولات |
| No round limit within contract (cell) | دون حدّ للجولات ضمن العقد |
| Premium scope note | في Premium لا يوجد حدّ لعدد جولات التحرير، ضمن مستندات التقديم والجدول الزمني المتعاقد عليها. |
| No round limit (student app) | دون حدّ للجولات ضمن مستنداتك المتعاقد عليها |
| No limit (mobile chip) | دون حدّ ضمن المستندات المتعاقد عليها |
| Dormitory | السكن الجامعي |
| Settling in | التأشيرة والاستقرار |
| Visa decision disclaimer | دعم التأشيرة يعني المساعدة في التجهيز والتقديم، أما قرار المنح فيعود إلى الجهة المختصة. |
| Consultation support period | فترة الاستشارة |
| Contract term | مدة العقد |
| Service period | فترة الخدمة |
| Priority response | ردود ذات أولوية |
| Dedicated team | فريق مخصص · أولوية |
| Upgrade | اسأل الفريق عن الترقية |
| Notarization | قد تترتب تكلفة إضافية على كتابة مستند جديد والترجمة والتوثيق لدى كاتب العدل. |
| One-time payment in USD | جميع الأسعار دفعة واحدة بالدولار الأمريكي (USD). |
| Agree and pay CTA | أوافق وأدفع {{amount}} |

## Review passes

- Pass A (meaning vs Korean): 4 changed (visaDecision 'قرار المنح يعود إلى الجهة المختصة'; dormSchedule includes informing the student per Korean 확인·안내; upgrade.used; addons.lede).
- Pass B (native marketer naturalness): 4 changed (units as words; dual forms on All-in-One cards; 'الرفض لا يغيّر شيئًا').
- Pass C (UI brevity, one term per concept): 3 changed (rounds_zero; mockIncluded 'مشمولة: {{count}}'; mobile chips).
- Final check: no wording implies unlimited editing/documents/translation/time, guaranteed admission or a visa issued by Hangyul; recommended vs managed kept distinct; amounts left as placeholders; plan names Basic / All-in-One / Premium kept in Latin as in existing v29.pricing.<slug>.name.

## Marketing scorecard (marketing:v29.why.*; clarity, trust, naturalness, brevity, CTA strength, cultural fit; 5 each)

- s1 (title + text): 25/30
- s3 (title + text): 25/30

## Unsure

- supportFromStart / settlement use 'يومًا' (correct for 11–99, the expected 30/60/90 values) but are not plural-aware keys.
- 'تحرير' for editing; some Gulf sites prefer 'تدقيق'.

## Counts

Job keys: 158 · extra plural forms: 12 · kept verbatim: 0 (no `current` values) · rewritten: 0 · newly translated: 158.

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
