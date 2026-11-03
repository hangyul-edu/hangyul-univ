/**
 * **테스트 계정으로 로그인** — the one secondary action that gets a reviewer into a console (REPORT §134).
 *
 * Why it exists: the only ways in were to type a seeded email and `Hangyul!2026`, or to go through
 * `/__dev`, which is a developer screen. Neither is something you hand to someone reviewing the product.
 *
 * Four rules it follows, and each is a thing the brief rules out by name:
 *
 *   **It is visually secondary.** The normal sign-in button stays primary; this is an outlined button under
 *   a `또는` divider. A reviewer sees one way in; a customer sees the way in they expect.
 *
 *   **The default path is one click.** One button, one seeded persona (`TEST_ACCOUNTS`), straight to
 *   the console's landing screen. The other states sit behind "다른 테스트 계정 선택", not a wall of persona cards.
 *
 *   **It says nothing engineering-flavoured.** No DEV, no DEMO, no FIXTURE. "테스트 계정으로 로그인" is a
 *   sentence a non-engineer reads and understands.
 *
 *   **It does not exist in production — and this file is why it is a *file*.**
 *   `demoAccessEnabled()` returning false at runtime is not enough: a component that is imported and
 *   rendered keeps its string literals and its props in the bundle however early it returns. `npm run
 *   qa:v16` caught exactly that — a production build still carried `테스트 계정으로 로그인` and three
 *   `@demo.hangyul.kr` addresses. So the component lives in its own entry, the console imports it
 *   **dynamically behind a build-time constant**, and Vite folds the condition to `false`, drops the
 *   branch, and never emits the chunk. The emails live in `@hangyul/auth/demo-personas`, which is dropped
 *   the same way.
 *
 * It renders **nothing** after sign-in. The shortcut's whole job is the door; the room behind it has to
 * look like a real product (brief Part 8).
 */
import { useOptionalAuth, type DemoProduct } from '@hangyul/auth';
import { TEST_ACCOUNTS } from '@hangyul/auth/demo-personas';
import { useLocale } from '@hangyul/i18n';
import { useState } from 'react';

import { productUrl } from './devaccess';
import './test-access.css';

/**
 * This block's own copy, **inline rather than in the locale bundles**.
 *
 * `npm run qa:v16` caught the second half of the same lesson as the component split: the emails were gone
 * from the production bundle but `테스트 계정으로 로그인` was still in it, because it lived in
 * `common.json` and every console ships its locale resources. A string in a resource bundle is not a
 * credential and renders nowhere — but the requirement is that a production build contains *no* test-login
 * UI, and "no" is easier to verify than "harmless".
 *
 * So the copy lives here, in the module a production build drops, in the twelve languages a reviewer of
 * this product might use. Anything else falls back to English, which for a development-only shortcut is
 * the right trade: the alternative is 52 locales of a label nobody outside the team ever sees.
 */
const COPY: Record<string, { title: string; or: string; more: string }> = {
  'ar': { title: 'تسجيل الدخول بحساب تجريبي', or: 'أو', more: 'اختيار حساب تجريبي آخر' },
  'en': { title: 'Sign in with test account', or: 'or', more: 'Choose another test account' },
  'ja': { title: 'テストアカウントでログイン', or: 'または', more: '別のテストアカウントを選ぶ' },
  'ko': { title: '테스트 계정으로 로그인', or: '또는', more: '다른 테스트 계정 선택' },
  'mn': { title: 'Туршилтын бүртгэлээр нэвтрэх', or: 'эсвэл', more: 'Өөр туршилтын бүртгэл сонгох' },
  'my': { title: 'စမ်းသပ်အကောင့်ဖြင့် ဝင်ရန်', or: 'သို့မဟုတ်', more: 'အခြားစမ်းသပ်အကောင့် ရွေးရန်' },
  'ne': { title: 'परीक्षण खाताबाट लग इन', or: 'वा', more: 'अर्को परीक्षण खाता छान्नुहोस्' },
  'ru': { title: 'Войти с тестовым аккаунтом', or: 'или', more: 'Выбрать другой тестовый аккаунт' },
  'uz': { title: 'Test hisob bilan kirish', or: 'yoki', more: 'Boshqa test hisobini tanlash' },
  'vi': { title: 'Đăng nhập bằng tài khoản thử', or: 'hoặc', more: 'Chọn tài khoản thử khác' },
  'zh-Hans': { title: '使用测试账号登录', or: '或', more: '选择其他测试账号' },
  'zh-Hant': { title: '使用測試帳號登入', or: '或', more: '選擇其他測試帳號' },
};
const copyFor = (locale: string) => COPY[locale] ?? COPY[locale.split('-')[0]] ?? COPY.en;

export default function TestAccountSignIn({ product, onDone }: {
  product: DemoProduct;
  onDone: () => void;
}) {
  const { demoLogin } = useOptionalAuth() ?? {};
  const { locale } = useLocale('common');
  const c = copyFor(locale);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const roles = TEST_ACCOUNTS[product];
  if (roles.length === 0) return null;

  const signIn = async (email: string) => {
    setError(null);
    if (!demoLogin) {
      // No auth context on this surface (marketing): hand off to the app's own login with `?demo=`.
      window.location.assign(`${productUrl(product)}/login?demo=${encodeURIComponent(email)}`);
      return;
    }
    setBusy(email);
    try {
      await demoLogin(email);
      onDone();
    } catch (e) {
      // The same inline treatment a wrong password gets. A separate error style here would be a second
      // error vocabulary on a screen with one form.
      setError((e as Error).message);
      setBusy(null);
    }
  };

  const [primary, ...rest] = roles;
  return (
    <div className="hg-testlogin">
      <div className="hg-testlogin__or"><span>{c.or}</span></div>
      {error && <p className="hg-testlogin__error">{error}</p>}
      <button type="button" className="hg-btn hg-btn--secondary hg-btn--lg hg-btn--block"
        disabled={!!busy} aria-busy={busy === primary.email} onClick={() => signIn(primary.email)}>
        {c.title}
      </button>
      {rest.length > 0 && (
        <>
          {/* A disclosure, not a second set of buttons. Collapsed, the screen still reads as one form and
              one alternative; expanded, a reviewer who needs the manager's view can have it. */}
          <button type="button" className="hg-testlogin__more" aria-expanded={more} onClick={() => setMore(!more)}>
            {c.more}
          </button>
          {more && (
            <ul className="hg-testlogin__roles">
              {rest.map((r) => (
                <li key={r.email}>
                  <button type="button" disabled={!!busy} aria-busy={busy === r.email} onClick={() => signIn(r.email)}>
                    {locale === 'ko' ? r.ko : r.en}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
