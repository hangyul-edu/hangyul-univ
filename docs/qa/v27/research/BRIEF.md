# V27 official-source research brief

Every research agent in V27 follows this file. Output goes to `server/app/data/research/v27/`. The JSON is
**evidence**, loaded into the database by `scripts/universities/v27-load.py`; nothing in it may be invented.

## Hard rules

1. **Sources, in priority order**: (1) the university's official international-admissions pages, (2) its international
   office, (3) its official scholarship / dormitory / Korean-language-institute pages, (4) Study in Korea
   (studyinkorea.go.kr), (5) 대학알리미, (6) government data (NIIED/GKS, MOE). **Never** agency blogs, Namu wiki, forums,
   ranking aggregators or AI summaries as authority.
2. **Never fill a field from memory or inference.** If the page you read does not state it, the value is `null` and a line
   goes in `gaps`. A missing value is fine; a guessed value is a defect.
3. Every non-null fact carries `evidence` (a short exact quote from the source, original language, ≤ 300 chars) and
   `source` (an id from the file's `sources` list).
4. Record `publication_date` of a guide/notice when the page shows one; otherwise `null`.
5. If two official sources disagree, keep both in `conflicts` with their sources; do not pick silently.
6. Respect robots.txt. Do not fetch `grandculture.net`. Do not log in anywhere. Do not submit forms.
7. Videos: only from the university's **own** official channel (the channel id given to you, or one the university's own
   site links to). Confirm the video is public and embeddable with
   `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=<id>&format=json` (HTTP 200 and `author_url` is that
   channel). Never a student vlog, never a news channel, never another university.
8. Scholarships: record each named scholarship separately. Never collapse them into "scholarships available". Keep
   undergraduate vs graduate and new vs enrolled students apart exactly as the source does.
9. Language tests: record **only** tests the current official rule names, per degree level and track. Do not assume
   TOEIC, Duolingo, Cambridge or PTE are accepted unless the page says so.

## University facts file — `server/app/data/research/v27/facts/<slug>.json`

```json
{
  "slug": "yonsei-university",
  "researched_at": "2026-10-29",
  "sources": [
    {"id": "s1", "url": "https://...", "name": "Office of Admissions — International undergraduate", "kind": "OFFICIAL_INTL_ADMISSIONS",
     "publication_date": null}
  ],
  "links": {
    "international_admissions": {"url": "https://...", "source": "s1"},
    "international_office": null,
    "scholarship": null,
    "dormitory": null,
    "korean_language_institute": null,
    "official_website": {"url": "https://...", "source": "s1"}
  },
  "international": {
    "korean_language_program": {"value": true, "name": "Korean Language Institute", "evidence": "...", "source": "s3"},
    "english_taught_degrees": {"value": true, "levels": ["BACHELOR", "MASTER"], "detail": "Underwood International College", "evidence": "...", "source": "s2"},
    "support_services": [{"key": "BUDDY", "evidence": "...", "source": "s4"}],
    "dormitory": {"available": true, "international_priority": null, "cost_semester_krw_min": 1500000, "cost_semester_krw_max": 2600000,
                  "capacity": null, "note": "double room, 2026 Spring", "evidence": "...", "source": "s5"},
    "gks_participating": {"value": true, "programme": "GKS Graduate 2026", "evidence": "...", "source": "s9"}
  },
  "language_rules": [
    {"degree": "BACHELOR", "track": "KOREAN", "group": "A", "test": "TOPIK", "min": "3", "stage": "APPLICATION",
     "note": "or completion of level 3 at the university's own KLI", "evidence": "...", "source": "s1"}
  ],
  "gpa_rule": null,
  "scholarships": [
    {"name": "…", "name_en": "…", "category": "UNIVERSITY", "stage": "NEW", "degree_levels": ["BACHELOR"],
     "international_only": true, "topik_min": null, "english": null, "gpa_requirement": null, "gpa_min_percent": null,
     "tuition_waiver_percent_min": 30, "tuition_waiver_percent_max": 100, "amount_krw": null, "dormitory_support": null,
     "living_allowance": null, "duration": "first semester", "renewal": "GPA 3.0/4.3 each semester", "automatic": true,
     "application_period": null, "department_restriction": null, "nationality_restriction": null,
     "evidence": "...", "source": "s6"}
  ],
  "videos": [
    {"video_id": "…", "title": "…", "channel_id": "UC…", "channel_title": "…", "purpose": "INTL_RECRUITMENT",
     "language": "en", "oembed_ok": true, "campus": "Sinchon", "evidence": "linked from the international admissions page"}
  ],
  "conflicts": [],
  "gaps": ["dormitory cost: page lists only graduate housing"]
}
```

Enumerations:

