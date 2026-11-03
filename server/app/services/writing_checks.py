"""Deterministic automatic checks for admissions essays (V5 writing review).

Pure functions: text in, findings out. No database, no model, no network. Shown in every UI as "Automatic check".

Rules that every check follows
- Findings point at the student's own text (a quote + character offsets). They NEVER propose new content: no invented
  experiences, awards, jobs, volunteer work, motivations, research or achievements, and no rewritten sentences.
- Fact checks compare what the text claims with the structured profile and ask the student to check ("Please check") —
  the text is never changed automatically, and the profile is never changed from the essay.
- Heuristics are conservative: when unsure, stay silent (a missed hint is cheaper than a false accusation).

A finding is a dict: {kind, code, severity (BLOCKER|WARNING|INFO), params, text (English fallback), quote,
anchor_start, anchor_end, staff_only}. ``fingerprint()`` gives a stable id for dismissals across re-runs.
"""
from __future__ import annotations

import difflib
import hashlib
import re
from dataclasses import dataclass, field
from datetime import date

WORD_RE = re.compile(r"[\w'’-]+", re.UNICODE)
HANGUL_RE = re.compile(r"[가-힣]")
LATIN_RE = re.compile(r"[A-Za-z]")

STOPWORDS = set(
    """a an the and or but of to in on at for from by with about as into over after before during your you yours
    my me i we our is are was were be been being this that these those it its their them they he she his her
    please describe explain discuss tell us write include including present provide state briefly detail details
    how why what which who whom when where do does did will would can could should may might must also any all
    own some such than then there here so if not no yes very more most much many each other""".split()
)

# Concept → cues that show a prompt clause about this concept is addressed. Cues are lower-case prefixes.
CONCEPTS: dict[str, list[str]] = {
    "motivation": ["motivat", "why", "because", "interest", "decid", "chose", "choose", "inspir", "want to", "passion", "reason"],
    "reason": ["because", "reason", "why", "decid", "chose"],
    "applying": ["apply", "applying", "chose", "choose", "program", "universit", "department"],
    "background": ["studied", "study", "school", "experience", "project", "worked", "learn", "major", "course", "class"],
    "academic": ["school", "studied", "grade", "gpa", "course", "class", "subject", "academic", "major", "university"],
    "experience": ["experience", "worked", "project", "volunteer", "intern", "job", "learned", "club"],
    "plan": ["plan", "goal", "future", "career", "after graduat", "hope to", "will ", "aim", "intend"],
    "plans": ["plan", "goal", "future", "career", "after graduat", "hope to", "will ", "aim", "intend"],
    "goal": ["goal", "plan", "aim", "hope", "want to", "future", "career"],
    "goals": ["goal", "plan", "aim", "hope", "want to", "future", "career"],
    "future": ["future", "after graduat", "career", "plan", "goal", "will "],
    "career": ["career", "job", "work", "company", "profession", "future"],
    "graduation": ["after graduat", "graduat", "career", "return", "future"],
    "study": ["study", "studies", "studying", "course", "class", "curriculum", "semester", "research", "learn"],
    "studies": ["study", "studies", "course", "class", "curriculum", "semester", "research", "learn"],
    "research": ["research", "lab", "thesis", "paper", "study", "experiment", "project"],
    "program": ["program", "major", "department", "course", "curriculum", "degree"],
    "major": ["major", "program", "department", "degree", "field"],
    "korea": ["korea", "korean", "seoul", "busan"],
    "korean": ["korean", "korea", "topik", "hangul"],
    "language": ["topik", "korean", "language", "english", "ielts", "toefl"],
    "period": ["year", "semester", "month", "first", "second", "timeline"],
    "degree": ["degree", "program", "major", "bachelor", "master", "semester", "year"],
    "contribute": ["contribut", "help", "bring", "share", "club", "community", "support"],
    "contribution": ["contribut", "help", "bring", "share", "club", "community", "support"],
    "challenge": ["challeng", "difficult", "overc", "problem", "hard", "struggl", "fail"],
    "strengths": ["strength", "good at", "skill", "able to", "confiden"],
    "weaknesses": ["weakness", "improve", "struggl", "difficult"],
}

GENERIC_PHRASES = [
    "since i was young", "since i was a child", "since i was little", "from a young age", "ever since i was a child",
    "i have always been passionate", "i have always dreamed", "it has always been my dream", "dream come true",
    "world-class university", "world class university", "prestigious university", "your esteemed university",
    "your prestigious", "broaden my horizons", "broaden my horizon", "global leader", "global talent",
    "make the world a better place", "change the world", "hard-working person", "hardworking person",
    "i am a hard worker", "korea is a developed country", "korea is a beautiful country", "best university in korea",
    "number one university", "top university in korea", "unique opportunity", "step out of my comfort zone",
    "어릴 때부터", "어렸을 때부터", "세계적인 대학", "명문 대학", "귀교", "글로벌 인재", "시야를 넓히",
]

OVERCLAIMS = ["guaranteed", "100%", "the best student", "number one student", "perfect student", "never failed"]

FUTURE_CUES = re.compile(r"(prepar|aim|goal|plan|hope|want|reach|achiev|target|toward|will|study for|studying for|improv|next)", re.I)

