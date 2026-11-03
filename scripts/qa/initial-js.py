# Initial JS/CSS (gzip -9) = assets referenced by dist/index.html. Usage: python3 scripts/qa/initial-js.py apps/<app>
import re, gzip, sys, os
d = sys.argv[1] + '/dist'
h = open(d + '/index.html').read()
t = {'js': 0, 'css': 0}
for f in re.findall(r'(?:src|href)="/(assets/[^"]+\.(?:js|css))"', h):
    t[f.rsplit('.', 1)[1]] += len(gzip.compress(open(f'{d}/{f}', 'rb').read(), 9))
print(sys.argv[1], {k: round(v / 1024, 1) for k, v in t.items()})
