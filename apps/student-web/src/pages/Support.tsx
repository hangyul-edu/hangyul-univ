import { useApi } from '@hangyul/auth';
import { MessageCircle, Plus, Send } from '@hangyul/icons';
import { Button, ButtonLink, Field, Input, ListRow, Modal, OptionCards, QueryState, Section, SkeletonCard, StatusText, Textarea, useToast } from '@hangyul/ui';
import { formatRelative } from '@hangyul/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { PageIntro } from '../components/bits';
import { useT } from '../lib/i18n';

const CATEGORIES = ['VISA', 'HOUSING', 'ACADEMIC', 'HEALTH', 'FINANCE', 'OTHER'] as const;
type Category = (typeof CATEGORIES)[number];

function NewTicket({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const api = useApi();
  const qc = useQueryClient();
  const nav = useNavigate();
  const toast = useToast();
  const [category, setCategory] = useState<Category | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const m = useMutation({
    mutationFn: () => api.me.createSupportTicket({ category: category as Category, subject: subject.trim(), body: body.trim() }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['support'] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
      toast.success(t('support.created'));
      onClose();
      nav(`/messages/${r.conversation_id}`);
    },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <Modal open onClose={onClose} width={600} title={t('support.new.title')} description={t('support.new.subtitle')}
      footer={<><Button variant="ghost" onClick={onClose}>{t('common:actions.cancel')}</Button><Button variant="primary" icon={<Send />} disabled={!category || subject.trim().length < 3 || !body.trim()} loading={m.isPending} onClick={() => m.mutate()}>{t('support.new.send')}</Button></>}>
      <div className="hg-stack">
        <fieldset className="st-group">
          <legend className="st-group__label">{t('support.new.category')}</legend>
          <OptionCards label={t('support.new.category')} min={150} value={category} onChange={(v) => setCategory(v as Category)}
            options={CATEGORIES.map((c) => ({ value: c, label: t(`support.category.${c}`) }))} />
        </fieldset>
        <Field label={t('support.new.subject')} htmlFor="t-subject"><Input id="t-subject" value={subject} maxLength={200} onChange={(e) => setSubject(e.target.value)} /></Field>
        <Field label={t('support.new.body')} htmlFor="t-body" hint={t('support.new.bodyHint')}><Textarea id="t-body" rows={5} value={body} onChange={(e) => setBody(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

export default function Support() {
  const { t, locale } = useT();
  const api = useApi();
  const [open, setOpen] = useState(false);
  const q = useQuery({ queryKey: ['support'], queryFn: () => api.me.supportTickets() });
  return (
    <div className="st-page">
      <PageIntro title={t('support.title')} subtitle={t('support.subtitle')} />
      <section className="ssu-ask" aria-labelledby="ssu-ask">
        <div>
          <h2 id="ssu-ask" className="hg-title-sm">{t('supportV3.askTitle')}</h2>
          <p className="hg-muted">{t('supportV3.askText')}</p>
        </div>
        <div className="hg-row-wrap">
          <ButtonLink as={Link} to="/messages" variant="primary" icon={<MessageCircle />}>{t('supportV3.message')}</ButtonLink>
          <Button icon={<Plus />} onClick={() => setOpen(true)}>{t('support.new.button')}</Button>
        </div>
      </section>
      <Section title={t('supportV3.tickets')}>
        <QueryState query={q} skeleton={<SkeletonCard lines={4} />} isEmpty={(d) => d.length === 0}
          empty={<p className="hg-small hg-muted">{t('supportV3.noTickets')}</p>}>
          {(list) => (
            <div className="hg-panel">
              <ul className="hg-list">
                {list.map((x) => (
                  <li key={x.id}>
                    <ListRow as={Link} to={x.conversation_id ? `/messages/${x.conversation_id}` : '/messages'} chevron title={x.subject}
                      meta={`${t(`support.category.${x.category}`, { defaultValue: x.category })} · ${formatRelative(x.created_at, locale)}`}
                      end={<StatusText tone={x.status === 'OPEN' ? 'info' : x.status === 'WAITING_STUDENT' ? 'warning' : x.status === 'RESOLVED' ? 'success' : 'neutral'}>{t(`support.status.${x.status}`, { defaultValue: x.status })}</StatusText>} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </QueryState>
      </Section>
      <p className="hg-small hg-muted">{t('support.urgent')}</p>
      {open && <NewTicket onClose={() => setOpen(false)} />}
    </div>
  );
}
