/**
 * V23 — the institution's own website, **rendered**, for the YouTube link plain HTTP never saw.
 *
 * V22 read official sites with plain HTTP. Many Korean university homepages build their footer (and its
 * SNS icons) in JavaScript, so `v22-research-official.mjs` saw no YouTube link on them. This renders, in
 * headless Chromium, the same pages V22 identified — the homepage and, when V22 recorded one, the
 * English landing page — and collects the YouTube links in the rendered DOM.
 *
 * Who is looked at: every registry institution that has **no verified YouTube channel** in
 * university_content.json and whose official website is known and was not robots-disallowed in V22.
 * Every page is checked against robots.txt (`lib.mjs#allowed`, the V22 logic) before it is loaded, and
 * the page it lands on after redirects is checked again; a refused page contributes nothing.
 *
 * The crawler identifies itself with the V22 UA (`lib.mjs#UA`); a page that answers 403/406/429/503 to
 * it is retried once with the browser UA, exactly as V22 did, and the fallback is recorded.
 *
 * Memory (the host has ~5 GB shared): one browser, one page at a time, images/media/fonts and YouTube
 * embeds blocked, each context closed after its institution, the browser recycled every 40 pages.
 *
 * Discovery is only from the rendered own site — nothing here searches YouTube.
 *
 * Output: `server/app/data/raw/v23_rendered_youtube_links.json`. `v23-verify-youtube.mjs` verifies it.
 *
 *   node scripts/universities/v23-render-youtube.mjs [--only slug,…] [--limit N] [--budget-min 60] [--resume]
 */
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { allowed, content, readJson, registry, ROOT, TODAY, UA, writeJson } from './lib.mjs';

const ARG = process.argv.slice(2);
const flag = (n, d) => { const i = ARG.indexOf(n); return i >= 0 ? ARG[i + 1] : d; };
const ONLY = (flag('--only', '') || '').split(',').filter(Boolean);
const LIMIT = Number(flag('--limit', '0')) || 0;
const BUDGET_MS = (Number(flag('--budget-min', '60')) || 60) * 60_000;
const RESUME = ARG.includes('--resume');

const OFFICIAL = join(ROOT, 'server/app/data/raw/v22_official.json');
const WD_RAW = join(ROOT, 'server/app/data/raw/v22_wikidata.json');
const OUT = join(ROOT, 'server/app/data/raw/v23_rendered_youtube_links.json');
const BROWSER_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/** Channel forms — the same pattern V22 used on plain HTML. */
const YT_CHANNEL = /https?:\/\/(?:www\.|m\.)?youtube\.com\/(?:channel\/UC[\w-]{20,24}|@[\w.\-%]{2,80}|c\/[\w.\-%]{2,80}|user\/[\w.\-%]{2,80})/ig;
/** Video forms — recorded for the audit trail only; a video on the site is not channel-ownership evidence. */
const YT_VIDEO = /https?:\/\/(?:www\.|m\.)?(?:youtu\.be\/[\w-]{11}|youtube(?:-nocookie)?\.com\/(?:watch\?v=|embed\/|shorts\/)[\w-]{11})/ig;
const BLOCK_TYPES = new Set(['image', 'media', 'font']);
const BLOCK_HOSTS = /(^|\.)(youtube\.com|youtube-nocookie\.com|googlevideo\.com|ytimg\.com|doubleclick\.net|google-analytics\.com|googletagmanager\.com|facebook\.net|vimeo\.com)$/i;

