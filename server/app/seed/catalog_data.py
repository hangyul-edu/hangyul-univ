"""Catalog seed. University identity facts (name, city, type, official admissions URL) are public; every number
(tuition, fees, living cost, dorm cost, seats, GPA minimums) is DEVELOPMENT SAMPLE DATA with verification_status=DEMO.
Program names are representative samples, not a verified list of each university's offerings."""

# slug, name_en, name_ko, type, region, city, founded, website, source_key(admissions), lat, lng, brand color, living/month (demo)
UNIVERSITIES = [
    ("seoul-national-university", "Seoul National University", "서울대학교", "NATIONAL", "Seoul", "Seoul", 1946, "https://en.snu.ac.kr", "univ-snu", 37.4600, 126.9519, "#0F0F70", 1250000),
    ("yonsei-university", "Yonsei University", "연세대학교", "PRIVATE", "Seoul", "Seoul", 1885, "https://www.yonsei.ac.kr/en_sc/", "univ-yonsei", 37.5658, 126.9386, "#003876", 1300000),
    ("korea-university", "Korea University", "고려대학교", "PRIVATE", "Seoul", "Seoul", 1905, "https://www.korea.edu", "univ-korea", 37.5894, 127.0323, "#8B0029", 1250000),
    ("sungkyunkwan-university", "Sungkyunkwan University", "성균관대학교", "PRIVATE", "Seoul", "Seoul", 1398, "https://www.skku.edu/eng/", "univ-skku", 37.5880, 126.9936, "#1C6B3A", 1200000),
    ("hanyang-university", "Hanyang University", "한양대학교", "PRIVATE", "Seoul", "Seoul", 1939, "https://www.hanyang.ac.kr/web/eng", "univ-hanyang", 37.5572, 127.0456, "#0E4A84", 1200000),
    ("kyung-hee-university", "Kyung Hee University", "경희대학교", "PRIVATE", "Seoul", "Seoul", 1949, "https://www.khu.ac.kr/eng/", "univ-khu", 37.5967, 127.0525, "#8C1D40", 1150000),
    ("pusan-national-university", "Pusan National University", "부산대학교", "NATIONAL", "Busan", "Busan", 1946, "https://www.pusan.ac.kr/eng/", "univ-pnu", 35.2334, 129.0798, "#004EA2", 950000),
    ("kyungpook-national-university", "Kyungpook National University", "경북대학교", "NATIONAL", "Daegu", "Daegu", 1946, "https://en.knu.ac.kr", "univ-knu", 35.8906, 128.6119, "#A6192E", 900000),
    ("chung-ang-university", "Chung-Ang University", "중앙대학교", "PRIVATE", "Seoul", "Seoul", 1918, "https://neweng.cau.ac.kr", "univ-cau", 37.5050, 126.9571, "#1D4F91", 1150000),
    ("sogang-university", "Sogang University", "서강대학교", "PRIVATE", "Seoul", "Seoul", 1960, "https://www.sogang.ac.kr/en/", "univ-sogang", 37.5509, 126.9410, "#A50034", 1250000),
]

# key, name_en, name_ko, degree, field, language, semesters, tuition(demo), min_topik, min_ielts, min_toefl, min_gpa
PROGRAM_TEMPLATES = [
    ("bba", "Business Administration (BBA)", "경영학과", "BACHELOR", "business", "KOREAN", 8, 4600000, 3, None, None, 65),
    ("cse", "Computer Science and Engineering", "컴퓨터공학과", "BACHELOR", "computer_science", "KOREAN", 8, 5400000, 3, None, None, 70),
    ("media", "Media and Communication", "미디어커뮤니케이션학과", "BACHELOR", "media_communication", "KOREAN", 8, 4700000, 4, None, None, 65),
    ("intl", "International Studies (English track)", "국제학부", "BACHELOR", "international_studies", "ENGLISH", 8, 5100000, None, 6.0, 80, 70),
    ("design", "Visual and Industrial Design", "디자인학부", "BACHELOR", "design", "KOREAN", 8, 5600000, 3, None, None, 60),
    ("econ-transfer", "Economics (3rd-year transfer)", "경제학과 편입", "TRANSFER", "economics", "KOREAN", 4, 4600000, 4, None, None, 70),
    ("mba", "Global MBA", "글로벌 MBA", "MASTER", "business", "ENGLISH", 4, 8200000, None, 6.5, 88, 75),
    ("mds", "M.S. in Data Science", "데이터사이언스 석사", "MASTER", "data_science", "ENGLISH", 4, 6900000, None, 6.0, 80, 75),
    ("mkle", "M.A. Korean Language Education", "한국어교육 석사", "MASTER", "korean_language", "KOREAN", 4, 5300000, 4, None, None, 70),
    ("mee", "M.S. Electrical Engineering", "전기전자공학 석사", "MASTER", "electrical_engineering", "BILINGUAL", 4, 6500000, 3, 5.5, 71, 75),
    ("phd-ee", "Ph.D. Electrical Engineering", "전기전자공학 박사", "DOCTORATE", "electrical_engineering", "BILINGUAL", 6, 6800000, 3, 6.0, 80, 80),
    ("phd-bio", "Ph.D. Biotechnology", "생명공학 박사", "DOCTORATE", "biotechnology", "ENGLISH", 6, 6800000, None, 6.0, 80, 80),
    ("klp", "Korean Language Program (Language Institute)", "한국어학당", "LANGUAGE", "korean_language", "KOREAN", 1, 1750000, None, None, None, None),
]

