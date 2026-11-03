"""V28 localization census: rendered keys (docs/qa/v28/l10n/rendered-keys.json) × market locales → per-locale missing /
English-identical counts for class A (customer: marketing + student) and B (operational: agency + university).
Writes docs/qa/v28/l10n/CENSUS.json. Keys are 'ns:dotted.key' as the recorder stores them."""
import json, os, re
R = json.load(open('docs/qa/v28/l10n/rendered-keys.json'))['apps']
A, B = set(), set()
for app, v in R.items():
    (B if app in ('agency', 'university') else A).update(v['keys'])
B -= A
LOC = 'packages/i18n/locales'
MARKETS = ['vi','ne','uz','mn','zh-Hans','ja','th','id','fil','my','hi','bn','kk','ky','ar','tr','ru','uk','pl','cs','hu','ro','sr','el','it','es','pt','fr','de','nl','sv','zh-Hant','fa','ur']
cache = {}
def get(loc, key):
    ns, _, k = key.partition(':')
    if not k: ns, k = 'common', ns
    if (loc, ns) not in cache:
        p = f'{LOC}/{loc}/{ns}.json'
        cache[(loc, ns)] = json.load(open(p)) if os.path.exists(p) else {}
    d = cache[(loc, ns)]
    for part in k.split('.'):
        if not isinstance(d, dict) or part not in d: return None
        d = d[part]
    return d if isinstance(d, str) else None
def plain(s): return re.sub(r'\{\{[^}]+\}\}|<[^>]+>', '', s or '').strip()
out = {'classes': {'A': len(A), 'B': len(B)}, 'locales': {}}
for loc in MARKETS:
    row = {}
    for cls, keys in (('A', A), ('B', B)):
        miss, same = [], []
        for k in sorted(keys):
            en = get('en', k)
            if en is None: continue
            v = get(loc, k)
            if v is None: miss.append(k)
            elif v == en and len(plain(en).split()) > 3: same.append(k)
        row[cls] = {'missing': len(miss), 'english_identical': len(same), 'missing_keys': miss[:400], 'identical_keys': same[:400]}
    out['locales'][loc] = row
json.dump(out, open('docs/qa/v28/l10n/CENSUS.json', 'w'), ensure_ascii=False, indent=1)
print('A', len(A), 'B', len(B))
for loc, r in out['locales'].items():
    print(f"{loc:8} A miss {r['A']['missing']:4} same {r['A']['english_identical']:3} | B miss {r['B']['missing']:4} same {r['B']['english_identical']:3}")
