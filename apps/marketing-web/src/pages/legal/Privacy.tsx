/**
 * 개인정보 처리방침 (V12, brief Part 3).
 *
 * Structured on the 2026 PIPC privacy-policy guidance, but every category, recipient and processor in it was
 * read out of this repository's own schema and configuration — see `src/lib/legal/data-map.ts` for the mapping
 * and `docs/qa/v12/PRIVACY_DATA_MAP.md` for the audit generated from it. Three consequences are visible on the
 * page and are all deliberate:
 *
 *  - §5 states that **no overseas-transfer processor is in use**, because `PROCESSORS` is empty and that is the
 *    true state of production, not an omission.
 *  - §9 explains the one essential cookie and offers no consent control, because there is no non-essential
 *    cookie to control. A banner here would be asking permission for something that does not happen.
 *  - §2 gives the rule Hangyul follows and the statutory commerce periods, and does **not** give a retention
 *    period for accounts or documents, because no approved one exists. That is a launch blocker in §92, not a
 *    number to invent.
 *
 * Nothing on this page is rendered from a placeholder. Where a required company field is missing the section
 * does not appear at all — see `src/lib/legal/entity.ts`.
 */
import { useLocale } from '@hangyul/i18n';
import { countryName } from '@hangyul/utils';
import { Trans } from 'react-i18next';

import { LegalLayout, LegalTable, type LegalSection } from '../../components/LegalLayout';
import { studentUrl } from '../../lib/env';
import { DATA_CATEGORIES, DISCLOSURES, DOMESTIC_PROCESSORS, PROCESSORS, STATUTORY_RECORDS } from '../../lib/legal/data-map';
import { LEGAL_ENTITY } from '../../lib/legal/entity';
import { useSeo } from '../../lib/useSeo';
import '../../styles/directory.css';

