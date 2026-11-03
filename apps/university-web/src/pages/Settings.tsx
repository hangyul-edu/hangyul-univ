// PRIMARY QUESTION: "Who is on our team, what may they do — and who takes over when someone leaves?" (V9 U8).
import { useAuth } from '@hangyul/auth';
import { Users } from '@hangyul/icons';
import { useLocale } from '@hangyul/i18n';
import { Avatar, EmptyState, LocaleSelector, QueryState, Section, SkeletonCard, StatusText } from '@hangyul/ui';
import { PageHeader } from '@hangyul/ynex-ui';
import { useQuery } from '@tanstack/react-query';

import { useTeam } from '../lib/queries';
import { useUniversity } from '../lib/university';
import { TeamManager } from '../components/v9/TeamManager';
import { TwoStepPanel, useSecurityT } from '../components/security/TwoStep';

/** V29: staff two-step verification (status, set up, regenerate recovery codes). */
function TwoStepVerification() {
  const { tx } = useSecurityT();
  return (
    <Section title={tx('title')}>
      <TwoStepPanel />
    </Section>
  );
}

function SingleSignOn() {
  const { t } = useLocale(['university', 'common']);
  const { api, session } = useAuth();
  // V22: every university member is its admin (REPORT §247); Hangyul staff do not manage a partner's SSO.
  const isAdmin = session?.active_org?.org_type === 'UNIVERSITY';
  const q = useQuery({ queryKey: ['sso', 'config'], queryFn: () => api.sso.config(), enabled: isAdmin, staleTime: 60_000 });
  return (
    <Section title={t('university:settings.sso')} sub={t('university:settings.ssoSub')}>
      {!isAdmin ? <p className="hg-small hg-muted">{t('university:settings.ssoAdminOnly')}</p> : q.isLoading ? <SkeletonCard lines={2} /> : !q.data ? (
        <p className="hg-small">{t('university:settings.ssoNone')}</p>
      ) : (
        <dl className="uc-kv">
          <dt>{t('university:settings.ssoStatus')}</dt><dd>{q.data.enabled ? <StatusText tone="success">{t('university:settings.ssoOn')}</StatusText> : <StatusText tone="neutral">{t('university:settings.ssoOff')}</StatusText>}</dd>
          <dt>{t('university:settings.ssoProtocol')}</dt><dd>{q.data.protocol}</dd>
          <dt>{t('university:settings.ssoDomains')}</dt><dd>{q.data.allowed_domains.join(', ')}</dd>
          <dt>{t('university:settings.ssoEnforce')}</dt><dd>{q.data.enforce ? t('university:common.yes') : t('university:common.no')}</dd>
          <dt>{t('university:settings.ssoSecret')}</dt><dd>{q.data.client_secret_present ? t('university:settings.ssoSecretOk') : t('university:settings.ssoSecretMissing')}</dd>
        </dl>
      )}
      <p className="uc-note">{t('university:settings.ssoNote')}</p>
    </Section>
  );
}

export default function Settings() {
  const { t } = useLocale(['university', 'common']);
  const { session } = useAuth();
  const { isHangyul, overview } = useUniversity();
  const team = useTeam();
  return (
    <div className="hg-stack uc-page uv7" style={{ '--hg-gap': '32px' } as React.CSSProperties}>
      <PageHeader title={t('university:nav.settingsTeam')} sub={t('university:settings.subtitle', { university: overview?.name_en ?? '' })} />
      <div className="uc-split">
        <Section title={t('university:settings.you')}>
          <div className="hg-row" style={{ gap: 12 }}>
            <Avatar name={session?.user.full_name ?? '?'} size={40} />
            <div style={{ minWidth: 0 }}>
              <div className="hg-medium">{session?.user.full_name}</div>
              <div className="uc-sub">{session?.user.email}{session?.active_org ? ` · ${session.active_org.org_name}` : ''}</div>
            </div>
          </div>
          <div className="hg-row hg-between" style={{ gap: 8 }}>
            <span className="hg-small">{t('common:actions.language')}</span>
            <LocaleSelector />
          </div>
        </Section>
        <SingleSignOn />
      </div>
      <div className="uc-split">
        <TwoStepVerification />
      </div>
      <Section title={t('common:nav.team')} sub={isHangyul ? t('university:settings.hangyulTeam') : t('university:settings.teamSub')}>
        <QueryState query={team} skeleton={<SkeletonCard lines={3} />} isEmpty={(d) => d.length === 0} empty={<EmptyState compact icon={<Users />} title={t('university:settings.noTeam')} />}>
          {(members) => <TeamManager team={members} isAdmin={!isHangyul} me={session?.user.id} />}
        </QueryState>
        <p className="uc-note">{t('university:v22.manage.teamNote')}</p>
      </Section>
    </div>
  );
}
