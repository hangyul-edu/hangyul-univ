# Side-by-side before/after images for the screens V9 changed most. Usage: python3 scripts/qa/v9-comparisons.py
import os, json
from PIL import Image, ImageDraw
B, A, O = 'docs/qa/v9/before', 'docs/qa/v9/after', 'docs/qa/v9/comparisons'
os.makedirs(O, exist_ok=True)
PAIRS = [
    ('marketing/home', 390), ('marketing/home', 1440),
    ('student/home-nepal', 390), ('student/visa-myanmar', 390), ('student/budget', 390),
    ('student/explore-new', 390), ('student/documents', 390),
    ('agency/today', 1024), ('agency/students', 1024), ('agency/team', 1440), ('agency/submissions', 1440),
    ('university/applicant', 1024), ('university/analytics', 1024), ('university/overview', 1440),
    ('agency/hq-readiness', 1440), ('student/visa', 390), ('agency/today', 390),
]
made = []
for name, w in PAIRS:
    app, view = name.split('/')
    b, a = f'{B}/{app}/{view}-{w}.png', f'{A}/{app}/{view}-{w}.png'
    if not (os.path.exists(b) and os.path.exists(a)): continue
    ib, ia = Image.open(b).convert('RGB'), Image.open(a).convert('RGB')
    h = max(ib.height, ia.height); pad, label = 24, 34
    out = Image.new('RGB', (ib.width + ia.width + pad * 3, h + label + pad), '#f2f3f5')
    out.paste(ib, (pad, label)); out.paste(ia, (pad * 2 + ib.width, label))
    d = ImageDraw.Draw(out)
    d.text((pad, 10), f'BEFORE (V8)  {name} @{w}', fill='#111')
    d.text((pad * 2 + ib.width, 10), f'AFTER (V9)  {name} @{w}', fill='#111')
    out.save(f'{O}/{app}-{view}-{w}.png')
    made.append(f'{app}-{view}-{w}.png')
json.dump(made, open(f'{O}/index.json', 'w'), indent=1)
print(len(made), 'comparisons:', ', '.join(made))
