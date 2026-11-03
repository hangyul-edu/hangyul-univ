import { useAuth } from '@hangyul/auth';
import { Keyboard } from '@hangyul/icons';
import { Card, CardHeader, DescriptionList, LocaleSelector, PageHeader, Switch } from '@hangyul/ui';

import { Kbd, useT } from '../components/bits';
import { TwoStepPanel, useSecurityT } from '../components/security/TwoStep';
import { usePrefs, type Prefs } from '../lib/local';

export default function Settings() {
  const { t } = useT();
  const { tx } = useSecurityT();
  const { session } = useAuth();
  const [prefs, setPrefs] = usePrefs();
  // Only preferences that actually change behaviour are shown. (Per-type notification switches were removed:
  // notifications are generated server-side and were never filtered by them.)
  const toggles: { key: keyof Prefs; label: string; hint: string }[] = [
    { key: 'pollNotifications', label: t('settings.poll'), hint: t('settings.pollHint') },
  ];
  return (
    <div className="hg-stack ag-page">
      <PageHeader title={t('nav.settings')} subtitle={t('settings.sub')} />
      <div className="ag-grid-2">
        <Card>
          <CardHeader title={t('settings.language')} bordered />
          <div className="ag-panel__body hg-stack">
            <div className="ag-setting">
              <div><div className="hg-strong hg-small">{t('actions.language')}</div><div className="hg-subtle hg-xs">{t('settings.languageHint')}</div></div>
              <LocaleSelector />
            </div>
          </div>
        </Card>
        <Card>
          <CardHeader title={t('settings.updates')} subtitle={t('settings.localOnly')} bordered />
          <div className="ag-panel__body hg-stack">
            {toggles.map((x) => (
              <div key={x.key} className="ag-setting">
                <div><div className="hg-strong hg-small">{x.label}</div><div className="hg-subtle hg-xs">{x.hint}</div></div>
                <Switch checked={prefs[x.key]} onChange={(v) => setPrefs({ [x.key]: v })} label={x.label} />
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader title={t('settings.account')} bordered />
          <div className="ag-panel__body">
            <DescriptionList items={[
              { label: t('auth.fullName'), value: session?.user.full_name },
              { label: t('auth.email'), value: session?.user.email },
              { label: t('settings.org'), value: session?.active_org?.org_name },
              { label: t('teamPage.role'), value: session?.active_org ? t(session.active_org.org_type === 'HANGYUL' ? `role.${session.active_org.role}` : 'role.AGENCY_ADMIN') : '—' },
              { label: t('settings.timezone'), value: session?.user.timezone },
            ]} />
          </div>
        </Card>
        <Card>
          <CardHeader title={tx('title')} bordered />
          <div className="ag-panel__body">
            <TwoStepPanel />
          </div>
        </Card>
        <Card>
          <CardHeader title={<><Keyboard size={16} aria-hidden style={{ display: 'inline' }} /> {t('settings.shortcuts')}</>} bordered />
          <div className="ag-panel__body">
            <dl className="ag-shortcuts">
              <dt><Kbd>J</Kbd> / <Kbd>K</Kbd></dt><dd>{t('docs.sc.nav')}</dd>
              <dt><Kbd>V</Kbd></dt><dd>{t('docs.sc.verify')}</dd>
              <dt><Kbd>C</Kbd></dt><dd>{t('docs.sc.changes')}</dd>
              <dt><Kbd>Ctrl</Kbd>+<Kbd>Enter</Kbd></dt><dd>{t('settings.scSend')}</dd>
              <dt><Kbd>↑</Kbd> <Kbd>↓</Kbd> <Kbd>Enter</Kbd></dt><dd>{t('settings.scSearch')}</dd>
            </dl>
          </div>
        </Card>
      </div>
    </div>
  );
}
