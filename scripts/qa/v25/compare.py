"""Before | after side-by-side for one route at one width (top 1.6 viewports): python3 compare.py <group> <file-stem> <width> <out>"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
g, stem, w, out = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4]
root = Path(__file__).resolve().parents[3] / 'docs/qa/v25/visual'
font = ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', 22)
h = int((844 if w < 600 else 900) * 1.6)
ims = []
for ph in ('before', 'after'):
    f = root / ph / g / f'{stem}-{w}.png'
    im = Image.open(f).convert('RGB') if f.exists() else Image.new('RGB', (w, h), 'gray')
    ims.append(im.crop((0, 0, im.width, min(h, im.height))))
H = max(i.height for i in ims); W = sum(i.width for i in ims) + 20
s = Image.new('RGB', (W, H + 34), 'white'); d = ImageDraw.Draw(s)
x = 0
for ph, im in zip(('BEFORE', 'AFTER'), ims):
    s.paste(im, (x, 34)); d.text((x + 6, 4), f'{ph} · {g}/{stem} · {w}', fill='black', font=font); x += im.width + 20
sc = 1800 / W if W > 1800 else 1
s.resize((int(W * sc), int((H + 34) * sc))).save(out, quality=78)