const cleanChannel = (u) => u.split(/[?#"'\s<>]/)[0].replace(/^http:/, 'https:').replace('//m.', '//www.').replace('//youtube.com', '//www.youtube.com').replace(/\/+$/, '');

/* ------------------------------------------------------------------------------------------ targets */

const insts = registry();
const doc = content();
const official = readJson(OFFICIAL, { records: {} }).records ?? {};
const wd = readJson(WD_RAW, { records: {} }).records ?? {};

function pagesFor(inst) {
  const o = official[inst.slug] ?? {};
  const wdSite = (wd[inst.slug]?.websites ?? []).find((u) => /^https?:/.test(u));
  const home = o.resolved_home || o.website || inst.website_url || doc.records[inst.slug]?.website_url || wdSite || null;
  const english = (o.pages ?? []).find((p) => p.role === 'english')?.url ?? null;
  return { home, english, v22_status: o.status ?? null };
}

const all = [...insts].sort((a, b) => a.slug.localeCompare(b.slug));
let targets = all.filter((i) => {
  if (doc.records[i.slug]?.youtube?.channel_id) return false;      // already verified
  const { home, v22_status } = pagesFor(i);
  return !!home && v22_status !== 'ROBOTS_DISALLOWED';
});
const eligible = targets.length;
if (ONLY.length) targets = targets.filter((i) => ONLY.includes(i.slug));
if (LIMIT) targets = targets.slice(0, LIMIT);

const prior = readJson(OUT, { records: {} }).records ?? {};
const records = RESUME || ONLY.length || LIMIT ? { ...prior } : {};
if (RESUME) targets = targets.filter((i) => !records[i.slug]);
console.log(`V23 rendered own-site YouTube links — ${eligible} eligible, ${targets.length} to render now`);

/* ------------------------------------------------------------------------------------------ browser */

let browser = null;
let pagesSinceLaunch = 0;
async function ensureBrowser() {
  if (browser && pagesSinceLaunch < 40) return browser;
  if (browser) await browser.close().catch(() => {});
  browser = await chromium.launch({ headless: true, args: ['--disable-dev-shm-usage', '--disable-gpu', '--no-zygote', '--js-flags=--max-old-space-size=384'] });
  pagesSinceLaunch = 0;
  return browser;
}

/** One page, rendered; returns the links in the rendered DOM (all frames). */
async function renderOnce(url, ua) {
  const b = await ensureBrowser();
  pagesSinceLaunch += 1;
  const ctx = await b.newContext({ userAgent: ua, locale: 'ko-KR', ignoreHTTPSErrors: true, viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
  try {
    await ctx.route('**/*', (route) => {
      const req = route.request();
      if (BLOCK_TYPES.has(req.resourceType())) return route.abort();
      let host = '';
      try { host = new URL(req.url()).hostname; } catch { /* data: etc. */ }
      if (host && BLOCK_HOSTS.test(host)) return route.abort();
      return route.continue();
    });
    const page = await ctx.newPage();
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    let resp;
    try { resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 }); }
    catch (e) { return { ok: false, status: 0, error: String(e?.message ?? e).split('\n')[0].slice(0, 160) }; }
    const status = resp?.status() ?? 0;
    if (status >= 400) return { ok: false, status, final_url: page.url() };
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    // Footers are often lazy: scroll once, let it settle briefly.
    await page.evaluate(() => window.scrollTo(0, document.body ? document.body.scrollHeight : 0)).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
    const finalUrl = page.url();
    let html = '';
    for (const f of page.frames()) {
      try {
        const fu = f.url();
        if (f !== page.mainFrame() && (!/^https?:/.test(fu) || BLOCK_HOSTS.test(new URL(fu).hostname))) continue;
        html += await f.evaluate(() => {
          const parts = [document.documentElement.outerHTML];
          for (const el of document.querySelectorAll('[href],[src],[onclick],[data-href],[data-url],[data-link]')) {
            for (const a of ['href', 'src', 'onclick', 'data-href', 'data-url', 'data-link']) { const v = el.getAttribute(a); if (v) parts.push(` ${v} `); }
          }
          return parts.join('\n');
        });
      } catch { /* detached frame */ }
    }
    const anchors = await page.evaluate(() => [...document.querySelectorAll('a[href]')].map((a) => ({ href: a.href, text: (a.innerText || a.title || '').trim().slice(0, 40) }))).catch(() => []);
    return { ok: true, status, final_url: finalUrl, html, anchors };
  } finally {
    await ctx.close().catch(() => {});
  }
}

async function renderPage(url, role) {
  const rec = { role, url };
  if (!(await allowed(url))) return { ...rec, status: 'ROBOTS_REFUSED' };
  let r = await renderOnce(url, UA);
  if (!r.ok && [403, 406, 429, 503].includes(r.status)) {
    const retry = await renderOnce(url, BROWSER_UA);
    if (retry.ok) { r = retry; rec.ua_fallback = true; }
  }
  if (!r.ok) return { ...rec, status: 'FAILED', http_status: r.status, error: r.error ?? `HTTP ${r.status}` };
  rec.final_url = r.final_url;
  if (r.final_url && r.final_url !== url && /^https?:/.test(r.final_url) && !(await allowed(r.final_url))) return { ...rec, status: 'ROBOTS_REFUSED', after_redirect: true };
  const channels = new Set();
  const videos = new Set();
  const text = r.html.replace(/\\\//g, '/').replace(/&amp;/g, '&');
  for (const m of text.matchAll(YT_CHANNEL)) channels.add(cleanChannel(m[0]));
  for (const m of text.matchAll(YT_VIDEO)) videos.add(m[0].replace(/^http:/, 'https:'));
  // A splash page ("대학 홈페이지 바로가기") is not the homepage: remember its way in.
  let entry = null;
  if ((r.anchors?.length ?? 0) <= 40) {
    const host = (() => { try { return new URL(r.final_url).hostname.replace(/^www\./, ''); } catch { return ''; } })();
    const own = (r.anchors ?? []).filter((a) => { try { const h = new URL(a.href).hostname.replace(/^www\./, ''); return /^https?:/.test(a.href) && (h === host) && a.href.split('#')[0] !== r.final_url.split('#')[0]; } catch { return false; } });
    entry = own.find((a) => /대학\s*홈페이지|홈페이지\s*(바로가기|입장)|메인\s*(페이지|바로가기)|^(한국어|국문|KOR(EAN)?|ENTER|입장|main)$/i.test(a.text))?.href
      ?? own.find((a) => /\/(main|kor|index)(\.(do|php|jsp|html?|asp|aspx))?(\/|$|\?)/i.test(new URL(a.href).pathname))?.href ?? null;
  }
  return { ...rec, status: 'OK', channel_links: [...channels], video_links: [...videos].slice(0, 10), anchors: r.anchors?.length ?? 0, ...(entry ? { splash_entry: entry } : {}) };
}

/* --------------------------------------------------------------------------------------------- run */

const started = Date.now();
let processed = 0;
let stoppedEarly = false;
const save = () => writeJson(OUT, {
  _generated_by: 'scripts/universities/v23-render-youtube.mjs',
  generated_at: TODAY,
  eligible,
  processed_this_run: processed,
  stopped_early: stoppedEarly,
  institutions: Object.keys(records).length,
  records,
});

for (const inst of targets) {
  if (Date.now() - started > BUDGET_MS) { stoppedEarly = true; console.log(`\n  time budget reached after ${processed} institutions — stopping cleanly`); break; }
  const { home, english, v22_status } = pagesFor(inst);
  const out = { slug: inst.slug, name_ko: inst.name_ko, checked: TODAY, v22_status, pages: [] };
  try {
    const h = await renderPage(home, 'home');
    out.pages.push(h);
    if (h.status === 'OK' && !h.channel_links.length && h.splash_entry) out.pages.push(await renderPage(h.splash_entry, 'home-entered'));
    // The English landing page is rendered when V22 recorded one and the homepage gave no channel link.
    if (english && english !== home && !out.pages.some((p) => p.channel_links?.length)) out.pages.push(await renderPage(english, 'english'));
  } catch (e) {
    out.pages.push({ role: 'home', url: home, status: 'FAILED', error: String(e?.message ?? e).slice(0, 160) });
    if (browser) { await browser.close().catch(() => {}); browser = null; }
  }
  const links = new Map();
  for (const p of out.pages) for (const l of p.channel_links ?? []) if (!links.has(l.toLowerCase())) links.set(l.toLowerCase(), { url: l, found_on: p.final_url ?? p.url, page_role: p.role });
  out.links = [...links.values()];
  out.video_links = [...new Set(out.pages.flatMap((p) => p.video_links ?? []))].slice(0, 10);
  out.status = out.pages.some((p) => p.status === 'OK') ? 'RENDERED' : out.pages.every((p) => p.status === 'ROBOTS_REFUSED') ? 'ROBOTS_REFUSED' : 'FAILED';
  records[inst.slug] = out;
  processed += 1;
  process.stdout.write(`  [${processed}/${targets.length}] ${inst.slug.padEnd(40)} ${out.status.padEnd(14)} ${out.links.length} link(s) ${Math.round((Date.now() - started) / 1000)}s\n`);
  if (processed % 10 === 0) save();
}
if (browser) await browser.close().catch(() => {});
save();

const rs = Object.values(records);
const tally = {};
for (const r of rs) tally[r.status] = (tally[r.status] ?? 0) + 1;
console.log(`\n  ${Object.entries(tally).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
console.log(`  institutions with a channel link   ${rs.filter((r) => r.links.length).length}`);
console.log(`  channel links                      ${rs.reduce((n, r) => n + r.links.length, 0)}`);
console.log(`  → server/app/data/raw/v23_rendered_youtube_links.json\n`);
