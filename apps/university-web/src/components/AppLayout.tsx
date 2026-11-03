import { useAuth } from '@hangyul/auth';
import { Building2, ChartColumn, MessageSquare, Search, Settings, Users } from '@hangyul/icons';
import { useLocale } from '@hangyul/i18n';
import { Badge, Card, ErrorState, Select, Skeleton, type NavSection } from '@hangyul/ui';
import { YnexShell } from '@hangyul/ynex-ui';
import { useQuery } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Outlet, useNavigate } from 'react-router';

import { useUniversity } from '../lib/university';

/** Hangyul staff only: the partner universities whose console they may open (REPORT §247 U3). */
function HangyulPicker({ compact }: { compact?: boolean }) {
  const { api } = useAuth();
  const { t } = useLocale(['university', 'common']);
  const { universityId, pick } = useUniversity();
  const q = useQuery({
    queryKey: ['catalog', 'partner-universities'],
    queryFn: () => api.catalog.universities({ partner_only: true, page_size: 100 }),
    staleTime: 10 * 60_000,
  });
  return (
    <Select compact={compact} aria-label={t('university:picker.label')} value={universityId ?? ''} onChange={(e) => pick(e.target.value || null)} style={{ maxInlineSize: 260 }}>
      <option value="">{t('university:picker.placeholder')}</option>
      {(q.data?.items ?? []).map((u) => <option key={u.id} value={u.id}>{u.name_en}</option>)}
    </Select>
  );
}

/**
 * A university member with more than one university membership switches between *their own* memberships
 * (the session's active organisation). One membership — the normal case — renders nothing: direct landing,
 * no picker that looks like a permission selector and no list of other universities (REPORT §247 U3).
 */
function OwnMembershipSwitch({ compact }: { compact?: boolean }) {
  const { session, switchOrg } = useAuth();
  const { t } = useLocale(['university', 'common']);
  const own = (session?.memberships ?? []).filter((m) => m.org_type === 'UNIVERSITY' && m.university_id);
  if (own.length < 2) return null;
  return (
    <Select compact={compact} aria-label={t('university:picker.label')} value={session?.active_org?.org_id ?? ''} onChange={(e) => { if (e.target.value) void switchOrg(e.target.value); }} style={{ maxInlineSize: 260 }}>
      {own.map((m) => <option key={m.org_id} value={m.org_id}>{m.org_name}</option>)}
    </Select>
  );
}

function UniversityLabel() {
  const { t, locale } = useLocale(['university', 'common']);
  const { overview, overviewQuery, isHangyul } = useUniversity();
  if (overviewQuery.isLoading) return <Skeleton w={180} h={20} />;
  if (!overview) return null;
  const name = locale === 'ko' ? overview.name_ko : overview.name_en;
  return (
    <div className="uc-orglabel">
      <Building2 size={16} aria-hidden />
      <span className="uc-orglabel__text">
        <span className="hg-medium hg-small hg-truncate">{name}</span>
        <span className="uc-orglabel__meta">
          {overview.is_partner && <Badge size="sm" tone="neutral" title={t('university:header.certificationHint')}>{t('university:header.partner')}</Badge>}
          {isHangyul && <Badge size="sm" tone="info">{t('university:header.hangyulView')}</Badge>}
        </span>
      </span>
    </div>
  );
}

function GlobalSearch() {
  const { t } = useLocale('university');
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    nav(q.trim() ? `/?q=${encodeURIComponent(q.trim())}` : '/');
  };
  return (
    <form onSubmit={submit} role="search">
      <div className="hg-input-icon">
        <Search aria-hidden />
        <input type="search" className="hg-input hg-input--sm" placeholder={t('search.placeholder')} aria-label={t('search.label')} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
    </form>
  );
}

function PickUniversityCard() {
  const { t } = useLocale('university');
  return (
    <div style={{ maxInlineSize: 560, marginInline: 'auto', paddingBlock: 48 }}>
      <Card pad>
        <h1 className="hg-title-lg">{t('picker.title')}</h1>
        <p className="hg-muted" style={{ marginBlock: '8px 16px' }}>{t('picker.body')}</p>
        <HangyulPicker />
      </Card>
    </div>
  );
}

export function AppLayout() {
  const { t } = useLocale(['university', 'common']);
  const { needsPick, isHangyul, overviewQuery } = useUniversity();

  /**
   * V22 navigation — four destinations (REPORT §250 V2; V11 had six).
   *
   *   지원자  the work: the stage strip over the applicant table. Overview, Applicants, Offers and Documents
   *           were four doors to the same rows; the strip's stages and filters are those doors now.
   *   메시지  conversations with applicants and agencies.
   *   통계    the four questions (where from · where lost · who gets in · who stays).
   *   설정    everything administrative — programmes & rules, team, exports, scholarships, partnership,
   *           agencies, notifications, office settings — one page of links, none of it daily work.
   */
  const sections: NavSection[] = [
    {
      items: [
        { to: '/', label: t('common:nav.applicants'), icon: <Users />, end: true },
        { to: '/messages', label: t('common:nav.messages'), icon: <MessageSquare /> },
        { to: '/analytics', label: t('university:v22.nav.insights'), icon: <ChartColumn /> },
        { to: '/manage', label: t('common:nav.settings'), icon: <Settings /> },
      ],
    },
  ];

  return (
    <YnexShell
      product="university"
      productLabel={t('university:product')}
      menu="light"
      sections={sections}
      orgLabel={<UniversityLabel />}
      search={needsPick ? undefined : <GlobalSearch />}
      topExtra={<span className="uc-picker-top">{isHangyul ? <HangyulPicker compact /> : <OwnMembershipSwitch compact />}</span>}
    >
      {needsPick ? <PickUniversityCard /> : overviewQuery.isError ? <ErrorState error={overviewQuery.error} onRetry={() => overviewQuery.refetch()} /> : <Outlet />}
    </YnexShell>
  );
}
