# V27 l10n review: tr (Türkçe)

Scope: all 729 strings in `scripts/i18n/v27/strings.json` (215 new, 514 changed; changed strings were retranslated
from the new English, not patched). Output: `scripts/i18n/v27/tx/tr.json`. Register: "siz", warm and plain, as
Turkish education services write. Turkish attaches case suffixes that depend on vowel harmony, so no suffix is
attached directly to a `{{placeholder}}`. Sentences use postpositions ("için", "ile") or a colon instead, so they
read correctly for any university, country or document name.

## Personas

1. **Elif, 18, İzmir.** Finishing lise and applying for a lisans programme, probably starting at a university dil
   enstitüsü on a D-4-1 visa.
2. **Emre, 26, mühendis, Ankara.** Applying for a yüksek lisans taught in English. Wants exact visa and document terms.
3. **Elif'in annesi Ayşe, 49.** Pays the fees. Cares about where the money goes, refunds and scams, and wants no
   empty promises.

## Glossary

| English | Korean | Turkish |
|---|---|---|
| scholarship | 장학(금) | burs |
| Global Korea Scholarship (GKS) | 정부초청장학(GKS) | Kore Hükümeti Bursu (GKS) |
| admission guide | 모집요강 | başvuru kılavuzu (existing) |
| apostille | 아포스티유 | apostil (existing) |
| Apostille Convention | 아포스티유 협약 | Apostil Sözleşmesi |
| consular legalization | 영사확인 | konsolosluk tasdiki |
| Korean language institute | 어학당 | dil enstitüsü (existing) |
| admission letter / certificate of admission | 표준입학허가서 | (standart) kabul belgesi / kabul mektubu |
| CCVI | 사증발급인정서 | Vize Verilmesine İlişkin Onay Belgesi (CCVI) |
| residence card | 외국인등록증 | ikamet kartı (existing) |
| immigration office | 출입국관리사무소 | göç idaresi ofisi |
| counselor | 상담사 | danışman (existing) |
| the Hangyul team | 한귤 상담팀 | Hangyul ekibi |
| plan (paid) | 플랜 | paket (existing) |
| matches | 매칭 | eşleşmeler (existing) |
| Recommended (sort) | 추천순 | Önerilen (explained as "bir sıralama değildir") |
| deadline | 마감일 | son tarih / son başvuru tarihi |
| tuition | 등록금 | öğrenim ücreti |
| proof of funds | 재정 증명 | maddi yeterlilik kanıtı |
| bank balance certificate | 잔고증명서 | banka bakiye belgesi |
| TB certificate | 결핵 진단서 | tüberküloz raporu |
| transcript | 성적표 | transkript |
| Bachelor's / Master's / Doctorate / Associate | 학사 / 석사 / 박사 / 전문학사 | Lisans / Yüksek lisans / Doktora (PhD) / Ön lisans |
| Integrated master's and PhD | 석박사 통합 | Bütünleşik doktora |
| essay | 에세이 | kompozisyon (existing nav term) |
| Writing / Messages (sections) | 글쓰기 / 메시지 | Yazılar / Mesajlar (existing) |

**Deviation from the existing bundle:** `legalization.CONSULAR_LEGALIZATION` was «Konsolosluk onayı» ("consular
approval/confirmation"). The brief rules that rendering out. It is now «Konsolosluk tasdiki», the term used in Turkish
legal and consular usage for legalization.

## Pass A: meaning (2 strings changed, all listed)

| Key | Before | After |
|---|---|---|
| common:uni27.intl.english | İngilizce eğitim veren lisans ve lisansüstü programlar var. | İngilizce eğitim veren derece programları var. (removed the added "bachelor's and graduate") |
| common:uni27.service.COUNSELING | Psikolojik danışmanlık | Danışmanlık desteği (Korean 상담 지원 does not say "psychological") |

## Pass B: native naturalness (7 strings changed)

| Key | Before | After |
|---|---|---|
| visaroute:why.POST_FOR_COUNTRY | Şu ülkede yaşayan öğrenciler: {{country}}. Başvuru … yapılır. | Yaşadığınız ülke {{country}} ise başvurunuzu {{city}} şehrindeki … yaparsınız. |
| visaroute:state.NO_ROUTE | Şu ülke için kuralları henüz doğrulamadık: {{country}}. | {{country}} için kuralları henüz doğrulamadık. |
| dossier:upload.kept | Yüklenecek bir şey yok. Mevcut belgenizi yeniden kullanıyoruz: {{doc}}. | Yüklemenize gerek yok. {{doc}} belgenizi yeniden kullanıyoruz. |
| dossier:upload.sendText | Bu belge zaten belgeleriniz arasında: {{doc}}. … | {{doc}} zaten belgeleriniz arasında; tekrar yüklemeden gönderebilirsiniz. |
| mobile:student.home.subtitle | Kore'de okuma yolunda ne kadar ilerlediğiniz burada. | Kore'de okuma hazırlığınızda nereye geldiğinizi burada görebilirsiniz. |

## Pass C: UI context & brevity (3 strings changed, all listed)

| Key | Before | After |
|---|---|---|
| common:fit.tier.MEETS.short | Koşulları karşılıyor | Asgari koşullar tamam (says "minimums", like the title) |
| common:fit.level.TRANSFER | Lisans yatay geçiş | Lisansa yatay geçiş |
| common:fit.tier.CHALLENGE.short | Bakmaya değer | Göz atmaya değer |

## Final comparison

I compared every source and target string by script and by reading them. All placeholders, `<em>` tags, numbers
(1,500 → 1.500 in Turkish notation), test names, GKS/CCVI/CHSI/D-2/D-4, the e-mail address and the emergency
numbers survive. Percentages use the Turkish prefix form (%{{pct}}). Turkish plural rules select `_one` only for 1,
and nouns after a number stay singular, so all plural keys read correctly. No guarantees or chances of admission
were introduced. Validator: **729 valid, 0 problems.**

## Unsure

- `fit.level.COMBINED` = «Bütünleşik doktora» is the Turkish YÖK term for an integrated master's + PhD route. Some
  readers may expect «Yüksek lisans + doktora».
- The government tier names «danışmanlık» / «mükemmel» are not established Turkish terms.
- «kompozisyon» for essays follows the existing nav label. Turkish applicants more often say «niyet mektubu» or
  «essay». It is worth a product decision.

## Follow-up (5 keys)

Added after the main pass (two new reasons; the UNCLEAR tier re-sourced as "far above current result"). Meaning, naturalness and brevity passes applied; no wording implies admission probability.

- `fit.reason.noneRequiredLater` → Başvuru için dil puanı gerekmez. Kabulden sonra {{tests}} veya üzeri gerekecek.
- `fit.reason.far` → {{options}} veya üzeri gerekir; bu, mevcut puanınızın oldukça üzerinde.
- `fit.tier.UNCLEAR.title` → Şimdilik yol hâlâ uzun
- `fit.tier.UNCLEAR.short` → Daha fazla hazırlık
- `fit.tier.UNCLEAR.lede` → Mevcut puanınız yayımlanan koşulun oldukça altında. Hazırlık için daha fazla zaman ayırın, sonra tekrar kontrol edin.

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
