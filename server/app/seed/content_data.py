"""Guides shown on the marketing site and in the student platform. Facts come from docs/RESEARCH.md with source keys;
items that research could not confirm are written as 'check' guidance rather than stated as fact."""

ARTICLES = [
    {
        "slug": "how-studying-in-korea-works",
        "content_type": "STUDY_GUIDE",
        "title": "How studying in Korea works",
        "summary": "Degree vs language programs, the two main intakes, and the order things happen in — from choosing a university to your residence card.",
        "sources": ["study-in-korea", "moe-standard-guideline-2025", "visa-portal", "immigration-visa-navigator"],
        "body": """## Two ways to study

**Degree programs** (associate, bachelor's, transfer, master's, doctorate) lead to a Korean degree. Students on degree programs generally hold a **D-2** student visa.

**Korean language programs** run by university language institutes are non-degree study. Students generally hold a **D-4-1** (Korean language trainee) visa. Many students start here and move into a degree program later.

## Intakes

Korean universities mostly admit international students for the **spring semester (March)** and the **fall semester (September)**. Applications usually close several months earlier — often 4–7 months before the semester starts. Language institutes typically run four terms a year.

## The order things happen in

1. Choose programs that fit your academic background, language level and budget.
2. Prepare documents — especially **apostilled or consular-confirmed** diplomas and transcripts, which can take weeks.
3. Apply (many universities use online systems such as UwayApply or JinhakApply).
4. Interview, if the program requires one.
5. Receive the admission decision.
6. Pay tuition **in your own name** through the university's payment channel.
7. The university issues the **standard admission letter** (표준입학허가서).
8. Apply for your visa at a Korean embassy/consulate, or via a Certificate for Confirmation of Visa Issuance.
9. Arrive, attend orientation, and apply for your **residence card within 90 days**.

## Language standards

The Ministry of Education's guideline recommends **TOPIK level 3 to enter** and **level 4 before graduating** for Korean-taught programs at four-year universities, with relaxations for some programs such as English-taught tracks. Each university sets its own requirement — always check the program.
""",
    },
    {
        "slug": "student-visa-d2-d4",
        "content_type": "VISA_GUIDE",
        "title": "Student visas: D-2 and D-4 explained",
        "summary": "Which visa fits your program, what you typically need, and what changes by country and consulate.",
        "sources": ["mofa-la-d2-d4", "visa-portal", "moe-funding-thresholds", "mofa-vn-d2-d4", "hikorea"],
        "body": """> Visas are issued by the Korean government. Hangyul helps you prepare; it does not issue visas.

## Which visa?

| Study | Typical visa |
|---|---|
| Associate degree | D-2-1 |
| Bachelor's / transfer | D-2-2 |
| Master's | D-2-3 |
| Doctorate | D-2-4 |
| Research / exchange / visiting | D-2-5 / D-2-6 / D-2-8 |
| Korean language institute | D-4-1 |

## Common documents

- Passport and application form with photo
- **Standard admission letter** from the university (for D-2)
- Proof of tuition payment
- **Proof of funds** in your or your sponsor's name (thresholds are set by the government and can change — your checklist shows the current figure and its source)
- Final education documents with apostille or consular confirmation
- Family relationship documents when a parent sponsors you

## Why checklists differ

Embassies and consulates publish their own requirements. For example, some consulates ask for funds to be held for a set period before you apply. Your Hangyul visa checklist is built from rules per visa type, nationality and consulate, and every item shows when it was last verified.

## After arrival

Apply for a residence card within **90 days** of entry and report address changes within **14 days**. Part-time work requires **prior permission**, and weekly hour limits depend on your program and TOPIK level.
""",
    },
    {
        "slug": "apostille-and-legalization",
        "content_type": "STUDY_GUIDE",
        "title": "Apostille or consular confirmation? A country-by-country guide",
        "summary": "Your diploma and transcript need official authentication. The route depends on the country that issued them — and it changes over time.",
        "sources": ["hcch-apostille-status", "hcch-vietnam-accession", "hcch-thailand-accession", "wikipedia-apostille-parties", "skku-guide-2022-uway"],
        "body": """## The rule

Korea is a party to the Hague Apostille Convention. For documents issued in another **party** country, you get an **apostille** from that country's competent authority. For documents from a **non-party** country, you get **consular confirmation** at the Korean embassy or consulate in that country.

The route depends on the **country that issued the document**, not your nationality.

## Recent changes to watch

- **Vietnam** joined the Convention with effect from **11 September 2026**. Documents already confirmed by the consulate before then are generally still accepted — check with your university.
- **Thailand** joins with effect from **28 February 2027**. Until then, Thai documents need consular confirmation.
- **China** has been a party since **7 November 2023** — older university guides that say otherwise are out of date.
- **Nepal** and **Myanmar** are not parties: use consular confirmation.

## Typical steps

1. Get the official original or certified copy from the issuing school.
2. Notarize, if your country's authority requires it.
3. Apostille **or** Ministry of Foreign Affairs authentication + Korean consular confirmation.
4. Certified translation into Korean or English if needed.
5. Upload to your Hangyul vault — the verified document can be reused for every application.

Some universities also accept or require official verification reports (for example CHSI/CDGDC reports for Chinese degrees).
""",
    },
    {
        "slug": "cost-of-studying-in-korea",
        "content_type": "COST_GUIDE",
        "title": "What studying in Korea costs",
        "summary": "Tuition, living costs and the financial proof you'll need — and how to read the estimates on Hangyul.",
        "sources": ["moe-funding-thresholds", "sungshin-nhis-2026", "moe-standard-guideline-2025"],
        "body": """## The main costs

- **Tuition** — set per program and paid each semester, directly to the university in your own name.
- **Application fee** — set by each university, usually non-refundable.
- **Housing** — dormitory or private housing.
- **National Health Insurance** — international students pay a monthly premium once enrolled.
- **Living costs** — food, transport, phone, books.

## How Hangyul estimates cost

Estimated yearly cost = tuition × 2 semesters + estimated monthly living cost × 12. Figures not yet checked against an official source are marked **Not yet verified**. Verified figures always show their source and the date they were checked.

## Proof of funds

For your visa you show a bank balance in your or your sponsor's name. The government sets different thresholds for degree and language programs and for Seoul-area vs regional study. Your visa checklist shows the current amount and its source.
""",
    },
    {
        "slug": "university-dormitories",
        "content_type": "DORMITORY_GUIDE",
        "title": "Dormitories and housing",
        "summary": "How dorm applications work, when to apply, and what to check before signing a private lease.",
        "sources": [],
        "body": """## Campus dormitories

Many universities reserve dormitory rooms for new international students, but rooms are limited and applications usually open after admission. Apply as soon as the university announces the window.

## Off-campus

If you rent privately, check the deposit, contract length, management fees and the landlord's identity. Hangyul does not list private rentals — your counselor can review a contract with you before you sign.
""",
    },
    {
        "slug": "application-calendar",
        "content_type": "APPLICATION_CALENDAR",
        "title": "Application calendar",
        "summary": "When to start for spring (March) and fall (September) entry.",
        "sources": ["univ-skku", "univ-snu"],
        "body": """## Spring entry (March)

- **June–August:** shortlist programs, book TOPIK/IELTS, start apostille or consular confirmation.
- **August–November:** most application windows (varies by university).
- **November–January:** interviews and decisions.
- **January–February:** tuition, admission letter, visa, dormitory.

## Fall entry (September)

- **December–February:** shortlist and prepare documents.
- **March–May:** most application windows.
- **May–July:** decisions, tuition, admission letter, visa.

Exact dates are on each program page with the date they were last verified.
""",
    },
    {
        "slug": "faq",
        "content_type": "FAQ",
        "title": "Frequently asked questions",
        "summary": "Straight answers about Hangyul Univ.",
        "sources": [],
        "body": """### Does Hangyul guarantee admission?

No. Universities make admission decisions. Hangyul shows how well your profile matches published requirements and helps you submit the strongest application you can. Where a partner university offers a conditional guarantee, the exact terms and criteria are shown on that program.

### Who pays tuition, and to whom?

You pay tuition directly to the university, in your own name, through the university's payment channel. Hangyul only charges for its own services, and prices are always shown before you buy.

### Who sees my documents?

You, Hangyul, and — only after you buy a support service — your assigned partner agency. A university sees your documents only after you submit an application to it.

### Can I use one document for several universities?

Yes. Upload once; once verified it can be reused wherever it's accepted.
""",
    },
    {
        "slug": "study-in-korea-from-vietnam",
        "content_type": "COUNTRY_GUIDE",
        "country": "VN",
        "title": "Studying in Korea from Vietnam",
        "summary": "Apostille changes in 2026, proof of funds and what Vietnamese applicants should prepare first.",
        "sources": ["hcch-vietnam-accession", "mofa-vn-d2-d4", "sedaily-2026-stats"],
        "body": """Vietnam is now the largest source country of international students in Korea.

## Documents

Since **11 September 2026**, Vietnamese public documents can be authenticated with an **apostille**. Before that date, Korean consular confirmation was required. Check your university's current instructions if your documents were legalized before the change.

## Proof of funds

The Korean Embassy in Hanoi publishes Vietnam-specific D-2/D-4 document lists, including how long funds must be held. Your checklist shows the current rule and the date it was last verified.
""",
    },
    {
        "slug": "study-in-korea-from-nepal",
        "content_type": "COUNTRY_GUIDE",
        "country": "NP",
        "title": "Studying in Korea from Nepal",
        "summary": "Consular confirmation, language preparation and planning your timeline.",
        "sources": ["wikipedia-apostille-parties", "moe-standard-guideline-2025"],
        "body": """Nepal is not a party to the Apostille Convention, so academic documents need **consular confirmation** at the Korean Embassy in Kathmandu after authentication by Nepal's Ministry of Foreign Affairs. Allow extra weeks for this.

Many Nepali students begin with a **Korean language program (D-4-1)** before entering a degree — plan your TOPIK preparation early.
""",
    },
    {
        "slug": "study-in-korea-from-myanmar",
        "content_type": "COUNTRY_GUIDE",
        "country": "MM",
        "title": "Studying in Korea from Myanmar",
        "summary": "Consular confirmation and how to plan around longer document timelines.",
        "sources": ["wikipedia-apostille-parties"],
        "body": """Myanmar is not a party to the Apostille Convention, so documents need **consular confirmation** at the Korean Embassy in Yangon. Start early and keep certified copies; your counselor will confirm the current embassy procedure.
""",
    },
    {
        "slug": "scholarships-in-korea",
        "content_type": "SCHOLARSHIP_GUIDE",
        "title": "Scholarships for international students",
        "summary": "University, government (GKS) and Hangyul Partner Scholarships — how they differ.",
        "sources": ["gks-g-2026-ny", "study-in-korea"],
        "body": """## University scholarships

Most universities offer tuition waivers based on grades or TOPIK level, often reviewed each semester.

## Government scholarships (GKS)

The Global Korea Scholarship covers airfare, full tuition, a monthly allowance, insurance and a year of Korean language study. Applications go through Korean embassies or designated universities.

## Hangyul Partner Scholarships

At some partner universities, Hangyul funds additional scholarships from its partnership. These are shown only when an active partnership is in place, with the exact rules and remaining budget.
""",
    },
]

