/**
 * V32 — `npm run qa:v32-crawl` (through scripts/qa/e2e-run.mjs, on the isolated stack).
 *
 * Every reachable route of the four web products, read from the routers themselves (apps/*-web/src/router.tsx and the
 * marketing routes.tsx), rendered at 1440 and 390 with a fixture session, and checked for the things a screenshot cannot
 * be trusted to show on its own: console errors, horizontal overflow, a visible native <select>, a raw translation key,
 * a broken image, a blank page. Screenshots land in docs/qa/v32/crawl/<app>/ for the manual sign-off.
 */
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';

import { API, apiLogin, uiLogin, URLS } from './helpers';

const OUT = 'docs/qa/v32/crawl';
const LOGIN = { student: 'student@demo.hangyul.kr', agency: 'counselor@lotus.demo.hangyul.kr', university: 'admin@pusan.univ.demo.hangyul.kr' } as const;
type App = keyof typeof URLS;

function routesOf(app: App): string[] {
  const file = app === 'marketing' ? 'apps/marketing-web/src/routes.tsx' : `apps/${app}-web/src/router.tsx`;
  const src = readFileSync(file, 'utf8');
  const raw = [...src.matchAll(/path: ?'([^']+)'/g)].map((m) => m[1]).filter((p) => p !== '*' && !p.endsWith('/*'));
  const routes = raw.map((p) => (p.startsWith('/') ? p : `/${p}`)).filter((p) => !/\/(start|sponsor|__dev)\b/.test(p) || p === '/start');
  return [...new Set(routes)];
}

/** Fill :params from the fixture data the stack holds, so detail routes render a real record. */
async function fillParams(app: App, routes: string[], headers: Record<string, string>): Promise<string[]> {
  const get = async (p: string) => (await (await fetch(`${API}${p}`, { headers })).json()) as { items?: { id?: string; slug?: string }[]; id?: string }[] | { items?: { id?: string; slug?: string }[] };
  const first = async (p: string) => { const r = await get(p); const list = Array.isArray(r) ? r : r.items; return list?.[0]; };
  // Every :param is filled from the list the same product renders, so a detail route shows a real record of its own kind.
  const ids: Record<string, Record<string, string | undefined>> = { marketing: { ':slug': 'yonsei-university' }, student: {}, agency: {}, university: {} };
  if (app === 'student') {
    ids.student = { 'applications/:id': (await first('/applications'))?.id, 'essays/:id': (await first('/essays'))?.id, 'messages/:id': (await first('/conversations'))?.id,
      'universities/:slug': (await first('/universities?page_size=1'))?.slug };
  }
  if (app === 'agency') {
    ids.agency = { 'students/:id': (await first('/agency/students?page_size=1'))?.id, 'applications/:id': (await first('/applications?page_size=1'))?.id,
      'essays/:id': (await first('/essays?page_size=1'))?.id, 'messages/:id': (await first('/conversations'))?.id, 'universities/:slug': (await first('/universities?page_size=1'))?.slug };
  }
  if (app === 'university') {
    ids.university = { 'applications/:id': (await first('/applications?page_size=1'))?.id, 'messages/:id': (await first('/conversations'))?.id, 'cohorts/:tab': 'overview' };
  }
  const out: string[] = [];
  for (const r of routes) {
    // role-gated areas a partner-agency account cannot open are not defects (Hangyul HQ is its own persona)
    if (app === 'agency' && r.startsWith('/hq')) continue;
    let filled = r; let ok = true;
    for (const [pattern, value] of Object.entries(ids[app])) {
      if (!filled.includes(pattern)) continue;
      if (!value) { ok = false; break; }
      filled = filled.replace(pattern, pattern.replace(/:[a-z]+/, value));
    }
    if (ok && !/:[a-z]+/.test(filled)) out.push(filled);
  }
  return out;
}

async function audit(page: Page, url: string) {
  const errors: string[] = [];
  const onConsole = (m: { type: () => string; text: () => string }) => { if (m.type() === 'error') errors.push(m.text().slice(0, 140)); };
  const onError = (e: Error) => errors.push(`pageerror ${String(e).slice(0, 140)}`);
  page.on('console', onConsole); page.on('pageerror', onError);
  const res = await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => null);
  await page.waitForTimeout(600);
  const facts = await page.evaluate(() => {
    const vis = (el: Element) => { const cs = getComputedStyle(el); const r = el.getBoundingClientRect(); return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0 && r.width > 0 && r.height > 0; };
    const text = document.body.innerText || '';
    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      nativeSelects: [...document.querySelectorAll('select')].filter(vis).length,
      rawKeys: (text.match(/\b(?:common|marketing|student|agency|university|mobile):[a-zA-Z0-9_.]+\b|\bv\d{1,2}\.[a-z][a-zA-Z0-9_]*\.[a-zA-Z0-9_.]+\b/g) ?? []).slice(0, 3),
      brokenImgs: [...document.querySelectorAll('img')].filter((i) => i.complete && i.naturalWidth === 0 && i.src && !i.src.startsWith('data:')).map((i) => i.src.slice(-60)).slice(0, 3),
      blank: text.trim().length < 20,
      title: document.title,
    };
  });
  page.off('console', onConsole); page.off('pageerror', onError);
  const problems: string[] = [];
  if (!res || res.status() >= 400) problems.push(`status ${res?.status()}`);
  if (facts.overflow > 1) problems.push(`horizontal overflow ${facts.overflow}px`);
  if (facts.nativeSelects) problems.push(`${facts.nativeSelects} visible native select`);
  if (facts.rawKeys.length) problems.push(`raw i18n key ${facts.rawKeys.join(' ')}`);
  if (facts.brokenImgs.length) problems.push(`broken image ${facts.brokenImgs.join(' ')}`);
  if (facts.blank) problems.push('blank page');
  if (errors.length) problems.push(`console: ${[...new Set(errors)].slice(0, 2).join(' | ')}`);
  return { problems, title: facts.title };
}

for (const app of ['marketing', 'student', 'agency', 'university'] as App[]) {
  test(`${app}: every router route renders clean at 1440 and 390`, async ({ page, request }) => {
    test.setTimeout(15 * 60 * 1000);
    mkdirSync(`${OUT}/${app}`, { recursive: true });
    let headers: Record<string, string> = {};
    if (app !== 'marketing') { await uiLogin(page, app, LOGIN[app], undefined, 'en'); headers = await apiLogin(request, LOGIN[app], app); }
    const routes = await fillParams(app, routesOf(app), headers);
    const report: string[] = [];
    for (const w of [1440, 390]) {
      await page.setViewportSize({ width: w, height: w < 500 ? 844 : 900 });
      for (const route of routes) {
        const url = `${URLS[app]}${route}${route.includes('?') ? '&' : '?'}lang=en`;
        const { problems } = await audit(page, url);
        const name = `${route.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'home'}-${w}`;
        await page.screenshot({ path: `${OUT}/${app}/${name}.png` }).catch(() => {});
        if (problems.length) report.push(`${route} @${w}: ${problems.join('; ')}`);
      }
    }
    console.log(`${app}: ${routes.length} routes × 2 widths, ${report.length} findings\n${report.join('\n')}`);
    expect(report, `${app} crawl findings`).toEqual([]);
  });
}
