import { expect, test } from '@playwright/test';

import { API, apiLogin, uiLogin, URLS } from './helpers';

test('an agency cannot open another agency’s student, even by URL', async ({ page, request }) => {
  const lotus = await apiLogin(request, 'manager@lotus.demo.hangyul.kr', 'agency');
  const lotusStudent = (await (await request.get(`${API}/agency/students?page_size=1`, { headers: lotus })).json()).items[0];
  const silk = await apiLogin(request, 'manager@silk.demo.hangyul.kr', 'agency');
  expect((await request.get(`${API}/agency/students/${lotusStudent.id}`, { headers: silk })).status()).toBe(404);
  await uiLogin(page, 'agency', 'manager@silk.demo.hangyul.kr');
  await page.goto(`${URLS.agency}/students/${lotusStudent.id}`);
  await expect(page.getByText(lotusStudent.full_name)).toHaveCount(0);
});

test('a university only sees its own submitted applications', async ({ request }) => {
  const pnu = await apiLogin(request, 'admin@pusan.univ.demo.hangyul.kr', 'university');
  const items = (await (await request.get(`${API}/applications?page_size=200`, { headers: pnu })).json()).items as { university: { slug: string }; status: string }[];
  expect(items.length).toBeGreaterThan(0);
  expect(items.every((a) => a.university.slug === 'pusan-national-university')).toBeTruthy();
  expect(items.some((a) => ['DRAFT', 'DOCUMENT_PREPARATION', 'READY'].includes(a.status))).toBeFalsy();
});

test('a student account cannot sign in to the consoles', async ({ request }) => {
  const r = await request.post(`${API}/auth/login`, { data: { email: 'student@demo.hangyul.kr', password: 'Hangyul!2026', client: 'agency' } });
  expect(r.status()).toBe(403);
});
