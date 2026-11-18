#!/usr/bin/env python3
"""Docs gate: root layout + link integrity.  Run: python3 scripts/docs/check-links.py [--all]

Root gates (docs/):
  * at most 20 top-level files, every one of them Markdown (*.md)
  * docs/REPORT.md is at most 1,500 lines
Link checks, for README.md and every docs/*.md (with --all also every tracked *.md under docs/ subfolders except
docs/qa/v*, which are frozen historical evidence):
  * every relative Markdown link [text](target) and image ![alt](target) resolves to an existing file or directory
  * every #anchor into a Markdown file matches a heading there
  * (README.md and docs/*.md only) every inline-code path that starts with docs/ and names a concrete file or
    folder exists
External links (http, https, mailto, tel) are not fetched.  Standard library only.  Exit 1 on any finding.
"""
from __future__ import annotations

import re
import sys
import unicodedata
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parents[2]
DOCS = ROOT / "docs"
MAX_ROOT_FILES = 20
MAX_REPORT_LINES = 1500

LINK = re.compile(r"!?\[(?:[^\]\[]|\[[^\]]*\])*\]\(\s*<?([^)\s>]+)>?(?:\s+\"[^\"]*\")?\s*\)")
CODE_PATH = re.compile(r"`(docs/[^`\s]+)`")
FENCE = re.compile(r"^(```|~~~)")
HEADING = re.compile(r"^#{1,6}\s+(.*?)\s*#*\s*$")
PLACEHOLDER = re.compile(r"[<>*{}…]|\.\.\.|vNN|\$")


def slug(heading: str) -> str:
    """GitHub-style heading anchor."""
    text = re.sub(r"`([^`]*)`", r"\1", heading)
    text = re.sub(r"!?\[([^\]]*)\]\([^)]*\)", r"\1", text)
    text = re.sub(r"[*_~]", "", text).strip().lower()
    out = []
    for ch in text:
        cat = unicodedata.category(ch)
        if ch in " -":
            out.append("-")
        elif ch == "_" or cat[0] in "LN" or cat == "Mn" or cat == "Mc":
            out.append(ch)
    return "".join(out)


def body_lines(path: Path):
    """Yield (line_no, text) outside fenced code blocks."""
    fenced = False
    for no, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if FENCE.match(line.strip()):
            fenced = not fenced
            continue
        if not fenced:
            yield no, line


_anchor_cache: dict[Path, set[str]] = {}


def anchors(path: Path) -> set[str]:
    if path not in _anchor_cache:
        seen: dict[str, int] = {}
        found: set[str] = set()
        for _, line in body_lines(path):
            m = HEADING.match(line)
            if not m:
                continue
            base = slug(m.group(1))
            n = seen.get(base, 0)
            seen[base] = n + 1
            found.add(base if n == 0 else f"{base}-{n}")
        _anchor_cache[path] = found
    return _anchor_cache[path]


def check_file(path: Path, problems: list[str], code_paths: bool = True) -> int:
    count = 0
    rel = path.relative_to(ROOT)
    for no, line in body_lines(path):
        prose = re.sub(r"`[^`]*`", "", line)  # links inside inline code are examples, not links
        for m in LINK.finditer(prose):
            target = m.group(1)
            if re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*:", target) or target.startswith("//"):
                continue
            count += 1
            raw, _, frag = target.partition("#")
            dest = path if raw == "" else (path.parent / unquote(raw)).resolve()
            if not dest.exists():
                problems.append(f"{rel}:{no}: broken link -> {target}")
                continue
            if frag and dest.is_file() and dest.suffix.lower() == ".md":
                if unquote(frag).lower() not in anchors(dest):
                    problems.append(f"{rel}:{no}: missing anchor -> {target}")
        for m in (CODE_PATH.finditer(line) if code_paths else ()):
            ref = m.group(1).rstrip(".,;:)")
            if PLACEHOLDER.search(ref):
                continue
            count += 1
            if not (ROOT / ref.split("#")[0]).exists():
                problems.append(f"{rel}:{no}: path in code span does not exist -> {ref}")
    return count


def main() -> int:
    problems: list[str] = []

    entries = sorted(p for p in DOCS.iterdir() if p.is_file() and not p.name.startswith("."))
    if len(entries) > MAX_ROOT_FILES:
        problems.append(f"docs/: {len(entries)} top-level files (max {MAX_ROOT_FILES})")
    for p in entries:
        if p.suffix != ".md":
            problems.append(f"docs/{p.name}: top-level file is not Markdown")
    report = DOCS / "REPORT.md"
    report_lines = len(report.read_text(encoding="utf-8").splitlines()) if report.exists() else 0
    if not report.exists():
        problems.append("docs/REPORT.md is missing")
    elif report_lines > MAX_REPORT_LINES:
        problems.append(f"docs/REPORT.md: {report_lines} lines (max {MAX_REPORT_LINES})")

    targets = [ROOT / "README.md"] + [p for p in entries if p.suffix == ".md"]
    if "--all" in sys.argv:
        for p in sorted(DOCS.rglob("*.md")):
            if p.parent == DOCS:
                continue
            parts = p.relative_to(DOCS).parts
            if parts[0] == "qa" and re.fullmatch(r"v\d+", parts[1] if len(parts) > 1 else ""):
                continue
            targets.append(p)

    # Code-span paths are enforced for the canonical docs only; detail files under subfolders are dated records that
    # may name evidence since removed (git history).
    checked = sum(check_file(p, problems, code_paths=p.parent in (ROOT, DOCS)) for p in targets if p.exists())

    print(f"docs root: {len(entries)} top-level files (max {MAX_ROOT_FILES}), "
          f"{sum(1 for p in entries if p.suffix == '.md')} Markdown; REPORT.md {report_lines} lines (max {MAX_REPORT_LINES})")
    print(f"checked {checked} links and paths in {len(targets)} files")
    for line in problems:
        print("FAIL  " + line)
    print(f"{len(problems)} broken")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
