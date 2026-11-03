import { useAuth } from '@hangyul/auth';
import { DOCUMENT_CATEGORIES, type DocumentCategory, type VaultDocument } from '@hangyul/types';
import { Button, Field, Modal, Select, useToast } from '@hangyul/ui';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { StudentPicker, useT } from './bits';

/** Staff upload into a student's vault (e.g. a file the student emailed). Audited server-side as an upload on behalf. */
export function UploadOnBehalf({ open, onClose, onDone, student }: { open: boolean; onClose: () => void; onDone: (d: VaultDocument) => void; student?: { id: string; full_name: string } | null }) {
  const { api } = useAuth();
  const { t } = useT();
  const toast = useToast();
  const [who, setWho] = useState<{ id: string; full_name: string } | null>(null);
  const [category, setCategory] = useState<DocumentCategory | ''>('');
  const [file, setFile] = useState<File | null>(null);
  const [touched, setTouched] = useState(false);
  useEffect(() => { if (open) { setWho(student ?? null); setCategory(''); setFile(null); setTouched(false); } }, [open, student]);
  const m = useMutation({
    mutationFn: () => api.documents.upload(file!, { category: category as DocumentCategory, student_user_id: who!.id }),
    onSuccess: (d) => { toast.success(t('docs.uploadedFor', { name: who!.full_name })); onDone(d); onClose(); },
    onError: (e) => toast.error((e as Error).message),
  });
  const submit = () => { setTouched(true); if (who && category && file) m.mutate(); };
  return (
    <Modal open={open} onClose={onClose} title={student ? t('docs.uploadForName', { name: student.full_name }) : t('docs.uploadForStudent')} width={520}
      footer={<><Button onClick={onClose}>{t('actions.cancel')}</Button><Button variant="primary" loading={m.isPending} onClick={submit}>{t('docs.upload')}</Button></>}>
      <div className="hg-stack" style={{ '--hg-gap': '14px' } as React.CSSProperties}>
        <p className="hg-small hg-muted">{t('docs.uploadForHint')}</p>
        {student ? null : <Field label={t('misc.student')} error={touched && !who ? t('validation.required') : undefined}><StudentPicker value={who} onChange={setWho} label={t('misc.student')} /></Field>}
        <Field label={t('docs.category')} htmlFor="ob-cat" error={touched && !category ? t('validation.required') : undefined}>
          <Select id="ob-cat" value={category} onChange={(e) => setCategory(e.target.value as DocumentCategory)} invalid={touched && !category}>
            <option value="">{t('docs.chooseCategory')}</option>
            {DOCUMENT_CATEGORIES.map((c) => <option key={c} value={c}>{t(`docCategory.${c}`)}</option>)}
          </Select>
        </Field>
        <Field label={t('docs.file')} htmlFor="ob-file" hint={t('docs.fileHint')} error={touched && !file ? t('validation.required') : undefined}>
          <input id="ob-file" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </Field>
      </div>
    </Modal>
  );
}

