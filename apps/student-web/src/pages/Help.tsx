/**
 * "Need help in Korea?" (V5 concierge) — one simple entry: pick what it's about, say what happened, and the right team
 * gets it (your counselor; Hangyul operations for visa/residence and lost documents). Emergency numbers come first.
 */
import { useApi } from '@hangyul/auth';
import { LifeBuoy } from '@hangyul/icons';
import { Button, Callout, Field, OptionCards, QueryState, Section, SkeletonCard, Textarea, useToast } from '@hangyul/ui';
import { formatRelative } from '@hangyul/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { CaseStatus, EmergencyNumbers, FeedbackLine, useCT } from '../components/ConciergeBits';
import { PageIntro } from '../components/bits';

export default function Help() {
  const { t, locale } = useCT();
  const api = useApi();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['help'], queryFn: () => api.concierge.help() });
  const [cat, setCat] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const send = useMutation({
    mutationFn: () => api.concierge.askHelp({ category: cat!, message: msg.trim() }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['help'] });
      toast.success(t(r.routed_to === 'HANGYUL_OPS' ? 'help.sentOps' : 'help.sentTeam'));
      setMsg(''); setCat(null);
    },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <div className="st-page">
      <PageIntro title={t('help.title')} subtitle={t('help.subtitle')} />
      <QueryState query={q} skeleton={<SkeletonCard lines={6} />}>
        {(h) => (
          <div className="sv-layout">
            <div className="sv-main">
              {cat === 'MEDICAL' && <><Callout tone="danger" title={t('help.medicalFirst')}>{t('help.medicalText')}</Callout><EmergencyNumbers emergency={h.emergency} /></>}
              <Section title={t('help.what')}>
                <form className="hg-stack" onSubmit={(e) => { e.preventDefault(); if (cat && msg.trim().length >= 3) send.mutate(); }}>
                  <OptionCards<string> label={t('help.what')} min={150} value={cat} onChange={(v) => setCat(v as string)}
                    options={h.categories.map((c) => ({ value: c, label: t(`help.cat.${c}`), sub: t(`help.route.${c}`) }))} />
                  {cat && (
                    <>
                      <Field label={t('help.message')} htmlFor="cg-help-msg" hint={t('help.messageHint')}>
                        <Textarea id="cg-help-msg" rows={4} required value={msg} onChange={(e) => setMsg(e.target.value.slice(0, 2000))} />
                      </Field>
                      <div><Button type="submit" variant="primary" icon={<LifeBuoy />} loading={send.isPending} disabled={msg.trim().length < 3}>{t('help.send')}</Button></div>
                    </>
                  )}
                </form>
              </Section>
              {h.requests.length > 0 && (
                <Section title={t('help.yours')}>
                  <ul className="cg-list">
                    {h.requests.map((c) => (
                      <li key={c.id} className="cg-item">
                        <div className="cg-item__head"><span className="cg-item__title">{t(`help.cat.${c.help_category}`)}</span><CaseStatus c={c} /></div>
                        <p className="cg-note">{String(c.details.message ?? '')}</p>
                        <p className="hg-xs hg-subtle">{t(c.routed_to === 'HANGYUL_OPS' ? 'help.withOps' : 'help.withTeam')} · {formatRelative(c.created_at, locale)}</p>
                        {c.closed && c.status !== 'CANCELLED' && <FeedbackLine c={c} />}
                      </li>
                    ))}
                  </ul>
                </Section>
              )}
            </div>
            <aside className="sv-side">
              {cat !== 'MEDICAL' && <EmergencyNumbers emergency={h.emergency} />}
            </aside>
          </div>
        )}
      </QueryState>
    </div>
  );
}
