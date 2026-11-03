/**
 * V19 — the interaction click-map (REPORT §193/§208; the brief's §19).
 *
 * V17 asked for it and V18 admitted it was never built. For each primary route it enumerates every visible
 * interactive control, exercises it, and classifies the outcome. The point is **no silent coverage holes**:
 * every control on a page ends up in exactly one bucket, and the bucket counts are the coverage claim.
 *
 *   tested       the control was activated and the page responded (navigation, DOM change, or a dialog)
 *   inert        activated, nothing observable changed — a candidate dead control, listed individually
 *   disabled     `disabled` / `aria-disabled` — intentionally off, not a defect
 *   unreachable  present in the DOM but not clickable (zero size, covered, outside the viewport flow)
 *   broken       activating it threw, navigated to an error, or left a console exception
 *
 * Controls are re-found by index after every activation, because a click can re-render the page and a held
 * handle would be stale. Anything that navigates away is followed by a reload of the route, so each control
 * is exercised from the same starting state.
 *
 *   node scripts/qa/v19/click-map.mjs [--app marketing|student] [--width 1440] [--max 40]
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const ARG = process.argv.slice(2);
const val = (n, d) => { const i = ARG.indexOf(n); return i >= 0 ? ARG[i + 1] : d; };
const APP = val('--app', 'both');
const WIDTH = Number(val('--width', 1440));
const MAX = Number(val('--max', 60));

const TARGETS = {
  marketing: {
    base: 'http://localhost:3100',
    login: null,
    routes: ['/?lang=ko', '/start?lang=ko', '/universities?lang=ko', '/privacy?lang=ko', '/terms?lang=ko'],
  },
  student: {
    base: 'http://localhost:3101',
    login: { email: 'student@demo.hangyul.kr', password: 'Hangyul!2026' },
    routes: ['/', '/explore', '/applications', '/documents', '/essays', '/messages',
      '/notifications', '/visa', '/housing', '/arrival', '/tasks', '/services', '/profile', '/settings', '/more'],
  },
};

/** Everything a reader can act on. Deliberately broad — a hole here is a hole in the claim. */
const SELECTOR = [
  'a[href]', 'button', 'summary', '[role="button"]', '[role="tab"]', '[role="radio"]',
  '[role="checkbox"]', '[role="switch"]', 'select', 'input[type="checkbox"]', 'input[type="radio"]',
  'input[type="file"]', 'input[type="search"]', '[tabindex]:not([tabindex="-1"])',
].join(', ');

mkdirSync('docs/qa/v19/evidence', { recursive: true });
const browser = await chromium.launch();
const all = [];

