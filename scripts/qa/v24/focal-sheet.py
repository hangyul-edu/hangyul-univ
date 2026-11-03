"""V24 — contact sheet of heroes cropped as the product crops them (16:10 desktop, 4:5 phone) at their focal point.
   python3 scripts/qa/v24/focal-sheet.py <out.jpg> slug [slug …]"""
import json, sys
from PIL import Image, ImageDraw
out, slugs = sys.argv[1], sys.argv[2:]
R = json.load(open('server/app/data/university_content.json'))['records']
def crop(im, ar, fx, fy):
    w, h = im.size
    if w / h > ar: cw, ch = int(h * ar), h
    else: cw, ch = w, int(w / ar)
    x = min(max(int(w * fx / 100 - cw / 2), 0), w - cw); y = min(max(int(h * fy / 100 - ch / 2), 0), h - ch)
    return im.crop((x, y, x + cw, y + ch))
rows = []
for s in slugs:
    h = R[s]['media']['hero']
    im = Image.open(f"apps/marketing-web/public/media/{h['asset']}-1200.jpg").convert('RGB')
    a = crop(im, 16 / 10, h.get('focal_x', 50), h.get('focal_y', 50)).resize((320, 200))
    b = crop(im, 4 / 5, h.get('focal_x', 50), h.get('focal_y', 50)).resize((160, 200))
    rows.append((s, a, b, h.get('focal_x', 50), h.get('focal_y', 50)))
W = 220 + 320 + 10 + 160 + 10
sheet = Image.new('RGB', (W * 2, ((len(rows) + 1) // 2) * 210), 'white'); d = ImageDraw.Draw(sheet)
for i, (s, a, b, fx, fy) in enumerate(rows):
    ox, oy = (i % 2) * W, (i // 2) * 210
    d.text((ox + 4, oy + 90), s[:32], fill='black'); d.text((ox + 4, oy + 106), f'focal {fx},{fy}', fill='gray')
    sheet.paste(a, (ox + 220, oy)); sheet.paste(b, (ox + 550, oy))
sheet.save(out, quality=85)
