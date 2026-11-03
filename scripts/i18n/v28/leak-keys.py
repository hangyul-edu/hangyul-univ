"""V28: map English text the visual gate saw on a non-English page back to its en bundle keys.
   python3 scripts/i18n/v28/leak-keys.py [report.json] -> prints key per leaked text; writes docs/qa/v28/l10n/leak-keys.json"""
import glob, json, re, sys

rep = json.load(open(sys.argv[1] if len(sys.argv) > 1 else 'docs/qa/v28/visual/report.json'))
texts = set()
for f in rep['findings']:
    if f['check'] == 'mixed-locale':
        for t in f['detail'].split(': ', 1)[1].split(' | '):
            texts.add(t.strip())
en = {}
for p in glob.glob('packages/i18n/locales/en/*.json'):
    ns = p.split('/')[-1][:-5]
    def walk(o, pre=''):
        if isinstance(o, dict):
            for k, v in o.items(): walk(v, pre + ('.' if pre else '') + k)
        elif isinstance(o, str): en[f'{ns}:{pre}'] = o
    walk(json.load(open(p)))
pats = []
for k, v in en.items():
    lit = re.sub(r'\{\{[^}]*\}\}|<[^>]+>', '', v)
    if len(lit.strip()) < 8: continue
    pats.append((k, re.compile(re.sub(r'\\\{\\\{[^}]*\\\}\\\}', '.+?', re.escape(re.sub(r'<[^>]+>', '', v))), re.S), len(lit)))
found = {}
for t in sorted(texts):
    probe = t[:70]
    hits = [(k, n) for k, rx, n in pats if (rx.fullmatch(t) if len(t) < 70 else rx.match(t[:70]) or rx.fullmatch(t)) or (len(t) >= 70 and en[k].startswith(t[:60]))]
    hits.sort(key=lambda x: -x[1])
    found[probe] = [k for k, _ in hits[:3]]
    print(probe, '=>', found[probe])
json.dump(found, open('docs/qa/v28/l10n/leak-keys.json', 'w'), ensure_ascii=False, indent=1)
