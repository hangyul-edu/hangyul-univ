# Rebuild a phase's page-height metrics from the captured full-page screenshots.
#
#   python3 scripts/qa/v10-metrics-from-shots.py before|after
#
# A full-page PNG is exactly as tall as the page was, so the evidence on disk is enough to recover height and
# "screens" even when metrics.json was overwritten by a partial re-run (which is what happened to the V10
# `before` file). Written alongside metrics.json as heights.json; it never overwrites metrics.json.
import json
import os
import re
import struct
import sys

PHASE = sys.argv[1] if len(sys.argv) > 1 else 'before'
ROOT = f'docs/qa/v10/{PHASE}'
VIEWPORT = {1440: 900, 1024: 768, 768: 1024, 430: 932, 390: 844}


def png_size(path):
    """Width and height from the IHDR chunk — no image library, no decode."""
    with open(path, 'rb') as f:
        head = f.read(24)
    if head[:8] != b'\x89PNG\r\n\x1a\n':
        raise ValueError(f'not a png: {path}')
    return struct.unpack('>II', head[16:24])


rows = []
for app in sorted(os.listdir(ROOT)):
    d = os.path.join(ROOT, app)
    if not os.path.isdir(d):
        continue
    for fn in sorted(os.listdir(d)):
        m = re.fullmatch(r'(.+)-(\d+)-full\.png', fn)
        if not m:
            continue
        view, width = m.group(1), int(m.group(2))
        w, h = png_size(os.path.join(d, fn))
        vh = VIEWPORT.get(width)
        rows.append({'app': app, 'view': view, 'width': width, 'height': h,
                     'screens': round(h / vh, 1) if vh else None})

out = os.path.join(ROOT, 'heights.json')
json.dump(rows, open(out, 'w'), indent=1)
print(f'{len(rows)} views → {out}')
for r in rows:
    if r['app'] == 'marketing' and r['view'] == 'home':
        print(f"  marketing home @{r['width']}: {r['height']}px = {r['screens']} screens")