export default function Privacy() {
  const { t, locale } = useLocale(['marketing', 'common']);
  useSeo({ title: t('v12.seo.privacy.title'), description: t('v12.seo.privacy.description') });
  const e = LEGAL_ENTITY;

  const sections: LegalSection[] = [];

  // ---------------------------------------------------------------- 1. What is processed, and why
  sections.push({
    id: 'collect',
    heading: t('v12.privacy.collect.h'),
    body: (
      <>
        <p>{t('v12.privacy.collect.intro')}</p>
        <LegalTable
          head={[t('v12.privacy.collect.colKind'), t('v12.privacy.collect.colItems'), t('v12.privacy.collect.colPurpose')]}
          rows={DATA_CATEGORIES.map((c) => [
            t(`v12.privacy.collect.${c.key}.kind`),
            t(`v12.privacy.collect.${c.key}.items`),
            t(`v12.privacy.collect.${c.key}.purpose`),
          ])}
        />
        {/* Two statements of fact that a reader of a Korean privacy policy has every reason to doubt, so they
            are made explicitly rather than left to be inferred from a table. */}
        <p>{t('v12.privacy.collect.noCard')}</p>
        <p>{t('v12.privacy.collect.passport')}</p>
      </>
    ),
  });

  // ---------------------------------------------------------------- 2. Retention
  sections.push({
    id: 'retention',
    heading: t('v12.privacy.retention.h'),
    body: (
      <>
        <p>{t('v12.privacy.retention.rule')}</p>
        <p>{t('v12.privacy.retention.statutory')}</p>
        <LegalTable
          head={[t('v12.privacy.retention.colRecord'), t('v12.privacy.retention.colPeriod')]}
          rows={STATUTORY_RECORDS.map((r) => [
            t(`v12.privacy.retention.${r.key}.record`),
            'months' in r ? t('v12.privacy.retention.months', { count: r.months }) : t('v12.privacy.retention.years', { count: r.years }),
          ])}
        />
      </>
    ),
  });

  // ---------------------------------------------------------------- 3. Disclosure to third parties
  sections.push({
    id: 'sharing',
    heading: t('v12.privacy.sharing.h'),
    body: (
      <>
        <p>{t('v12.privacy.sharing.rule')}</p>
        <p>{t('v12.privacy.sharing.whenApplying')}</p>
        <LegalTable
          head={[
            t('v12.privacy.sharing.colWho'),
            t('v12.privacy.sharing.colPurpose'),
            t('v12.privacy.sharing.colItems'),
            t('v12.privacy.sharing.colWhen'),
          ]}
          rows={DISCLOSURES.map((d) => [
            t(`v12.privacy.sharing.${d.key}.who`),
            t(`v12.privacy.sharing.${d.key}.purpose`),
            t(`v12.privacy.sharing.${d.key}.items`),
            t(`v12.privacy.sharing.${d.key}.when`),
          ])}
        />
        <p>{t('v12.privacy.sharing.notAll')}</p>
      </>
    ),
  });

  // ---------------------------------------------------------------- 4. Processors (V22: three, all abroad)
  sections.push({
    id: 'processors',
    heading: t('v12.privacy.processors.h'),
    body: PROCESSORS.length ? (
      <>
        <p>{t('v12.privacy.processors.intro')}</p>
        <LegalTable
          head={[t('v12.privacy.processors.colWho'), t('v12.privacy.processors.colPurpose'), t('v12.privacy.processors.colItems'), t('v12.privacy.processors.colCountry')]}
          rows={[...DOMESTIC_PROCESSORS, ...PROCESSORS].map((p) => [
            <>{p.name}<br /><span className="mk-legal__muted">{p.entity}</span></>,
            t(`v12.privacy.processors.${p.key}.purpose`),
            t(`v12.privacy.processors.${p.key}.items`),
            p.countries.map((c) => countryName(c, locale)).join(', '),
          ])}
        />
      </>
    ) : (
      <p>{t('v12.privacy.processors.none')}</p>
    ),
  });

  // ---------------------------------------------------------------- 5. Overseas transfer — 제28조의8② items, per recipient
  sections.push({
    id: 'transfer',
    heading: t('v12.privacy.transfer.h'),
    body: PROCESSORS.length ? (
      <>
        <p>{t('v12.privacy.transfer.intro')}</p>
        <LegalTable
          head={[t('v12.privacy.transfer.colWho'), t('v12.privacy.transfer.colItems'), t('v12.privacy.transfer.colCountry'), t('v12.privacy.transfer.colWhen'),
            t('v12.privacy.transfer.colPurpose'), t('v12.privacy.transfer.colRetention')]}
          rows={PROCESSORS.map((p) => [
            <>{p.entity}<br /><span className="mk-legal__muted">{p.address}</span><br /><a href={`mailto:${p.contact}`}>{p.contact}</a></>,
            t(`v12.privacy.processors.${p.key}.items`),
            p.countries.map((c) => countryName(c, locale)).join(', '),
            p.key === 'turnstile' ? t('v12.privacy.transfer.whenTurnstile') : t('v12.privacy.transfer.when'),
            t(`v12.privacy.processors.${p.key}.purpose`),
            p.retention ? t(`v23.privacy.retention.${p.key}`) : t('v12.privacy.processors.retentionUnknown'),
          ])}
        />
        <p>{t('v12.privacy.transfer.refuse')}</p>
        <p>{t('v12.privacy.transfer.safeguards')} {PROCESSORS.map((p, i) => <span key={p.key}>{i > 0 ? ' · ' : ''}<a href={p.dpaUrl} target="_blank" rel="noreferrer">{p.name}</a></span>)}</p>
        <p className="mk-legal__muted">{t('v12.privacy.transfer.verified')}</p>
        <p>{t('v12.privacy.transfer.universities')}</p>
      </>
    ) : (
      <>
        <p>{t('v12.privacy.transfer.none')}</p>
        <p>{t('v12.privacy.transfer.universities')}</p>
      </>
    ),
  });

  // ---------------------------------------------------------------- 6. Destruction
  sections.push({
    id: 'destruction',
    heading: t('v12.privacy.destruction.h'),
    body: (
      <>
        <p>{t('v12.privacy.destruction.p1')}</p>
        <p>{t('v12.privacy.destruction.p2')}</p>
      </>
    ),
  });

  // ---------------------------------------------------------------- 7. Rights — linked to the real action
  sections.push({
    id: 'rights',
    heading: t('v12.privacy.rights.h'),
    body: (
      <>
        <p>{t('v12.privacy.rights.intro')}</p>
        <ul>
          {['access', 'correct', 'delete', 'suspend', 'withdraw', 'close'].map((k) => (
            <li key={k}>{t(`v12.privacy.rights.${k}`)}</li>
          ))}
        </ul>
        {/* `/settings` in the Student Platform is where export and deletion requests are actually raised
            (`api.me.dataRequest`). The policy links the button that exists, and describes no other. */}
        <p>
          <Trans
            t={t}
            i18nKey="v12.privacy.rights.how"
            components={{ settings: <a href={studentUrl('/settings', locale)} /> }}
          />
        </p>
      </>
    ),
  });

  // ---------------------------------------------------------------- 8. Safeguards — only real controls
  sections.push({
    id: 'security',
    heading: t('v12.privacy.security.h'),
    body: (
      <ul>
        {/* Each of these is implemented and testable; see docs/SECURITY.md and server/tests/test_security.py.
            Nothing aspirational is listed, and no configuration detail that would help an attacker. */}
        {['access', 'roles', 'audit', 'transport', 'links', 'passwords', 'uploads'].map((k) => (
          <li key={k}>{t(`v12.privacy.security.${k}`)}</li>
        ))}
      </ul>
    ),
  });

  // ---------------------------------------------------------------- 9. Cookies
  sections.push({
    id: 'cookies',
    heading: t('v12.privacy.cookies.h'),
    body: (
      <>
        <p>{t('v12.privacy.cookies.essential')}</p>
        <p>{t('v12.privacy.cookies.storage')}</p>
        <p>{t('v12.privacy.cookies.noTracking')}</p>
      </>
    ),
  });

  // ---------------------------------------------------------------- 10. Contact — only if configured
  // PIPA requires a named privacy officer. No value for one exists in this repository, so rather than publish
  // "[개인정보 보호책임자]" the section is omitted and the absence is a launch blocker (REPORT §92).
  if (e.privacyOfficerName && e.privacyOfficerEmail) {
    sections.push({
      id: 'contact',
      heading: t('v12.privacy.contact.h'),
      body: (
        <LegalTable
          head={[t('v12.privacy.contact.colField'), t('v12.privacy.contact.colValue')]}
          rows={[
            [t('v12.privacy.contact.officer'), e.privacyOfficerName],
            ...(e.privacyOfficerDepartment ? [[t('v12.privacy.contact.department'), e.privacyOfficerDepartment]] : []),
            [t('v12.privacy.contact.email'), <a key="m" href={`mailto:${e.privacyOfficerEmail}`}>{e.privacyOfficerEmail}</a>],
            ...(e.privacyOfficerPhone ? [[t('v12.privacy.contact.phone'), e.privacyOfficerPhone]] : []),
          ]}
        />
      ),
    });
  }

  // ---------------------------------------------------------------- 11. Changes
  sections.push({
    id: 'changes',
    heading: t('v12.privacy.changes.h'),
    body: <p>{t('v12.privacy.changes.p1')}</p>,
  });

  return (
    <LegalLayout
      title={t('v12.privacy.title')}
      summary={t('v12.privacy.summary')}
      effective={e.policyEffectiveOn ? t('v12.legal.effective', { date: e.policyEffectiveOn }) : null}
      sections={sections}
      footNote={<p>{t('v12.privacy.scope')}</p>}
    />
  );
}
