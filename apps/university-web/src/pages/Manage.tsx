import { Bell, BookOpen, Download, Handshake, ScrollText, Settings, Users, Wallet } from '@hangyul/icons';
import { useLocale } from '@hangyul/i18n';
import { Avatar, EmptyState, QueryState, SkeletonCard, StatusText } from '@hangyul/ui';
import { PageHeader } from '@hangyul/ynex-ui';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { useTeam } from '../lib/queries';
import { useUniversity } from '../lib/university';

/**
 * 설정 — everything that is not daily work, on one page (REPORT §250 V2).
 *
 * Programmes & rules, scholarships, partnership, agencies, exports, notifications and the office settings keep
 * their routes and lose their navigation slots. The team is a read-only roster: every member of a university
 * is its admin (REPORT §247), so there is no role column and nothing to pick.
 */
export default function Manage() {
  const { t } = useLocale(['university', 'common']);
  const { perms, isHangyul } = useUniversity();
  const team = useTeam();
  const groups: { key: string; items: { to: string; label: string; hint: string; icon: ReactNode }[] }[] = [
    {
      key: 'admissions',
      items: [
        { to: '/programs', label: t('university:nav.programsRules'), hint: t('university:v11.manage.rulesHint'), icon: <BookOpen /> },
        { to: '/rules', label: t('common:nav.admissionRules'), hint: t('university:v22.manage.rulesHistoryHint'), icon: <ScrollText /> },
        ...(perms.canViewPartnership ? [{ to: '/scholarships', label: t('common:nav.scholarships'), hint: t('university:v11.manage.scholarshipsHint'), icon: <Wallet /> }] : []),
      ],
    },
    {
      key: 'partners',
      items: [
        ...(perms.canViewPartnership ? [{ to: '/partnership', label: t('common:nav.partnership'), hint: t('university:v11.manage.partnershipHint'), icon: <Handshake /> }] : []),
        { to: '/agencies', label: t('common:nav.partnerAgencies'), hint: t('university:v22.manage.agenciesHint'), icon: <Users /> },
        ...(perms.canExport ? [{ to: '/exports', label: t('university:v22.manage.exports'), hint: t('university:v11.manage.exportsHint'), icon: <Download /> }] : []),
      ],
    },
    {
      key: 'office',
      items: [
        { to: '/notifications', label: t('common:nav.notifications'), hint: t('university:v22.manage.notificationsHint'), icon: <Bell /> },
        { to: '/settings', label: t('common:nav.settings'), hint: t('university:v22.manage.settingsHint'), icon: <Settings /> },
      ],
    },
  ];
  return (
    <div className="uv-manage uv22-manage">
      <PageHeader title={t('common:nav.settings')} sub={t('university:v11.manage.sub')} />
      {groups.map((g) => (
        <section key={g.key} className="uv-manage__group" aria-labelledby={`umg-${g.key}`}>
          <h2 className="uv-manage__title" id={`umg-${g.key}`}>{t(`university:v22.manage.group.${g.key}`)}</h2>
          <ul className="uv-manage__list">
            {g.items.map((i) => (
              <li key={i.to}>
                <Link to={i.to} className="uv-manage__item">
                  <span className="uv-manage__icon" aria-hidden>{i.icon}</span>
                  <span><strong>{i.label}</strong><span>{i.hint}</span></span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <section className="uv-manage__group" aria-labelledby="umg-team">
        <h2 className="uv-manage__title" id="umg-team">{t('common:nav.team')}</h2>
        <p className="uv22-manage__sub">{isHangyul ? t('university:settings.hangyulTeam') : t('university:v22.manage.teamSub')}</p>
        <QueryState query={team} skeleton={<SkeletonCard lines={3} />} isEmpty={(d) => d.length === 0} empty={<EmptyState compact icon={<Users />} title={t('university:settings.noTeam')} />}>
          {(members) => (
            <ul className="uv22-roster" data-team-count={members.length}>
              {members.map((m) => {
                const active = (m as { is_active?: boolean }).is_active !== false;
                return (
                  <li key={m.user_id} className="uv22-roster__row">
                    <Avatar name={m.full_name} size={28} />
                    <span className="uv22-roster__name">{m.full_name}{m.title ? <span className="uv22-roster__title"> · {m.title}</span> : null}</span>
                    {active ? <StatusText tone="success">{t('university:v22.manage.active')}</StatusText> : <StatusText tone="neutral">{t('university:v22.manage.inactive')}</StatusText>}
                  </li>
                );
              })}
            </ul>
          )}
        </QueryState>
        <p className="uc-note">{t('university:v22.manage.teamNote')} <Link to="/settings">{t('university:v22.manage.teamManage')}</Link></p>
      </section>
    </div>
  );
}
