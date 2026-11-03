import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@hangyul/auth';
import { ShieldCheck } from '@hangyul/icons';
import { useLocale } from '@hangyul/i18n';
import type { Program } from '@hangyul/types';
import { Button, Callout, Checkbox, DescriptionList, Field, Input, Select, Textarea, useToast } from '@hangyul/ui';
import { LiveImpact } from '../components/v9/ImpactNote';
import { formatDateTime } from '@hangyul/utils';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useState } from 'react';
import { Navigate, useSearchParams } from 'react-router';

import { requirementLines, rulesDefaults, rulesPayload, rulesSchema, type RulesValues } from '../lib/rules';
import { useUniversity } from '../lib/university';

/** Admission-rule editor. Admins publish directly; admissions staff submit a proposal that an admin publishes. */
export function RulesForm({ program, onDone }: { program: Program; onDone?: () => void }) {
  const { t, locale } = useLocale(['university', 'common']);
  const { api } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const { perms, scopeId } = useUniversity();
  const [reason, setReason] = useState('');
  const publish = perms.canPublishRules;
  const r = program.requirements;
  const { register, handleSubmit, formState: { errors, isDirty }, reset, watch } = useForm<RulesValues>({
    resolver: zodResolver(rulesSchema),
    defaultValues: rulesDefaults(r),
  });
  const m = useMutation({
    mutationFn: (v: RulesValues): Promise<unknown> => (publish
      ? api.university.updateRequirements(program.id, rulesPayload(v))
      : api.university.proposeRequirements(program.id, { ...rulesPayload(v), note: reason.trim() || undefined })),
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ['university', 'programs', scopeId ?? 'own'] });
      qc.invalidateQueries({ queryKey: ['university', 'proposals'] });
      reset(v);
      setReason('');
      toast.success(publish ? t('university:rules.saved') : t('university:rules.proposed'));
      onDone?.();
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const err = (k: keyof RulesValues) => {
    const msg = errors[k]?.message as string | undefined;
    return msg ? t(msg.includes(':') ? msg : `common:${msg}`) : undefined;
  };

  if (!perms.canEditRules) {
    return (
      <div className="hg-stack">
        <Callout tone="info">{t('university:rules.readOnly')}</Callout>
        <DescriptionList items={[
          { label: t('university:rules.minGpa'), value: r?.min_gpa_percent !== null && r?.min_gpa_percent !== undefined ? `${r.min_gpa_percent}%` : t('university:rules.none') },
          { label: t('university:rules.minTopik'), value: r?.min_topik_level ?? t('university:rules.none') },
          { label: t('university:rules.minIelts'), value: r?.min_ielts ?? t('university:rules.none') },
          { label: t('university:rules.minToefl'), value: r?.min_toefl_ibt ?? t('university:rules.none') },
          { label: t('university:rules.languageAlt'), value: r?.language_alternative ? t('university:common.yes') : t('university:common.no') },
          { label: t('university:rules.interview'), value: r?.requires_interview ? t('university:common.yes') : t('university:common.no') },
          { label: t('university:rules.notes'), value: r?.notes || '—' },
        ]} />
      </div>
    );
  }

  return (
    <form className="hg-stack" onSubmit={handleSubmit((v) => m.mutate(v))} noValidate>
      <div className="uc-form-2">
        <Field label={t('university:rules.minGpa')} htmlFor="r-gpa" hint={t('university:rules.minGpaHint')} error={err('min_gpa_percent')}>
          <Input id="r-gpa" type="number" inputMode="decimal" min={0} max={100} step={0.1} {...register('min_gpa_percent')} invalid={!!errors.min_gpa_percent} />
        </Field>
        <Field label={t('university:rules.minTopik')} htmlFor="r-topik" hint={t('university:rules.minTopikHint')} error={err('min_topik_level')}>
          <Input id="r-topik" type="number" inputMode="numeric" min={0} max={6} step={1} {...register('min_topik_level')} invalid={!!errors.min_topik_level} />
        </Field>
        <Field label={t('university:rules.minIelts')} htmlFor="r-ielts" hint={t('university:rules.minIeltsHint')} error={err('min_ielts')}>
          <Input id="r-ielts" type="number" inputMode="decimal" min={0} max={9} step={0.5} {...register('min_ielts')} invalid={!!errors.min_ielts} />
        </Field>
        <Field label={t('university:rules.minToefl')} htmlFor="r-toefl" hint={t('university:rules.minToeflHint')} error={err('min_toefl_ibt')}>
          <Input id="r-toefl" type="number" inputMode="numeric" min={0} max={120} step={1} {...register('min_toefl_ibt')} invalid={!!errors.min_toefl_ibt} />
        </Field>
      </div>
      <Field label={t('university:v9.rules.priorEducation')} htmlFor="r-edu" optional>
        <Select id="r-edu" {...register('min_prior_education')}>
          <option value="">{t('university:rules.none')}</option>
          {(['HIGH_SCHOOL', 'ASSOCIATE', 'BACHELOR', 'MASTER'] as const).map((l) => <option key={l} value={l}>{t(`university:eduLevel.${l}`, { defaultValue: l })}</option>)}
        </Select>
      </Field>
      <div className="hg-stack" style={{ '--hg-gap': '8px' } as React.CSSProperties}>
        <Checkbox label={t('university:rules.languageAltLabel')} {...register('language_alternative')} />
        <Checkbox label={t('university:rules.interviewLabel')} {...register('requires_interview')} />
      </div>
      <Field label={t('university:rules.notes')} htmlFor="r-notes" optional hint={t('university:rules.notesHint')} error={err('notes')}>
        <Textarea id="r-notes" rows={4} maxLength={2000} {...register('notes')} />
      </Field>
      <Field label={t('university:rules.sourceUrl')} htmlFor="r-src" optional hint={t('university:rules.sourceUrlHint')} error={err('source_url')}>
        <Input id="r-src" type="url" inputMode="url" placeholder="https://" {...register('source_url')} invalid={!!errors.source_url} />
      </Field>
      <div className="uc-rules-preview" aria-live="polite">
        <div className="uc-sidebox__label">{t('university:v4.rules.studentsSee')}</div>
        <ul className="uc-bullets">{requirementLines({ ...(r ?? {}), ...rulesPayload(watch()) }, t).map((l) => <li key={l}>{l}</li>)}</ul>
      </div>
      {isDirty && <LiveImpact programId={program.id} payload={rulesPayload(watch())} />}
      {!publish && (
        <Field label={t('university:rules.reason')} htmlFor="r-reason" optional hint={t('university:rules.reasonHint')}>
          <Input id="r-reason" maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      )}
      <p className="uc-note"><ShieldCheck size={13} aria-hidden style={{ display: 'inline', verticalAlign: '-2px' }} /> {publish ? t('university:rules.stampBody') : t('university:rules.reviewBody')}</p>
      <div className="hg-row" style={{ gap: 8, justifyContent: 'flex-end' }}>
        <Button onClick={() => { reset(rulesDefaults(r)); onDone?.(); }}>{t('common:actions.cancel')}</Button>
        <Button type="submit" variant="primary" loading={m.isPending} disabled={!isDirty}>{publish ? t('university:rules.publish') : t('university:rules.submitReview')}</Button>
      </div>
      {r?.verified_at && <p className="hg-subtle hg-xs">{t('university:rules.lastUpdated', { date: formatDateTime(r.verified_at, locale) })}</p>}
    </form>
  );
}

/** Admission rules now live inside Programs & rules; old links keep working. */
export default function AdmissionRules() {
  const [sp] = useSearchParams();
  const program = sp.get('program');
  return <Navigate to={program ? `/programs?program=${program}&edit=1` : '/programs'} replace />;
}