COUNTRIES = {
    "VN": ["Vietnam", "Viet Nam", "Vietnamese"], "UZ": ["Uzbekistan", "Uzbek"], "MN": ["Mongolia", "Mongolian"],
    "NP": ["Nepal", "Nepali", "Nepalese"], "CN": ["China", "Chinese"], "KZ": ["Kazakhstan", "Kazakh", "Kazakhstani"],
    "KG": ["Kyrgyzstan", "Kyrgyz"], "TJ": ["Tajikistan", "Tajik"], "MM": ["Myanmar", "Burma", "Burmese"],
    "ID": ["Indonesia", "Indonesian"], "PH": ["Philippines", "Filipino", "Filipina"], "TH": ["Thailand", "Thai"],
    "BD": ["Bangladesh", "Bangladeshi"], "PK": ["Pakistan", "Pakistani"], "LK": ["Sri Lanka", "Sri Lankan"],
    "IN": ["India", "Indian"], "JP": ["Japan", "Japanese"], "TW": ["Taiwan", "Taiwanese"], "KH": ["Cambodia", "Cambodian"],
    "LA": ["Laos", "Lao", "Laotian"], "MY": ["Malaysia", "Malaysian"], "US": ["United States", "American"],
    "RU": ["Russia", "Russian"], "FR": ["France", "French"], "DE": ["Germany", "German"],
}
_COUNTRY_BY_NAME = {n.lower(): cc for cc, names in COUNTRIES.items() for n in names}
_COUNTRY_ALT = "|".join(sorted((re.escape(n) for names in COUNTRIES.values() for n in names), key=len, reverse=True))

LEVEL_ORDER = {"HIGH_SCHOOL": 1, "ASSOCIATE": 2, "BACHELOR": 3, "TRANSFER": 3, "MASTER": 4, "DOCTORATE": 5, "COMBINED": 5}


@dataclass
class Education:
    level: str
    institution: str
    graduation_year: int | None
    graduation_status: str  # GRADUATED | EXPECTED | IN_PROGRESS
    gpa_value: float | None = None
    gpa_scale_max: float | None = None


@dataclass
class Profile:
    """The structured facts an essay is checked against (built from StudentProfile by the service layer)."""
    nationality: str | None = None
    date_of_birth: date | None = None
    educations: list[Education] = field(default_factory=list)
    languages: dict[str, float] = field(default_factory=dict)  # test → best score (TOPIK level, IELTS band…)


@dataclass
class Target:
    university_name: str | None = None
    university_aliases: list[str] = field(default_factory=list)
    program_name: str | None = None
    other_universities: list[tuple[str, list[str]]] = field(default_factory=list)  # (display name, aliases)
    other_programs: list[str] = field(default_factory=list)  # V6: other program names at the target university


@dataclass
class OwnEssay:
    """V6: another essay by the same student (another application or another essay type), for consistency checks."""
    text: str
    essay_type: str | None = None
    university: str | None = None


# ------------------------------------------------------------------ text helpers

def word_count(text: str) -> int:
    return len(WORD_RE.findall(text or ""))


def sentences(text: str) -> list[tuple[int, int, str]]:
    """(start, end, sentence) — split on . ! ? 。 and line breaks, offsets into the original text."""
    out = []
    # A period followed by a non-space ("3.1", "e.g.x") stays inside the sentence.
    for m in re.finditer(r"(?:[^.!?。\n]|[.!?](?=[^\s.!?]))+[.!?。]*", text or ""):
        s = m.group(0)
        lead = len(s) - len(s.lstrip())
        st = s.strip()
        if st:
            out.append((m.start() + lead, m.start() + lead + len(st), st))
    return out


def sentence_at(text: str, pos: int) -> tuple[int, int, str]:
    for s in sentences(text):
        if s[0] <= pos < s[1]:
            return s
    return (pos, pos, "")


def _norm(s: str) -> str:
    return re.sub(r"[^\w\s]", "", s.lower()).strip()


def fingerprint(f: dict) -> str:
    basis = f"{f['code']}|{_norm(f.get('quote') or '')}|{sorted((f.get('params') or {}).items())!r}"
    return hashlib.sha1(basis.encode("utf-8")).hexdigest()[:32]


def _finding(kind, code, severity, text, *, params=None, quote=None, start=None, end=None, staff_only=False) -> dict:
    return {"kind": kind, "code": code, "severity": severity, "params": params or {}, "text": text, "quote": quote,
            "anchor_start": start, "anchor_end": end, "staff_only": staff_only}


def essay_language(text: str) -> str:
    h, lat = len(HANGUL_RE.findall(text or "")), len(LATIN_RE.findall(text or ""))
    return "ko" if h > lat else "en"


# ------------------------------------------------------------------ limit + language

def check_limit(text: str, word_limit: int | None, char_limit: int | None) -> list[dict]:
    out = []
    if char_limit:
        n = len(text or "")
        if n > char_limit:
            out.append(_finding("LIMIT", "OVER_CHAR_LIMIT", "BLOCKER", f"{n} characters — over the {char_limit}-character limit by {n - char_limit}.",
                                params={"count": n, "limit": char_limit, "over": n - char_limit}))
        elif n < char_limit * 0.6:
            out.append(_finding("LIMIT", "UNDER_CHAR_LENGTH", "WARNING", f"{n} of {char_limit} characters — well under the limit; there is room for more detail.",
                                params={"count": n, "limit": char_limit}))
    if word_limit:
        n = word_count(text)
        if n > word_limit:
            out.append(_finding("LIMIT", "OVER_LIMIT", "BLOCKER", f"{n} words — over the {word_limit}-word limit by {n - word_limit}.",
                                params={"count": n, "limit": word_limit, "over": n - word_limit}))
        elif n < word_limit * 0.6:
            out.append(_finding("LIMIT", "UNDER_LENGTH", "WARNING", f"{n} of {word_limit} words — well under the limit; there is room for more detail.",
                                params={"count": n, "limit": word_limit}))
    return out


