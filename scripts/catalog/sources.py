"""Authoritative sources for the Korean institution directory (V12, REPORT §85).

Three tiers, in the order the brief fixes them:

1. **대학알리미 / AcademyInfo** (`academyinfo.go.kr`) — the *canonical registry*. Its school picker is backed by
   ``POST /main/main0790/selectList.do``, which returns every institution in the current public-disclosure
   (정보공시) dataset with its official Korean name, institution division, establishment division, region code and
   campus role. Nothing else decides whether an institution exists or which region it is in.
2. **Study in Korea** (`studyinkorea.go.kr`) — *international-student enrichment only*. The IEQAS page
   (교육국제화역량 인증제) publishes the certified-institution lists, which carry real consequences for a visa
   application, so they are worth showing. Study in Korea's own search is explicitly not exhaustive, which is
   exactly why it may not be the registry.
3. Official university websites — per-institution facts, resolved from Wikidata's ``official website`` claim and
   never scraped.

Wikidata supplies the English name, the official website and the coordinates. It is a secondary source and is
recorded as such on every field it fills; where it disagrees with AcademyInfo on *existence*, *name* or *region*,
AcademyInfo wins.
"""

from __future__ import annotations

ACADEMYINFO_LIST = "https://www.academyinfo.go.kr/main/main0790/selectList.do"
ACADEMYINFO_REFERER = "https://www.academyinfo.go.kr/index.do"
ACADEMYINFO_HOME = "https://www.academyinfo.go.kr"
STUDYINKOREA_IEQAS = "https://www.studyinkorea.go.kr/ko/plan/certifiedUniversity.do"
WIKIDATA_SPARQL = "https://query.wikidata.org/sparql"

USER_AGENT = "HangyulUnivDirectory/1.0 (+https://univ.talkhangyul.com; study-abroad directory)"

# AcademyInfo `zn_cd` → the region key the product already uses (packages/i18n `common:region.*`).
# These seventeen are the full set the source emits, and they are Korea's seventeen 광역자치단체.
REGION_BY_CODE: dict[str, str] = {
    "11": "Seoul",
    "21": "Busan",
    "22": "Daegu",
    "23": "Incheon",
    "24": "Gwangju",
    "25": "Daejeon",
    "26": "Ulsan",
    "41": "Gyeonggi",
    "42": "Gangwon",
    "43": "Chungbuk",
    "44": "Chungnam",
    "45": "Jeonbuk",
    "46": "Jeonnam",
    "47": "Gyeongbuk",
    "48": "Gyeongnam",
    "49": "Jeju",
    "50": "Sejong",
}

# `schl_div_nm` → our institution kind. 대학원 (the graduate *school* of a university that is already listed) is
# deliberately absent: it is a faculty of an institution, not an institution, and including it would triple the
# directory with duplicates of its own parent.
KIND_BY_DIVISION: dict[str, str] = {
    "대학": "UNIVERSITY",
    "전문대학": "JUNIOR_COLLEGE",
    "대학원대학": "GRADUATE_UNIVERSITY",
}

# `estb_div_nm` → establishment. The source distinguishes six legal forms; students care about the
# national/public/private distinction, so the corporate forms fold into the tier they belong to and the exact
# source string is kept in `establishment_source` for the record.
ESTABLISHMENT_BY_NAME: dict[str, str] = {
    "국립": "NATIONAL",
    "국립대법인": "NATIONAL",
    "특별법국립": "NATIONAL",
    "공립": "PUBLIC",
    "특별법법인": "PRIVATE",
    "사립": "PRIVATE",
    "기타": "PRIVATE",
}

# `psbs_div_cd` → campus role. Only `1` (본교, the main campus) becomes a directory entry; the others are recorded
# against their main campus so a branch is never presented as a separate university.
MAIN_CAMPUS_CODE = "1"
