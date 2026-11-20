/**
 * **Design Preview mode** — owner review of signed-in and paid screens, with no sign-in and no payment.
 *
 * ONE flag controls everything: `VITE_ENABLE_DESIGN_PREVIEW=1` at build time. It is read here and nowhere
 * else; every entry point, the indicator and the transport hang off `DESIGN_PREVIEW_ENABLED`. With the flag
 * unset the constant folds to `false`, the entries render nothing, and the transport and its synthetic
 * bundles are dropped from the build (`npm run release:preview-gate` proves it).
 *
 * This is not the removed demo login. Nothing is authenticated: the API client is built with a `fetch` that
 * answers from synthetic fixtures (`@hangyul/api-client/preview`) and never touches the network, so preview
 * cannot read real records, write anything, pay, message, upload or export. The choice is kept in
 * `sessionStorage` (per tab, gone when the tab closes) and takes effect on a full reload, so a preview and
 * a real session never share one running app.
 */
import type { PreviewApp, PreviewVariant } from '@hangyul/api-client/preview';
import { i18next, loadNamespaces } from '@hangyul/i18n';
import { Eye } from '@hangyul/icons';
import { useEffect, useState } from 'react';

export const DESIGN_PREVIEW_ENABLED: boolean = import.meta.env.VITE_ENABLE_DESIGN_PREVIEW === '1';
export const DESIGN_PREVIEW_KEY = 'hg.designPreview';

/** The active preview variant, or null. Always null when the flag is off, whatever is in storage. */
export function designPreviewVariant(): PreviewVariant | null {
  if (!DESIGN_PREVIEW_ENABLED) return null;
  try {
    const v = sessionStorage.getItem(DESIGN_PREVIEW_KEY);
    return v === 'paid' || v === 'unpaid' || v === 'hq' ? v : null;
  } catch { return null; }
}

const home = () => `${(import.meta.env.BASE_URL || '/').replace(/\/+$/, '')}/`;

export function enterDesignPreview(variant: PreviewVariant, to = home()) {
  if (!DESIGN_PREVIEW_ENABLED) return;
  try { sessionStorage.setItem(DESIGN_PREVIEW_KEY, variant); } catch { return; }
  window.location.assign(to);
}

function exitDesignPreview() {
  try { sessionStorage.removeItem(DESIGN_PREVIEW_KEY); } catch { /* ignore */ }
  window.location.assign(`${home()}login`);
}

/** The synthetic transport for this app, or undefined when preview is not active. Called once, in `bootWebApp`. */
export async function designPreviewFetch(client: string): Promise<typeof fetch | undefined> {
  if (!DESIGN_PREVIEW_ENABLED) return undefined;
  const variant = designPreviewVariant();
  if (!variant || (client !== 'student' && client !== 'agency' && client !== 'university')) return undefined;
  const { loadPreviewBundle, previewFetch } = await import('@hangyul/api-client/preview');
  // Staff-written fixture sentences follow the interface language (owner pass 261119, req 7).
  const translate = (key: string, lng: string) => i18next.t(key, { lng, defaultValue: '' });
  const inner = previewFetch(await loadPreviewBundle(client as PreviewApp), variant, translate);
  // The first requests can leave before the reader's `common` bundle has loaded; wait for it so the sample notes are
  // translated on the very first screen too (they otherwise stayed English in some locales).
  return async (input, init) => {
    const lng = new Headers(init?.headers).get('Accept-Language')?.split(',')[0]?.trim();
    if (lng && !lng.startsWith('en')) await loadNamespaces(i18next, lng, ['common']).catch(() => undefined);
    return inner(input, init);
  };
}