TRANSLATIONS = [
    {
        "slug": "how-studying-in-korea-works",
        "locale": "ko",
        "status": "REVIEWED",
        "title": "한국 유학, 이렇게 진행됩니다",
        "summary": "학위과정과 어학과정의 차이, 두 번의 입학 시기, 대학 선택부터 외국인등록까지의 순서.",
        "body": """## 두 가지 유학 방법

**학위과정**(전문학사·학사·편입·석사·박사)은 한국 학위를 받는 과정으로, 일반적으로 **D-2** 유학 비자를 받습니다.

**한국어 연수과정**(대학 어학당)은 비학위 과정이며 일반적으로 **D-4-1**(한국어 연수) 비자를 받습니다.

## 입학 시기

대부분의 대학은 **봄학기(3월)**와 **가을학기(9월)**에 외국인 학생을 선발하며, 지원 마감은 학기 시작 4~7개월 전인 경우가 많습니다.

## 진행 순서

1. 학력·언어·예산에 맞는 과정 선택
2. 서류 준비 — 특히 **아포스티유 또는 영사확인**
3. 지원 및 (필요시) 면접
4. 합격 발표 후 **본인 명의로** 등록금 납부
5. **표준입학허가서** 발급
6. 비자 신청
7. 입국 후 **90일 이내 외국인등록**
""",
    },
    {
        "slug": "how-studying-in-korea-works",
        "locale": "vi",
        "status": "MACHINE_DRAFT",
        "title": "Du học Hàn Quốc diễn ra như thế nào",
        "summary": "Chương trình cấp bằng và chương trình tiếng, hai kỳ nhập học, và thứ tự các bước.",
        "body": """## Hai con đường du học

**Chương trình cấp bằng** (cao đẳng, cử nhân, chuyển tiếp, thạc sĩ, tiến sĩ) — thường dùng visa **D-2**.

**Chương trình tiếng Hàn** tại viện ngôn ngữ của trường — thường dùng visa **D-4-1**.

## Kỳ nhập học

Phần lớn các trường tuyển sinh cho **kỳ xuân (tháng 3)** và **kỳ thu (tháng 9)**.

## Thứ tự các bước

1. Chọn chương trình phù hợp
2. Chuẩn bị hồ sơ — đặc biệt là **hợp pháp hóa lãnh sự hoặc apostille**
3. Nộp hồ sơ và phỏng vấn (nếu có)
4. Đóng học phí **bằng tên của bạn**
5. Nhận **giấy báo nhập học tiêu chuẩn**
6. Xin visa
7. Đăng ký thẻ cư trú trong vòng **90 ngày**
""",
    },
]
