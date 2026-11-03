"""V25 — WebP renditions beside every institution photograph's JPEG (REPORT §318 step 4).

    python3 scripts/universities/v25-webp.py [--check]

For every hero/gallery entry in university_content.json, writes <asset>-<w>.webp next to each existing <asset>-<w>.jpg in
both public/media folders (quality 78, method 6), records `formats: ['jpg','webp']` and `renditions` on the entry, and
reports bytes saved. `--check` only verifies that every referenced rendition exists in both formats.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
CONTENT = ROOT / 'server/app/data/university_content.json'
MEDIA = [ROOT / 'apps/marketing-web/public/media', ROOT / 'apps/student-web/public/media']
check = '--check' in sys.argv
doc = json.loads(CONTENT.read_text())
missing, made, saved = [], 0, 0
for slug, rec in doc['records'].items():
    m = rec.get('media') or {}
    for e in [m.get('hero')] + list(m.get('gallery') or []):
        if not e or not e.get('local_path'):
            continue
        stem = e['local_path'].split('/', 1)[1]
        widths = []
        for w in (640, 1200, 2400):
            for folder in MEDIA:
                jpg, webp = folder / f'{stem}-{w}.jpg', folder / f'{stem}-{w}.webp'
                if not jpg.exists():
                    missing.append(str(jpg.relative_to(ROOT))); continue
                if w not in widths:
                    widths.append(w)
                if not webp.exists():
                    if check:
                        missing.append(str(webp.relative_to(ROOT))); continue
                    Image.open(jpg).convert('RGB').save(webp, quality=78, method=6)
                    made += 1; saved += jpg.stat().st_size - webp.stat().st_size
        if not check:
            e['renditions'] = widths
            e['formats'] = ['jpg', 'webp']
if not check:
    CONTENT.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + '\n')
print(f'webp written {made}, bytes saved {saved/1e6:.1f} MB, missing {len(missing)}')
for x in missing[:20]:
    print('  missing', x)
sys.exit(1 if (check and missing) else 0)
