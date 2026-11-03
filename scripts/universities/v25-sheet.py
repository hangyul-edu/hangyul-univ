"""V25 — contact sheets for a person to judge photograph candidates (nothing is accepted by this script).

    python3 scripts/universities/v25-sheet.py <out-dir> <candidates.json> [<candidates.json> …] [--slugs a,b] [--per 12]

Reads the V25 harvest files (v25_geo_candidates.json / v25_wiki_candidates.json), takes every file whose verdict is
CANDIDATE, downloads Commons' own 500 px thumbnail, and lays them out 4 × 3 per sheet with an index, the institution,
licence, size and (for geotagged files) the distance from the campus point. `index.json` maps each index to its file so a
pick list can be written by index.
"""
from __future__ import annotations

import io
import json
import sys
import time
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

UA = 'HangyulUniv-media/1.0 (support@talkhangyul.com)'
args = sys.argv[1:]
slugs = None
per = 12
cap = None
if '--cap' in args:
    i = args.index('--cap'); cap = int(args[i + 1]); del args[i:i + 2]
if '--slugs' in args:
    i = args.index('--slugs'); slugs = set(args[i + 1].split(',')); del args[i:i + 2]
if '--per' in args:
    i = args.index('--per'); per = int(args[i + 1]); del args[i:i + 2]
out = Path(args[0]); out.mkdir(parents=True, exist_ok=True)
cands = []
for p in args[1:]:
    for slug, r in json.loads(Path(p).read_text())['records'].items():
        if slugs and slug not in slugs:
            continue
        for f in r['files']:
            if f.get('verdict') == 'CANDIDATE' and f.get('thumb'):
                if any(c['title'] == f['title'] and c['slug'] == slug for c in cands):
                    continue
                cands.append({**f, 'slug': slug, 'route': Path(p).stem})
import re
CAMPUS = re.compile(r'campus|univ|college|hall|library|building|gate|dorm|본관|도서관|캠퍼스|대학|학관|기숙사|정문|교정|관$', re.I)
def rank(c):
    return (0 if c.get('titled_self') else 1, 0 if CAMPUS.search(c['title']) else 1, c.get('dist') or 0)
if cap:
    by = {}
    for c in cands:
        by.setdefault(c['slug'], []).append(c)
    cands = [c for slug in sorted(by) for c in sorted(by[slug], key=rank)[:cap]]
try:
    font = ImageFont.truetype('/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc', 15)
except OSError:
    try:
        font = ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', 15)
    except OSError:
        font = ImageFont.load_default()


def fetch(url: str) -> Image.Image:
    for a in range(5):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=40) as r:
                return Image.open(io.BytesIO(r.read())).convert('RGB')
        except Exception:  # noqa: BLE001 — 429 bursts; back off
            time.sleep(3 + a * 5)
    return Image.new('RGB', (500, 330), 'lightgray')


tw, th, cols = 480, 300, 4
index = {}
for s in range(0, len(cands), per):
    batch = cands[s:s + per]
    rows = (len(batch) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * (tw + 10), rows * (th + 58)), 'white')
    d = ImageDraw.Draw(sheet)
    for j, c in enumerate(batch):
        n = s + j
        im = fetch(c['thumb']); time.sleep(0.6)
        im.thumbnail((tw, th))
        x, y = (j % cols) * (tw + 10), (j // cols) * (th + 58)
        sheet.paste(im, (x, y))
        d.rectangle([x, y, x + 46, y + 22], fill='black'); d.text((x + 4, y + 2), f'{n}', fill='yellow', font=font)
        dist = f" · {c['dist']}m" if c.get('dist') is not None else ''
        d.text((x, y + th + 2), f"{c['slug'][:34]} · {c['width']}×{c['height']}{dist}", fill='black', font=font)
        d.text((x, y + th + 20), f"{c['licence'][:16]} · {c['title'][5:60]}", fill='#444', font=font)
        index[n] = {k: c.get(k) for k in ('slug', 'title', 'licence', 'author', 'width', 'height', 'dist', 'source_url', 'route')}
    sheet.save(out / f'sheet-{s // per:02d}.jpg', quality=80)
    print(f'sheet-{s // per:02d}.jpg', len(batch), flush=True)
(out / 'index.json').write_text(json.dumps(index, ensure_ascii=False, indent=1))
print(len(cands), 'candidates')
