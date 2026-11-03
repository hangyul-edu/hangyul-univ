"""Load the committed institution directory into the database (V12).

The dataset is produced by ``scripts/catalog/import_korean_universities.py`` from 대학알리미, Study in Korea and
Wikidata, and committed as ``app/data/korean_institutions.json``. This loader only transfers it; it invents
nothing and defaults nothing, so a field missing from the dataset stays null in the row.

It is idempotent and matches on ``academyinfo_id``, the registry's own stable key, so re-running after a new
disclosure year updates names, regions and certifications in place rather than creating a second row for a
renamed institution.
"""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Institution, University

DATA = Path(__file__).resolve().parents[1] / "data" / "korean_institutions.json"
#: V17 — the verified-facts cache produced by `scripts/catalog/enrich_universities.py`. Optional on
#: purpose: a checkout without it still seeds a complete directory, it just has no founding years or
#: official channels, and every public page composes around what is missing rather than failing.
ENRICHMENT = Path(__file__).resolve().parents[1] / "data" / "university_enrichment.json"
#: V20 — the canonical university content record produced by ``scripts/universities/*`` (REPORT §216.3).
#: It supersedes the V17 cache for everything it carries and is the only source for the fields the
#: public page added in V20: the official destinations read from the institution's own site, the
#: verified channel and introduction video, the rights-checked logo, and the reviewed philosophy.
CONTENT = Path(__file__).resolve().parents[1] / "data" / "university_content.json"

#: Keys the content record **owns outright**. A merge that let the old cache fill one of these back in
#: would be a rights regression, not a convenience: V17 recorded five CC BY-SA logos that V20's licence
#: re-check refused, and the refusal is expressed by the key being *absent* from the content record.
CONTENT_OWNED = ("logo", "hero", "youtube", "media", "education_philosophy")


def _date(value: str | None) -> date | None:
    return date.fromisoformat(value) if value else None


def load_dataset() -> dict[str, Any]:
    return json.loads(DATA.read_text(encoding="utf-8"))


def load_enrichment() -> dict[str, Any]:
    """The V17 Wikidata cache merged under the V20 content record, per slug.

    Both files are optional: a checkout without either still seeds a complete directory, it just has no
    founding years and no official channels, and every public page composes around what is missing
    rather than failing (§211.2's "a section with nothing to put in it does not render").
    """
    base: dict[str, Any] = {}
    if ENRICHMENT.exists():
        base = json.loads(ENRICHMENT.read_text(encoding="utf-8")).get("records") or {}
    if not CONTENT.exists():
        return base
    content = json.loads(CONTENT.read_text(encoding="utf-8")).get("records") or {}
    merged: dict[str, Any] = {}
    for slug in set(base) | set(content):
        under = {k: v for k, v in (base.get(slug) or {}).items() if k not in CONTENT_OWNED}
        merged[slug] = {**under, **(content.get(slug) or {})}
    _merge_v27(merged)
    return merged


#: V27 (REPORT §355, brief §5): an official film made for overseas students beats the domestic brand film.
VIDEO_PURPOSE_RANK = {"INTL_RECRUITMENT": 0, "INTL_CAMPUS_INTRO": 1, "ENGLISH_INTRO": 2, "CAMPUS_TOUR": 3, "GENERAL_PROMO": 4}


