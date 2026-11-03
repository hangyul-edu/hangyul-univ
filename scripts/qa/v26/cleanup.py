#!/usr/bin/env python3
"""V26 repository cleanup (brief §91–§100), driven by the analysis table in docs/qa/v26/FILE_CLEANUP.md.

    python3 scripts/qa/v26/cleanup.py a            # stage A, dry run: prints the plan, writes FILE_CLEANUP_MANIFEST.dry.txt
    python3 scripts/qa/v26/cleanup.py a --apply    # stage A: everything that must precede the post-cleanup validation
    python3 scripts/qa/v26/cleanup.py b --apply    # stage B: after the post-cleanup validation and the Android builds —
                                                   # superseded native artifacts, non-final logs, scale databases, V26 scratch

Stage A never touches: source, tests, node_modules, the licensed template sources, docs/media/retired-attribution-required,
docs/qa/v26 evidence (captures, JSON, final logs), the *.md summaries of every earlier pass, the CSV registries and any
earlier-pass file a kept script or a current-state document references.
Every removed path is appended to docs/qa/v26/FILE_CLEANUP_MANIFEST.txt with its size and category.
"""
import os, re, shutil, subprocess, sys, json, filecmp

ROOT = '/root/hangyul-univ'
os.chdir(ROOT)
stage = sys.argv[1] if len(sys.argv) > 1 else 'a'
APPLY = '--apply' in sys.argv
MAN = 'docs/qa/v26/FILE_CLEANUP_MANIFEST.txt' if APPLY else 'docs/qa/v26/FILE_CLEANUP_MANIFEST.dry.txt'
plan = []  # (category, path, bytes)

def size(p):
    if os.path.islink(p): return 0
    if os.path.isdir(p):
        t = 0
        for r, _, fs in os.walk(p):
            for f in fs:
                fp = os.path.join(r, f)
                if not os.path.islink(fp): t += os.path.getsize(fp)
        return t
    return os.path.getsize(p) if os.path.exists(p) else 0

def add(cat, p):
    if os.path.lexists(p): plan.append((cat, p, size(p)))

def remove(p):
    if os.path.islink(p) or os.path.isfile(p): os.remove(p)
    elif os.path.isdir(p): shutil.rmtree(p)

def read_all(paths):
    out = []
    for p in paths:
        try: out.append(open(p, errors='ignore').read())
        except Exception: pass
    return '\n'.join(out)

