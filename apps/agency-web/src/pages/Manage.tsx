import { Bell, Building2, CalendarClock, ClipboardList, ConciergeBell, Receipt, ScrollText, Settings, Store, UsersRound } from '@hangyul/icons';
import { PageHeader } from '@hangyul/ynex-ui';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { useT } from '../components/bits';

/**
 * Manage — the low-frequency areas, in one place (REPORT §77.1).
 *
 * V10 gave Team, Vendors, Settings, Templates, Payments, Audit and the university Catalog their own navigation
 * slots, so seven administrative destinations competed with a counsellor's daily work for the same attention.
 * None of them is opened more than a few times a month. They keep their routes; they lose their rail slots.
 *
 * This is a list of links, not a dashboard: no cards with metrics on them, because none of these needs a number
 * to decide whether to open it.
 */
export default function Manage() {
  const { t } = useT();
  const groups: { title: string; items: { to: string; label: string; hint: string; icon: ReactNode }[] }[] = [
    {
      title: t('v11.manage.people'),
      items: [
        { to: '/team', label: t('v22.team.title'), hint: t('v11.manage.teamHint'), icon: <UsersRound /> },
        { to: '/vendors', label: t('concierge:nav.vendors'), hint: t('v11.manage.vendorsHint'), icon: <Store /> },
        { to: '/services', label: t('concierge:nav.services'), hint: t('v11.manage.servicesHint'), icon: <ConciergeBell /> },
      ],
    },
    {
      title: t('v11.manage.work'),
      items: [
        { to: '/templates', label: t('nav.templates'), hint: t('v11.manage.templatesHint'), icon: <ClipboardList /> },
        { to: '/universities', label: t('sidebar.universities'), hint: t('v11.manage.catalogHint'), icon: <Building2 /> },
        // V23 §272 A5: moved here from Settings, which repeated this hub; Settings keeps only personal preferences.
        { to: '/tasks?view=deadlines', label: t('nav.deadlines'), hint: t('settings.deadlinesHint'), icon: <CalendarClock /> },
        { to: '/notifications', label: t('nav.notifications'), hint: t('settings.notificationsHint'), icon: <Bell /> },
      ],
    },
    {
      title: t('v11.manage.org'),
      items: [
        { to: '/settings', label: t('nav.settings'), hint: t('v11.manage.settingsHint'), icon: <Settings /> },
        { to: '/payments', label: t('nav.payments'), hint: t('v11.manage.paymentsHint'), icon: <Receipt /> },
        { to: '/audit', label: t('nav.audit'), hint: t('v11.manage.auditHint'), icon: <ScrollText /> },
      ],
    },
  ];
  return (
    <div className="hg-stack ag-page">
      <PageHeader title={t('v22.nav.settings')} sub={t('v11.manage.sub')} />
      {groups.map((g) => (
        <section key={g.title} className="ag-manage__group" aria-labelledby={`mg-${g.title}`}>
          <h2 className="ag-manage__title" id={`mg-${g.title}`}>{g.title}</h2>
          <ul className="ag-manage__list">
            {g.items.map((i) => (
              <li key={i.to}>
                <Link to={i.to} className="ag-manage__item">
                  <span className="ag-manage__icon" aria-hidden>{i.icon}</span>
                  <span>
                    <strong>{i.label}</strong>
                    <span>{i.hint}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
