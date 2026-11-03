# Before/after comparison from the two metrics.json files. Usage: python3 scripts/qa/v9-compare.py [filter]
import json, sys
b = json.load(open('docs/qa/v9/before/metrics.json'))
a = json.load(open('docs/qa/v9/after/metrics.json'))
f = sys.argv[1] if len(sys.argv) > 1 else ''
rows = []
for k, av in a.items():
    if f and f not in k: continue
    bv = b.get(k)
    if not bv: continue
    if bv['screens'] != av['screens'] or bv['sideScrollTables'] != av['sideScrollTables']:
        rows.append((k, bv['screens'], av['screens'], bv['sideScrollTables'], av['sideScrollTables']))
rows.sort(key=lambda r: (r[1] - r[2]), reverse=True)
print(f"{'view':44} {'screens b→a':>14}  side b→a")
for k, bs, as_, bt, at in rows[:40]:
    print(f"{k:44} {bs:6} → {as_:<6} {bt:4} → {at}")
tot = lambda m, key: sum(1 for v in m.values() if v[key])
print('\nTOTALS   views', len(b), '→', len(a),
      '| sideways tables', tot(b, 'sideScrollTables'), '→', tot(a, 'sideScrollTables'),
      '| overflow', tot(b, 'pageOverflow'), '→', tot(a, 'pageOverflow'),
      '| h1≠1', sum(1 for v in b.values() if v['h1'] != 1), '→', sum(1 for v in a.values() if v['h1'] != 1),
      '| errors', sum(1 for v in b.values() if v['errors']), '→', sum(1 for v in a.values() if v['errors']))
