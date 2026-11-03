"""V24 — remove institution photographs no record uses any more (replaced heroes, dropped gallery images): their files
in both public/media folders and their entry in credits.json, so /credits lists exactly what the site shows.
Only `<institution-slug>--…` assets are considered; site photography (city bands, home sections) is never touched.
   python3 scripts/universities/v24-prune-unused.py [--apply]"""
import json, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
APPLY = '--apply' in sys.argv
records = json.loads((ROOT / 'server/app/data/university_content.json').read_text())['records']
used = set()
for r in records.values():
    m = r.get('media') or {}
    for a in [m.get('hero')] + list(m.get('gallery') or []):
        if a: used.add(a['asset'])
slugs = set(records)
credits_p = ROOT / 'apps/marketing-web/src/media/credits.json'
credits = json.loads(credits_p.read_text())
def institution_asset(name): return '--' in name and name.split('--', 1)[0] in slugs
drop_credits = [c for c in credits if institution_asset(c.get('slug', '')) and c['slug'] not in used]
files = []
for folder in ('apps/marketing-web/public/media', 'apps/student-web/public/media'):
    for f in (ROOT / folder).glob('*--*-*.jpg'):
        asset = f.name.rsplit('-', 1)[0]
        if institution_asset(asset) and asset not in used: files.append(f)
print(f'unused institution assets: {len({f.name.rsplit("-",1)[0] for f in files})} ({len(files)} files), credit entries: {len(drop_credits)}')
for c in drop_credits[:40]: print('  credit', c['slug'])
if APPLY:
    for f in files: f.unlink()
    credits_p.write_text(json.dumps([c for c in credits if c not in drop_credits], ensure_ascii=False, indent=1) + '\n')
    print('removed')
