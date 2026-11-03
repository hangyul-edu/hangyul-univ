/**
 * FLOW C (V5): the Myanmar persona (student.myanmar@demo.hangyul.kr) uses the app in Burmese:
 * home → application → documents → visa, with no English text in the core workflow region (<main>).
 * Allowed Latin tokens: university / program proper names and the student's own name, TOPIK/IELTS/TOEFL, D-2/D-4 visa
 * types, KRW/USD amounts, dates, e-mails, domains (visa.go.kr), the brand "Hangyul", codes with digits (receipt / passport numbers).
 * The visa screen must be clean (hard assertion); other screens are soft assertions so every leak is listed in one run.
 */
import { expect, test, type Page } from '@playwright/test';

import { API, apiLogin, uiLogin, URLS } from './helpers';

const STUDENT = 'student.myanmar@demo.hangyul.kr';
const ALLOWED = new Set(['TOPIK', 'IELTS', 'TOEFL', 'KRW', 'USD', 'Hangyul', 'Univ', 'PDF', 'JPG', 'PNG']); // file types are format names

/** Visible text of <main> → Latin-script words that are not allowed tokens or known proper names. */
export async function latinLeaks(page: Page, properNames: string[]): Promise<string[]> {
  // Same rules as scripts/qa/leak-check.mjs: text people wrote ([data-user-content]), quoted official sources and
  // decorative initials (avatars, university marks — aria-hidden) are not interface text.
  const text = await page.locator('main').evaluate((main) => {
    const parts: string[] = [];
    const walk = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      const el = n.parentElement;
      if (!el || el.closest('[data-user-content],[data-source-quote],[aria-hidden=true],.hg-avatar,script,style')) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || el.closest('details:not([open]) > :not(summary)')) continue;
      parts.push(n.textContent ?? '');
    }
    return parts.join(' ');
  });
  const proper = new Set(properNames.join(' ').split(/[\s·,()]+/).filter(Boolean));
  const out = new Set<string>();
  for (const raw of text.split(/\s+/)) {
    const w = raw.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    if (!/[A-Za-z]/.test(w)) continue;
    if (/\d/.test(w)) continue; // D-2-2, codes, receipt / passport numbers, dates
    if (/@/.test(w) || /^[\w-]+(\.[\w-]+)+$/.test(w)) continue; // e-mails, domains
    if (ALLOWED.has(w) || proper.has(w)) continue;
    out.add(w);
  }
  return [...out];
}

test('FLOW C — Burmese core workflow without English leakage', async ({ page, request }) => {
  const sh = await apiLogin(request, STUDENT, 'student');
  const plan = await (await request.get(`${API}/me/visa-route`, { headers: sh })).json();
  const apps = await (await request.get(`${API}/applications`, { headers: sh })).json();
  const items = (apps.items ?? apps) as { id: string; university?: { name_en?: string; name_ko?: string } | null; program?: { name_en?: string } | null }[];
  const me = await (await request.get(`${API}/auth/me`, { headers: sh })).json().catch(() => ({}));
  const dash = await (await request.get(`${API}/me/dashboard`, { headers: sh })).json().catch(() => ({}));
  const team = [dash?.counselor?.organization ?? '', dash?.counselor?.counselor?.full_name ?? ''];
  const proper = [
    plan.inputs?.university?.name_en ?? '', plan.inputs?.program?.name_en ?? '', me?.full_name ?? me?.user?.full_name ?? 'Hnin Wai Phyo', 'Hnin', 'Wai', 'Phyo',
    ...items.flatMap((a) => [a.university?.name_en ?? '', a.program?.name_en ?? '']), ...team,
  ];

  await page.addInitScript(() => { try { localStorage.setItem('hg.locale', 'my'); } catch { /* ignore */ } });
  await uiLogin(page, 'student', STUDENT, undefined, 'my');
  const leaks: Record<string, string[]> = {};

  // Home
  await page.goto(`${URLS.student}/`);
  await page.waitForLoadState('networkidle');
  leaks.home = await latinLeaks(page, proper);

  // Application
  if (items[0]) {
    await page.goto(`${URLS.student}/applications/${items[0].id}`);
    await page.waitForLoadState('networkidle');
    leaks.application = await latinLeaks(page, proper);
  }

  // Documents
  await page.goto(`${URLS.student}/documents`);
  await page.waitForLoadState('networkidle');
  leaks.documents = await latinLeaks(page, proper);

  // Visa (owned by the visa workstream: must be clean)
  await page.goto(`${URLS.student}/visa`);
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('ကျောင်းသားဗီဇာ');
  await expect(page.getByText('ရန်ကုန် ရှိ ကိုရီးယားသံရုံး').first()).toBeVisible();
  leaks.visa = await latinLeaks(page, proper);

  console.log('FLOW C Latin-script leaks per screen:', JSON.stringify(leaks, null, 2));
  test.info().annotations.push({ type: 'leaks', description: JSON.stringify(leaks) });
  for (const screen of ['home', 'application', 'documents'] as const) expect.soft(leaks[screen] ?? [], `English on ${screen}`).toEqual([]);
  expect(leaks.visa, 'English on the visa screen').toEqual([]);
});
