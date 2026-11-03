/**
 * Build the server-free stakeholder review bundle (V17, REPORT §153, brief §12).
 *
 *     npm run review:build          # → dist-review/{marketing,student,agency,university}
 *     BASE=/hangyul-preview/ npm run review:build
 *
 * Produces four static sites that run with FastAPI, Postgres and Redis switched off. Every app is built
 * with `VITE_REVIEW_MODE=true`, which swaps the API client's transport for the captured fixtures
 * (`packages/api-client/src/review.ts`) and leaves every component untouched.
 *
 * **Cross-links.** A reviewer must be able to walk from marketing into the student app and back, so the
 * four sites are built to sit side by side under one origin and each `VITE_*_APP_URL` points at its
 * sibling's folder. No `localhost` survives the build; `--check` asserts that.
 *
 * **Relative base.** The output uses a relative base by default so the bundle works from a file server, a
 * subdirectory, or a bucket root without being rebuilt. `BASE` overrides it when the host path is known.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'dist-review');
/** Each app is served from its own folder, so each is built with that folder as its base — which is also
 *  what gives its router a basename (see any app's `router.tsx`). `BASE` prefixes all four when the bundle
 *  is hosted somewhere other than the origin root. */
const BASE_PREFIX = (process.env.BASE ?? '/').replace(/\/*$/, '/');
const APPS = ['marketing', 'student', 'agency', 'university'];
const DIR = { marketing: 'marketing-web', student: 'student-web', agency: 'agency-web', university: 'university-web' };

/** Where each app lives relative to the others once deployed side by side. */
const url = (app) => `${BASE_PREFIX}${app}/`;

function build(app) {
  const env = {
    ...process.env,
    NODE_ENV: 'production',
    VITE_REVIEW_MODE: 'true',
    // Demo sign-in has no server to talk to in a preview, and a button that cannot work must not be shown.
    VITE_DEMO_LOGINS: '',
    VITE_MARKETING_URL: url('marketing'),
    VITE_STUDENT_APP_URL: url('student'),
    VITE_AGENCY_APP_URL: url('agency'),
    VITE_UNIVERSITY_APP_URL: url('university'),
  };
  const out = join(OUT, app);
  execFileSync('npx', ['vite', 'build', '--base', `${BASE_PREFIX}${app}/`, '--outDir', out, '--emptyOutDir'], {
    cwd: join(ROOT, 'apps', DIR[app]), env, stdio: 'inherit', timeout: 900_000,
  });
  // A static host serves one file per path; these are SPAs, so every unknown path must fall back to the
  // shell. `404.html` covers GitHub Pages and most bucket hosts without any server configuration.
  const index = join(out, 'index.html');
  if (existsSync(index)) cpSync(index, join(out, '404.html'));
  return out;
}

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

/** Nothing in a shared bundle may point at a machine the reviewer does not have. */
function check() {
  const problems = [];
  let files = 0;
  let bytes = 0;
  for (const app of APPS) {
    const dir = join(OUT, app);
    if (!existsSync(dir)) { problems.push(`${app}: not built`); continue; }
    for (const f of walk(dir)) {
      files += 1;
      bytes += statSync(f).size;
      if (!/\.(js|css|html|json)$/.test(f)) continue;
      const text = readFileSync(f, 'utf8');
      for (const bad of ['localhost:8000', 'localhost:8001', 'localhost:3100', 'localhost:3101', 'localhost:3102', 'localhost:3103', '127.0.0.1:']) {
        if (text.includes(bad)) problems.push(`${f.replace(OUT + '/', '')} references ${bad}`);
      }
    }
  }
  return { problems: [...new Set(problems)], files, bytes };
}

const only = process.argv.find((a) => APPS.includes(a));
if (!process.argv.includes('--check-only')) {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  for (const app of only ? [only] : APPS) {
    console.log(`\n=== ${app} ===`);
    build(app);
  }
  // An index so a reviewer opening the bundle's root is not met with a directory listing — and so the
  // brief's "working links" means a route a stakeholder can actually click, not four app roots they then
  // have to find their own way around. Every path here is one the bundle has fixtures for; `qa:v17` opens
  // the four roots and a university deep link, and a path that 404s shows the app's own 404, not a blank.
  const TOUR = [
    ['marketing', 'Marketing site', [
      ['', 'Home — the slow reveal, USD pricing, the university rail'],
      ['start', 'Free quick check — three questions, no account'],
      ['universities', 'All 425 universities'],
      ['universities/kaist', 'One university, as a story'],
      ['#pricing', 'The three plans, in USD'],
    ]],
    ['student', 'Student app', [
      ['', 'Home'],
      ['explore', 'Explore universities'],
      ['applications', 'Applications'],
      ['services', 'Plan and checkout'],
      ['more', 'More'],
    ]],
    ['agency', 'Agency console', [['', 'Overview'], ['students', 'Students'], ['tasks', 'Tasks']]],
    ['university', 'University console', [['', 'Overview'], ['applicants', 'Applicants'], ['programs', 'Programmes']]],
  ];
  writeFileSync(join(OUT, 'index.html'), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Hangyul Univ — review build</title>
<style>:root{color-scheme:light}
body{font:16px/1.6 system-ui,-apple-system,sans-serif;max-width:44rem;margin:9vh auto;padding:0 1.5rem;color:#181A1F;background:#FFFDF8}
h1{font-size:1.5rem;margin:0 0 .25rem}h2{font-size:.95rem;margin:2rem 0 .5rem;color:#181A1F}
p.lede{color:#555A62;margin:0 0 .5rem}p.note{color:#686D76;font-size:.85rem;margin:0 0 1.5rem}
ul{list-style:none;padding:0;margin:0}
li{margin:0 0 6px}
a{display:flex;gap:10px;align-items:baseline;padding:11px 14px;border:1px solid #E6E6E6;border-radius:10px;color:inherit;text-decoration:none;background:#fff}
a:hover,a:focus-visible{border-color:#181A1F}
a strong{font-weight:600;white-space:nowrap}a span{color:#686D76;font-size:.88rem}
@media (max-width:30rem){a{flex-direction:column;gap:2px}a strong{white-space:normal}}</style></head>
<body><h1>Hangyul Univ</h1>
<p class="lede">Stakeholder review build — every page below runs with no server, no database and no network.</p>
<p class="note">Signed-in consoles open with real seeded content. Payment is the one action that answers
&ldquo;not available in the preview&rdquo;, because nothing here may take money. Host note: these are
single-page apps, so the host must serve each app&rsquo;s <code>index.html</code> for unknown paths —
<code>404.html</code> is emitted for hosts that use it.</p>
${TOUR.map(([app, label, rows]) => `<h2>${label}</h2>
<ul>
${rows.map(([path, what]) => `  <li><a href="./${app}/${path}"><strong>/${path || ''}</strong><span>${what}</span></a></li>`).join('\n')}
</ul>`).join('\n')}
</body></html>
`);
}

const { problems, files, bytes } = check();
console.log(`\nreview build: ${files} files, ${(bytes / 1e6).toFixed(1)} MB → dist-review/`);
if (problems.length) {
  console.error(`\n! ${problems.length} problem(s):`);
  problems.forEach((p) => console.error(`  - ${p}`));
  process.exit(1);
}
console.log('no localhost or loopback reference in any emitted file.');