if stage == 'a':
    # ── 1. earlier passes' evidence (docs/qa/v3 … v25): keep Markdown, cited registries, and anything a kept script or
    #       current-state document references by path. REPORT.md's dated sections are narrative, not live links (FILE_CLEANUP.md).
    ref_sources = []
    for r, ds, fs in os.walk('scripts'):
        ref_sources += [os.path.join(r, f) for f in fs]
    ref_sources += ['package.json', 'docs/qa/v26/README.md'] + [os.path.join('docs', f) for f in os.listdir('docs') if f.endswith('.md') and not f.startswith('REPORT')]
    ref_sources += [os.path.join('docs/qa/v26', f) for f in os.listdir('docs/qa/v26') if f.endswith('.md')]
    hay = read_all(ref_sources)
    KEEP_NAMES = {'UNIVERSITY_PHOTO_SEARCH.csv', 'UNIVERSITY_MEDIA_COVERAGE.csv', 'UNIVERSITY_VISUAL_COVERAGE.csv', 'MANUAL_MEDIA_ACQUISITION.md'}
    for v in sorted(os.listdir('docs/qa')):
        if not re.fullmatch(r'v\d+', v) or int(v[1:]) >= 26: continue
        base = os.path.join('docs/qa', v)
        for r, ds, fs in os.walk(base):
            for f in fs:
                p = os.path.join(r, f)
                if f.endswith('.md') or f in KEEP_NAMES or f.upper().startswith('IOS_BUILD_BLOCKER'): continue
                if p in hay or f in hay and v in hay: continue   # cited by path, or by name next to its pass
                add('earlier-pass evidence (images/logs/traces/intermediate data)', p)
    add('second copy of REPORT.md', 'docs/qa/v25/REPORT.before-v25.md')
    # ── 2. V26 scratch that is now in REPORT / the logs (evidence files are moved, not deleted)
    os.makedirs('docs/qa/v26/evidence', exist_ok=True)
    for f in ['base.before-prune.css', 'base.pruned-selectors.txt', 'perf-compare.md', 'doc-drift-actions.md', 'unreferenced-probes.txt', 'media-dups.txt', 'media-student-newer.txt']:
        src = os.path.join('docs/qa/v26/_work', f)
        if os.path.exists(src) and APPLY: shutil.move(src, os.path.join('docs/qa/v26/evidence', f))
    add('V26 pixel-diff scratch (verdict in logs/css-consolidation-pixel.log)', 'docs/qa/v26/_work/pix')
    for f in sorted(os.listdir('docs/qa/v26/_work')) if os.path.isdir('docs/qa/v26/_work') else []:
        if f != 'pix': add('V26 drafts/patches already applied or appended', os.path.join('docs/qa/v26/_work', f))
    # ── 3. probe scripts nothing references
    for p in open('docs/qa/v26/evidence/unreferenced-probes.txt' if os.path.exists('docs/qa/v26/evidence/unreferenced-probes.txt') else 'docs/qa/v26/_work/unreferenced-probes.txt').read().split():
        add('unreferenced one-off probe script', p)
    add('V26 one-off chain', 'scripts/qa/v26/_chain-zoom-perf.sh')
    # ── 4. capture output folders and reproducible build output
    add('V15/V21 capture output', 'qa-screenshots')
    for app in ['marketing', 'student', 'agency', 'university']:
        for d in ['dist', 'dist-perf', 'dist-cssattr', 'dist-e2e', 'dist-review']:
            add('reproducible build output (the final build recreates dist)', f'apps/{app}-web/{d}')
    # ── 5. caches
    for r, ds, fs in os.walk('.'):
        ds[:] = [d for d in ds if d not in ('node_modules', '.venv', '.git', 'themeforest-eduan', 'themeforest-ynex', 'template-koreanasha')]
        for d in list(ds):
            if d in ('__pycache__', '.ruff_cache', '.pytest_cache', '.expo', '.expo-export-check', '.qa-logs'):
                add('regenerable cache', os.path.join(r, d)); ds.remove(d)
    # ── 6. media: one tree. The 6 renditions the student copy re-encoded smaller go to marketing first; then the student
    #       folder becomes a symlink; the 16 byte-identical 2400 renditions go and the registry drops that width.
    M, S = 'apps/marketing-web/public/media', 'apps/student-web/public/media'
    newer = open('docs/qa/v26/evidence/media-student-newer.txt' if os.path.exists('docs/qa/v26/evidence/media-student-newer.txt') else 'docs/qa/v26/_work/media-student-newer.txt').read().split()
    dups = open('docs/qa/v26/evidence/media-dups.txt' if os.path.exists('docs/qa/v26/evidence/media-dups.txt') else 'docs/qa/v26/_work/media-dups.txt').read().split()
    if os.path.isdir(S) and not os.path.islink(S):
        if APPLY:
            for rel in newer: shutil.copy2(os.path.join(S, rel), os.path.join(M, rel))
        add('duplicate media tree → symlink to marketing (6 newer WebP copied over first)', S)
    for rel in dups: add('byte-identical 2400 rendition of a ≤1200-px source', os.path.join(M, rel))
    if APPLY and dups:
        reg = 'server/app/data/university_content.json'; data = json.load(open(reg)); changed = 0
        bases = {re.sub(r'-2400\.(jpg|webp)$', '', d) for d in dups}
        def walk(o):
            global changed
            if isinstance(o, dict):
                lp = o.get('local_path')
                if lp and 'renditions' in o and any(lp.rstrip('/').endswith(b.split('/')[-1]) or b.split('/')[-1] in lp for b in bases) and 2400 in o['renditions']:
                    o['renditions'] = [w for w in o['renditions'] if w != 2400]; changed += 1
                for v in o.values(): walk(v)
            elif isinstance(o, list):
                for v in o: walk(v)
        walk(data)
        json.dump(data, open(reg, 'w'), ensure_ascii=False, indent=1); print(f'registry: dropped 2400 from {changed} assets')
        r = subprocess.run([ROOT + '/server/.venv/bin/python', '-m', 'scripts.v12_load_institutions'], cwd=ROOT + '/server', env={**os.environ, 'HG_ENV': 'development'}, capture_output=True, text=True)
        print('institutions reload:', (r.stdout or r.stderr).strip().split('\n')[-1][:120])
