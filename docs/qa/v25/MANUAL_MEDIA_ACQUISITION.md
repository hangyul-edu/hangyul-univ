# V25 — Manual media acquisition

Generated 2026-10-27 by the V25 pass. These are photographs whose **licence already permits use** (KOGL Type 1, 공공누리 제1유형 출처표시)
but which this environment must not fetch: 공유마당 (gongu.copyright.or.kr) serves only a generic placeholder thumbnail for
them, and the original file lives at 향토문화전자대전 (`*.grandculture.net`), whose `robots.txt` disallows automated agents —
including `ClaudeBot`, `Claude-User` and `Claude-SearchBot` by name. V25 did not bypass that. A person can download each original
through 공유마당's own 다운로드 button (the public, licensed route) in a normal browser.

## Why these are usable once downloaded

- KOGL Type 1 permits commercial use and modification; its one condition is **출처표시** (source attribution).
- University photographs in Hangyul Univ render their credit *inside the picture* (`PhotoCredit`, since V21), which satisfies
  that condition. The credit line to record: `출처: 공유마당(한국저작권위원회), 원저작물: 향토문화전자대전(한국학중앙연구원), KOGL 제1유형`.
- **Verify on the item page before use** that the 공공누리 mark shown is 제1유형 (not 2/3/4 — those forbid commercial use or change).

## Exact manual action (per row)

