// V7: capture the purchased ThemeForest templates as the visual baseline.
// Usage: node scripts/qa/v7-template-capture.mjs eduan|ynex [filter]
// Serves are expected at :4100 (themeforest-eduan/eduan) and :4200 (themeforest-ynex/Html/dist).
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const which = process.argv[2];
const filter = process.argv[3];
const WIDTHS = [[390, 844], [768, 1024], [1440, 900]];

const EDUAN = ['index', 'index-2', 'index-3', 'index-4', 'index-5', 'index-6', 'index-7', 'index-8', 'index-9', 'index-10',
  'about', 'course', 'course-2', 'course-details', 'event', 'event-details', 'blog', 'blog-details', 'team', 'team-details',
  'gallery', 'price', 'contact', 'sign-in', 'sign-up', '404'];
const YNEX = ['index', 'index-1', 'index-2', 'index-3', 'index-4', 'index-5', 'index-6', 'index-7', 'index-8', 'index-9', 'index-10', 'index-11',
  'crm-contacts', 'crm-companies', 'crm-deals', 'crm-leads', 'data-tables', 'grid-tables', 'tables', 'file-manager', 'mail', 'mail-settings',
  'chat', 'task-kanban-board', 'task-list-view', 'task-details', 'profile', 'full-calendar', 'form_layout', 'form_inputs', 'form_select',
  'apex-bar-charts', 'apex-line-charts', 'apex-heatmap-charts', 'apex-column-charts', 'widgets', 'projects-overview', 'projects-list',
  'job-candidate-details', 'job-candidate-search', 'team', 'invoice-list', 'timeline', 'navs_tabs', 'modals_closes', 'offcanvas',
  'to-do-list', 'notifications', 'sign-in-cover', 'sign-in-basic', 'cards', 'empty', 'contacts', 'blog-details'];

const conf = which === 'eduan'
  ? { base: 'http://localhost:4100/', pages: EDUAN, out: 'docs/qa/v7/template-eduan' }
  : { base: 'http://localhost:4200/html/', pages: YNEX, out: 'docs/qa/v7/template-ynex' };
mkdirSync(conf.out, { recursive: true });

const b = await chromium.launch({ args: ['--headless=new'] });
for (const page of conf.pages.filter((p) => !filter || p.includes(filter))) {
  const KEY = new Set(['index', 'index-3', 'index-8', 'crm-contacts', 'file-manager', 'mail', 'chat', 'task-kanban-board', 'task-list-view', 'profile', 'job-candidate-details', 'full-calendar', 'form_layout', 'apex-bar-charts', 'widgets', 'sign-in-cover']);
  for (const [w, h] of WIDTHS) {
    if (which === 'ynex' && w !== 1440 && !KEY.has(page)) continue;
    const ctx = await b.newContext({ viewport: { width: w, height: h }, reducedMotion: 'no-preference' });
    const p = await ctx.newPage();
    try {
      await p.goto(conf.base + page + '.html', { waitUntil: 'load', timeout: 30000 });
      await p.waitForTimeout(1200);
      // reveal scroll-triggered (WOW / appear) content
      const H = await p.evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0; y < H; y += Math.round(h * 0.8)) { await p.evaluate((yy) => window.scrollTo(0, yy), y); await p.waitForTimeout(120); }
      await p.evaluate(() => window.scrollTo(0, 0));
      await p.waitForTimeout(700);
      await p.screenshot({ path: `${conf.out}/${page}-${w}.jpg`, type: 'jpeg', quality: 72 });
      if (w !== 768) await p.screenshot({ path: `${conf.out}/${page}-${w}-full.jpg`, type: 'jpeg', quality: 60, fullPage: true });
      console.log(page, w, 'ok', H);
    } catch (e) { console.log(page, w, 'ERR', e.message.slice(0, 100)); }
    await ctx.close();
  }
}
await b.close();
