# V27 research: Study in Korea, GKS, IEQAS, GPA, rankings, language tests

Checked on **2026-10-29**. Only official sources were used. Machine-readable results are in
`server/app/data/research/v27/reference.json`. A value with no source is a gap, not a guess.

---

## 1. Study in Korea (studyinkorea.go.kr, NIIED): university pages

### URL pattern

```
https://www.studyinkorea.go.kr/ko/search/universityInfo.do?tab=univ-basic-info&univCd={univ_cd}
```

- Other tabs: `tab=univ-departments` (with `&courseCd=…&majorCd=…`) and `tab=univ-community`.
- The site's own JavaScript (`movePage.js`) reaches this URL with a POST, but a plain GET with the same query string returns the full page (HTTP 200).
- `univ_cd` is a 6-digit NIIED code. The site search box finds it through
  `/search/front/studyRcmdJson.jsp?term=<name>&mode=multi`, which returns JSON with `univ_cd`, `univ_nm`, `univ_engl_nm` and region.
- There is **no English page**. `/en/...` serves the same Korean HTML, and Google Translate translates it in the browser.

| Example | univ_cd | URL |
|---|---|---|
| 연세대학교 (Seoul) | 100289 | https://www.studyinkorea.go.kr/ko/search/universityInfo.do?tab=univ-basic-info&univCd=100289 |
| 연세대학교(미래) | 100290 | …&univCd=100290 |
| 부산대학교 | 100190 | https://www.studyinkorea.go.kr/ko/search/universityInfo.do?tab=univ-basic-info&univCd=100190 |

### Fields shown on the page (read from the Yonsei and Pusan pages)

| Section | Fields |
|---|---|
| Header | Korean name, founding date (설립), national/private, **IEQAS badge** ("교육 국제화 역량 인증 대학"), address, homepage link, KLI (어학당) homepage link, 홍보자료, SNS |
| 대학소개 | Number of international students (total / PhD / MA / integrated / BA / other), faculty by rank, total students by level |
| 유학생 지원 프로그램 | Free text |
| 어학과정 개설현황 | **Korean language programme**: name, eligibility, capacity, study period, tuition per term, other cost, department, contact name, email, phone, fax, last-modified date |
| 장학금 지원 | Each scholarship separately: name, eligibility, scale, amount per person, department, contact, email, last-modified date |
| 기숙사 지원 | **Dormitory capacity**, **monthly cost by room type** (1, 2, 3 or 4 people), notes, average cafeteria price, which meals are served, eligibility and capacity for each dormitory, contact |
| 아르바이트 지원 | **Part-time job / internship support**: name, eligibility, content, contact |
| 특성화분야 & 외국어 강좌 | Specialised fields, **English-taught courses** (text plus "% English-only courses"), other foreign-language courses |
| 학교 & 편의 시설 | Campus facilities (free text) |
| 수업료 | Tuition per term, by field (sciences, humanities, arts, engineering, medicine) and by degree level |
| 문의처 | **International office and admissions contacts** for each programme (name, email) |
| 외국인 특별과정 | Summer and winter schools and the KLI: duration, language, intake months, quota, fee, documents |
| 학사/석사/박사 입학관련 정보 | Intake months, application period, length of study, attached admission guideline PDF, full department list (English-course ratio, English requirement, URL), link to the part-time work-hour rules |
| Community tab | Videos and gallery |
| "대학 정보 다운로드" modal | Download for each university: 담당자정보 (contacts), 장학정보 (scholarships), 어학정보 (language courses), 기숙사정보 (dormitories) |

**Not on the university page:** city or region information (it is on a separate page, `/ko/life/regionsIntro.do`), GKS participation, and rankings.

**Data quality is poor; do not import it blindly.**
- Each section shows when it was last edited, and many are old. Most of Yonsei's sections are from April–May 2020; Pusan's range from 2012-11-28 to 2026-03-27.
- Currency labels are wrong. Pusan's tuition table is headed "$" but the figures are in won (for example 2,459,000), and its KLI fee appears as "1,400,000원" in a "$" field.
- The universities enter this data themselves.

### robots.txt (checked 2026-10-29)

```
User-agent: *
Allow: /
Disallow: /Sims/
Sitemap: https://www.studyinkorea.go.kr/sitemap.xml
```
`universityInfo.do` is allowed, but it is not in the sitemap.

### Terms and copyright: **PROHIBITED** (without NIIED's explicit approval)

