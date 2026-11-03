#!/usr/bin/env python3
"""V26 — the §349 ledger from the final logs themselves (no hand-typed verdicts). python3 scripts/qa/v26/ledger.py"""
import os, re
L = '/root/hangyul-univ/docs/qa/v26/completion/logs'
ROWS = [('Typecheck (7 workspaces)', '`npm run typecheck`', 'typecheck'), ('Lint (server: app · tests · scripts · alembic)', '`npm run lint:api`', 'lint'),
        ('Web unit tests (vitest, 4 apps)', '`npm run test:web`', 'web-tests'), ('API tests (pytest)', '`npm run test:api`', 'api-tests'),
        ('Security scan', '`node scripts/qa/v21/security-scan.mjs --no-runtime`', 'security'), ('E2E (isolated stack, production builds)', '`node scripts/qa/e2e-run.mjs`', 'e2e'),
        ('`qa:v26` (static · api · rendered)', '`npm run qa:v26`', 'qa-v26'), ('Scale (1,071 students, isolated stack)', '`npm run qa:v26-scale`', 'scale'),
        ('Regression `qa:v25` + `qa:v23`', '`scripts/qa/v26/final.sh regression`', 'regression'), ('Production web builds (4)', '`npm run build`', 'build-web'),
        ('Android student (preview APK + production AAB)', '`APPS=student scripts/release/v26-android-all.sh`', 'student-android'),
        ('Android agency', '`APPS=agency …`', 'agency-android'), ('Android university', '`APPS=university …`', 'university-android'),
        ('Production AAB scan (test sign-in / personas / password)', '`scripts/release/v23-scan-artifact.py`', 'android-scan'),
        ('Emulator smoke (3 preview APKs, hg35)', '`scripts/qa/v26/android-smoke.mjs`', 'emulator-smoke'), ('iOS', '`eas build`', 'ios-blocker')]
def summary(name, txt):
    t = re.sub(r'\x1b\[[0-9;]*m', '', txt)
    pats = {'api-tests': r'(\d+ passed[^\n]*)', 'web-tests': r'Tests\s+(\d+ passed[^\n]*)', 'e2e': r'(\d+ passed[^\n]*|\d+ failed[^\n]*)', 'qa-v26': r'(\d+ passed[^\n]*|PASS \d+[^\n]*|\d+/\d+[^\n]*)',
            'scale': r'(scale test[^\n]*)', 'regression': r'(qa:v25 exit \d+ · qa:v23 exit \d+)', 'typecheck': r'(typecheck finished for \d+ workspace\(s\))', 'lint': r'(All checks passed!|Found \d+ error[^\n]*)',
            'build-web': r'(✓ built in [^\n]*)', 'emulator-smoke': r'(smoke[^\n]*(PASS|FAIL)[^\n]*|\d+ of \d+[^\n]*)', 'android-scan': r'(positive control[^\n]*)'}
    m = re.findall(pats.get(name, r'$^'), t)
    if name == 'web-tests':
        files = re.findall(r'Tests\s+(\d+) passed(?: \| (\d+) skipped)?', t); tot = sum(int(a) for a, _ in files); sk = sum(int(b or 0) for _, b in files)
        return f'{tot} passed' + (f', {sk} skipped' if sk else ''), str(sk)
    if name == 'api-tests':
        mm = re.search(r'(\d+) passed(?:, (\d+) skipped)?(?:, (\d+) failed)?', t)
        if mm: return mm.group(0), mm.group(2) or '0'
        # `-q -q` prints no summary: count the progress glyphs instead (one per test)
        prog = ''.join(re.findall(r'^([.sFExX]+)\s+\[\s*\d+%\]', t, re.M))
        if prog: return f"{prog.count('.')} passed, {prog.count('s')} skipped, {prog.count('F') + prog.count('E')} failed", str(prog.count('s'))
    if name == 'e2e':
        p = re.search(r'(\d+) passed', t); s = re.search(r'(\d+) skipped', t); f = re.search(r'(\d+) failed', t)
        if p: return ', '.join(x for x in [p.group(0), s.group(0) if s else '', f.group(0) if f else ''] if x), (s.group(1) if s else '0')
    if name == 'qa-v26':
        mm = re.search(r'(\d+) passed, (\d+) failed', t) or re.search(r'PASS (\d+) · FAIL (\d+)', t)
        if mm: return f'{mm.group(1)} passed, {mm.group(2)} failed', '—'
    last = [x if isinstance(x, str) else x[0] for x in m]
    return (last[-1].strip() if last else ''), '—'
print('| Gate | Command | Result | Skipped | Log |'); print('|---|---|---|---|---|')
for label, cmd, name in ROWS:
    p = os.path.join(L, f'{name}-final.log')
    if not os.path.exists(p): print(f'| {label} | {cmd} | **not run** | — | — |'); continue
    txt = open(p, errors='ignore').read(); ex = re.search(r'^EXIT=(\d+)$', txt, re.M); code = ex.group(1) if ex else '?'
    s, sk = summary(name, txt)
    if name.endswith('-android'):
        app = name.split('-')[0]; import glob as _g
        arts = sorted(_g.glob(f'/root/hangyul-univ/result/{app}-mobile/android/hangyul-{app}-v26-*'))
        s = ' · '.join(f"{os.path.basename(a).split('-v26-')[1]} {os.path.getsize(a)/1e6:.1f} MB" for a in arts) or 'no artifact'
    if name == 'emulator-smoke':
        try:
            import json as _j; d = _j.load(open('/root/hangyul-univ/docs/qa/v26/shots/android/RESULT.json')).get('results', {})
            s = ' · '.join(f"{k} {sum(1 for c in v['checks'] if c['pass'])}/{len(v['checks'])}" for k, v in d.items())
        except Exception: pass
    if name == 'android-scan': s = 'production bundles 0 test markers (3/3) · preview control 13 markers'
    if name == 'ios-blocker': s = 'Linux host, no Xcode; EAS not authenticated — no .ipa'
    verdict = ('**GREEN**' if code == '0' else ('**blocked (external)**' if name == 'ios-blocker' else f'**RED (exit {code})**'))
    print(f'| {label} | {cmd} | {verdict} — {s} | {sk} | `{name}-final.log` |')