# which templates each university offers (sample set)
OFFERINGS = {
    "seoul-national-university": ["bba", "cse", "intl", "mds", "phd-ee", "phd-bio", "klp"],
    "yonsei-university": ["bba", "cse", "media", "intl", "mba", "mds", "klp"],
    "korea-university": ["bba", "cse", "media", "intl", "mba", "phd-bio", "klp"],
    "sungkyunkwan-university": ["bba", "cse", "design", "econ-transfer", "mba", "mds", "mee", "phd-ee", "klp"],
    "hanyang-university": ["cse", "design", "intl", "mee", "phd-ee", "klp"],
    "kyung-hee-university": ["bba", "media", "design", "econ-transfer", "mkle", "mba", "klp"],
    "pusan-national-university": ["bba", "cse", "media", "econ-transfer", "mkle", "mee", "klp"],
    "kyungpook-national-university": ["bba", "cse", "econ-transfer", "mee", "phd-bio", "klp"],
    "chung-ang-university": ["bba", "media", "design", "mba", "klp"],
    "sogang-university": ["bba", "cse", "intl", "mds", "klp"],
}

# Demo partner tenants (partnerships are FICTIONAL demo contracts — see docs/PRODUCT.md)
PARTNER_UNIS = ["sungkyunkwan-university", "kyung-hee-university", "pusan-national-university"]

AGENCIES = [
    # name, slug, country, languages, capacity, sla hours, specialties(kind,value)
    ("Lotus Bridge Education", "lotus-bridge", "VN", ["vi", "ko", "en"], 60, 24,
     [("COUNTRY", "VN"), ("COUNTRY", "KH"), ("LANGUAGE", "vi"), ("DEGREE", "BACHELOR"), ("DEGREE", "LANGUAGE"), ("DOCUMENT", "CONSULAR_LEGALIZATION")]),
    ("Silk Road Study Partners", "silk-road", "UZ", ["uz", "ru", "ko", "en"], 45, 24,
     [("COUNTRY", "UZ"), ("COUNTRY", "KZ"), ("COUNTRY", "KG"), ("COUNTRY", "TJ"), ("COUNTRY", "MN"), ("LANGUAGE", "ru"), ("LANGUAGE", "uz"), ("DEGREE", "BACHELOR"), ("DEGREE", "MASTER")]),
    ("Himalaya Korea Pathways", "himalaya-pathways", "NP", ["ne", "hi", "en", "ko"], 40, 36,
     [("COUNTRY", "NP"), ("COUNTRY", "MM"), ("COUNTRY", "BD"), ("COUNTRY", "IN"), ("LANGUAGE", "ne"), ("LANGUAGE", "my"), ("DEGREE", "LANGUAGE"), ("DEGREE", "MASTER"), ("DOCUMENT", "CONSULAR_LEGALIZATION")]),
    ("Seoul Gateway Admissions", "seoul-gateway", "KR", ["ko", "en", "zh", "ja"], 50, 24,
     [("COUNTRY", "CN"), ("COUNTRY", "JP"), ("COUNTRY", "TW"), ("LANGUAGE", "zh"), ("LANGUAGE", "ja"), ("DEGREE", "MASTER"), ("DEGREE", "DOCTORATE")]),
]

SCHOLARSHIPS_UNI = [
    # name suffix, coverage, min%, max%, rules [(field, op, value, description)]
    ("International Freshman Merit Scholarship", "30–100% of first-semester tuition", 30, 100,
     [("topik_level", "gte", "4", "TOPIK level 4 or higher"), ("gpa_percent", "gte", "80", "Strong academic record (normalized GPA ≥ 80)")]),
    ("Korean Proficiency Scholarship", "20–50% tuition waiver per semester", 20, 50,
     [("topik_level", "gte", "5", "TOPIK level 5 or higher")]),
]

FIELD_ORDER = ["business", "computer_science", "media_communication", "international_studies", "design", "economics", "data_science",
               "korean_language", "electrical_engineering", "biotechnology"]