- `sources[].kind`: OFFICIAL_INTL_ADMISSIONS, OFFICIAL_INTL_OFFICE, OFFICIAL_SCHOLARSHIP, OFFICIAL_DORM, OFFICIAL_KLI,
  OFFICIAL_GUIDE, OFFICIAL_SITE, OFFICIAL_YOUTUBE, STUDY_IN_KOREA, GOVERNMENT, REGISTRY
- `support_services[].key`: BUDDY, ORIENTATION, AIRPORT_PICKUP, VISA_HELP, CAREER, JOB_PART_TIME, COUNSELING, KOREAN_TUTORING,
  HEALTH_INSURANCE_HELP, INTL_STUDENT_LOUNGE
- `language_rules[].degree`: LANGUAGE, ASSOCIATE, BACHELOR, TRANSFER, MASTER, DOCTORATE, COMBINED
- `language_rules[].track`: KOREAN, ENGLISH, ANY. Rules in the same `group` are alternatives (any one suffices).
- `language_rules[].test`: TOPIK, TOPIK_IBT, KIIP, KING_SEJONG, UNIV_KLI, TOEFL_IBT, IELTS_ACADEMIC, TEPS, NEW_TEPS, TOEIC,
  DUOLINGO, CAMBRIDGE, PTE, OTHER (OTHER needs `note`). `min` is a string as printed (e.g. "3", "80", "5.5", "327").
  Use `"stage": "GRADUATION"` when a level is only needed before graduation, not to apply.
- `scholarships[].category`: GKS, UNIVERSITY, FOUNDATION, DEPARTMENT, LANGUAGE, ACADEMIC, HOUSING
- `scholarships[].stage`: NEW, ENROLLED, BOTH
- `videos[].purpose`, best first: INTL_RECRUITMENT, INTL_CAMPUS_INTRO, ENGLISH_INTRO, CAMPUS_TOUR, GENERAL_PROMO

## Admission guide file — `server/app/data/research/v27/guides/<slug>.json`

Only the **current** official international-admission guide (the 2027 Spring or 2027 Fall round, or the latest round
the university has published). If the latest published guide is older than the 2026 Fall round, record it with
`"status": "STALE"`.

```json
{
  "slug": "yonsei-university",
  "researched_at": "2026-10-29",
  "guides": [
    {
      "status": "VERIFIED",
      "intake_year": 2027, "term": "SPRING", "degree_level": "BACHELOR", "applicant_type": "FRESHMAN", "track": "KOREAN",
      "title": "2027학년도 1학기 외국인 학부 신입학 모집요강",
      "source_url": "https://…/guide.pdf", "source_page_url": "https://…/notice/123", "source_document": "guide.pdf",
      "publication_date": "2026-08-20",
      "application_opens": "2026-09-01", "application_closes": "2026-09-15", "document_deadline": "2026-09-17",
      "submission_channel": "online application (Jinhak/UWAY) + documents by mail",
      "language_rules": [{"test": "TOPIK", "min": "3", "group": "A", "evidence": "…", "source_page": "p.4"}],
      "requirements": [
        {"category": "PASSPORT", "name": "여권 사본", "name_en": "Copy of passport", "required": "REQUIRED",
         "condition": null, "applies_to": null, "original_or_copy": "COPY", "submission": "UPLOAD",
         "translation_required": false, "notarization_required": false, "legalization": "NOT_REQUIRED",
         "issuance_max_age_days": null, "source_page": "p.7", "evidence": "여권 사본 1부"}
      ],
      "notes": [],
      "conflicts": []
    }
  ],
  "gaps": []
}
```

- `requirements[].category`: PASSPORT, NATIONAL_ID, PHOTO, APPLICATION_FORM, SELF_INTRODUCTION, STUDY_PLAN, PERSONAL_STATEMENT,
  GRADUATION_CERTIFICATE, EXPECTED_GRADUATION_CERTIFICATE, TRANSCRIPT, FAMILY_RELATION_CERTIFICATE, PARENT_ID,
  BIRTH_CERTIFICATE, LANGUAGE_CERTIFICATE, BANK_STATEMENT, SPONSOR_DOCUMENT, RECOMMENDATION, PORTFOLIO, RESEARCH_PROPOSAL,
  CV, ALIEN_REGISTRATION, CONSENT_FORM, OTHER
- `required`: REQUIRED or CONDITIONAL (then `condition` states when, in the guide's words).
- `applies_to` (optional): `{"nationalities": ["CN"]}`, `{"education_country_not": ["KR"]}`, `{"applicant": "TRANSFER"}`,
  `{"has_language": "TOPIK"}` … only what the guide states.
- `legalization`: APOSTILLE_OR_CONSULAR (guide demands apostille/consular confirmation), CHINA_CHSI (Chinese degree
  verification route), NOT_REQUIRED, or null if the guide is silent.
- `issuance_max_age_days`: only when the guide states a validity window (e.g. "issued within 30 days" → 30).
- A requirement that could not be read with certainty is **left out** and named in `gaps` — never approximated.
