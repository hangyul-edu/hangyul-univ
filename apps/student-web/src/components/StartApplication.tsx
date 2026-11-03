import { useApi } from '@hangyul/auth';
import type { Program } from '@hangyul/types';
import { Button, Callout, Field, Modal, Select, useToast } from '@hangyul/ui';
import { formatDate } from '@hangyul/utils';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

import { intakeLabel, useT } from '../lib/i18n';

export function useStartApplication() {
  const api = useApi();
  const qc = useQueryClient();
  const nav = useNavigate();
  const toast = useToast();
  const { t } = useT();
  return useMutation({
    mutationFn: ({ programId, intakeId }: { programId: string; intakeId?: string | null }) => api.applications.create(programId, intakeId ?? undefined),
    onSuccess: (app) => {
      qc.invalidateQueries({ queryKey: ['applications'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      toast.success(t('start.created'));
      nav(`/applications/${app.id}`);
    },
    onError: (e) => {
      const s = (e as { status?: number }).status;
      toast.error(s === 409 ? t('start.exists') : (e as Error).message);
    },
  });
}

/** Pick a program + open intake at a university, then create the application. */
export function StartApplicationModal({ open, onClose, programs, initialProgramId }: { open: boolean; onClose: () => void; programs: Program[]; initialProgramId?: string | null }) {
  const { t, locale } = useT();
  const start = useStartApplication();
  const today = new Date().toISOString().slice(0, 10);
  const openPrograms = useMemo(() => programs.filter((p) => (p.intakes ?? []).some((i) => i.is_open && i.application_deadline >= today)), [programs, today]);
  const [programId, setProgramId] = useState<string>(initialProgramId && openPrograms.some((p) => p.id === initialProgramId) ? initialProgramId : openPrograms[0]?.id ?? '');
  const program = openPrograms.find((p) => p.id === programId);
  const intakes = (program?.intakes ?? []).filter((i) => i.is_open && i.application_deadline >= today).sort((a, b) => a.application_deadline.localeCompare(b.application_deadline));
  const [intakeId, setIntakeId] = useState<string>('');
  const chosenIntake = intakes.find((i) => i.id === intakeId) ?? intakes[0];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('start.title')}
      description={t('start.subtitle')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t('common:actions.cancel')}</Button>
          <Button variant="primary" disabled={!program || !chosenIntake} loading={start.isPending}
            onClick={() => program && chosenIntake && start.mutate({ programId: program.id, intakeId: chosenIntake.id })}>
            {t('start.cta')}
          </Button>
        </>
      }
    >
      {openPrograms.length === 0 ? <Callout tone="warning">{t('start.noneOpen')}</Callout> : (
        <div className="hg-stack">
          <Field label={t('start.program')} htmlFor="start-program">
            <Select id="start-program" value={programId} onChange={(e) => { setProgramId(e.target.value); setIntakeId(''); }}>
              {openPrograms.map((p) => <option key={p.id} value={p.id}>{p.name_en} · {t(`common:degreeShort.${p.degree_level}`)}</option>)}
            </Select>
          </Field>
          <Field label={t('start.intake')} htmlFor="start-intake">
            <Select id="start-intake" value={chosenIntake?.id ?? ''} onChange={(e) => setIntakeId(e.target.value)}>
              {intakes.map((i) => (
                <option key={i.id} value={i.id}>{intakeLabel(t, i.term, i.year)} — {t('start.deadline', { date: formatDate(i.application_deadline, locale) })}</option>
              ))}
            </Select>
          </Field>
          <Callout tone="neutral">{t('start.whatHappens')}</Callout>
        </div>
      )}
    </Modal>
  );
}
