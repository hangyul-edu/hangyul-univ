import { brandAssets, Check, ChevronDown, ExternalLink, Search, ShieldCheck, TriangleAlert } from '@hangyul/icons';
import { changeLocale, translationQuality, useLocale, type Namespace } from '@hangyul/i18n';
import type { Country, Freshness } from '@hangyul/types';
import { countryName, cx, flagEmoji, formatDate } from '@hangyul/utils';
import { useMemo, useState, type ReactNode } from 'react';

import { Popover } from './overlays';

/**
 * The Hangyul lockup. V10: this renders the **brand asset** (`logo-combined.png` from the Hangyul BI kit, with an
 * @2x source for high-DPI screens) instead of the typeset "Hangyul Univ" string V1–V9 drew in CSS.
 *
 * `tone="light"` swaps to the variant whose wordmark ink is white, for dark surfaces (the university console
 * sidebar, any chrome over a photograph). The tangerine symbol is identical in both.
 *
 * The collapsed console rail hides `.hg-logo__full` and shows `.hg-logo__mark` (see styles/layout.css), so the
 * rail keeps the symbol alone rather than a clipped lockup.
 */
/**
 * `below` marks a lockup that is **not** in the first viewport — the footer's, in practice. V20's
 * §48 check found the footer logo loading eagerly 3,600 px down every page in the product: 40 KB of
 * brand asset competing with the hero photograph for the first connections. The header's lockup keeps
 * the default, because it is the LCP candidate on several routes and deferring it would be worse.
 */
export function Logo({ product, href = '/', as: As, tag, tone = 'dark', below }: {
  product?: string; href?: string; as?: React.ElementType; tag?: string; tone?: 'dark' | 'light'; below?: boolean;
}) {
  const { t } = useLocale('common');
  const Comp = As ?? 'a';
  const light = tone === 'light';
  const src = light ? brandAssets.logoCombinedLight : brandAssets.logoCombined;
  const src2x = light ? brandAssets.logoCombinedLight2x : brandAssets.logoCombined2x;
  return (
    <Comp className="hg-logo" {...(As ? { to: href } : { href })} aria-label={`${t('brand.name')}${product ? ` ${product}` : ''}`}>
      <img className="hg-logo__mark" src={brandAssets.symbol} alt="" width={27} height={32} aria-hidden loading={below ? 'lazy' : undefined} />
      <span className="hg-logo__full">
        <img className="hg-logo__img" src={src} srcSet={`${src} 1x, ${src2x} 2x`} alt="" width={456} height={96} loading={below ? 'lazy' : undefined} decoding={below ? 'async' : undefined} />
        {tag && <span className="hg-logo__tag">{tag}</span>}
      </span>
    </Comp>
  );
}

/**
 * Shows provenance for any time-sensitive fact. Synthetic seed data (`verification_status = DEMO`) carries no per-row label:
 * a development environment is never announced in product chrome, and synthetic data never exists outside test databases (V32).
 * Its provenance stays reachable through the plain source link when one is present.
 */
export function FreshnessBadge({ data, compact, sourceName }: { data: Partial<Freshness> | null | undefined; compact?: boolean; sourceName?: string }) {
  const { t, locale } = useLocale('common');
  if (!data) return null;
  const status = data.verification_status;
  if (status === 'DEMO') {
    if (compact || !data.source_url) return null;
    return (
      <span className="hg-fresh">
        <a href={data.source_url} target="_blank" rel="noreferrer">
          {sourceName ?? t('freshness.source')}
          <ExternalLink aria-hidden style={{ display: 'inline', marginInlineStart: 2, verticalAlign: '-2px' }} />
        </a>
      </span>
    );
  }
  const date = data.verified_at ? formatDate(data.verified_at, locale) : null;
  const warn = status === 'REVIEW_DUE' || status === 'CHANGED' || status === 'CONFLICT';
  return (
    <span className="hg-fresh">
      {warn ? <TriangleAlert aria-hidden style={{ color: 'var(--hg-status-warning-fg)' }} /> : <ShieldCheck aria-hidden style={{ color: 'var(--hg-status-success-fg)' }} />}
      {status === 'REVIEW_DUE' ? t('freshness.reviewDue') : status === 'CHANGED' ? t('freshness.changed') : status === 'CONFLICT' ? t('freshness.conflict') : date ? t('freshness.verified', { date }) : t('freshness.unverified')}
      {!compact && data.source_url && (
        <>
          {' · '}
          <a href={data.source_url} target="_blank" rel="noreferrer">
            {sourceName ?? t('freshness.source')}
            <ExternalLink aria-hidden style={{ display: 'inline', marginInlineStart: 2, verticalAlign: '-2px' }} />
          </a>
        </>
      )}
    </span>
  );
}

/**
 * Which locales the language picker offers. The student app (set by bootWebApp for client 'student') offers only
 * locales that pass the V9 student gate (isStudentAppLocale: full student-journey manifest + passing leak check);
 * every other surface (marketing site, consoles) offers all LOCALES.
 */
// `setLanguagePickerSurface` lived here and set module state for `LanguageSwitcher`. Both are gone;
// `setLocaleSelectorSurface` in ./locale-selector.tsx is the one that matters now.