def _merge_v27(merged: dict[str, Any]) -> None:
    """The V27 facts files become the record's ``intl`` block; the best-purpose verified film leads ``youtube``."""
    from app.seed.v27_gks import gks_by_name
    from app.seed.v27_research import read_all  # local: keeps the V12 loader importable without the research folder

    # Official GKS participation (NIIED guidelines) for every institution the lists name — not only the researched 25.
    slug_by_name = {r["name_ko"]: r["slug"] for r in load_dataset()["institutions"] if r.get("status") == "ACTIVE"}
    gks, _unmatched = gks_by_name(set(slug_by_name))
    for name, entries in gks.items():
        merged.setdefault(slug_by_name[name], {})["gks"] = {"programmes": entries, "source": "NIIED GKS guidelines"}

    for slug, doc in read_all("facts").items():
        rec = merged.setdefault(slug, {})
        rec["intl"] = {
            "researched_at": doc.get("researched_at"),
            "links": {k: v for k, v in (doc.get("links") or {}).items() if v and v.get("url")},
            **{k: v for k, v in (doc.get("international") or {}).items() if v not in (None, [], {})},
            "sources": [{k: s.get(k) for k in ("id", "url", "name", "kind", "publication_date")} for s in doc.get("sources") or []],
            "gaps": doc.get("gaps") or [],
        }
        films = sorted((v for v in doc.get("videos") or [] if v.get("video_id") and v.get("oembed_ok") and v.get("purpose") in VIDEO_PURPOSE_RANK),
                       key=lambda v: VIDEO_PURPOSE_RANK[v["purpose"]])
        if not films:
            continue
        yt = dict(rec.get("youtube") or {})
        current_rank = VIDEO_PURPOSE_RANK.get(yt.get("purpose") or "GENERAL_PROMO", 4)
        best = films[0]
        yt["videos"] = [{k: v.get(k) for k in ("video_id", "title", "purpose", "language", "channel_id", "channel_title")} for v in films[:4]]
        if VIDEO_PURPOSE_RANK[best["purpose"]] < current_rank or not yt.get("video_id"):
            yt.update({"video_id": best["video_id"], "video_title": best.get("title"), "purpose": best["purpose"],
                       "video_language": best.get("language"), "video_found_via": "v27:official-research",
                       "verified_at": doc.get("researched_at"), "verification_status": "VERIFIED_OFFICIAL"})
            yt.setdefault("channel_id", best.get("channel_id"))
            yt.setdefault("channel_title", best.get("channel_title"))
            if best.get("channel_id") and not yt.get("channel_url"):
                yt["channel_url"] = f"https://www.youtube.com/channel/{best['channel_id']}"
            yt.pop("poster", None)  # the V23 poster size belonged to the previous film
            yt.pop("poster_review", None)
        else:
            yt.setdefault("purpose", "GENERAL_PROMO")
        rec["youtube"] = yt


def seed_institutions(db: Session) -> int:
    """Upsert every institution in the dataset. Returns the number of rows written."""
    doc = load_dataset()
    existing = {i.academyinfo_id: i for i in db.scalars(select(Institution)).all()}
    # The directory links to the application catalogue where Hangyul already holds verified admission data.
    # Matched on the catalogue's own slug, which the V11 catalogue seed derives from the English name.
    catalog_by_slug = {u.slug: u for u in db.scalars(select(University)).all()}
    enrichment = load_enrichment()

    written = 0
    for rec in doc["institutions"]:
        ieqas = rec.get("ieqas") or {}
        intl = (rec.get("sources") or {}).get("international") or {}
        fields = {
            "slug": rec["slug"],
            "name_ko": rec["name_ko"],
            "name_en": rec.get("name_en") or (enrichment.get(rec["slug"]) or {}).get("name_en"),
            "registry_name_ko": rec.get("registry_name_ko"),
            "institution_type": rec["institution_type"],
            "establishment": rec["establishment"],
            "establishment_source": rec.get("establishment_source"),
            "region": rec["region"],
            "status": rec["status"],
            "withdrawn_at": _date(rec.get("withdrawn_at")),
            # The registry's URL wins where it has one; Wikidata fills the 144 it does not.
            "website_url": rec.get("website_url") or (enrichment.get(rec["slug"]) or {}).get("website_url"),
            "latitude": rec.get("latitude"),
            "longitude": rec.get("longitude"),
            "major_count": rec.get("major_count"),
            "ieqas_certified": bool(ieqas.get("certified")),
            "ieqas_excellent": bool(ieqas.get("excellent")),
            "ieqas_language_programme": bool(ieqas.get("language_programme")),
            "ieqas_checked_on": _date(intl.get("checked")),
            "last_verified": _date(rec.get("last_verified")),
            "other_campuses": rec.get("other_campuses"),
            "sources": rec.get("sources"),
            "catalog_university_id": getattr(catalog_by_slug.get(rec["slug"]), "id", None),
            "enrichment": enrichment.get(rec["slug"]),
        }
        row = existing.get(rec["academyinfo_id"])
        if row is None:
            db.add(Institution(academyinfo_id=rec["academyinfo_id"], **fields))
        else:
            for key, value in fields.items():
                setattr(row, key, value)
        written += 1
    db.flush()
    return written
