#!/usr/bin/env python3
"""V30 before/after comparison sheets (brief Part 47).

    python3 scripts/qa/v30/sheet.py <before.png> <after.png> <out.png> [title] [--crop=x,y,w,h]

Puts BEFORE and AFTER side by side (stacked if wide) at the same scale with a label bar, so a reviewer
compares identical viewport/locale captures. With --crop both images are cropped to the same rectangle.
"""
import sys
from PIL import Image, ImageDraw, ImageFont

args = [a for a in sys.argv[1:] if not a.startswith('--')]
opts = dict(a[2:].split('=', 1) for a in sys.argv[1:] if a.startswith('--') and '=' in a)
before, after, out = args[:3]
title = args[3] if len(args) > 3 else ''
a, b = Image.open(before).convert('RGB'), Image.open(after).convert('RGB')
if 'crop' in opts:
    x, y, w, h = map(int, opts['crop'].split(','))
    a, b = a.crop((x, y, x + w, y + h)), b.crop((x, y, x + w, y + h))
try:
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 18)
except OSError:
    font = ImageFont.load_default()
bar, pad = 34, 12
stack = a.width > 900
W = max(a.width, b.width) if stack else a.width + b.width + pad
H = (a.height + b.height + 2 * bar + pad) if stack else max(a.height, b.height) + bar
o = Image.new('RGB', (W, H + (bar if title else 0)), '#e9e7e3')
d = ImageDraw.Draw(o)
y0 = 0
if title:
    d.text((10, 8), title, fill='#181a1f', font=font); y0 = bar
d.text((10, y0 + 8), 'BEFORE', fill='#b42318', font=font)
o.paste(a, (0, y0 + bar))
if stack:
    yb = y0 + bar + a.height + pad
    d.text((10, yb + 8), 'AFTER', fill='#067647', font=font)
    o.paste(b, (0, yb + bar))
else:
    d.text((a.width + pad + 10, y0 + 8), 'AFTER', fill='#067647', font=font)
    o.paste(b, (a.width + pad, y0 + bar))
o.save(out)
print(out, o.size)
