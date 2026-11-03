"""V25 — docs/qa/v25/UNIVERSITY_PHOTO_SEARCH.csv: per institution, every sourcing route and what it found (brief §8).

    python3 scripts/universities/v25-photo-search.py

Built only from the recorded search logs, never typed by hand:
  V22  server/app/data/raw/v22_wikidata.json, v22_official.json, v22_youtube.json   (Wikidata, official site, official channel)
  V24  server/app/data/raw/v24_media_candidates.json                              (Commons ×4 routes, Openverse, KOGL, 공유마당)
  V25  server/app/data/raw/v25_geo_candidates.json      (Commons geosearch, 700 m around the campus)
       server/app/data/raw/v25_wiki_candidates.json     (images inside the ko/en Wikipedia article)
       server/app/data/raw/v25_category_candidates.json (Commons category trees, 3 levels)
       server/app/data/raw/v25_official_rights.json     (reuse terms stated on the official homepage / English site)
       docs/qa/v25/media-review/poster-review.json       (official film posters, classified by a person)
       docs/qa/v25/MANUAL_MEDIA_ACQUISITION.md leads      (공유마당 KOGL-1 originals behind a robots.txt that blocks agents)
A route that did not apply is written as `n/a: <why>`, never as a blank or a "yes".
"""
from __future__ import annotations

import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / 'server/app/data/raw'
load = lambda p, d=None: json.loads(p.read_text()) if p.exists() else d  # noqa: E731

reg = {i['slug']: i for i in load(ROOT / 'server/app/data/korean_institutions.json')['institutions']}
content = load(ROOT / 'server/app/data/university_content.json')['records']
before = load(ROOT / 'docs/qa/v25/_coverage_before.json')
v24 = load(RAW / 'v24_media_candidates.json')['records']
v24 = v24 if isinstance(v24, dict) else {x['slug']: x for x in v24}
wd = load(RAW / 'v22_wikidata.json')['records']
off = load(RAW / 'v22_official.json', {}).get('records', {})
geo = load(RAW / 'v25_geo_candidates.json', {'records': {}})['records']
wiki = load(RAW / 'v25_wiki_candidates.json', {'records': {}})['records']
cat = load(RAW / 'v25_category_candidates.json', {'records': {}})['records']
rights = load(RAW / 'v25_official_rights.json', {'records': {}})['records']
posters = load(ROOT / 'docs/qa/v25/media-review/poster-review.json', {'records': {}})['records']
leads = {}
for s, r in v24.items():
    for l in r.get('leads', []):
        leads.setdefault(s, []).append(l)
imports = load(ROOT / 'docs/qa/v25/media-review/import-log.json', [])
applied = {}
for x in imports:
    if x.get('result') == 'APPLIED':
        applied.setdefault(x['slug'], []).append(x)


def visual(slug: str) -> str:
    rec = content.get(slug) or {}
    if (rec.get('media') or {}).get('hero'):
        return 'CAMPUS_PHOTO'
    yt = rec.get('youtube') or {}
    if yt.get('video_id') and yt.get('poster_review') == 'CAMPUS_SCENE':
        return 'OFFICIAL_FILM_POSTER'
    if (rec.get('logo') or {}).get('url'):
        return 'LOGO_IDENTITY'
    return 'IDENTITY'


def att(slug: str, route: str) -> list[dict]:
    return [a for a in (v24.get(slug) or {}).get('attempts', []) if a['route'] == route]