1. Open the source page in a normal browser.  2. Confirm the 공공누리 1유형 mark and the subject (it must show this university's campus/building).
3. Click 다운로드 and save the original.  4. Reject if < 1600 px on the long edge, portrait, dark, blurred, watermarked, or not the campus.
5. Put accepted files in `docs/media/manual-intake/<slug>/` with a `source.json` (`source_url`, `licence`, `author`) and run
   `python3 scripts/universities/v25-import-local.py docs/media/manual-intake` — it writes renditions, rights metadata and the credit.

## Leads (50, 14 institutions)

| # | University | 한국어 | Asset name (공유마당) | Source page | Original (do not fetch automatically) | Licence | Current visual |
|--:|---|---|---|---|---|---|---|
| 1 | Far East University (`far-east-university`) | 극동대학교 | 극동대학교 | https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=12244023&menuNo=200018 | http://eumseong.grandculture.net/Contents?dataType=0403&contents_id=GC011P0181 | KOGL Type 1 (공공누리 제1유형: 출처표시) | IDENTITY |
| 2 | Daegu Arts University (`daegu-arts-university`) | 대구예술대학교 | 대구예술대학교 | https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=12246006&menuNo=200018 | http://chilgok.grandculture.net/Contents?dataType=0403&contents_id=GC023P2810 | KOGL Type 1 (공공누리 제1유형: 출처표시) | IDENTITY |
| 3 | Daegu Arts University (`daegu-arts-university`) | 대구예술대학교 | 대구예술대학교 | https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=12245986&menuNo=200018 | http://chilgok.grandculture.net/Contents?dataType=0403&contents_id=GC023P2811 | KOGL Type 1 (공공누리 제1유형: 출처표시) | IDENTITY |
| 4 | Daegu Arts University (`daegu-arts-university`) | 대구예술대학교 | 대구예술대학교 | https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=12245963&menuNo=200018 | http://chilgok.grandculture.net/Contents?dataType=0403&contents_id=GC023P2812 | KOGL Type 1 (공공누리 제1유형: 출처표시) | IDENTITY |
| 5 | Sehan University (`sehan-university`) | 세한대학교 | 세한 대학교 | https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=12243555&menuNo=200018 | http://yeongam.grandculture.net/Contents?dataType=0403&contents_id=GC044P02632 | KOGL Type 1 (공공누리 제1유형: 출처표시) | IDENTITY |
| 6 | Hanseo University (`hanseo-university`) | 한서대학교 | 한서대학교 영암체육관 | https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=12242437&menuNo=200018 | http://seosan.grandculture.net/Contents?dataType=0403&contents_id=GC041P4083 | KOGL Type 1 (공공누리 제1유형: 출처표시) | IDENTITY |
| 7 | Hanseo University (`hanseo-university`) | 한서대학교 | 한서대학교 인곡관 | https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=12242398&menuNo=200018 | http://seosan.grandculture.net/Contents?dataType=0403&contents_id=GC041P4074 | KOGL Type 1 (공공누리 제1유형: 출처표시) | IDENTITY |
| 8 | Hanseo University (`hanseo-university`) | 한서대학교 | 한서대학교 심운관 | https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=12242397&menuNo=200018 | http://seosan.grandculture.net/Contents?dataType=0403&contents_id=GC041P4082 | KOGL Type 1 (공공누리 제1유형: 출처표시) | IDENTITY |
| 9 | Hanseo University (`hanseo-university`) | 한서대학교 | 한서대학교 청곡관 | https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=12242377&menuNo=200018 | http://seosan.grandculture.net/Contents?dataType=0403&contents_id=GC041P4072 | KOGL Type 1 (공공누리 제1유형: 출처표시) | IDENTITY |
| 10 | Hanseo University (`hanseo-university`) | 한서대학교 | 한서대학교 이학관 | https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=12242352&menuNo=200018 | http://seosan.grandculture.net/Contents?dataType=0403&contents_id=GC041P4070 | KOGL Type 1 (공공누리 제1유형: 출처표시) | IDENTITY |
| 11 | Hanseo University (`hanseo-university`) | 한서대학교 | 한서대학교 예술관 | https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=12242446&menuNo=200018 | http://seosan.grandculture.net/Contents?dataType=0403&contents_id=GC041P4084 | KOGL Type 1 (공공누리 제1유형: 출처표시) | IDENTITY |
| 12 | Hanseo University (`hanseo-university`) | 한서대학교 | 한서대학교 연암도서관 | https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=12242447&menuNo=200018 | http://seosan.grandculture.net/Contents?dataType=0403&contents_id=GC041P4078 | KOGL Type 1 (공공누리 제1유형: 출처표시) | IDENTITY |
| 13 | Hanseo University (`hanseo-university`) | 한서대학교 | 한서대학교 보건의료학관 | https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=12242466&menuNo=200018 | http://seosan.grandculture.net/Contents?dataType=0403&contents_id=GC041P4073 | KOGL Type 1 (공공누리 제1유형: 출처표시) | IDENTITY |
| 14 | Hanseo University (`hanseo-university`) | 한서대학교 | 한서대학교 영암관 | https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=12242479&menuNo=200018 | http://seosan.grandculture.net/Contents?dataType=0403&contents_id=GC041P4071 | KOGL Type 1 (공공누리 제1유형: 출처표시) | IDENTITY |
| 15 | Hanseo University (`hanseo-university`) | 한서대학교 | 한서대학교 공학관과 평생교육원 | https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=12242596&menuNo=200018 | http://seosan.grandculture.net/Contents?dataType=0403&contents_id=GC041P4077 | KOGL Type 1 (공공누리 제1유형: 출처표시) | IDENTITY |
| 16 | Hanseo University (`hanseo-university`) | 한서대학교 | 한서대학교 대운동장 | https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=12242588&menuNo=200018 | http://seosan.grandculture.net/Contents?dataType=0403&contents_id=GC041P4081 | KOGL Type 1 (공공누리 제1유형: 출처표시) | IDENTITY |
| 17 | Hanseo University (`hanseo-university`) | 한서대학교 | 한서대학교 건축공학관 | https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=12242578&menuNo=200018 | http://seosan.grandculture.net/Contents?dataType=0403&contents_id=GC041P4075 | KOGL Type 1 (공공누리 제1유형: 출처표시) | IDENTITY |
| 18 | Hanseo University (`hanseo-university`) | 한서대학교 | 한서대학교 건축공학관 | https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=12242566&menuNo=200018 | http://seosan.grandculture.net/Contents?dataType=0403&contents_id=GC041P4069 | KOGL Type 1 (공공누리 제1유형: 출처표시) | IDENTITY |
| 19 | Hanseo University (`hanseo-university`) | 한서대학교 | 한서대학교 교문 | https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=12242543&menuNo=200018 | http://seosan.grandculture.net/Contents?dataType=0403&contents_id=GC041P4068 | KOGL Type 1 (공공누리 제1유형: 출처표시) | IDENTITY |
| 20 | Hanseo University (`hanseo-university`) | 한서대학교 | 한서대학교 연암도서관 | https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=12242542&menuNo=200018 | http://seosan.grandculture.net/Contents?dataType=0403&contents_id=GC041P4079 | KOGL Type 1 (공공누리 제1유형: 출처표시) | IDENTITY |
| 21 | Hanseo University (`hanseo-university`) | 한서대학교 | 한서대학교 인곡관 어학교육원 | https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=12242551&menuNo=200018 | http://seosan.grandculture.net/Contents?dataType=0403&contents_id=GC041P4076 | KOGL Type 1 (공공누리 제1유형: 출처표시) | IDENTITY |
| 22 | Gangdong University (`gangdong-university`) | 강동대학교 | 강동대학교 | https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=12244039&menuNo=200018 | http://eumseong.grandculture.net/Contents?dataType=0403&contents_id=GC011P0183 | KOGL Type 1 (공공누리 제1유형: 출처표시) | IDENTITY |
| 23 | Seojeong University (`seojeong-university`) | 서정대학교 | 서정대학교 본관 | https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=12243214&menuNo=200018 | http://yangju.grandculture.net/Contents?dataType=0403&contents_id=GC043P0829 | KOGL Type 1 (공공누리 제1유형: 출처표시) | IDENTITY |
| 24 | Hanyeong University (`hanyeong-university`) | 한영대학교 | 한영대학 | https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=12243382&menuNo=200018 | http://yeosu.grandculture.net/Contents?dataType=0403&contents_id=GC013P0298 | KOGL Type 1 (공공누리 제1유형: 출처표시) | IDENTITY |
| 25 | Graduate School of Korean Studies (`graduate-school-of-korean-studies`) | 한국학대학원 | 한국학대학원 측면 | https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=12242800&menuNo=200018 | http://seongnam.grandculture.net/Contents?dataType=0403&contents_id=GC001P4146 | KOGL Type 1 (공공누리 제1유형: 출처표시) | IDENTITY |
| 26 | Graduate School of Korean Studies (`graduate-school-of-korean-studies`) | 한국학대학원 | 한국학대학원 | https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=12242787&menuNo=200018 | http://seongnam.grandculture.net/Contents?dataType=0403&contents_id=GC001P4148 | KOGL Type 1 (공공누리 제1유형: 출처표시) | IDENTITY |
| 27 | Namseoul University (`namseoul-university`) | 남서울대학교 | 남서울 대학교 | https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=12245375&menuNo=200018 | http://cheonan.grandculture.net/Contents?dataType=0403&contents_id=GC045P02887 | KOGL Type 1 (공공누리 제1유형: 출처표시) | OFFICIAL_VIDEO |
| 28 | Namseoul University (`namseoul-university`) | 남서울대학교 | 남서울대학교 | https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=12264368&menuNo=200018 | http://cheonan.grandculture.net/Contents?dataType=0403&contents_id=GC045P02888 | KOGL Type 1 (공공누리 제1유형: 출처표시) | OFFICIAL_VIDEO |
| 29 | Namseoul University (`namseoul-university`) | 남서울대학교 | 남서울대학교 | https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=12264924&menuNo=200018 | http://cheonan.grandculture.net/Contents?dataType=0403&contents_id=GC045P02890 | KOGL Type 1 (공공누리 제1유형: 출처표시) | OFFICIAL_VIDEO |
| 30 | Namseoul University (`namseoul-university`) | 남서울대학교 | 남서울 대학교 | https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=12245598&menuNo=200018 | http://cheonan.grandculture.net/Contents?dataType=0403&contents_id=GC045P02891 | KOGL Type 1 (공공누리 제1유형: 출처표시) | OFFICIAL_VIDEO |
| 31 | Namseoul University (`namseoul-university`) | 남서울대학교 | 남서울 대학교 | https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=12245438&menuNo=200018 | http://cheonan.grandculture.net/Contents?dataType=0403&contents_id=GC045P02889 | KOGL Type 1 (공공누리 제1유형: 출처표시) | OFFICIAL_VIDEO |
| 32 | Namseoul University (`namseoul-university`) | 남서울대학교 | 남서울 대학교 | https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=12245429&menuNo=200018 | http://cheonan.grandculture.net/Contents?dataType=0403&contents_id=GC045P02892 | KOGL Type 1 (공공누리 제1유형: 출처표시) | OFFICIAL_VIDEO |
| 33 | Namseoul University (`namseoul-university`) | 남서울대학교 | 남서울 대학교 | https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=12245486&menuNo=200018 | http://cheonan.grandculture.net/Contents?dataType=0403&contents_id=GC045P02894 | KOGL Type 1 (공공누리 제1유형: 출처표시) | OFFICIAL_VIDEO |
| 34 | Namseoul University (`namseoul-university`) | 남서울대학교 | 남서울대학교 | https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=12264972&menuNo=200018 | http://cheonan.grandculture.net/Contents?dataType=0403&contents_id=GC045P02893 | KOGL Type 1 (공공누리 제1유형: 출처표시) | OFFICIAL_VIDEO |
| 35 | Pai Chai University (`pai-chai-university`) | 배재대학교 | Pai Chai Univercity dormitory building. 배재대학교 기숙사 중앙 계단 | https://www.flickr.com/photos/28021450@N05/4426796462 | — | CC BY-SA 2.0 | OFFICIAL_VIDEO |
| 36 | Pusan National University (`pusan-national-university`) | 부산대학교 | 부산대학교 | https://www.flickr.com/photos/71711641@N00/365498811 | — | CC BY 2.0 | OFFICIAL_VIDEO |
| 37 | Pusan National University (`pusan-national-university`) | 부산대학교 | 부산대학교 GCZRGA | https://www.flickr.com/photos/71711641@N00/365499996 | — | CC BY 2.0 | OFFICIAL_VIDEO |
| 38 | Sun Moon University (`sun-moon-university`) | 선문대학교 | 선문 대학교 천안 캠퍼스 | https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=12245395&menuNo=200018 | http://cheonan.grandculture.net/Contents?dataType=0403&contents_id=GC045P02330 | KOGL Type 1 (공공누리 제1유형: 출처표시) | OFFICIAL_VIDEO |
| 39 | Semyung University (`semyung-university`) | 세명대학교 | 세명대학교 본관 | https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=12244595&menuNo=200018 | http://jecheon.grandculture.net/Contents?dataType=0403&contents_id=GC033P1722 | KOGL Type 1 (공공누리 제1유형: 출처표시) | OFFICIAL_VIDEO |
| 40 | Semyung University (`semyung-university`) | 세명대학교 | 세명대학교 세명학사 | https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=12244794&menuNo=200018 | http://jecheon.grandculture.net/Contents?dataType=0403&contents_id=GC033P1713 | KOGL Type 1 (공공누리 제1유형: 출처표시) | OFFICIAL_VIDEO |
| 41 | Semyung University (`semyung-university`) | 세명대학교 | 세명대학교 정문 | https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=12244754&menuNo=200018 | http://jecheon.grandculture.net/Contents?dataType=0403&contents_id=GC033P1727 | KOGL Type 1 (공공누리 제1유형: 출처표시) | OFFICIAL_VIDEO |
| 42 | Semyung University (`semyung-university`) | 세명대학교 | 세명대학교 이학관 | https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=12244736&menuNo=200018 | http://jecheon.grandculture.net/Contents?dataType=0403&contents_id=GC033P1717 | KOGL Type 1 (공공누리 제1유형: 출처표시) | OFFICIAL_VIDEO |
| 43 | Semyung University (`semyung-university`) | 세명대학교 | 세명대학교 문화관(대학원) | https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=12244686&menuNo=200018 | http://jecheon.grandculture.net/Contents?dataType=0403&contents_id=GC033P1723 | KOGL Type 1 (공공누리 제1유형: 출처표시) | OFFICIAL_VIDEO |
| 44 | Semyung University (`semyung-university`) | 세명대학교 | 세명대학교 학생회관 | https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=12244611&menuNo=200018 | http://jecheon.grandculture.net/Contents?dataType=0403&contents_id=GC033P1718 | KOGL Type 1 (공공누리 제1유형: 출처표시) | OFFICIAL_VIDEO |
| 45 | Semyung University (`semyung-university`) | 세명대학교 | 세명대학교 후문 | https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=12244623&menuNo=200018 | http://jecheon.grandculture.net/Contents?dataType=0403&contents_id=GC033P1712 | KOGL Type 1 (공공누리 제1유형: 출처표시) | OFFICIAL_VIDEO |
| 46 | Semyung University (`semyung-university`) | 세명대학교 | 세명대학교 체육관 | https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=12244640&menuNo=200018 | http://jecheon.grandculture.net/Contents?dataType=0403&contents_id=GC033P1719 | KOGL Type 1 (공공누리 제1유형: 출처표시) | OFFICIAL_VIDEO |
| 47 | Semyung University (`semyung-university`) | 세명대학교 | 세명대학교 창업보육센터 | https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=12244660&menuNo=200018 | http://jecheon.grandculture.net/Contents?dataType=0403&contents_id=GC033P1720 | KOGL Type 1 (공공누리 제1유형: 출처표시) | OFFICIAL_VIDEO |
| 48 | Semyung University (`semyung-university`) | 세명대학교 | 세명대학교 대운동장 | https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=12244687&menuNo=200018 | http://jecheon.grandculture.net/Contents?dataType=0403&contents_id=GC033P1715 | KOGL Type 1 (공공누리 제1유형: 출처표시) | OFFICIAL_VIDEO |
| 49 | University of Brain Education (`inst-657`) | 국제뇌교육종합대학원대학교 | 국제 뇌 교육 종합 대학원 대학교 캠퍼스 | https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=12245524&menuNo=200018 | http://cheonan.grandculture.net/Contents?dataType=0403&contents_id=GC045P02371 | KOGL Type 1 (공공누리 제1유형: 출처표시) | OFFICIAL_VIDEO |
| 50 | University of Brain Education (`inst-657`) | 국제뇌교육종합대학원대학교 | 국제 뇌 교육 종합 대학원 대학교 정문 | https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=12245577&menuNo=200018 | http://cheonan.grandculture.net/Contents?dataType=0403&contents_id=GC045P02369 | KOGL Type 1 (공공누리 제1유형: 출처표시) | OFFICIAL_VIDEO |

## Priority

Hanseo (16 named buildings), Semyung (10) and Namseoul (8) currently have **no** photograph at all; one accepted file each moves
three institutions from identity art to a real campus photograph. Pusan National and Pai Chai already have photographs; their
leads are gallery depth only.

