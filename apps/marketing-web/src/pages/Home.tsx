import { useLocale } from '@hangyul/i18n';

import { useSeo } from '../lib/useSeo';
import { KoreaHero, Questions, Services, UniversityCrests, WhyKorea } from './home/v11';
import { Pricing } from './home/pricing';
import '../styles/home.css';

/**
 * V11 home (REPORT §75.3) — six sections, in Koreanasha's composition and Koreanasha's own Korean words.
 *
 *   1 Hero ........... "Do I want this?"                 full-viewport photograph, `banner_*` verbatim
 *   2 Universities ... "Where could I study?"            three rows of real crests, moving left/right/left
 *   3 Why ............ "Why with help at all?"           `why_koreanasha_*` verbatim
 *   4 Services ....... "What do you actually do for me?" `koreanasha_services_*` verbatim, photo/text rows
 *   5 Pricing ........ "What does this cost me?"         V15 — the three plans, from the shared manifest
 *   6 FAQ ............ "TOPIK? Documents? Age? Money?"   `faq_q1–10` / `faq_a1–10` verbatim
 *   7 Continue ....... "How do I start?"                 the site layout's closing band
 *
 * V10's nine movements lost three to merging and three outright: the programmes band (the catalogue is one click
 * away and that is where deadlines belong), the quick-eligibility form (Part 7 — no form on this page), the four
 * "Hangyul at work" product screenshots (Part 6 — the marketing site does not demonstrate the backend), the
 * journey band (Koreanasha's own service row 2 already covers arrival and settling in), our own FAQ (replaced by
 * Koreanasha's ten questions) and the Trust band (its sourced figures now live on /credits).
 */
export default function Home() {
  const { t } = useLocale('marketing');
  useSeo({ title: t('seo.home.title'), description: t('seo.home.description') });
  return (
    <div className="kn-home">
      <KoreaHero />
      <UniversityCrests />
      <WhyKorea />
      <Services />
      <Pricing />
      <Questions />
    </div>
  );
}
