import { useApi } from '@hangyul/auth';
import { PenLine, Plus } from '@hangyul/icons';
import type { EssayType } from '@hangyul/types';
import { Button, EmptyState, Field, Input, ListRow, Modal, QueryState, Section, Select, SkeletonCard, StatusText, Textarea, useToast } from '@hangyul/ui';
import { essayTone, formatDate, formatRelative } from '@hangyul/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { PageIntro } from '../components/bits';
import { essayTitle, useT } from '../lib/i18n';

const TYPES: EssayType[] = ['PERSONAL_STATEMENT', 'STUDY_PLAN', 'CV'];

function NewEssay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useT();
  const api = useApi();
  const qc = useQueryClient();
  const nav = useNavigate();
  const toast = useToast();
  const [type, setType] = useState<EssayType>('PERSONAL_STATEMENT');
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [limit, setLimit] = useState('');
  const m = useMutation({
    mutationFn: () => api.essays.create({ essay_type: type, title: title.trim() || t(`common:essayType.${type}`), prompt: prompt.trim() || undefined, word_limit: Number(limit) || undefined }),
    onSuccess: (e) => { qc.invalidateQueries({ queryKey: ['essays'] }); onClose(); nav(`/essays/${e.id}`); },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <Modal open={open} onClose={onClose} title={t('essays.new.title')} description={t('essays.new.subtitle')}
      footer={<><Button variant="ghost" onClick={onClose}>{t('common:actions.cancel')}</Button><Button variant="primary" loading={m.isPending} onClick={() => m.mutate()}>{t('essays.new.cta')}</Button></>}>
      <div className="hg-stack">
        <Field label={t('essays.new.type')} htmlFor="essay-type">
          <Select id="essay-type" value={type} onChange={(e) => setType(e.target.value as EssayType)}>
            {TYPES.map((x) => <option key={x} value={x}>{t(`common:essayType.${x}`)}</option>)}
          </Select>
        </Field>
        <Field label={t('essays.new.name')} htmlFor="essay-title" optional><Input id="essay-title" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field label={t('writing:student.pastePrompt')} htmlFor="essay-prompt" optional hint={t('writing:student.pastePromptHint')}><Textarea id="essay-prompt" rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} /></Field>
        <Field label={t('essays.new.limit')} htmlFor="essay-limit" optional><Input id="essay-limit" inputMode="numeric" value={limit} onChange={(e) => setLimit(e.target.value.replace(/\D/g, ''))} style={{ maxWidth: 160 }} /></Field>
      </div>
    </Modal>
  );
}

export default function Essays() {
  const { t, locale } = useT();
  const api = useApi();
  const [open, setOpen] = useState(false);
  const q = useQuery({ queryKey: ['essays', {}], queryFn: () => api.essays.list({ page_size: 50 }) });
  return (
    <div className="st-page">
      <PageIntro title={t('writing.title')} subtitle={t('writing.subtitle')} actions={<Button icon={<Plus />} onClick={() => setOpen(true)}>{t('essays.new.button')}</Button>} />
      <QueryState query={q} skeleton={<div className="st-cards">{[1, 2, 3].map((i) => <SkeletonCard key={i} />)}</div>}
        isEmpty={(d) => d.items.length === 0}
        empty={<EmptyState icon={<PenLine />} title={t('essays.empty')} text={t('essays.emptyText')} action={<Button variant="primary" onClick={() => setOpen(true)}>{t('essays.new.button')}</Button>} />}>
        {(d) => {
          const needYou = d.items.filter((e) => ['DRAFT', 'CHANGES_REQUESTED', 'STUDENT_REVISION'].includes(e.status));
          const rest = d.items.filter((e) => !needYou.includes(e));
          const row = (e: (typeof d.items)[number]) => (
            <li key={e.id}>
              <ListRow as={Link} to={`/essays/${e.id}`} chevron title={essayTitle(t, e, locale)}
                meta={[t(`common:essayType.${e.essay_type}`), e.writing?.context.university?.name ?? null,
                  e.word_limit ? t('essays.words', { count: e.word_count, limit: e.word_limit }) : null,
                  e.reviewer ? t('writing.reviewer', { name: e.reviewer.full_name }) : null,
                  // V5: truthful review timing — "expected by" while a person is reading it, "taking longer" when late.
                  e.writing?.status_line.code === 'REVIEWING' || e.writing?.status_line.code === 'FINAL'
                    ? (e.writing.status_line.expected_by ? t('writing:student.expectedBy', { date: formatDate(e.writing.status_line.expected_by, locale, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) }) : null)
                    : e.writing?.status_line.code === 'LATE' || e.writing?.status_line.code === 'LATE_FLAGGED' ? t('writing:student.lateShort')
                    : e.due_date ? t('common:time.due', { date: formatDate(e.due_date, locale) }) : t('essays.edited', { when: formatRelative(e.updated_at, locale) })].filter(Boolean).join(' · ')}
                end={<span className="sh-app-end">
                  {e.open_comments > 0 && <span className="hg-xs" style={{ color: 'var(--hg-primary-text)' }}>{t('essays.comments', { count: e.open_comments })}</span>}
                  <StatusText tone={essayTone[e.status]}>{t(`writing.status.${e.status}`)}</StatusText>
                </span>} />
            </li>
          );
          return (
            <>
              {needYou.length > 0 && <Section title={t('writing.needYou')}><div className="hg-panel"><ul className="hg-list">{needYou.map(row)}</ul></div></Section>}
              {rest.length > 0 && <Section title={t('writing.others')}><div className="hg-panel"><ul className="hg-list">{rest.map(row)}</ul></div></Section>}
              <p className="hg-small hg-subtle">{t('writing.promise')}</p>
            </>
          );
        }}
      </QueryState>
      {open && <NewEssay open onClose={() => setOpen(false)} />}
    </div>
  );
}