rows = []
for slug, inst in sorted(reg.items()):
    had = before[slug]['has_real_photo'] == 'yes'
    now = visual(slug)
    w = wd.get(slug) or {}
    o = off.get(slug) or {}
    rt = rights.get(slug)
    g, wk, ct = geo.get(slug), wiki.get(slug), cat.get(slug)
    cands = sum(len([f for f in (x or {}).get('files', []) if f.get('verdict') == 'CANDIDATE']) for x in (g, wk, ct))
    cands += len((v24.get(slug) or {}).get('candidates', [])) + len(leads.get(slug, []))
    acc = applied.get(slug, [])

    def site(kind):
        if had and slug not in v24:
            return 'n/a: had a campus photograph before V25 (re-audited on the hero sheets)'
        pages = (rt or {}).get('pages', [])
        if kind == 'official':
            parts = [f"{p['url']} → {p['terms']}" for p in pages[:1]]
            return '; '.join(parts) or ('V22 read ' + o.get('url', '') if o.get('url') else (rt or {}).get('outcome', 'no site on record'))
        if kind == 'english':
            return '; '.join(f"{p['url']} → {p['terms']}" for p in pages[1:2]) or 'no separate English site on record'
        return ''
    yt = (content.get(slug) or {}).get('youtube') or {}
    rej = []
    if not acc and now != 'CAMPUS_PHOTO':
        if cands == 0:
            rej.append('no candidate on any automated route')
        else:
            rej.append(f'{cands} candidate(s) viewed on V25 sheets and refused (not this campus / cars / people / signage / too dark)')
    blocker = ''
    if now != 'CAMPUS_PHOTO':
        t = (rt or {}).get('outcome')
        blocker = {'RESERVED': 'official site reserves all rights (무단 전재 금지 / ©)', 'SILENT': 'official site states no licence (all rights reserved by default)',
                   'BLOCKED': 'official site robots-blocked or unreachable for our agent', 'NO_SITE_ON_RECORD': 'no official site on record',
                   'OPEN_KOGL_OTHER': '공공누리 type 2–4 only (no commercial use / no change)'}.get(t or '', '')
    manual = ''
    if leads.get(slug):
        manual = f"{len(leads[slug])} 공유마당 KOGL-1 original(s) to download by hand — docs/qa/v25/MANUAL_MEDIA_ACQUISITION.md"
    elif now != 'CAMPUS_PHOTO':
        manual = 'ask the institution’s PR office for a press-kit photograph licensed for reuse, or commission photography (OWNER_AUTHORISED)'
    rows.append({
        'slug': slug, 'name_ko': inst['name_ko'], 'name_en': before[slug]['name_en'],
        'current_visual': now, 'visual_before_v25': 'CAMPUS_PHOTO' if had else before[slug]['primary'],
        'official_site_checked': site('official'),
        'english_site_checked': site('english'),
        'international_office_checked': ((content.get(slug) or {}).get('international_office_url') or 'not found on the official site') if not had else 'n/a: had a photograph',
        'press_center_checked': 'homepage terms recorded (press/PR pages carry the site-wide terms); no reusable press-kit licence found' if rt else 'n/a: had a photograph',
        'commons_checked': ('; '.join(a['outcome'][:70] for a in att(slug, 'commons')[:2]) or ('category tree (V25): ' + str(len((ct or {}).get('files', []))) + ' files' if ct else 'V22 category + title search')),
        'wikidata_checked': f"{w.get('qid') or 'no item'} · P18 {len(w.get('images') or [])}",
        'openverse_checked': f"{len(att(slug, 'openverse'))} queries (V24)" if att(slug, 'openverse') else 'n/a: had a photograph before V24',
        'kogl_checked': (att(slug, 'kogl')[0]['outcome'][:90] if att(slug, 'kogl') else 'n/a'),
        'gongumadang_checked': (att(slug, 'gongu')[0]['outcome'][:90] if att(slug, 'gongu') else 'n/a'),
        'official_video_checked': (f"{yt.get('video_id')} poster {yt.get('poster_review', 'not reviewed')}" if yt.get('video_id') else 'no verified official film'),
        'commercial_asset_checked': 'none held by Hangyul (MEDIA_LICENSE_AUDIT: COMMERCIAL_NO_ATTRIBUTION = 0)',
        'owner_asset_checked': 'owner drop holds crests only (23), no campus photographs',
        'geosearch_v25': (f"{(g or {}).get('coord', {}).get('source', '')}: {len((g or {}).get('files', []))} files ≤700 m" if g else 'n/a'),
        'wikipedia_article_v25': (f"{len((wk or {}).get('articles', []))} article(s), {len((wk or {}).get('files', []))} images" if wk else 'n/a'),
        'candidate_count': cands,
        'accepted_asset': '; '.join(f"{x['role']}: {x['title']}" for x in acc),
        'rejection_reason': '; '.join(rej),
        'rights_blocker': blocker,
        'manual_action_required': manual,
    })
out = ROOT / 'docs/qa/v25/UNIVERSITY_PHOTO_SEARCH.csv'
with out.open('w', newline='') as f:
    wr = csv.DictWriter(f, fieldnames=list(rows[0].keys()), quoting=csv.QUOTE_ALL)
    wr.writeheader(); wr.writerows(rows)
from collections import Counter
print(len(rows), Counter(r['current_visual'] for r in rows))
print('manual leads', sum(1 for r in rows if '공유마당' in r['manual_action_required']), 'rights-blocked', sum(1 for r in rows if r['rights_blocker']))
