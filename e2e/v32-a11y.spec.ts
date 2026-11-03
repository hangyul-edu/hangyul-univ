/**
 * V32 — `npm run qa:v32-a11y`: axe-core (WCAG 2.1 A/AA) on the representative routes of all four products, including
 * the canonical select in its OPENED state (listbox semantics, active option, focus), at desktop and phone widths.
 * Serious and critical violations fail; moderate ones are listed for the ledger.
 */
import { expect, test, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';

import { uiLogin, URLS } from './helpers';

const AXE = ['node_modules/axe-core/axe.min.js'].find((p) => existsSync(p));
const LOGIN = { student: 'student@demo.hangyul.kr', agency: 'counselor@lotus.demo.hangyul.kr', university: 'admin@pusan.univ.demo.hangyul.kr' } as const;
const ROUTES: Record<keyof typeof URLS, string[]> = {
  marketing: ['/', '/universities', '/universities/yonsei-university', '/start'],
  student: ['/login', '/register', '/', '/applications', '/documents', '/services', '/housing'],
  agency: ['/login', '/', '/students', '/applications'],
  university: ['/login', '/', '/applicants', '/analytics'],
};

/**
 * axe measures the page as it is at that instant. The products animate (the listbox fades in, the marketing sections
 * reveal when scrolled into view), and a colour sampled mid-fade is not what a reader sees, so every scan starts from a
 * settled page: scrolled through once (reveals fire), back at the top, with no animation still running.
 */
async function settle(page: Page, scroll = true) {
  if (scroll) await page.evaluate(async () => {
    const h = document.documentElement.scrollHeight;
    for (let y = 0; y < h; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); }
    window.scrollTo(0, 0);
  });
  // only finite animations are awaited (a marquee loops forever); a 3 s cap keeps a slow host from stalling the gate
  await page.evaluate(() => Promise.race([
    Promise.all(document.getAnimations().filter((a) => Number.isFinite(a.effect?.getComputedTiming().endTime ?? Infinity)).map((a) => a.finished.catch(() => undefined))),
    new Promise((r) => setTimeout(r, 3000)),
  ]));
  await page.waitForTimeout(150);
}

async function runAxe(page: Page, opened = false) {
  // with a popup open the page must not scroll (that repositions and re-animates the popup); only let it settle
  await settle(page, !opened);
  if (!(await page.evaluate(() => 'axe' in window))) await page.addScriptTag({ path: AXE! });
  return page.evaluate(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out = await (window as any).axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } });
    return (out.violations as { id: string; impact: string; nodes: { target: string[] }[] }[]).map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, first: v.nodes[0]?.target?.[0] }));
  });
}

test.skip(!AXE, 'axe-core is not installed (node_modules/axe-core/axe.min.js)');

for (const app of Object.keys(ROUTES) as (keyof typeof ROUTES)[]) {
  test(`${app}: no serious/critical WCAG violations, including the opened select`, async ({ page }) => {
    test.setTimeout(10 * 60 * 1000);
    if (app !== 'marketing') await uiLogin(page, app, LOGIN[app], undefined, 'en');
    const serious: string[] = []; const moderate: string[] = [];
    for (const w of [1280, 390]) {
      await page.setViewportSize({ width: w, height: w < 500 ? 844 : 900 });
      for (const route of ROUTES[app]) {
        await page.goto(`${URLS[app]}${route}?lang=en`, { waitUntil: 'networkidle' });
        const v = await runAxe(page);
        for (const x of v) (x.impact === 'serious' || x.impact === 'critical' ? serious : moderate).push(`${route}@${w} ${x.id} ×${x.n} (${x.first})`);
        // the canonical select, opened: the listbox must be a valid, named listbox with a selected option
        const box = page.getByRole('combobox').first();
        if (await box.isVisible().catch(() => false)) {
          await box.click();
          if (await page.getByRole('listbox').isVisible().catch(() => false)) {
            const v2 = await runAxe(page, true);
            for (const x of v2) (x.impact === 'serious' || x.impact === 'critical' ? serious : moderate).push(`${route}@${w} [select open] ${x.id} ×${x.n} (${x.first})`);
            await page.keyboard.press('Escape');
          }
        }
      }
    }
    console.log(`${app}: ${serious.length} serious/critical, ${moderate.length} moderate/minor\n${[...serious, ...moderate.map((m) => `  (moderate) ${m}`)].join('\n')}`);
    expect(serious, `${app} serious/critical axe violations`).toEqual([]);
  });
}