/*
 * `LanguageSwitcher` lived here from V8 to V13. It is deleted, not deprecated: V14's `LocaleSelector`
 * (./locale-selector.tsx) replaces it everywhere — header pills, settings pages, the public quick check and
 * the sponsor view — and leaving a second, older language UI in the package is how a product ends up with
 * two of them again. It had no flags, searched three fields instead of six, offered a 55-item list with no
 * market ordering, and wrote only to `localStorage` rather than to the URL.
 */

/** Searchable country picker with flags, native names and aliases ("Burma", "Viet Nam"). */
export function CountrySelect({ countries, value, onChange, label, placeholder, priorityFirst = true, invalid }: {
  countries: Country[];
  value: string | null | undefined;
  onChange: (code: string) => void;
  label: string;
  placeholder?: string;
  priorityFirst?: boolean;
  invalid?: boolean;
}) {
  const { t, locale } = useLocale('common');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const selected = countries.find((c) => c.code === value);
  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const list = countries.filter((c) => {
      if (!ql) return true;
      const local = countryName(c.code, locale).toLowerCase();
      return local.includes(ql) || c.name_en.toLowerCase().includes(ql) || (c.name_native ?? '').toLowerCase().includes(ql) || (c.name_ko ?? '').includes(ql) || c.code.toLowerCase() === ql || c.aliases.some((a) => a.toLowerCase().includes(ql));
    });
    return priorityFirst ? list : [...list].sort((a, b) => countryName(a.code, locale).localeCompare(countryName(b.code, locale)));
  }, [countries, q, locale, priorityFirst]);
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      align="start"
      width={320}
      trigger={(p) => (
        <button type="button" className="hg-sel" aria-label={label} aria-invalid={invalid || undefined} data-open={open || undefined} {...p} aria-haspopup="listbox">
          <span className="hg-sel__value">{selected ? `${flagEmoji(selected.code)}  ${countryName(selected.code, locale)}` : <span className="hg-subtle">{placeholder ?? t('form.selectPlaceholder')}</span>}</span>
          <ChevronDown className="hg-sel__chev" aria-hidden />
        </button>
      )}
    >
      {(close) => (
        <div>
          <div className="hg-input-icon" style={{ padding: 4 }}>
            <Search aria-hidden style={{ insetInlineStart: 16 }} />
            <input className="hg-input hg-input--sm" placeholder={t('form.searchPlaceholder')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={label} autoFocus />
          </div>
          <div role="listbox" aria-label={label} style={{ maxHeight: 300, overflowY: 'auto', marginTop: 4 }}>
            {filtered.length === 0 && <div className="hg-muted hg-small" style={{ padding: 12 }}>{t('form.noOptions')}</div>}
            {filtered.map((c) => (
              <button key={c.code} role="option" aria-selected={c.code === value} className="hg-menu-item" onClick={() => { onChange(c.code); setQ(''); close(); }}>
                <span aria-hidden style={{ fontSize: 18 }}>{flagEmoji(c.code)}</span>
                <span className="hg-grow">
                  {countryName(c.code, locale)}
                  {c.name_native && c.name_native !== countryName(c.code, locale) && <span className="hg-subtle hg-xs" style={{ marginInlineStart: 6 }}>{c.name_native}</span>}
                </span>
                {c.code === value && <Check aria-hidden />}
              </button>
            ))}
          </div>
        </div>
      )}
    </Popover>
  );
}

export function SectionTitle({ eyebrow, title, subtitle, action, center }: { eyebrow?: ReactNode; title: ReactNode; subtitle?: ReactNode; action?: ReactNode; center?: boolean }) {
  return (
    <div className={cx('hg-row hg-between')} style={{ alignItems: 'flex-end', marginBottom: 16, textAlign: center ? 'center' : undefined, justifyContent: center ? 'center' : undefined, flexWrap: 'wrap' }}>
      <div style={{ minWidth: 0 }}>
        {eyebrow && <div className="hg-eyebrow" style={{ marginBottom: 6 }}>{eyebrow}</div>}
        <h2 className="hg-title-md">{title}</h2>
        {subtitle && <p className="hg-muted hg-small" style={{ marginTop: 4 }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/**
 * Honest translation status: machine-drafted or incomplete languages say so and offer English.
 * Dismissal is remembered per locale in this browser only.
 */
export function TranslationNotice({ ns, surface }: { ns: Namespace; surface?: 'student' }) {
  const { t, locale } = useLocale('common');
  // V9: in the student app the notice reflects the student-journey gate, not raw namespace coverage.
  const q = translationQuality(locale, ns, surface);
  const key = `hg.i18n.notice.${locale}`;
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem(key) === '1'; } catch { return false; } });
  const needed = q.status === 'MACHINE_DRAFT' || (q.status !== 'SOURCE_APPROVED' && !q.complete);
  if (!needed || hidden) return null;
  const text = q.status === 'MACHINE_DRAFT' ? t('i18n.machine', { percent: q.coverage }) : t('i18n.partial', { percent: q.coverage });
  return (
    <div className="hg-i18n-notice" role="note">
      <span>{text}</span>
      <button type="button" className="hg-btn hg-btn--link hg-btn--sm" onClick={() => changeLocale('en')}>{t('i18n.useEnglish')}</button>
      <button type="button" className="hg-btn hg-btn--ghost hg-btn--sm" aria-label={t('actions.close')}
        onClick={() => { setHidden(true); try { localStorage.setItem(key, '1'); } catch { /* ignore */ } }}>×</button>
    </div>
  );
}
