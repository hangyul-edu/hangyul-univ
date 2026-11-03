// V23 — extract the canonical Hangyul social footer (platform, href, label, target, rel, SVG glyph paths)
// from the live talkhangyul.com page and from the owner's source project (/root/hangyul-web), and write
// docs/qa/v23/social/talkhangyul-footer.json. `qa:v23` compares Hangyul Univ's config against this file
// (always) and against the live page (with --live), so drift in either direction is visible.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const OUT = path.join(ROOT, 'docs/qa/v23/social/talkhangyul-footer.json');
const SRC = '/root/hangyul-web/src';

export async function fetchLive(url = 'https://www.talkhangyul.com/en') {
  const html = await (await fetch(url, { headers: { 'user-agent': 'HangyulUniv-QA/1.0' } })).text();
  const out = [];
  const re = /<a[^>]*data-platform="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  for (const m of html.matchAll(re)) {
    const tag = m[0].slice(0, m[0].indexOf('>') + 1);
    const attr = (n) => (tag.match(new RegExp(`${n}="([^"]*)"`)) || [])[1] ?? null;
    const paths = [...m[2].matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((p) => p[1]);
    out.push({ platform: m[1], href: attr('href'), ariaLabel: attr('aria-label'), target: attr('target'), rel: attr('rel'), paths: [...new Set(paths)] });
  }
  return out;
}

export function readSource() {
  const links = fs.readFileSync(path.join(SRC, 'constants/socialLinks.ts'), 'utf8');
  const comp = fs.readFileSync(path.join(SRC, 'components/layout/SocialLinks.tsx'), 'utf8');
  const entries = [...links.matchAll(/platform:\s*"([^"]+)",\s*href:\s*"([^"]+)"/g)].map((m) => ({ platform: m[1], href: m[2] }));
  for (const e of entries) {
    const m = comp.match(new RegExp(`${e.platform}:\\s*\\n?\\s*"([^"]+)"`));
    e.path = m ? m[1] : null;
  }
  return entries;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const live = await fetchLive();
  const source = fs.existsSync(SRC) ? readSource() : null;
  const doc = {
    extracted_at: new Date().toISOString(),
    live_url: 'https://www.talkhangyul.com/en',
    source_project: source ? '/root/hangyul-web (src/constants/socialLinks.ts, src/components/layout/SocialLinks.tsx)' : null,
    live, source,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(doc, null, 2) + '\n');
  const agree = source && live.length === source.length && live.every((l, i) => l.platform === source[i].platform && l.href === source[i].href && l.paths.includes(source[i].path));
  console.log(`live ${live.length} platforms, source ${source?.length ?? 'n/a'}; live == source: ${agree}`);
  if (!agree) process.exit(1);
}