- There is no separate 저작권 정책 page. The footer says only "© National Institute for International Education (NIIED). All rights reserved". There is no 공공누리 (KOGL) mark on the university pages.
- The 이용약관 (https://www.studyinkorea.go.kr/ko/uss/umt/EgovStplatCnfirmMber.do, in force since 2012-08-30), Article 16, says:
  > 1. 당 사이트가 제공하는 서비스, 그에 필요한 소프트웨어, 이미지, 마크, 로고, 디자인, 서비스 명칭, **정보** 및 상표 등과 관련된 지적재산권 및 기타 권리는 당 사이트에 소유권이 있습니다. 2. 귀하는 당 사이트가 명시적으로 승인한 경우를 제외하고는 … 수정, 대여, 대출, 판매, **배포**, … **상업적 이용 행위**를 할 수 없으며 …

  (In English: the site owns the rights to its services and **information**, and users may not modify, distribute or **commercially use** them without the site's explicit approval.)
- Attribution does not make collecting the pages and showing them on a commercial site acceptable under these terms. Whether bare facts can be protected (for example under database-producer rights) is a question for counsel. Pages are also often out of date, so scraping them is a poor source anyway.
- **Use the open-data copies instead** (below). Two of them are licensed "이용허락범위 제한 없음" (no restriction) on data.go.kr.

### Open data (public data / API)

| Dataset | URL | Licence | Notes |
|---|---|---|---|
| 교육부 국립국제교육원_대학문의처정보_20250731 | https://www.data.go.kr/data/15146912/fileData.do | 제한 없음 | CSV, 564 rows; contacts for the international office, admissions, KLI and student support; updated as needed (수시) |
| 교육부 국립국제교육원_대학정규과정정보_20250731 | https://www.data.go.kr/data/15146909/fileData.do | 제한 없음 | CSV, 1,006 rows; download goes to studyinkorea.go.kr |
| Study in Korea 자료실 › 공공 데이터 개방 (6 Excel sets, 2025-07-31) | https://www.studyinkorea.go.kr/ko/notice/archivesList.do?boardSort=10 | not stated | 정규과정, 단과대학원, 수업료, 편의시설, **기숙사 (입사자격 / 기숙사비 / 수용가능인원 / 지원여부)**, 문의처. Direct links: `/ko/opendata/{academicInfo,graduateSchool,universityTuition,universityConvenience,universityDormitory,universityInquiry}ExcelDownload.do` |
| 한국교육개발원_외국인 유학생 현황_대학_20250401 | https://www.data.go.kr/data/15050054/fileData.do | 제한 없음 | Foreign degree students per university; updated yearly (next 2026-12-30) |
| 법무부_46(외국인 유학생) 연도별 외국인 유학생 체류 현황_20251231 | https://www.data.go.kr/data/15100038/fileData.do | 제한 없음 | Holders of D-2, D-4-1 and D-4-7 visas, by year |
| 교육부 국립국제교육원_정부초청장학생_대학별_누적관리현황_20251120 | https://www.data.go.kr/data/15069760/fileData.do | 제한 없음 | Cumulative GKS scholars per university |
| 교육부 국립국제교육원_한국유학종합시스템 온라인 입학현황(국가별)_20241231 | https://www.data.go.kr/data/15070985/fileData.do | 제한 없음 | Has an auto-generated JSON/XML API |

I found **no open API** for the university pages themselves. The dormitory, tuition, facilities and graduate-school sets are offered only on Study in Korea, which states no licence for them. I found no data.go.kr listing for them.

---

## 2. GKS participating universities

All lists below are from the Korean application guidelines attached to each notice; I read the PDFs. Names are copied exactly as the guidelines abbreviate them.

- **GKS-U 2027** (posted 2026-09-09) is the latest undergraduate programme.
- **GKS-G 2026** (posted 2026-02-02, guidelines revised 2026-02-20) is the latest graduate programme. The 2027 graduate call is normally published in February and was not out on 2026-10-29.

### GKS 2027 Undergraduate (GKS-U)
Notice: https://www.studyinkorea.go.kr/ko/notice/scholarshipsRead.do?nttId=4522&bbsId=BBSMSTR_000000000461&boardSort=3 (2026-09-09; guidelines p.5)

| Track | Universities (exact) |
|---|---|
| Embassy track, **Type A** (28) | 가톨릭대, 경동대, 경희대, 고려대, 국민대, 동국대, 명지대, 서강대, 서경대, 서울과학기술대, 서울대, 서울시립대, 성균관대, 성신여대, 세종대, 숭실대, 아주대, 연세대, 울산과기원, 이화여대, 인천대, 인하대, 중앙대, 포항공대, 한국외대, 한성대, 한양대, 홍익대 |
| Embassy track, **Type B** and R-GKS (42) | 강원대, 건양대, 경북대, 경상국립대, 경성대, 경운대, 계명대, 국립경국대, 국립공주대, 국립군산대, 국립부경대, 국립순천대, 국립창원대, 국립한국교통대, 국립한밭대, 대구가톨릭대, 대구대, 대전대, 동명대, 동아대, 목원대, 배재대, 부산대, 부산외대, 선문대, 세명대, 순천향대, 신라대, 영남대, 울산대, 원광대, 인제대, 전남대, 전북대, 제주대, 조선대, 청주대, 충남대, 충북대, 한국기술교육대, 한남대, 호서대 |
| University track, associate degree / 전문학사 (9) | 경남정보대, 경복대, 경인여대, 동의과학대, 부산과기대, 영남이공대, 인덕대, 제주한라대, 한국영상대 |
| University track, UIC (13) | 학사과정: 건양대, 계명대, 국민대, 대구대, 동아대, 성신여대, 아주대, 영남대, 인제대, 한국기술교육대 · 전문학사과정: 경복대, 동의과학대, 오산대 |

- Embassy-track applicants may choose up to 3 universities, and at least one must be Type B. R-GKS applicants choose up to 2 Type B universities.
- Each university's own selection schedule for the university track is in notice #4527 (xlsx, 2026-09-23):
  https://www.studyinkorea.go.kr/ko/notice/scholarshipsRead.do?nttId=4527&bbsId=BBSMSTR_000000000461&boardSort=3

### GKS 2026 Undergraduate (for reference)
Notice: https://www.studyinkorea.go.kr/ko/notice/scholarshipsRead.do?nttId=4385&bbsId=BBSMSTR_000000000461&boardSort=3 (2025-09-05)

| Track | Universities (exact) |
|---|---|
| Type A, 수도권 (30) | 건국대, 경희대, 고려대, 국민대, 단국대, 덕성여대, 동국대, 명지대, 서강대, 서경대, 서울과학기술대, 서울대, 서울시립대, 성균관대, 성신여대, 숙명여대, 신한대, 아주대, 연세대, 울산과학기술원, 이화여대, 인천대, 인하대, 중앙대, 포항공대, 한국공학대, 한국외국어대, 한성대, 한양대, 홍익대 |
| Type B, 비수도권 (39) | 강원대, 건양대, 경북대, 경상국립대, 경성대, 계명대, 고려대 세종캠퍼스, 국립경국대, 국립공주대, 국립군산대, 국립한국해양대, 대구가톨릭대, 대구대, 대전대, 동서대, 동아대, 목원대, 배재대, 부경대, 부산대, 부산외국어대, 선문대, 세명대, 순천대, 순천향대, 신라대, 영남대, 울산대, 인제대, 전남대, 전북대, 제주대, 조선대, 청주대, 충남대, 충북대, 한국기술교육대, 한남대, 호서대 |
| 전문학사 (9) | 경복대, 구미대, 동의과학대, 영진전문대, 오산대, 전주비전대, 한국영상대, 한양여대, 호산대 |
| UIC (13) | 건양대, 계명대, 국민대, 대구대, 동아대, 성신여대, 영남대, 인제대, 한국기술교육대, 아주대 · 전문학사: 경복대, 동의과학대, 오산대 |

### GKS 2026 Graduate (GKS-G)
Notice: https://www.studyinkorea.go.kr/ko/notice/scholarshipsRead.do?nttId=4420&bbsId=BBSMSTR_000000000461&boardSort=3 (2026-02-02, revised guidelines 2026-02-20)

| Type | Universities (exact) |
|---|---|
| **Type A** (34) | KDI국제정책대학원, 건국대, 경희대, 고려대, 광주과학기술원, 국립암센터국제암대학원, 국민대, 단국대, 덕성여자대, 동국대, 서강대, 서경대, 서울과학기술대, 서울대, 서울시립대, 성균관대, 성신여자대, 세종대, 숙명여자대, 숭실대, 아주대, 연세대, 울산과학기술원, 이화여자대, 인천대, 인하대, 중앙대, 포항공과대, 한국과학기술원, 한국외국어대, 한국학중앙연구원, 한양대, 한양대 ERICA, 홍익대 |
| **Type B** (41) | 강원대, 건양대, 경북대, 경상국립대, 경성대, 경운대, 계명대, 국립경국대, 국립공주대, 국립군산대, 국립부경대, 국립순천대, 국립창원대, 대구대, 대전대, 동명대, 동서대, 동아대, 목원대, 배재대, 백석대, 부산대, 부산외국어대, 선문대, 세명대, 순천향대, 신라대, 영남대, 울산대, 원광대, 인제대, 전남대, 전북대, 제주대, 조선대, 청주대, 충남대, 충북대, 한국기술교육대, 한남대, 호서대 |
| University track, special: R&D (25 universities, 60 departments) | 건국대, 경북대, 경상국립대, 계명대, 국립군산대, 국립부경대, 국립순천대, 국민대, 동아대, 부산대, 서강대, 서울과기대, 서울신학대, 아주대, 연세대, 영남대, 이화여대, 인제대, 인천대, 전남대, 제주대, 청주대, 한국과학기술원, 한국기술교육대, 한남대 |
| University track, special: Global Network (6 universities, 7 departments) | KDI국제정책대학원, 국립경국대, 부산대, 서울대, 아주대, 홍익대 |

Who may apply where:
- Embassy track, 일반 or 재외동포·입양인: Type A or B, 3 choices, at least 1 must be Type B.
- University track, 일반 or 연구: Type A or B.
- University track, R-GKS: Type B only.
- University track, 국제기구: Type A or B.

**Change during the cycle:** notice #4422 (2026-02-12) changed the excluded list. Before, DGIST and the Academy of Korean Studies (AKS) were both excluded because they lacked 2025 IEQAS certification. After the change, only DGIST is excluded. This matches the 0220 guidelines: AKS (한국학중앙연구원) is listed and DGIST is not.

---

## 3. IEQAS (교육국제화역량 인증제)

| Item | Value |
|---|---|
| Latest cycle | **2025** certification, valid March 2026 to February 2030 (4th cycle) |
| Official announcement | Joint MOJ/MOE press release 「교육국제화역량 인증대학 및 유학생 유치‧관리 실태조사」 결과 발표: https://www.immigration.go.kr/bbs/moj/182/603491/artclView.do |
| Publication date | Posted **2026-02-12**; the release gives 2026-02-13 as the announcement date |
| Press-release counts | 181 for degree programmes, 123 for language programmes, 39 excellent; 16 degree / 4 language institutions under strict visa screening |
| Study in Korea list | https://www.studyinkorea.go.kr/ko/plan/certifiedUniversity.do. Last modified **2026-03-03**: 184 degree, 126 language, 43 excellent |
| Changed since 2026-03-03? | **No.** The page still showed 2026-03-03 on 2026-10-29, and I found no later official announcement. The next results are expected around February 2027 (not verified). |

**Why the two lists differ (both official sources disagree):**
- Study in Korea lists 강원대학교 as four campuses (강릉, 삼척, 원주, 춘천). The press release lists 강원대학교 and 국립강릉원주대학교 separately; they merged in March 2026.
- Study in Korea shows 국립창원대학교 남해캠퍼스 where the press release has 경남도립남해대학.
- Study in Korea **adds 동신대학교** (degree and language) and **leaves out 전북과학대학교** (degree and language).
- Study in Korea's excellent list adds 단국대학교(본교), 서경대학교, 서울여자대학교 and 경복대학교 (43 against 39).

Use the Study in Korea list (2026-03-03) as current and record the press release as a conflict.

---

## 4. GPA helper

- **WES iGPA Calculator: https://apps.wes.org/igpa-calculator/**. It is on the official `wes.org` domain and was checked on 2026-10-29: HTTP 200, page title "WES iGPA Calculator - WES.org", and the page says "Use this free tool to obtain a U.S. grade point average (GPA) calculated on a 4.0 scale." (© 2026 World Education Services).
- Do **not** link `https://applications.wes.org/igpa-calculator/`; it now redirects to the WES login page.
- **Official Korean-government guidance:** NIIED's GKS guidelines (2027 GKS-U, Appendix A "CGPA Conversion Table") map the 4.0, 4.3, 4.5 and 5.0 scales to a 100-point scale. The GKS minimum of 80% equals 2.64/4.0, 2.80/4.3, 2.91/4.5 or 3.23/5.0.
  - The FAQ adds that a grade converted on a website such as scholaro.com must be officially acknowledged by the student's school or university.
  - This table applies to GKS eligibility only. I found no general national conversion standard; each university sets its own rules.

---

## 5. Rankings licensing

| | Latest edition | Can rank numbers be shown on a commercial site? |
|---|---|---|
| QS | **QS World University Rankings 2027** (released 2026-06-18) | Not without written permission |
| THE | **THE World University Rankings 2027** (released 2026-09-30) | Not without written permission |

**QS.**
- The Data Copyright page (https://www.topuniversities.com/data-copyright) licenses rankings data under **CC BY-NC-ND 4.0**, which forbids commercial use and adaptation. It sends commercial reproduction requests to dataops@qs.com.
- The Terms & Conditions (https://www.topuniversities.com/terms-conditions) allow unaltered reproduction of the data as displayed, provided attribution and notices are kept ("With permission from QS Quacquarelli Symonds"). They name content@qs.com for commercial use.
- **Caveat:** topuniversities.com and qs.com return HTTP 403 (a Cloudflare bot check) to automated fetches. I did not try to get around it. The QS wording above therefore comes from search-engine extracts of these official pages, and someone should read them in a browser.

**THE.** The Website Terms of Use (https://www.timeshighereducation.com/website-terms-of-use, last updated 2026-07-07) say:
- §9: requests "to reproduce or distribute the [rankings] data for any purpose" go to data@timeshighereducation.com.
- §10: no reproduction "without THE's prior written consent".
- §14: rankings logos are trademarked, and "All commercial use requires the express written consent" (contact branding@timeshighereducation.com).

The WUR 2027 press release asks that anyone reproducing tables credit THE and link back, but that request is aimed at editorial use.

**Summary:** both publishers require written permission to show rank numbers or logos on a commercial platform. Until permission is granted, the safe options are a plain link out to the rankings page or no rank shown at all.

---

## 6. Language tests in Korean admissions (as Study in Korea describes them)

From https://www.studyinkorea.go.kr/ko/plan/schoolType.do and https://www.studyinkorea.go.kr/ko/plan/examAndKoreanStudy.do:

- **Undergraduate:**
  > 언어 능력 일반적으로 한국어능력시험(TOPIK) 3급 이상을 요구합니다. 단, 대학에 따라 요구 수준이 다를 수 있습니다.

  (Usually TOPIK level 3 or above, but universities differ.)
- **Graduate:**
  > 대부분의 대학원에서는 한국어능력시험(TOPIK) 또는 영어능력시험(TOEFL, IELTS 등) 성적을 요구하고 있으며 구체적인 요구사항은 대학별로 다를 수 있습니다.

  (Most graduate schools ask for TOPIK or an English test such as TOEFL or IELTS; details vary by university.)
- **General rule (degree programmes):**
  > 한국어 과정의 경우, 일반적으로 입학 지원시 한국어 능력 증빙 서류로 한국어능력시험 성적증명서(TOPIK PBT 또는 IBT)를 제출하지만 대학에 따라 TOPIK 외에도 법무부 사회통합프로그램 수료증(또는 사전평가 점수), 현지 세종학당 한국어 과정 이수 수료증을 인정하는 경우가 있습니다.

  (Korean-taught programmes usually ask for a TOPIK result, PBT or IBT. Some universities also accept a KIIP (법무부 사회통합프로그램) certificate or pre-assessment score, or a King Sejong Institute course certificate.)
- **Associate degree:** "한국어 능력 증명(예: TOPIK 성적)" (proof of Korean ability, for example a TOPIK score).
- **Score validity:** "성적 유효기간 2년 (성적 발표일로부터 2년간 유효합니다.)" (valid for 2 years from the results date).
- Study in Korea gives **no TOEFL or IELTS minimum scores** and **does not mention TEPS**.
- Related: the GKS 2027 guidelines add a TOEFL iBT column for tests taken after 21 January 2026, on the new 1–6 band scale (for example, the TOPIK level 4 equivalent is band 6.0).

### TOPIK IBT
- **It is official.** MOE notice 교육부 공고 제2025-317호 (2025-10-10), issued under 고등교육법 시행령 제42조의5, sets six 2026 IBT sittings (제11회 to 제16회) alongside the paper test (PBT).
  - Source: https://exam.topik.go.kr/nasdata/webnas/raonkeditordata/BBS//2025/10/20251031_093545671_74607.pdf
- **It uses the same 1–6 levels as the PBT, but the raw score bands are different:**

| Test | Levels and score bands |
|---|---|
| TOPIK I PBT (out of 200) | 1급 80–139, 2급 140–200 |
| TOPIK II PBT (out of 300) | 3급 120–149, 4급 150–189, 5급 190–229, 6급 230–300 |
| TOPIK I IBT (out of 400) | 1급 121–235, 2급 236–400 |
| TOPIK II IBT (out of 600) | 3급 191–290, 4급 291–360, 5급 361–430, 6급 431–600 |
| TOPIK Speaking (separate test) | 1급 20–49 … 6급 160–200 |

Store the **level** (급), never a raw score. Speaking has its own separate 1–6 levels.

**Gap:** topik.go.kr deep links redirect to `index.html` when there is no session, so I could not read the IBT pages there directly. I read the MOE notice PDF hosted on exam.topik.go.kr instead.
