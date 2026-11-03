"""V24 — import photographs a person picked on Wikimedia Commons (REPORT §293).

Two modes, both reading the file's rights from Commons itself (extmetadata), never from the picker:

  python3 scripts/universities/v24-import-picked.py preview <out-dir> "File:A.jpg" ["File:B.jpg" …]
      downloads a 1200 px rendition of each into <out-dir>, prints licence / author / size, makes a contact sheet.

  python3 scripts/universities/v24-import-picked.py apply <picks.json>
      picks.json: [{"slug": "...", "title": "File:...", "role": "hero"|"gallery", "focal_x": 50, "focal_y": 45,
                    "replace_hero_to_gallery": true, "why": "..."}]
      For each pick: refuses anything that is not a free licence with a named author (the credit needs one) and
      anything already used by another institution; downloads Commons' own ≤2400 px rendition (resized, never
      cropped); writes 640/1200/2400 JPEGs to both public/media folders; appends the credit to credits.json; and
      puts the record into server/app/data/university_content.json with full rights metadata.
"""
from __future__ import annotations

import datetime as dt
import html
import io
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
CONTENT = ROOT / 'server/app/data/university_content.json'
CREDITS = ROOT / 'apps/marketing-web/src/media/credits.json'
MEDIA = [ROOT / 'apps/marketing-web/public/media', ROOT / 'apps/student-web/public/media']
UA = 'HangyulUniv-media/1.0 (support@talkhangyul.com)'
TODAY = dt.date.today().isoformat()
FREE = re.compile(r'^(CC0|Public domain|PD|CC BY(-SA)? [1-4]\.0( kr| [a-z]{2})?|CC BY(-SA)? 2\.5|KOGL Type 1)', re.I)
LICENCE_URL = {
    'CC BY 4.0': 'https://creativecommons.org/licenses/by/4.0/', 'CC BY-SA 4.0': 'https://creativecommons.org/licenses/by-sa/4.0/',
    'CC BY 3.0': 'https://creativecommons.org/licenses/by/3.0/', 'CC BY-SA 3.0': 'https://creativecommons.org/licenses/by-sa/3.0/',
    'CC BY 2.0': 'https://creativecommons.org/licenses/by/2.0/', 'CC BY-SA 2.0': 'https://creativecommons.org/licenses/by-sa/2.0/',
    'CC0': 'https://creativecommons.org/publicdomain/zero/1.0/',
}


def get(url: str) -> bytes:
    last = None
    for attempt in range(6):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=60) as r:
                return r.read()
        except Exception as e:  # noqa: BLE001 — Commons rate limits (429) briefly; back off and retry
            last = e
            time.sleep(5 + attempt * 10)
    raise RuntimeError(f'failed ({last}): {url}')


def info(title: str, width: int) -> dict:
    q = urllib.parse.urlencode({'action': 'query', 'titles': title, 'prop': 'imageinfo', 'iiprop': 'url|size|extmetadata',
                                'iiurlwidth': width, 'format': 'json'})
    page = next(iter(json.loads(get(f'https://commons.wikimedia.org/w/api.php?{q}'))['query']['pages'].values()))
    ii = page['imageinfo'][0]
    md = ii.get('extmetadata', {})
    val = lambda k: html.unescape(re.sub(r'<[^>]+>', '', md.get(k, {}).get('value', ''))).strip()  # noqa: E731
    licence = val('LicenseShortName')
    return {
        'title': title, 'thumb': ii.get('thumburl') or ii['url'], 'width': ii['width'], 'height': ii['height'],
        'licence': licence, 'licence_url': val('LicenseUrl') or LICENCE_URL.get(licence, ''), 'author': val('Artist'),
        'source_url': ii['descriptionurl'], 'free': bool(FREE.match(licence)), 'restrictions': val('Restrictions'),
    }


def asset_name(slug: str, title: str) -> str:
    """ASCII stem from the file name plus a stable 8-hex digest of the full title. The digest is what keeps names
    unique: Korean file names collapse to their date ("20230624 연세대학교 언더우드홀" → "20230624"), and three
    different photographs once shared one asset name and overwrote each other's files."""
    import hashlib
    stem = re.sub(r'\.[a-z]+$', '', title.split(':', 1)[1], flags=re.I)
    stem = re.sub(r'[^a-z0-9]+', '-', stem.lower()).strip('-')[:40]
    digest = hashlib.sha1(title.encode()).hexdigest()[:8]
    return f'{slug}--{stem + "-" if stem else ""}{digest}'


