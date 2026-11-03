# Side-by-side before/after images for the screens V10 changed. Usage: python3 scripts/qa/v10-comparisons.py
# `before/` is the V9 product captured on 2026-10-16 before any V10 change; `after/` is the same route, persona
# and width after. Pairs are chosen where V10 actually changed something — mostly marketing.
import os, json
from PIL import Image, ImageDraw

B, A, O = 'docs/qa/v10/before', 'docs/qa/v10/after', 'docs/qa/v10/comparisons'
os.makedirs(O, exist_ok=True)

PAIRS = [
    ('marketing/home', 1440), ('marketing/home', 1024), ('marketing/home', 768),
    ('marketing/home', 430), ('marketing/home', 390),
    ('marketing/universities', 1440), ('marketing/universities', 390),
    ('marketing/universities_pusan-national-university', 1440),
    ('marketing/students', 1440), ('marketing/guides', 1440),
    ('marketing/how-it-works', 1440), ('marketing/trust', 1440),
    ('agency/home', 1440), ('university/home', 1440), ('student/home', 1440),
]

made = []
for name, w in PAIRS:
    app, view = name.split('/', 1)
    b, a = f'{B}/{app}/{view}-{w}.png', f'{A}/{app}/{view}-{w}.png'
    if not (os.path.exists(b) and os.path.exists(a)):
        continue
    ib, ia = Image.open(b).convert('RGB'), Image.open(a).convert('RGB')
    h = max(ib.height, ia.height)
    pad, label = 24, 34
    out = Image.new('RGB', (ib.width + ia.width + pad * 3, h + label + pad), '#f2f3f5')
    out.paste(ib, (pad, label))
    out.paste(ia, (pad * 2 + ib.width, label))
    d = ImageDraw.Draw(out)
    d.text((pad, 10), f'BEFORE (V9)  {name} @{w}', fill='#111')
    d.text((pad * 2 + ib.width, 10), f'AFTER (V10)  {name} @{w}', fill='#111')
    out.save(f'{O}/{app}-{view.replace("/", "_")}-{w}.png')
    made.append(f'{app}-{view.replace("/", "_")}-{w}.png')

json.dump(made, open(f'{O}/index.json', 'w'), indent=1)
print(len(made), 'comparisons:', ', '.join(made))