def check_language(text: str, required_language: str | None) -> list[dict]:
    if not required_language or word_count(text) < 20:
        return []
    lang = essay_language(text)
    if required_language in ("ko", "en") and lang != required_language:
        return [_finding("LIMIT", "WRONG_LANGUAGE", "WARNING", f"The university asks for this text in {required_language.upper()}.",
                         params={"required": required_language, "found": lang})]
    return []


# ------------------------------------------------------------------ prompt coverage

def prompt_parts(prompt: str | None) -> list[str]:
    """Split a prompt into the questions / clauses it asks for.
    "Describe your motivation for applying, your academic background, and your study and career plans." →
    ["Describe your motivation for applying", "your academic background", "your study and career plans"]."""
    if not prompt:
        return []
    parts: list[str] = []
    for sent in re.split(r"(?<=[?.!;:。])\s+|\n+", prompt.strip()):
        s = sent.strip().strip(".;:")
        if not s:
            continue
        pieces = re.split(r",\s*(?:and\s+|or\s+)?(?=[a-z])|\s+and\s+(?=(?:your|how|why|what|the|any|describe|explain)\b)", s)
        for p in pieces:
            p = p.strip(" ,.;:?")
            if len(WORD_RE.findall(p)) >= 2:
                parts.append(p)
    return parts


def _keywords(part: str) -> list[str]:
    toks = [t.lower() for t in WORD_RE.findall(part)]
    if any(HANGUL_RE.search(t) for t in toks):
        return [t for t in toks if len(t) >= 2][:6]
    return [t for t in toks if len(t) >= 4 and t not in STOPWORDS][:6]


def _covered(keyword: str, lower: str) -> bool:
    if HANGUL_RE.search(keyword):
        return keyword[:2] in lower
    cues = CONCEPTS.get(keyword)
    if cues and any(c in lower for c in cues):
        return True
    stem = keyword[:5] if len(keyword) > 5 else keyword
    return stem in lower


