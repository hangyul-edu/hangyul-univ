import { useLocale } from '@hangyul/i18n';
import { useEffect } from 'react';

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setLink(rel: string, href: string, extra?: Record<string, string>) {
  const sel = extra?.hreflang ? `link[rel="${rel}"][hreflang="${extra.hreflang}"]` : `link[rel="${rel}"]:not([hreflang])`;
  let el = document.head.querySelector<HTMLLinkElement>(sel);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    for (const [k, v] of Object.entries(extra ?? {})) el.setAttribute(k, v);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

/**
 * Per-route document title, description, canonical and social cards.
 *
 * V10: the Open Graph identity is Hangyul's own — a 1200×630 card built from the Hangyul photo library with the
 * BI lockup (`/og/hangyul-univ.jpg`). Nothing here descends from the Koreanasha template, whose `index.html`
 * carried `og:image: assets/img/pre_img.png`, `og:url`/canonical pointing at `edu.koreanasha.com`, a
 * `naver-site-verification` token and a Russian keyword block — none of which exist in this codebase.
 *
 * The canonical URL is the current origin plus the path, with query and hash dropped, so a filtered or
 * anchor-linked view does not advertise itself as a separate page. `og:locale` reflects the chosen language.
 */
export function useSeo({ title, description, image }: { title: string; description?: string; image?: string }) {
  const { t, locale } = useLocale('common');
  const brand = t('brand.name');
  useEffect(() => {
    const full = title.includes(brand) || title.includes('Hangyul') ? title : `${title} · ${brand}`;
    document.title = full;
    const url = `${window.location.origin}${window.location.pathname}`;
    const card = new URL(image ?? '/og/hangyul-univ.jpg', window.location.origin).toString();

    setMeta('property', 'og:title', full);
    setMeta('property', 'og:site_name', brand);
    setMeta('property', 'og:type', 'website');
    setMeta('property', 'og:url', url);
    setMeta('property', 'og:image', card);
    setMeta('property', 'og:image:alt', brand);
    setMeta('property', 'og:locale', locale.replace('-', '_'));
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', full);
    setMeta('name', 'twitter:image', card);
    setLink('canonical', url);

    if (description) {
      setMeta('name', 'description', description);
      setMeta('property', 'og:description', description);
      setMeta('name', 'twitter:description', description);
    }
  }, [title, description, image, brand, locale]);
}
