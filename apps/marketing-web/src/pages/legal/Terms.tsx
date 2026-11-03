/**
 * Hangyul Univ 이용약관 (V12, brief Part 4).
 *
 * Sixteen articles in the structure the brief fixes. Two of them are conditional on configuration rather than
 * on copy, and that is the point of the page:
 *
 *  - **제8조 (fees)** renders the real `service_prices` catalogue when prices are approved. Today they are demo
 *    values (`docs/LEGAL_DEPENDENCIES.md` L5, OPEN), so the article states how pricing is shown and where it is
 *    confirmed, and quotes no figure. An imaginary price in a contract is worse than no price.
 *  - **제9조 (refunds)** states only the refund rules that exist in the product — the visa-refusal case the
 *    service actually implements, and that tuition is paid by the student directly to the university and
 *    refunded by the university to the student's own account. Hangyul's own fee refund ladder has not been
 *    approved, so none is published, and no placeholder stands in for it.
 *  - **제15조 (governing law)** appears only once the agreed wording is configured.
 *
 * 제6조 carries the single limitation-of-outcome sentence for the whole product. V11 repeated the equivalent of
 * it in the footer of every page, on visa cards, on university cards and in the FAQ; it belongs here, once
 * (brief Part 5).
 */
import { useLocale } from '@hangyul/i18n';
import { Trans } from 'react-i18next';
import { LocaleLink } from '../../components/LocaleLink';

import { REFUND_POLICY } from '@hangyul/types';

import { LegalLayout, LegalTable, type LegalSection } from '../../components/LegalLayout';
import { LEGAL_ENTITY } from '../../lib/legal/entity';
import { useSeo } from '../../lib/useSeo';
import '../../styles/directory.css';

export default function Terms() {
  const { t } = useLocale(['marketing', 'common']);
  useSeo({ title: t('v12.seo.terms.title'), description: t('v12.seo.terms.description') });
  const e = LEGAL_ENTITY;

  const para = (key: string): LegalSection => ({
    id: key,
    heading: t(`v12.terms.${key}.h`),
    body: <p>{t(`v12.terms.${key}.p`)}</p>,
  });

  const sections: LegalSection[] = [];

  sections.push(para('purpose'));

  // 제2조 용어 — only the terms that really appear in this document and in the product.
  sections.push({
    id: 'definitions',
    heading: t('v12.terms.definitions.h'),
    body: (
      <dl className="mk-legal__deflist">
        {['service', 'member', 'support', 'agency', 'university', 'content'].map((k) => (
          <div key={k}>
            <dt>{t(`v12.terms.definitions.${k}.term`)}</dt>
            <dd>{t(`v12.terms.definitions.${k}.def`)}</dd>
          </div>
        ))}
      </dl>
    ),
  });

  sections.push(para('accounts'));

  // 제4조 서비스의 내용 — what Hangyul may provide. "May", because the scope of any one case depends on the
  // plan the student bought, which the article says in its own last line rather than in a disclaimer box.
  sections.push({
    id: 'services',
    heading: t('v12.terms.services.h'),
    body: (
      <>
        <p>{t('v12.terms.services.intro')}</p>
        <ul>
          {['info', 'profile', 'documents', 'writing', 'applications', 'counselling', 'visa', 'arrival', 'messages'].map((k) => (
            <li key={k}>{t(`v12.terms.services.${k}`)}</li>
          ))}
        </ul>
        <p>{t('v12.terms.services.scope')}</p>
      </>
    ),
  });

  sections.push(para('universityInfo'));

  // 제6조 유학 지원 서비스 — who is responsible for what, and the one outcome sentence for the whole product.
  sections.push({
    id: 'support',
    heading: t('v12.terms.support.h'),
    body: (
      <>
        <p>{t('v12.terms.support.coordination')}</p>
        <p>{t('v12.terms.support.agency')}</p>
        <p>{t('v12.terms.support.responsible')}</p>
        <p className="mk-legal__key">{t('v12.terms.support.decisions')}</p>
      </>
    ),
  });

  sections.push(para('duties'));

  // 제8조 이용료와 결제 — how price is shown, not what it is.
  sections.push({
    id: 'fees',
    heading: t('v12.terms.fees.h'),
    body: (
      <>
        <p>{t('v12.terms.fees.shown')}</p>
        <p>{t('v12.terms.fees.provider')}</p>
        <p>{t('v12.terms.fees.tuition')}</p>
      </>
    ),
  });

  // 제9조 취소 및 환불 — rendered from the canonical refund-policy model (V22, REPORT §245 L4). Only statutory rights are
  // stated; the commercial deduction schedule is OWNER_POLICY_REQUIRED and is described as not yet published, never invented.
  sections.push({
    id: 'refunds',
    heading: t('v12.terms.refunds.h'),
    body: (
      <>
        <p>{t('v12.terms.refunds.withdrawal')}</p>
        <p>{t('v12.terms.refunds.commenced')}</p>
        <p>{t('v12.terms.refunds.nonConforming')}</p>
        <p>{t('v12.terms.refunds.effect')}</p>
        <p>{t('v12.terms.refunds.stagesIntro')}</p>
        <LegalTable
          head={[t('v12.terms.refunds.colStage'), t('v12.terms.refunds.colRule')]}
          rows={REFUND_POLICY.stages.map((s) => [t(`v12.terms.refunds.stage.${s.key}`), t(`v12.terms.refunds.rule.${s.statutory}`)])}
        />
        {!REFUND_POLICY.commercial_schedule_approved && <p>{t('v12.terms.refunds.commercial')}</p>}
        <p>{t('v12.terms.refunds.route')}</p>
        <p>{t('v12.terms.refunds.visaRefusal')}</p>
        <p>{t('v12.terms.refunds.statutory')}</p>
      </>
    ),
  });

  sections.push({
    id: 'privacy',
    heading: t('v12.terms.privacy.h'),
    body: (
      <p>
        <Trans t={t} i18nKey="v12.terms.privacy.p" components={{ privacy: <LocaleLink to="/privacy" /> }} />
      </p>
    ),
  });

  sections.push(para('ip'));
  sections.push(para('changes'));
  sections.push(para('termination'));
  sections.push(para('liability'));

  // 제15조 준거법 및 관할 — published only when the agreed wording exists (brief Part 25).
  if (e.governingLaw && e.jurisdiction) {
    sections.push({
      id: 'law',
      heading: t('v12.terms.law.h'),
      body: (
        <>
          <p>{e.governingLaw}</p>
          <p>{e.jurisdiction}</p>
        </>
      ),
    });
  }

  if (e.policyEffectiveOn) {
    sections.push({
      id: 'effective',
      heading: t('v12.terms.effective.h'),
      body: <p>{t('v12.terms.effective.p', { date: e.policyEffectiveOn })}</p>,
    });
  }

  return (
    <LegalLayout
      title={t('v12.terms.title')}
      summary={t('v12.terms.summary')}
      effective={e.policyEffectiveOn ? t('v12.legal.effective', { date: e.policyEffectiveOn }) : null}
      sections={sections}
      footNote={<p>{t('v12.terms.intro')}</p>}
    />
  );
}
