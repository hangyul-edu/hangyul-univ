// Eduan building blocks ported to React (V7). Markup and class names follow themeforest-eduan/eduan so the
// template's own CSS (compiled from its SCSS in ../scss/eduan) applies; jQuery plugins are replaced:
//   bxSlider "ticker"  → <Ticker> (CSS marquee, paused for reduced motion, aria-hidden decoration)
//   WOW + animate.css  → <Reveal> (IntersectionObserver, no motion when reduced)
//   header-sticky JS   → useStickyHeader()
//   MeanMenu offcanvas → <Offcanvas> (focus trap, Escape, scroll lock)
import { X } from '@hangyul/icons';
import { cx } from '@hangyul/utils';
import { useEffect, useRef, useState, type CSSProperties, type ElementType, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** Eduan's outlined scrolling words ("Endless friendships, unforgettable memories", "Apply for Admission"…). */
export function Ticker({ text, className, as: As = 'p', speed = 40 }: { text: string; className?: string; as?: ElementType; speed?: number }) {
  // Four copies so the loop never shows a gap on wide screens; the track moves by exactly one half.
  return (
    <div className="ed-ticker" aria-hidden>
      <div className="ed-ticker__track" style={{ '--ed-ticker-s': `${speed}s` } as CSSProperties}>
        {[0, 1, 2, 3].map((i) => <As key={i} className={cx('ed-ticker__item', className)}>{text}</As>)}
      </div>
    </div>
  );
}

/** WOW.js `fadeInUp` replacement. Content is visible without JS and when motion is reduced. */
export function Reveal({ children, as: As = 'div', className, delay = 0, style }: { children: ReactNode; as?: ElementType; className?: string; delay?: number; style?: CSSProperties }) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setShown(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } }, { rootMargin: '0px 0px -8% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <As ref={ref} className={cx('ed-reveal', shown && 'is-in', className)} style={{ ...style, transitionDelay: delay ? `${delay}ms` : undefined }}>
      {children}
    </As>
  );
}

/** `section-area-6` heading block: optional subtitle chip, title, text. */
export function SectionTitle({ subtitle, title, text, center, id, light, className, as: As = 'h2' }: {
  subtitle?: ReactNode; title: ReactNode; text?: ReactNode; center?: boolean; id?: string; light?: boolean; className?: string; as?: ElementType;
}) {
  return (
    <div className={cx('section-area-6', center && 'text-center', light && 'ed-light', className)}>
      {subtitle && <span className="section-subtitle">{subtitle}</span>}
      <As id={id} className={cx('section-title', text ? 'mb-15' : 'mb-0')}>{title}</As>
      {text && <p className="section-text">{text}</p>}
    </div>
  );
}

/** Eduan's `.header-sticky` → `.sticky` after the hero scrolls away. */
export function useStickyHeader(threshold = 120) {
  const [sticky, setSticky] = useState(false);
  useEffect(() => {
    const on = () => setSticky(window.scrollY > threshold);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, [threshold]);
  return sticky;
}

/** `sidebar-info side-info` offcanvas (MeanMenu) as an accessible dialog. */
export function Offcanvas({ open, onClose, title, logo, children, closeLabel }: {
  open: boolean; onClose: () => void; title: string; logo?: ReactNode; children: ReactNode; closeLabel: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current;
    el?.querySelector<HTMLElement>('a,button')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && el) {
        const f = Array.from(el.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),select'));
        if (!f.length) return;
        const first = f[0]; const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; prev?.focus(); };
  }, [open, onClose]);
  if (typeof document === 'undefined') return null;
  return createPortal(
    <>
      <div ref={ref} className={cx('sidebar-info side-info ed-offcanvas', open && 'info-open')} role="dialog" aria-modal="true" aria-label={title} inert={!open ? true : undefined}>
        <div className="sidebar-logo-wrapper mb-25 d-flex align-items-center justify-content-between">
          <div className="sidebar-logo">{logo}</div>
          <button type="button" className="sidebar-close side-info-close" onClick={onClose} aria-label={closeLabel}><X aria-hidden /></button>
        </div>
        <div className="sidebar-menu-wrapper fix">{children}</div>
      </div>
      <div className={cx('offcanvas-overlay', open && 'overlay-open')} onClick={onClose} aria-hidden />
    </>,
    document.body,
  );
}

/** Eduan's arrow-up-right / arrow-right glyphs (Font Awesome Pro in the template) as inline SVG. */
export function ArrowUpRight({ className }: { className?: string }) {
  return (
    <svg className={cx('ed-icon hg-flip-rtl', className)} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M7 17 17 7M8 7h9v9" />
    </svg>
  );
}
export function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg className={cx('ed-icon hg-flip-rtl', className)} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 12h16M14 6l6 6-6 6" />
    </svg>
  );
}
