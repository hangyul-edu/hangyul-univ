#!/usr/bin/env python3
"""Tile screenshots into a labelled contact sheet for manual review: contact.py <out.png> <cols> <scale> <img>..."""
import sys, os
from PIL import Image, ImageDraw, ImageFont
out, cols, scale, *imgs = sys.argv[1:]; cols = int(cols); scale = float(scale)
ims = [Image.open(p).convert('RGB') for p in imgs]
ims = [i.resize((int(i.width * scale), int(i.height * scale))) for i in ims]
cw = max(i.width for i in ims); ch = max(i.height for i in ims) + 22
rows = (len(ims) + cols - 1) // cols
o = Image.new('RGB', (cols * (cw + 8), rows * (ch + 8)), '#d9d6d0'); d = ImageDraw.Draw(o)
try: f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 13)
except OSError: f = ImageFont.load_default()
for n, (im, p) in enumerate(zip(ims, imgs)):
    x, y = (n % cols) * (cw + 8), (n // cols) * (ch + 8)
    d.text((x + 4, y + 4), os.path.basename(p)[:60], fill='#111', font=f); o.paste(im, (x, y + 22))
o.save(out); print(out, o.size)