def preview(out: str, titles: list[str]) -> None:
    d = Path(out); d.mkdir(parents=True, exist_ok=True)
    tiles = []
    for i, t in enumerate(titles):
        try:
            m = info(t, 1200)
            im = Image.open(io.BytesIO(get(m['thumb']))).convert('RGB')
        except RuntimeError as e:
            print(f'{i:02d} SKIPPED {t}: {e}'); tiles.append(Image.new('RGB', (420, 280), 'lightgray')); continue
        time.sleep(1.5)
        im.save(d / f'{i:02d}.jpg', quality=85)
        print(f"{i:02d} {'FREE' if m['free'] else 'NOT-FREE'} {m['licence']} | {m['author'][:40]} | {m['width']}x{m['height']} | {t}")
        tiles.append(im)
    if tiles:
        from PIL import ImageDraw
        cols = 3; tw, th = 420, 280
        sheet = Image.new('RGB', (cols * (tw + 8), ((len(tiles) + cols - 1) // cols) * (th + 8)), 'white')
        for i, im in enumerate(tiles):
            im = im.copy(); im.thumbnail((tw, th))
            x, y = (i % cols) * (tw + 8), (i // cols) * (th + 8)
            sheet.paste(im, (x, y)); ImageDraw.Draw(sheet).text((x + 6, y + 6), f'{i:02d}', fill='yellow')
        sheet.save(d / 'sheet.jpg', quality=85)


def apply(picks_file: str) -> None:
    picks = json.loads(Path(picks_file).read_text())
    content = json.loads(CONTENT.read_text())
    credits = json.loads(CREDITS.read_text())
    used = {}  # source_url → slug, across every institution
    for slug, rec in content['records'].items():
        m = rec.get('media') or {}
        for e in [m.get('hero')] + list(m.get('gallery') or []):
            if e and e.get('media_source'):
                used[e['media_source']] = slug
    log = []
    for p in picks:
        slug, title = p['slug'], p['title']
        m = info(title, 2400)
        if not m['free'] or not m['author'] and not m['licence'].lower().startswith(('cc0', 'public domain', 'pd')):
            log.append({**p, 'result': 'REFUSED', 'why': f"licence {m['licence']!r} author {m['author']!r}"}); continue
        if m['source_url'] in used and used[m['source_url']] != slug:
            log.append({**p, 'result': 'REFUSED', 'why': f"already used by {used[m['source_url']]}"}); continue
        asset = asset_name(slug, title)
        im = Image.open(io.BytesIO(get(m['thumb']))).convert('RGB')
        for folder in MEDIA:
            folder.mkdir(parents=True, exist_ok=True)
            for w in (640, 1200, 2400):
                c = im.copy()
                if c.width > w:
                    c = c.resize((w, round(c.height * w / c.width)), Image.LANCZOS)
                c.save(folder / f'{asset}-{w}.jpg', quality=82, optimize=True, progressive=True)
        attribution_required = not m['licence'].lower().startswith(('cc0', 'public domain', 'pd'))
        entry = {
            'asset': asset, 'university_id': slug, 'kind': 'CAMPUS', 'license_or_permission': m['licence'],
            'rights_status': 'ATTRIBUTION_SUPPORTED' if attribution_required else 'CC0_PUBLIC_DOMAIN',
            'media_source': m['source_url'], 'official_asset': False,
            'attribution_requirement': {'author': m['author'], 'license': m['licence'], 'license_url': m['licence_url'], 'source_url': m['source_url']},
            'local_path': f'media/{asset}', 'focal_x': p.get('focal_x', 50), 'focal_y': p.get('focal_y', 50),
            'alt_key': 'v21.media.alt.campus', 'width': im.width, 'height': im.height,
            'found_via': ['v24:hand-picked'], 'verified_at': TODAY, 'quality_score': p.get('quality_score'),
            'source_owner': m['author'], 'license_url': m['licence_url'], 'attribution_required': attribution_required,
        }
        media = content['records'][slug].setdefault('media', {})
        gallery = media.setdefault('gallery', [])
        gallery[:] = [g for g in gallery if g.get('media_source') != m['source_url']]
        if p.get('role') == 'hero':
            old = media.get('hero')
            if old and old.get('media_source') != m['source_url'] and p.get('replace_hero_to_gallery', True):
                gallery.insert(0, old)
            media['hero'] = entry
        else:
            gallery.append(entry)
        if not any(c.get('source_url') == m['source_url'] for c in credits):
            credits.append({'slug': asset, 'title': title.split(':', 1)[1], 'subject': p.get('subject', ''), 'place': p.get('place', ''),
                            'width': im.width, 'height': im.height, 'license': m['licence'], 'license_url': m['licence_url'],
                            'author': m['author'], 'source_url': m['source_url'], 'retrieved': TODAY,
                            'rights_status': entry['rights_status'], 'attribution_required': attribution_required})
        used[m['source_url']] = slug
        log.append({**p, 'result': 'APPLIED', 'asset': asset, 'licence': m['licence'], 'author': m['author']})
        print(f"applied {slug} {p.get('role')} ← {title} ({m['licence']}, {m['author'][:30]})")
    CONTENT.write_text(json.dumps(content, ensure_ascii=False, indent=2) + '\n')
    CREDITS.write_text(json.dumps(credits, ensure_ascii=False, indent=1) + '\n')
    out = ROOT / 'docs/qa/v24/photo-review/import-log.json'
    prior = json.loads(out.read_text()) if out.exists() else []
    out.write_text(json.dumps(prior + log, ensure_ascii=False, indent=1) + '\n')
    for l in log:
        if l['result'] != 'APPLIED':
            print('REFUSED', l['slug'], l['title'], l['why'])


if __name__ == '__main__':
    mode = sys.argv[1]
    preview(sys.argv[2], sys.argv[3:]) if mode == 'preview' else apply(sys.argv[2])