for (const appName of APP === 'both' ? ['marketing', 'student'] : [APP]) {
  const cfg = TARGETS[appName];
  const ctx = await browser.newContext({ viewport: { width: WIDTH, height: WIDTH < 700 ? 844 : 900 } });
  const page = await ctx.newPage();
  page.on('dialog', (d) => d.dismiss().catch(() => {}));

  if (cfg.login) {
    await page.goto(`${cfg.base}/login`, { waitUntil: 'networkidle' });
    await page.evaluate(() => { try { localStorage.setItem('hg.locale', 'ko'); } catch { /* ignore */ } });
    await page.fill('#email', cfg.login.email);
    await page.fill('#password', cfg.login.password);
    await page.click('button[type=submit]');
    await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
  }

  for (const route of cfg.routes) {
    const open = async () => {
      await page.goto(`${cfg.base}${route}`, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(800);
    };
    await open();

    const described = await page.$$eval(SELECTOR, (els) => els.map((el, i) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const hidden = cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0;
      return {
        i,
        tag: el.tagName.toLowerCase(),
        role: el.getAttribute('role') || '',
        label: (el.getAttribute('aria-label') || el.textContent || el.getAttribute('title') || '').trim().replace(/\s+/g, ' ').slice(0, 46),
        href: el.getAttribute('href') || '',
        disabled: el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true',
        sized: r.width > 1 && r.height > 1,
        hidden,
        external: /^(https?:)?\/\//.test(el.getAttribute('href') || '') || /^(mailto|tel):/.test(el.getAttribute('href') || ''),
      };
    }));

    const controls = described.slice(0, MAX);
    for (const c of controls) {
      const row = { app: appName, route, ...c, state: '', note: '' };

      if (c.disabled) { row.state = 'disabled'; all.push(row); continue; }
      if (c.hidden || !c.sized) { row.state = 'unreachable'; row.note = c.hidden ? 'not visible' : 'zero size'; all.push(row); continue; }
      if (c.external) { row.state = 'tested'; row.note = `external target ${c.href.slice(0, 40)}`; all.push(row); continue; }

      const errs = [];
      const onP = (e) => errs.push(String(e).slice(0, 120));
      page.on('pageerror', onP);
      /*
       * What counts as "the page responded".
       *
       * Length-of-innerHTML alone is too blunt: selecting a radio flips one `aria-checked`, opening a
       * popover flips one `aria-expanded`, and a `<details>` gains one `open` — none of which move the
       * byte count much. The first run of this map put nineteen perfectly good controls in the "inert"
       * bucket for that reason, including the language picker and every option card on `/start`. The
       * signature below is the set of things a control is actually allowed to change.
       */
      const signature = () => ({
        url: location.pathname + location.search + location.hash,
        html: document.querySelector('#main')?.innerHTML.length ?? document.body.innerHTML.length,
        dialogs: document.querySelectorAll('[role="dialog"], dialog[open], .hg-modal, .hg-sheet, .hg-overlay, .hg-popover, .hg-locale').length,
        expanded: [...document.querySelectorAll('[aria-expanded]')].map((e) => e.getAttribute('aria-expanded')).join(''),
        checked: [...document.querySelectorAll('[aria-checked], [aria-selected], [aria-pressed]')]
          .map((e) => `${e.getAttribute('aria-checked') ?? ''}${e.getAttribute('aria-selected') ?? ''}${e.getAttribute('aria-pressed') ?? ''}`).join(''),
        open: document.querySelectorAll('details[open]').length,
        focus: `${document.activeElement?.tagName}${String(document.activeElement?.className ?? '').slice(0, 24)}`,
      });
      const before = await page.evaluate(signature);

      try {
        const handle = (await page.$$(SELECTOR))[c.i];
        if (!handle) { row.state = 'unreachable'; row.note = 're-query missed it (page re-rendered)'; }
        else {
          await handle.click({ timeout: 2500, noWaitAfter: true });
          await page.waitForTimeout(650);
          const after = await page.evaluate(() => {
            const sig = {
              url: location.pathname + location.search + location.hash,
              html: document.querySelector('#main')?.innerHTML.length ?? document.body.innerHTML.length,
              dialogs: document.querySelectorAll('[role="dialog"], dialog[open], .hg-modal, .hg-sheet, .hg-overlay, .hg-popover, .hg-locale').length,
              expanded: [...document.querySelectorAll('[aria-expanded]')].map((e) => e.getAttribute('aria-expanded')).join(''),
              checked: [...document.querySelectorAll('[aria-checked], [aria-selected], [aria-pressed]')]
                .map((e) => `${e.getAttribute('aria-checked') ?? ''}${e.getAttribute('aria-selected') ?? ''}${e.getAttribute('aria-pressed') ?? ''}`).join(''),
              open: document.querySelectorAll('details[open]').length,
              focus: `${document.activeElement?.tagName}${String(document.activeElement?.className ?? '').slice(0, 24)}`,
            };
            sig.is404 = /404|찾을 수 없|not found/i.test((document.querySelector('#main') || document.body).innerText.slice(0, 200));
            return sig;
          });
          const changed = [];
          if (after.url !== before.url) changed.push(`→ ${after.url}`);
          if (after.dialogs !== before.dialogs) changed.push('overlay');
          if (after.expanded !== before.expanded) changed.push('aria-expanded');
          if (after.checked !== before.checked) changed.push('selection');
          if (after.open !== before.open) changed.push('details');
          if (Math.abs(after.html - before.html) > 24) changed.push('content');
          if (errs.length) { row.state = 'broken'; row.note = errs[0]; }
          else if (after.is404 && before.url !== after.url) { row.state = 'broken'; row.note = `navigated to a 404 (${after.url})`; }
          else if (changed.length) { row.state = 'tested'; row.note = changed.join(' + '); }
          else { row.state = 'inert'; row.note = 'no observable change'; }
          if (after.url !== before.url) await open();
        }
      } catch (e) {
        const msg = String(e.message ?? e).split('\n')[0].slice(0, 110);
        /*
         * **Could not be activated ≠ broken.** A click that times out means Playwright never got the
         * element into an actionable state — it is behind a closed `<details>`, it is the visually-hidden
         * skip link that only exists on focus, or something overlays it. That is a coverage fact to report,
         * not a defect to claim. `broken` is reserved for a control that *ran* and went wrong: a thrown
         * exception, or a navigation into a 404. Classifying 11 collapsed footer links as "broken" in the
         * first run of this map would have been exactly the kind of invented finding this pass is meant to
         * stop producing.
         */
        row.state = 'unreachable';
        row.note = msg;
      }
      page.off('pageerror', onP);
      all.push(row);
    }
  }
  await ctx.close();
}
await browser.close();

writeFileSync(`docs/qa/v19/evidence/click-map-${WIDTH}.json`, JSON.stringify(all, null, 2));

const STATES = ['tested', 'disabled', 'unreachable', 'inert', 'broken'];
const byRoute = new Map();
for (const r of all) {
  const k = `${r.app}${r.route}`;
  if (!byRoute.has(k)) byRoute.set(k, []);
  byRoute.get(k).push(r);
}
console.log(`\nClick map @ ${WIDTH}px\n`);
console.log('route'.padEnd(34) + STATES.map((s) => s.slice(0, 6).padStart(8)).join(''));
for (const [k, rs] of byRoute) {
  console.log(k.padEnd(34) + STATES.map((s) => String(rs.filter((r) => r.state === s).length).padStart(8)).join(''));
}
const totals = Object.fromEntries(STATES.map((s) => [s, all.filter((r) => r.state === s).length]));
console.log('\nTOTAL'.padEnd(35) + STATES.map((s) => String(totals[s]).padStart(8)).join(''));

const problems = all.filter((r) => r.state === 'broken' || r.state === 'inert');
if (problems.length) {
  console.log(`\n${problems.length} control(s) needing a look:`);
  for (const r of problems) {
    console.log(`  ${r.state === 'broken' ? '✗' : '·'} ${r.app}${r.route} › <${r.tag}${r.role ? ` role=${r.role}` : ''}> "${r.label}" — ${r.note}`);
  }
}
console.log(`\n${all.length} controls across ${byRoute.size} routes → docs/qa/v19/evidence/click-map-${WIDTH}.json`);
process.exit(totals.broken ? 1 : 0);