/* The few strings of an owner-review tool live here rather than in the product's locale bundles. */
const COPY: Record<string, { login: string; paid: string; badge: string; exit: string; note: string; hq?: string }> = {
  en: { login: 'Preview without signing in', paid: 'Preview without paying', badge: 'Design Preview', exit: 'Exit', note: 'Sample data only. Nothing is saved.', hq: 'Preview Hangyul HQ screens' },
  ko: { login: '로그인 없이 화면 미리보기', paid: '결제 없이 화면 미리보기', badge: 'Design Preview', exit: '나가기', note: '샘플 데이터입니다. 저장되지 않습니다.', hq: '한귤 본사 화면 미리보기' },
  ja: { login: 'ログインせずに画面をプレビュー', paid: '支払いなしで画面をプレビュー', badge: 'Design Preview', exit: '終了', note: 'サンプルデータです。保存されません。' },
  vi: { login: 'Xem trước không cần đăng nhập', paid: 'Xem trước không cần thanh toán', badge: 'Design Preview', exit: 'Thoát', note: 'Chỉ là dữ liệu mẫu. Không lưu gì cả.' },
  'zh-Hans': { login: '无需登录预览界面', paid: '无需付款预览界面', badge: 'Design Preview', exit: '退出', note: '仅为示例数据，不会保存。' },
  'zh-Hant': { login: '無需登入預覽畫面', paid: '無需付款預覽畫面', badge: 'Design Preview', exit: '離開', note: '僅為範例資料，不會儲存。' },
  ru: { login: 'Предпросмотр без входа', paid: 'Предпросмотр без оплаты', badge: 'Design Preview', exit: 'Выйти', note: 'Только демонстрационные данные. Ничего не сохраняется.' },
  ar: { login: 'معاينة بدون تسجيل الدخول', paid: 'معاينة بدون دفع', badge: 'Design Preview', exit: 'خروج', note: 'بيانات نموذجية فقط. لا يُحفظ شيء.' },
};
const copy = () => COPY[i18next.language] ?? COPY[(i18next.language ?? 'en').split('-')[0]] ?? COPY.en;

/*
 * The three components below are chosen by the build-time constant, in this file and nowhere else. With the flag
 * off each one IS `() => null`, so the real implementations, the copy table and the storage key have no remaining
 * reference and the bundler drops them: a public-launch bundle contains no preview code at all
 * (`npm run release:preview-gate -- --bundles off`).
 */
const none = () => null;

/**
 * "Preview without signing in" — under a login form. `variant="hq"` (Operations login only) is the second, quieter entry
 * that opens the Hangyul HQ pages as a synthetic HQ staff member; it lands on `to`.
 */
export const DesignPreviewLoginEntry: (p: { variant?: PreviewVariant; to?: string }) => React.ReactNode = DESIGN_PREVIEW_ENABLED
  ? function DesignPreviewLoginEntry({ variant = 'paid', to }) {
    const hq = variant === 'hq';
    return (
      <button type="button" className={hq ? 'hg-preview-entry hg-preview-entry--secondary' : 'hg-preview-entry'} data-design-preview={hq ? 'login-hq' : 'login'}
        onClick={() => enterDesignPreview(variant, to ? `${home().replace(/\/$/, '')}${to}` : undefined)}>
        <Eye aria-hidden size={hq ? 14 : 16} />{hq ? copy().hq ?? COPY.en.hq : copy().login}
      </button>
    );
  }
  : none;

/** "Preview without paying" — under a plan/paywall area. Synthetic entitled state; creates no order or payment. */
export const DesignPreviewPaidEntry: () => React.ReactNode = DESIGN_PREVIEW_ENABLED
  ? function DesignPreviewPaidEntry() {
    return (
      <button type="button" className="hg-preview-entry hg-preview-entry--quiet" data-design-preview="paid" onClick={() => enterDesignPreview('paid')}>
        <Eye aria-hidden size={14} />{copy().paid}
      </button>
    );
  }
  : none;

/**
 * The indicator while preview is active (2026-11). It must always be visible and must never sit on content, at any
 * width — so by default it is a slim edge tab that lives entirely inside the page gutter (16 px at 320, wider
 * above), reading "Design Preview" along the inline-start edge; on a console wide enough to show its side panel it is
 * a small pill over the panel's empty bottom corner instead. Pressing the tab opens the pill with "Exit" (and
 * pressing it again, Escape or leaving it closes it), so the only time anything overlays the page is while the
 * reviewer is using it.
 */
export const DesignPreviewBadge: () => React.ReactNode = DESIGN_PREVIEW_ENABLED
  ? function DesignPreviewBadge() {
    const on = !!designPreviewVariant();
    const [open, setOpen] = useState(false);
    useEffect(() => {
      if (!on) return undefined;
      document.documentElement.setAttribute('data-design-preview', '');
      return () => document.documentElement.removeAttribute('data-design-preview');
    }, [on]);
    if (!on) return null;
    const c = copy();
    return (
      <div className="hg-preview-badge" role="status" data-design-preview="badge" data-open={open || undefined} title={c.note}
        onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
        onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false); }}>
        <button type="button" className="hg-preview-badge__tab" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <span className="hg-preview-badge__dot" aria-hidden />
          <span className="hg-preview-badge__label">{c.badge}</span>
        </button>
        <button type="button" className="hg-preview-badge__exit" onClick={exitDesignPreview}>{c.exit}</button>
      </div>
    );
  }
  : none;