def check_prompt(text: str, prompt: str | None) -> list[dict]:
    """Each clause of the question should be visibly addressed. A heuristic: the reviewer's rubric rating wins."""
    out = []
    lower = (text or "").lower()
    if not prompt or word_count(text) < 30:
        return out
    for part in prompt_parts(prompt):
        kws = _keywords(part)
        if not kws:
            continue
        hits = sum(_covered(k, lower) for k in kws)
        if hits < max(1, (len(kws) + 1) // 2):
            out.append(_finding("PROMPT", "PROMPT_PART_MISSING", "WARNING", f"The question asks: “{part}” — the text may not answer this part yet.",
                                params={"part": part}))
    return out


# ------------------------------------------------------------------ repetition, generic language, clarity

def check_repetition(text: str) -> list[dict]:
    out = []
    seen: dict[str, tuple[int, int, str]] = {}
    reported = set()
    for st, en, s in sentences(text):
        n = _norm(s)
        if len(n.split()) >= 5:
            if n in seen and n not in reported:
                reported.add(n)
                out.append(_finding("REPETITION", "REPEATED_SENTENCE", "WARNING", f"This sentence appears more than once: “{s}”", quote=s, start=st, end=en))
            seen.setdefault(n, (st, en, s))
    toks = [(m.group(0).lower(), m.start(), m.end()) for m in WORD_RE.finditer(text or "")]
    counts: dict[tuple, list[int]] = {}
    for i in range(len(toks) - 4):
        gram = tuple(t[0] for t in toks[i:i + 5])
        if all(g in STOPWORDS for g in gram):
            continue
        counts.setdefault(gram, []).append(i)
    phrases = 0
    covered: set[int] = set()
    for gram, idx in sorted(counts.items(), key=lambda kv: -len(kv[1])):
        non_overlap = []
        for i in idx:
            if not non_overlap or i - non_overlap[-1] >= 5:
                non_overlap.append(i)
        if len(non_overlap) >= 3 and not (set(range(idx[0], idx[0] + 5)) & covered) and phrases < 3:
            i = non_overlap[0]
            phrase = text[toks[i][1]:toks[i + 4][2]]
            covered |= set(range(i, i + 5))
            phrases += 1
            out.append(_finding("REPETITION", "REPEATED_PHRASE", "WARNING", f"“{phrase}” is used {len(non_overlap)} times.",
                                params={"phrase": phrase, "count": len(non_overlap)}, quote=phrase, start=toks[i][1], end=toks[i + 4][2]))
    openers: dict[str, list[tuple[int, int, str]]] = {}
    for st, en, s in sentences(text):
        w = [x.lower() for x in WORD_RE.findall(s)[:3]]
        if len(w) == 3:
            openers.setdefault(" ".join(w), []).append((st, en, s))
    for op, ss in openers.items():
        if len(ss) >= 3:
            st, en, s = ss[0]
            out.append(_finding("REPETITION", "REPEATED_OPENER", "INFO", f"{len(ss)} sentences start with “{op}” — vary how sentences begin.",
                                params={"opener": op, "count": len(ss)}, quote=s, start=st, end=en))
    return out


def check_generic(text: str, target: Target) -> list[dict]:
    out = []
    lower = (text or "").lower()
    for ph in GENERIC_PHRASES:
        i = lower.find(ph)
        if i >= 0:
            quote = text[i:i + len(ph)]
            out.append(_finding("GENERIC", "GENERIC_PHRASE", "WARNING", f"“{quote}” is a phrase many applicants use — a concrete detail from your own experience says more.",
                                params={"phrase": quote}, quote=quote, start=i, end=i + len(ph)))
    if word_count(text) >= 120 and target.university_name:
        names = [target.university_name, *target.university_aliases]
        prog_words = [w.lower() for w in WORD_RE.findall(target.program_name or "") if len(w) >= 5 and w.lower() not in STOPWORDS]
        names_uni = any(n and n.lower() in lower for n in names)
        names_prog = any(w in lower for w in prog_words)
        if not names_uni and not names_prog:
            out.append(_finding("GENERIC", "NOT_SPECIFIC", "WARNING",
                                f"The text never mentions {target.university_name} or the program — as written it could be sent to any university.",
                                params={"university": target.university_name}))
    for oc in OVERCLAIMS:
        i = lower.find(oc)
        if i >= 0:
            quote = text[i:i + len(oc)]
            out.append(_finding("CLARITY", "OVERCLAIM", "WARNING", f"“{quote}” is an absolute claim — reviewers trust evidence more than superlatives.",
                                params={"phrase": quote}, quote=quote, start=i, end=i + len(oc)))
    return out


def check_clarity(text: str) -> list[dict]:
    out = []
    long_ = [(st, en, s) for st, en, s in sentences(text) if word_count(s) > 45]
    for st, en, s in long_[:3]:
        out.append(_finding("CLARITY", "LONG_SENTENCE", "INFO", f"A {word_count(s)}-word sentence — consider splitting it so the reader can follow.",
                            params={"words": word_count(s)}, quote=s, start=st, end=en))
    paragraphs = [p for p in (text or "").split("\n") if p.strip()]
    if len(paragraphs) < 3 and word_count(text) > 180:
        out.append(_finding("CLARITY", "PARAGRAPHS", "INFO", "Break the text into paragraphs so the reader can follow your argument."))
    return out


# ------------------------------------------------------------------ university / program names

def _alias_regex(alias: str) -> re.Pattern:
    if alias.isupper() and len(alias) <= 5:  # acronym: case-sensitive, whole word
        return re.compile(rf"(?<![\w]){re.escape(alias)}(?![\w])")
    if HANGUL_RE.search(alias):
        return re.compile(re.escape(alias))
    return re.compile(rf"(?<![\w]){re.escape(alias)}(?![\w])", re.I)


def check_other_university(text: str, target: Target) -> list[dict]:
    out = []
    own = [a.lower() for a in [target.university_name or "", *target.university_aliases] if a]
    for name, aliases in target.other_universities:
        for alias in aliases:
            m = _alias_regex(alias).search(text or "")
            if not m:
                continue
            # "Pusan National University" contains "Pusan National" — never flag the target's own name.
            window = (text[max(0, m.start() - 40):m.end() + 40]).lower()
            if any(o and o in window and alias.lower() in o for o in own):
                continue
            st, en, s = sentence_at(text, m.start())
            out.append(_finding("OTHER_UNIVERSITY", "OTHER_UNIVERSITY", "BLOCKER",
                                f"Mentions {name} — this text is for {target.university_name}. Check it wasn't copied from another application.",
                                params={"name": name, "target": target.university_name, "found": m.group(0)}, quote=s or m.group(0),
                                start=st if s else m.start(), end=en if s else m.end()))
            break
    return out


def check_names(text: str, target: Target) -> list[dict]:
    """Near-misses of the target university / program name ("Pusan Nationl University", "Kyunghee")."""
    out = []
    toks = [(m.group(0), m.start(), m.end()) for m in WORD_RE.finditer(text or "")]
    exact_all = {a.lower() for a in [target.university_name or "", *target.university_aliases] if a}
    others = {a.lower() for _, al in target.other_universities for a in al}
    candidates = [(a, "UNIVERSITY") for a in [target.university_name, *target.university_aliases] if a and len(a) >= 6 and not a.isupper()]
    if target.program_name:
        prog = re.sub(r"\s*\(.*?\)", "", target.program_name).strip()
        if len(prog) >= 8:
            candidates.append((prog, "PROGRAM"))
    seen = set()
    covered: set[int] = set()
    for name, kind in sorted(candidates, key=lambda c: -len(c[0])):
        n_words = len(name.split())
        compact = name.lower().replace(" ", "").replace("-", "")
        for size in sorted({n_words, max(1, n_words - 1)}, reverse=True):
            for i in range(0, max(0, len(toks) - size + 1)):
                if covered & set(range(i, i + size)):
                    continue
                span = toks[i:i + size]
                found = text[span[0][1]:span[-1][2]]
                if re.search(r"[^\w\s'’-]", found):  # never across punctuation / sentences
                    continue
                fl = found.lower()
                if fl in exact_all or fl in others or fl == name.lower():
                    covered |= set(range(i, i + size))
                    continue
                if not found[:1].isalpha() or not found[:1].isupper():
                    continue
                fc = fl.replace(" ", "").replace("-", "")
                ratio = 0.99 if fc == compact else difflib.SequenceMatcher(a=fc, b=compact).ratio()
                if 0.84 <= ratio < 1.0 and abs(len(fc) - len(compact)) <= 3 and found not in seen:
                    seen.add(found)
                    covered |= set(range(i, i + size))
                    out.append(_finding("NAME", "NAME_MISSPELLED", "BLOCKER" if kind == "UNIVERSITY" else "WARNING",
                                        f"“{found}” — did you mean “{name}”? Names must be exactly right.",
                                        params={"found": found, "expected": name, "kind": kind}, quote=found, start=span[0][1], end=span[-1][2]))
    return out


# ------------------------------------------------------------------ similarity to other documents

def shingles(text: str, n: int = 8) -> list[int]:
    toks = [t.lower() for t in WORD_RE.findall(text or "")]
    return [hash(" ".join(toks[i:i + n])) for i in range(0, max(0, len(toks) - n + 1))]


def check_similarity(text: str, others: list[str], prompt: str | None = None, min_words: int = 60) -> list[dict]:
    """Passages identical to another student's document. Never reveals the other text or whose it is."""
    if word_count(text) < min_words or not others:
        return []
    mine = shingles(text)
    exclude = set(shingles(prompt or ""))
    pool: set[int] = set()
    for o in others:
        pool.update(shingles(o))
    matched = [i for i, h in enumerate(mine) if h in pool and h not in exclude]
    if len(matched) < 5:
        return []
    passages, prev = 0, -10
    for i in matched:
        if i != prev + 1:
            passages += 1
        prev = i
    toks = list(WORD_RE.finditer(text))
    first = matched[0]
    st, en = toks[first].start(), toks[min(first + 7 + 4, len(toks) - 1)].end()
    return [_finding("SIMILARITY", "SIMILAR_TEXT", "BLOCKER",
                     f"{passages} passage(s) are identical to another document in Hangyul. Talk to the student before approving — never share the other text.",
                     params={"passages": passages}, quote=text[st:en], start=st, end=en, staff_only=True)]


# ------------------------------------------------------------------ fact verification against the profile

def _edu_for(sentence: str, eds: list[Education]) -> Education | None:
    s = sentence.lower()
    want = "HIGH_SCHOOL" if "high school" in s or "secondary" in s else "BACHELOR" if re.search(r"universit|college|bachelor", s) else None
    if want:
        m = [e for e in eds if e.level == want]
        if m:
            return m[0]
    with_year = [e for e in eds if e.graduation_year]
    return max(with_year, key=lambda e: e.graduation_year) if with_year else None


def _claim(code, sentence_span, text_fallback, params) -> dict:
    st, en, s = sentence_span
    return _finding("FACT", code, "BLOCKER", text_fallback, params=params, quote=s, start=st, end=en)


def check_facts(text: str, profile: Profile, today: date) -> list[dict]:
    out: list[dict] = []
    seen: set[tuple] = set()

    def add(code, span, fallback, params):
        key = (code, span[0])
        if key not in seen:
            seen.add(key)
            out.append(_claim(code, span, fallback, params))

    eds = profile.educations
    # Graduation year (past or future tense).
    for m in re.finditer(r"\b(?:I\s+)?(will\s+graduate|graduating|expect(?:ed)?\s+to\s+graduate|graduated|graduate)\b[^.!?\n]{0,80}?\b((?:19|20)\d\d)\b", text, re.I):
        span = sentence_at(text, m.start())
        year = int(m.group(2))
        past = m.group(1).lower() == "graduated"
        e = _edu_for(span[2], eds)
        if not e or not e.graduation_year:
            continue
        expected = e.graduation_status in ("EXPECTED", "IN_PROGRESS")
        if year != e.graduation_year or (past and expected and e.graduation_year > today.year):
            add("FACT_GRAD_YEAR", span,
                f"“{span[2]}” — your profile says {'expected graduation' if expected else 'graduated'} {e.graduation_year}. Please check.",
                {"claim_year": year, "profile_year": e.graduation_year, "profile_expected": expected})
    for m in re.finditer(r"((?:19|20)\d\d)\s*년[^.!?\n]{0,20}졸업", text):
        span = sentence_at(text, m.start())
        e = _edu_for(span[2], eds)
        if e and e.graduation_year and int(m.group(1)) != e.graduation_year:
            expected = e.graduation_status in ("EXPECTED", "IN_PROGRESS")
            add("FACT_GRAD_YEAR", span, f"“{span[2]}” — your profile says {e.graduation_year}. Please check.",
                {"claim_year": int(m.group(1)), "profile_year": e.graduation_year, "profile_expected": expected})
    m = re.search(r"\bclass of ((?:19|20)\d\d)\b", text, re.I)
    if m:
        span = sentence_at(text, m.start())
        e = _edu_for(span[2], eds)
        if e and e.graduation_year and int(m.group(1)) != e.graduation_year:
            add("FACT_GRAD_YEAR", span, f"“{span[2]}” — your profile says {e.graduation_year}. Please check.",
                {"claim_year": int(m.group(1)), "profile_year": e.graduation_year, "profile_expected": e.graduation_status != "GRADUATED"})

    # Degree level claimed vs highest education in the profile.
    highest = max((LEVEL_ORDER.get(e.level, 0) for e in eds), default=0)
    highest_level = next((e.level for e in eds if LEVEL_ORDER.get(e.level, 0) == highest), None)
    if eds:
        degree_patterns = [
            (r"\b(?:at|in)\s+(?:my\s+)?university,?\s+I\s+(?:studied|majored|learned|led|took)", "BACHELOR"),
            (r"\bmy\s+(?:bachelor'?s?|undergraduate)\s+(?:degree|studies|program|thesis)", "BACHELOR"),
            (r"\bI\s+(?:hold|have|earned|completed|received|obtained)\s+a\s+bachelor'?s?", "BACHELOR"),
            (r"\bI\s+(?:am|was)\s+(?:currently\s+)?(?:a|an)\s+(?:university|college|undergraduate)\s+student", "BACHELOR"),
            (r"\bI\s+majored\s+in\b", "BACHELOR"),
            (r"\bmy\s+master'?s?\s+(?:degree|thesis|studies|program)", "MASTER"),
            (r"\bI\s+(?:hold|have|earned|completed|received|obtained)\s+a\s+master'?s?", "MASTER"),
            (r"대학(?:교)?에서\s*\S*\s*전공", "BACHELOR"),
        ]
        for pat, level in degree_patterns:
            for m in re.finditer(pat, text, re.I):
                if LEVEL_ORDER[level] > highest:
                    span = sentence_at(text, m.start())
                    add("FACT_DEGREE", span, f"“{span[2]}” — your profile lists {(highest_level or 'no degree').replace('_', ' ').lower()} as your highest education. Please check.",
                        {"claim_level": level, "profile_level": highest_level})

    # GPA.
    gpas = [e for e in eds if e.gpa_value is not None]
    if gpas:
        for m in re.finditer(r"\b(?:GPA|grade point average|average grade)\b(?:\s+(?:of|was|is|:))?\s*(?:is\s+|was\s+)?(\d{1,2}(?:\.\d{1,2})?)(?:\s*(?:/|out of)\s*(\d{1,3}(?:\.\d{1,2})?))?", text, re.I):
            val = float(m.group(1))
            scale = float(m.group(2)) if m.group(2) else None
            ok = any(abs(val - e.gpa_value) <= 0.05 and (scale is None or not e.gpa_scale_max or abs(scale - e.gpa_scale_max) <= 0.05) for e in gpas)
            if not ok:
                span = sentence_at(text, m.start())
                best = gpas[0]
                add("FACT_GPA", span, f"“{span[2]}” — your profile says GPA {best.gpa_value:g}{f'/{best.gpa_scale_max:g}' if best.gpa_scale_max else ''}. Please check.",
                    {"claim": m.group(0).strip(), "profile_gpa": best.gpa_value, "profile_scale": best.gpa_scale_max})

    # Language test levels (TOPIK / IELTS). Future goals ("preparing for TOPIK 5") are not claims.
    topik = profile.languages.get("TOPIK")
    for m in re.finditer(r"\bTOPIK\s*(?:\(?\s*level\s*|lv\.?\s*|Level\s*)?([1-6])\b|\bTOPIK\b[^.!?\n\d]{0,20}?\blevel\s*([1-6])\b|\blevel\s*([1-6])\s+(?:in|on|of)?\s*(?:the\s+)?TOPIK\b|(?:TOPIK|토픽)\s*([1-6])\s*급", text, re.I):
        lvl = int(next(g for g in m.groups() if g))
        before = text[max(0, m.start() - 45):m.start()]
        if FUTURE_CUES.search(before):
            continue
        if topik is None or int(topik) != lvl:
            span = sentence_at(text, m.start())
            add("FACT_TOPIK", span,
                f"“{span[2]}” — " + (f"your profile says TOPIK {int(topik)}. Please check." if topik is not None else "your profile has no TOPIK result yet. Please check or add it."),
                {"claim": lvl, "profile": int(topik) if topik is not None else None})
    ielts = profile.languages.get("IELTS")
    for m in re.finditer(r"\bIELTS\b[^.!?\n\d]{0,25}?(\d(?:\.[05])?)\b", text, re.I):
        before = text[max(0, m.start() - 45):m.start()]
        if FUTURE_CUES.search(before):
            continue
        band = float(m.group(1))
        if ielts is None or abs(ielts - band) > 0.01:
            span = sentence_at(text, m.start())
            add("FACT_IELTS", span,
                f"“{span[2]}” — " + (f"your profile says IELTS {ielts:g}. Please check." if ielts is not None else "your profile has no IELTS result yet. Please check or add it."),
                {"claim": band, "profile": ielts})

    # Nationality / home country.
    if profile.nationality:
        pats = [rf"\bI(?:\s+am|'m|’m)\s+(?:a\s+|an\s+)?({_COUNTRY_ALT})\b(?!\s+(?:language|learner|food|culture|speaker))",
                rf"\b[Aa]s\s+(?:a|an)\s+({_COUNTRY_ALT})\s+(?:student|citizen|national|applicant)\b",
                rf"\bI\s+(?:am|come)\s+from\s+({_COUNTRY_ALT})\b", rf"\bmy\s+(?:home\s+)?country,?\s+({_COUNTRY_ALT})\b",
                rf"\bborn\s+(?:and\s+raised\s+)?in\s+({_COUNTRY_ALT})\b"]
        for pat in pats:
            for m in re.finditer(pat, text):
                cc = _COUNTRY_BY_NAME.get(m.group(1).lower())
                if cc and cc != profile.nationality:
                    span = sentence_at(text, m.start())
                    add("FACT_NATIONALITY", span, f"“{span[2]}” — your profile says your nationality is {profile.nationality}. Please check.",
                        {"claim": cc, "profile": profile.nationality})

    # School name.
    names = [e.institution for e in eds if e.institution and e.institution.strip()]
    if names:
        for m in re.finditer(r"\b(?:graduated(?:\s+in\s+\d{4})?\s+from|studied at|attended|a student at|a student of|student at)\s+(?:the\s+)?((?:[A-Z][\w'’.&-]*\s+){0,6}?(?:High School|Secondary School|University|College|Academy|Institute|Gymnasium|Lyceum|School))\b", text):
            claim = m.group(1)
            cn = _norm(re.sub(r"\(.*?\)", "", claim))
            best = max(difflib.SequenceMatcher(a=cn, b=_norm(re.sub(r"\(.*?\)", "", n))).ratio() for n in names)
            contained = any(cn in _norm(n) or _norm(re.sub(r"\(.*?\)", "", n)) in cn for n in names)
            if best < 0.75 and not contained:
                span = sentence_at(text, m.start())
                add("FACT_SCHOOL", span, f"“{span[2]}” — your profile lists {', '.join(names)}. Please check.",
                    {"claim": claim, "profile": ", ".join(names)})

    # Age.
    if profile.date_of_birth:
        dob = profile.date_of_birth
        age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
        for m in re.finditer(r"\bI(?:\s+am|'m|’m)\s+(\d{2})\s+years?\s+old\b|\bas\s+an?\s+(\d{2})-year-old\b|저는\s*(\d{2})\s*살", text, re.I):
            claimed = int(next(g for g in m.groups() if g))
            if abs(claimed - age) > 1:
                span = sentence_at(text, m.start())
                add("FACT_AGE", span, f"“{span[2]}” — your date of birth in your profile makes you {age}. Please check.",
                    {"claim": claimed, "profile_age": age})
    return out


# ------------------------------------------------------------------ V6: program name validation

def _base_name(name: str) -> str:
    """"M.S. Electrical Engineering (Evening)" → "Electrical Engineering"."""
    base = re.sub(r"\s*\(.*?\)", "", name or "").strip()
    return re.sub(r"^(?:B\.?A\.?|B\.?S\.?|M\.?A\.?|M\.?S\.?|Ph\.?D\.?|MBA|LL\.?M\.?)\s+", "", base).strip()


def check_other_program(text: str, target: Target) -> list[dict]:
    """The text names a *different* program of the target university ("…apply to the Economics and Finance program"
    in an essay for Business Administration) — usually a paragraph reused from another application."""
    if not target.program_name or not target.other_programs:
        return []
    own = _base_name(target.program_name).lower()
    for name in sorted(target.other_programs, key=lambda n: -len(_base_name(n))):
        base = _base_name(name)
        bl = base.lower()
        # Single words ("Economics", "Design") are too often used as plain nouns; overlapping names are not "other".
        if len(base) < 8 or len(base.split()) < 2 or not own or bl in own or own in bl:
            continue
        m = re.search(rf"(?<![\w]){re.escape(base)}(?![\w])", text or "", re.I)
        if not m:
            continue
        st, en, s = sentence_at(text, m.start())
        if own in s.lower():  # "unlike Media and Communication, Business Administration…" — compares, doesn't confuse
            continue
        return [_finding("PROGRAM", "OTHER_PROGRAM", "WARNING",
                         f"Names the {m.group(0)} program — this application is for {target.program_name}. Check the paragraph wasn't reused.",
                         params={"found": m.group(0), "expected": target.program_name}, quote=s or m.group(0),
                         start=st if s else m.start(), end=en if s else m.end())]
    return []


# ------------------------------------------------------------------ V6: consistency across the student's own essays

def extract_claims(text: str) -> list[dict]:
    """Checkable facts the text states about the student: graduation year (per school level), GPA, TOPIK level, IELTS
    band, age, nationality. Future goals ("preparing for TOPIK 5") are not claims. Each claim carries its sentence."""
    out: list[dict] = []
    text = text or ""

    def add(topic, value, display, pos, scale=None):
        st, en, s = sentence_at(text, pos)
        out.append({"topic": topic, "value": value, "display": display, "scale": scale, "start": st, "end": en, "quote": s})

    for m in re.finditer(r"\b(will\s+graduate|graduating|expect(?:ed)?\s+to\s+graduate|graduated|graduate)\b[^.!?\n]{0,80}?\b((?:19|20)\d\d)\b", text, re.I):
        s = sentence_at(text, m.start())[2].lower()
        level = "HIGH_SCHOOL" if ("high school" in s or "secondary" in s) else "BACHELOR" if re.search(r"universit|college|bachelor", s) else "ANY"
        add(f"GRAD_YEAR:{level}", int(m.group(2)), m.group(2), m.start())
    for m in re.finditer(r"((?:19|20)\d\d)\s*년[^.!?\n]{0,20}졸업", text):
        s = sentence_at(text, m.start())[2]
        level = "HIGH_SCHOOL" if "고등학교" in s else "BACHELOR" if "대학" in s else "ANY"
        add(f"GRAD_YEAR:{level}", int(m.group(1)), m.group(1), m.start())
    for m in re.finditer(r"\b(?:GPA|grade point average)\b(?:\s+(?:of|was|is|:))?\s*(?:is\s+|was\s+)?(\d{1,2}(?:\.\d{1,2})?)(?:\s*(?:/|out of)\s*(\d{1,3}(?:\.\d{1,2})?))?", text, re.I):
        scale = float(m.group(2)) if m.group(2) else None
        add("GPA", float(m.group(1)), f"{m.group(1)}{'/' + m.group(2) if m.group(2) else ''}", m.start(), scale)
    for m in re.finditer(r"\bTOPIK\s*(?:\(?\s*level\s*|lv\.?\s*)?([1-6])\b|\bTOPIK\b[^.!?\n\d]{0,20}?\blevel\s*([1-6])\b|\blevel\s*([1-6])\s+(?:in|on|of)?\s*(?:the\s+)?TOPIK\b|(?:TOPIK|토픽)\s*([1-6])\s*급", text, re.I):
        if FUTURE_CUES.search(text[max(0, m.start() - 45):m.start()]):
            continue
        lvl = int(next(g for g in m.groups() if g))
        add("TOPIK", lvl, f"TOPIK {lvl}", m.start())
    for m in re.finditer(r"\bIELTS\b[^.!?\n\d]{0,25}?(\d(?:\.[05])?)\b", text, re.I):
        if FUTURE_CUES.search(text[max(0, m.start() - 45):m.start()]):
            continue
        add("IELTS", float(m.group(1)), f"IELTS {m.group(1)}", m.start())
    for m in re.finditer(r"\bI(?:\s+am|'m|’m)\s+(\d{2})\s+years?\s+old\b|\bas\s+an?\s+(\d{2})-year-old\b|저는\s*(\d{2})\s*살", text, re.I):
        age = int(next(g for g in m.groups() if g))
        add("AGE", age, str(age), m.start())
    for pat in (rf"\bI\s+(?:am|come)\s+from\s+({_COUNTRY_ALT})\b", rf"\bborn\s+(?:and\s+raised\s+)?in\s+({_COUNTRY_ALT})\b",
                rf"\b[Aa]s\s+(?:a|an)\s+({_COUNTRY_ALT})\s+(?:student|citizen|national|applicant)\b"):
        for m in re.finditer(pat, text):
            cc = _COUNTRY_BY_NAME.get(m.group(1).lower())
            if cc:
                add("NATIONALITY", cc, m.group(1), m.start())
    return out


def _conflict(a: dict, b: dict) -> bool:
    if a["topic"] != b["topic"]:
        return False
    if a["topic"] == "GPA":
        sa, sb = a["scale"], b["scale"]
        if sa and sb and abs(sa - sb) > 0.05:
            return False  # different scales — cannot compare
        if (sa is None) != (sb is None) and (a["value"] <= 5) != (b["value"] <= 5):
            return False
        return abs(a["value"] - b["value"]) > 0.05
    if a["topic"] == "AGE":
        return abs(a["value"] - b["value"]) > 1  # essays written a year apart may both be right
    if a["topic"] == "IELTS":
        return abs(a["value"] - b["value"]) > 0.01
    return a["value"] != b["value"]


def check_cross_application(text: str, own_essays: list[OwnEssay] | None) -> list[dict]:
    """Conflicting facts between this essay and the same student's other essays (other applications, other essay
    types): a university comparing documents notices. One finding per fact and other essay; the profile check says which
    one matches the profile — this check only says they disagree."""
    if not own_essays:
        return []
    mine = extract_claims(text)
    if not mine:
        return []
    out, seen = [], set()
    for o in own_essays:
        theirs = extract_claims(o.text)
        for c in mine:
            for d in theirs:
                key = (c["topic"], o.essay_type, o.university)
                if key in seen or not _conflict(c, d):
                    continue
                seen.add(key)
                label = " · ".join(x for x in ((o.essay_type or "").replace("_", " ").capitalize(), o.university) if x) or "other essay"
                out.append(_finding("CONSISTENCY", "CROSS_APP_CONFLICT", "WARNING",
                                    f"This text says {c['display']}; your {label} says {d['display']}. Use the same fact everywhere.",
                                    params={"topic": c["topic"].split(":")[0], "claim": c["display"], "other": d["display"],
                                            "other_type": o.essay_type, "other_university": o.university},
                                    quote=c["quote"], start=c["start"], end=c["end"]))
    return out


# ------------------------------------------------------------------ all checks

def run_all(text: str, *, prompt: str | None, word_limit: int | None, char_limit: int | None, required_language: str | None,
            profile: Profile, target: Target, others: list[str], today: date, own_essays: list[OwnEssay] | None = None) -> list[dict]:
    findings = (
        check_limit(text, word_limit, char_limit)
        + check_language(text, required_language)
        + check_prompt(text, prompt)
        + check_facts(text, profile, today)
        + check_other_university(text, target)
        + check_names(text, target)
        + check_other_program(text, target)
        + check_cross_application(text, own_essays)
        + check_repetition(text)
        + check_generic(text, target)
        + check_clarity(text)
        + check_similarity(text, others, prompt)
    )
    for f in findings:
        f["fingerprint"] = fingerprint(f)
    # One finding per fingerprint.
    uniq: dict[str, dict] = {}
    for f in findings:
        uniq.setdefault(f["fingerprint"], f)
    return list(uniq.values())