elif stage == 'b':
    for app in ['student', 'agency', 'university']:
        d = f'result/{app}-mobile/android'
        if os.path.isdir(d):
            for f in os.listdir(d):
                if '-v26-' not in f: add('superseded native artifact (V26 artifacts validated)', os.path.join(d, f))
    add('superseded native archive', 'result/student-mobile/archive-v22')
    add('stale V23 build metadata', 'result/student-mobile/metadata/BUILD_INFO.json')
    L = 'docs/qa/v26/completion/logs'
    for f in sorted(os.listdir(L)):
        if not f.endswith('-final.log'): add('non-final log (final runs kept)', os.path.join(L, f))
    add('V26 scratch folder', 'docs/qa/v26/_work')
    for f in ['_chain-final.sh', '_chain-zoom-perf.sh', '_rerun-reds.sh', '_rerun-qa26.sh', '_rerun-post.sh', '_rerun-qa26b.sh', '_chain-android-resume.sh', '_chain-android-tail.sh', '_chain-android-tail2.sh', '_chain-android-tail3.sh', '_chain-android-tail4.sh']: add('V26 one-off chain / re-run script', f'scripts/qa/v26/{f}')
    # the validation recreated these reproducible outputs; production `dist` (the deployment output of the final build) stays
    for app in ['marketing', 'student', 'agency', 'university']:
        for d in ['dist-e2e', 'dist-perf', 'dist-cssattr']: add('reproducible build output recreated by the validation (production dist kept)', f'apps/{app}-web/{d}')
    add('cleanup dry-run manifest', 'docs/qa/v26/FILE_CLEANUP_MANIFEST.dry.txt')
elif stage == 'c':
    # After the Android phase: Gradle intermediates that `expo prebuild` regenerates on every build (the artifacts live in
    # result/), the one-off post-capture script whose patch files are gone, and the V23/V25 Android scripts superseded by
    # their V26 versions that point at artifacts and log folders removed in stages A/B.
    for app in ['student', 'agency', 'university']:
        for d in ['app/build', 'app/.cxx', 'build', '.gradle']: add('Gradle intermediates (prebuild regenerates; artifacts are in result/)', f'apps/{app}-mobile/android/{d}')
    add('V26 one-off (its patch files were applied and removed)', 'scripts/qa/v26/post-capture.sh')
    for f in ['scripts/qa/v23/android-smoke.mjs', 'scripts/release/v25-android-all.sh', 'scripts/release/v25-collect.mjs']: add('superseded by the V26 version; referenced removed artifacts/logs', f)
else:
    sys.exit('stage must be a, b or c')

# ── report / apply
tot = sum(b for _, _, b in plan)
by = {}
for c, p, b in plan: by.setdefault(c, [0, 0]); by[c][0] += 1; by[c][1] += b
print(f"stage {stage} {'APPLY' if APPLY else 'DRY RUN'}: {len(plan)} paths, {tot/1e6:.0f} MB")
for c, (n, b) in sorted(by.items(), key=lambda x: -x[1][1]): print(f"  {b/1e6:8.1f} MB  {n:6}  {c}")
with open(MAN, 'a') as m:
    m.write(f"# stage {stage} — {'applied' if APPLY else 'dry run'} — {len(plan)} paths, {tot/1e6:.0f} MB\n")
    for c, p, b in plan: m.write(f"{b:>12}  {c:<70}  {p}\n")
if APPLY:
    for c, p, b in plan:
        if p == 'apps/student-web/public/media':
            remove(p); os.symlink('../../marketing-web/public/media', p)
        else: remove(p)
    # orphan upload files and QA residue in the dev database
    r = subprocess.run([ROOT + '/server/.venv/bin/python', '-m', 'scripts.purge_e2e'], cwd=ROOT + '/server', env={**os.environ, 'HG_ENV': 'development'}, capture_output=True, text=True)
    print('purge_e2e:', (r.stdout or r.stderr).strip().split('\n')[-1][:160])
    if stage in ('b', 'c'):
        for db in ['hangyul_univ_scale26', 'hangyul_univ_scale', 'hangyul_univ_bench', 'hangyul_univ_seedcheck']:
            subprocess.run(['psql', '-qc', f'DROP DATABASE IF EXISTS {db}'], capture_output=True)
        print('scale/bench databases dropped')
    print('manifest:', MAN)
