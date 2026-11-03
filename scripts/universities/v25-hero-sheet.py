"""V25 — every hero cropped as it is served: 16:10 (desktop/card) at focal_x/y and 4:5 (phone hero) at focal_mobile_x/y.
    python3 scripts/universities/v25-hero-sheet.py <out-dir> [--per 15]
Writes sheet-NN.jpg (index, slug, licence, current score) and index.json. Scoring is recorded by a person in hero-scores.json."""
import json, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
ROOT = Path(__file__).resolve().parents[2]
out = Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
per = int(sys.argv[sys.argv.index('--per') + 1]) if '--per' in sys.argv else 15
recs = json.loads((ROOT / 'server/app/data/university_content.json').read_text())['records']
heroes = [(s, r['media']['hero']) for s, r in sorted(recs.items()) if (r.get('media') or {}).get('hero')]
font = ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', 14)
def crop(im, ar, fx, fy):
    w, h = im.size
    if w / h > ar: nw, nh = int(h * ar), h
    else: nw, nh = w, int(w / ar)
    x = min(max(0, int(w * fx / 100 - nw / 2)), w - nw); y = min(max(0, int(h * fy / 100 - nh / 2)), h - nh)
    return im.crop((x, y, x + nw, y + nh))
index = {}
for s0 in range(0, len(heroes), per):
    batch = heroes[s0:s0 + per]; cols = 3; cw = 360 + 8 + 144
    sheet = Image.new('RGB', (cols * (cw + 14), ((len(batch) + cols - 1) // cols) * (225 + 24)), 'white'); d = ImageDraw.Draw(sheet)
    for j, (slug, h) in enumerate(batch):
        n = s0 + j
        f = ROOT / 'apps/marketing-web/public' / f"{h['local_path']}-640.jpg"
        im = Image.open(f).convert('RGB')
        a = crop(im, 16 / 10, h.get('focal_x', 50), h.get('focal_y', 50)).resize((360, 225))
        b = crop(im, 4 / 5, h.get('focal_mobile_x', h.get('focal_x', 50)), h.get('focal_mobile_y', h.get('focal_y', 50))).resize((144, 180))
        x, y = (j % cols) * (cw + 14), (j // cols) * (225 + 24)
        sheet.paste(a, (x, y)); sheet.paste(b, (x + 368, y))
        d.rectangle([x, y, x + 38, y + 18], fill='black'); d.text((x + 3, y + 1), str(n), fill='yellow', font=font)
        q = (h.get('quality') or {}).get('total') or h.get('quality_score') or ''
        d.text((x, y + 228), f"{slug[:40]} · {h['license_or_permission'][:12]} · {q}", fill='black', font=font)
        index[n] = {'slug': slug, 'asset': h['asset']}
    sheet.save(out / f'sheet-{s0 // per:02d}.jpg', quality=78)
(out / 'index.json').write_text(json.dumps(index, indent=1)); print(len(heroes))
