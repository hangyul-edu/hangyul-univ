"""Deterministic essay pre-check. It flags structure gaps; it never writes content or invents achievements.

An LLM-assisted reviewer can be plugged in behind `precheck` later; its output must be suggestions only,
shown alongside the student's own text, with the student's voice preserved.
"""
import difflib
import re

SECTIONS = {
    "PERSONAL_STATEMENT": [
        ("motivation", ["why", "motivat", "interest", "passion", "decid", "because"]),
        ("background", ["studied", "experience", "school", "project", "worked", "learned"]),
        ("korea", ["korea", "korean", "seoul", "busan"]),
        ("goals", ["goal", "future", "career", "plan", "after graduat", "hope to"]),
    ],
    "STUDY_PLAN": [
        ("objectives", ["objective", "goal", "aim", "purpose"]),
        ("curriculum", ["course", "curriculum", "semester", "subject", "class"]),
        ("language", ["topik", "korean language", "language"]),
        ("timeline", ["first year", "second year", "semester", "month", "year"]),
        ("after", ["after graduat", "career", "return", "future"]),
    ],
}


def word_count(text: str) -> int:
    return len(re.findall(r"\b[\w'’-]+\b", text, flags=re.UNICODE))


def precheck(essay_type: str, body: str, prompt: str | None, word_limit: int | None) -> list[dict]:
    lower = body.lower()
    checks: list[dict] = []
    wc = word_count(body)
    if word_limit:
        if wc > word_limit:
            checks.append({"level": "error", "code": "OVER_LIMIT", "text": f"{wc} words — over the {word_limit}-word limit by {wc - word_limit}."})
        elif wc < word_limit * 0.6:
            checks.append({"level": "warning", "code": "UNDER_LENGTH", "text": f"{wc} words — well under the {word_limit}-word limit; consider adding detail."})
        else:
            checks.append({"level": "ok", "code": "LENGTH_OK", "text": f"{wc} of {word_limit} words."})
    for key, cues in SECTIONS.get(essay_type, []):
        present = any(c in lower for c in cues)
        checks.append(
            {
                "level": "ok" if present else "warning",
                "code": f"SECTION_{key.upper()}",
                "text": ("Covers " if present else "Consider covering ") + key.replace("_", " ") + ".",
            }
        )
    if prompt:
        keywords = {w for w in re.findall(r"[a-zA-Z]{6,}", prompt.lower())} - {"please", "describe", "should", "explain"}
        hits = [k for k in keywords if k in lower]
        if keywords and len(hits) < max(1, len(keywords) // 3):
            checks.append({"level": "warning", "code": "PROMPT_ALIGNMENT", "text": "The draft may not directly answer the university's question."})
    paragraphs = [p for p in body.split("\n") if p.strip()]
    if len(paragraphs) < 3 and wc > 150:
        checks.append({"level": "warning", "code": "PARAGRAPHS", "text": "Break the text into paragraphs so reviewers can follow it."})
    if re.search(r"\b(guaranteed|100%|best student|number one)\b", lower):
        checks.append({"level": "warning", "code": "OVERCLAIM", "text": "Avoid absolute claims; show evidence instead."})
    return checks


def diff(a: str, b: str) -> list[dict]:
    """Word-level diff for the version comparison view."""
    ta, tb = re.findall(r"\S+|\s+", a), re.findall(r"\S+|\s+", b)
    out = []
    for op, i1, i2, j1, j2 in difflib.SequenceMatcher(a=ta, b=tb, autojunk=False).get_opcodes():
        if op == "equal":
            out.append({"op": "equal", "text": "".join(ta[i1:i2])})
        if op in ("delete", "replace"):
            out.append({"op": "delete", "text": "".join(ta[i1:i2])})
        if op in ("insert", "replace"):
            out.append({"op": "insert", "text": "".join(tb[j1:j2])})
    return out
