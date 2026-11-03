# V23 — scan the JS bundle inside an APK or AAB for test sign-in strings, persona addresses and the demo password
# (UTF-8 and UTF-16LE, since Hermes stores non-ASCII strings as UTF-16).  python3 scripts/release/v23-scan-artifact.py <file>
import sys, zipfile
f = sys.argv[1]
z = zipfile.ZipFile(f)
name = next(n for n in z.namelist() if n.endswith('index.android.bundle'))
d = z.read(name)
hits = {s: sum(d.count(s.encode(e)) for e in ('utf-8', 'utf-16-le')) for s in ['@demo.hangyul.kr', '테스트 계정으로 로그인', 'Sign in with test account', 'Demo access', 'Hangyul!2026']}
print(f.split('/')[-1], f'{len(d)/1e6:.1f} MB bundle', hits)
