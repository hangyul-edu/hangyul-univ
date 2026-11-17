import { useLocale } from '@hangyul/i18n';
import { HANGYUL_UNIV_BRAND, HANGYUL_UNIV_SITE_URL } from '@hangyul/icons';
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
 * The same tags exist in the **static HTML** — `index.html` for the homepage and the pages
 * `scripts/seo/prerender-meta.mjs` writes at build time for the directory and every university — because
 * link-preview crawlers do not run this hook. This hook keeps them right while the visitor navigates and
 * localises them; it updates the existing tags in place, so there is never a second copy.
 *
 * The card is the owner-supplied 1200×630 image, always as an absolute URL on the public origin (never the
 * current host, which may be a preview or localhost). A page may pass its own `image` only if it is a public,
 * permanent, same-site asset; nothing does today, so every page falls back to the Hangyul Univ card.
 *
 * The canonical URL is the public origin plus the path, with query and hash dropped, so a filtered or
 * anchor-linked view does not advertise itself as a separate page. `og:locale` reflects the chosen language.
 */
export function useSeo({ title, description, image }: { title: string; description?: string; image?: string }) {
  const { t, locale } = useLocale('common');
  const brand = t('brand.name');
  useEffect(() => {
    const full = title.includes(brand) || title.includes('Hangyul') ? title : `${title} · ${brand}`;
    document.title = full;
    const url = `${HANGYUL_UNIV_SITE_URL}${window.location.pathname}`;
    const card = image ? new URL(image, HANGYUL_UNIV_SITE_URL).toString() : HANGYUL_UNIV_BRAND.social.og;

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
