import type { ApplicationStatus } from '@hangyul/types';
import { z } from 'zod';

/** Form values for a decision (status transition). Everything is a string because it comes from inputs. */
export const decisionSchema = z.object({
  to: z.string(),
  note: z.string().max(2000).optional(),
  interview_at: z.string().optional(),
  offer_scholarship_note: z.string().max(300).optional(),
  tuition_amount_krw: z.string().optional(),
  tuition_due: z.string().optional(),
  external_reference: z.string().max(80).optional(),
}).superRefine((v, ctx) => {
  const need = (path: string, ok: boolean) => { if (!ok) ctx.addIssue({ code: 'custom', path: [path], message: 'validation.required' }); };
  // A decision that stops or pauses an application always carries its reason.
  if (['ADDITIONAL_DOCUMENTS', 'REJECTED', 'WAITLISTED'].includes(v.to)) need('note', !!v.note?.trim());
  if (v.to === 'INTERVIEW') need('interview_at', !!v.interview_at && !Number.isNaN(new Date(v.interview_at).getTime()));
  if (v.to === 'TUITION_PENDING') {
    const n = Number(v.tuition_amount_krw);
    need('tuition_amount_krw', !!v.tuition_amount_krw && Number.isFinite(n) && n > 0);
    need('tuition_due', !!v.tuition_due && /^\d{4}-\d{2}-\d{2}$/.test(v.tuition_due));
  }
});
export type DecisionValues = z.infer<typeof decisionSchema>;

export interface TransitionBody {
  to: ApplicationStatus;
  note?: string;
  interview_at?: string;
  tuition_amount_krw?: number;
  tuition_due?: string;
  offer_scholarship_note?: string;
  external_reference?: string;
}

/** Builds the API body, sending only the fields that belong to the chosen transition. */
export function buildTransitionBody(v: DecisionValues): TransitionBody {
  const to = v.to as ApplicationStatus;
  const body: TransitionBody = { to };
  if (v.note?.trim()) body.note = v.note.trim();
  if (to === 'INTERVIEW' && v.interview_at) body.interview_at = new Date(v.interview_at).toISOString();
  if (to === 'OFFERED' && v.offer_scholarship_note?.trim()) body.offer_scholarship_note = v.offer_scholarship_note.trim();
  if (to === 'TUITION_PENDING') {
    body.tuition_amount_krw = Math.round(Number(v.tuition_amount_krw));
    body.tuition_due = v.tuition_due;
  }
  if (v.external_reference?.trim()) body.external_reference = v.external_reference.trim();
  return body;
}

/** Visual weight of each action button. */
export function actionVariant(to: ApplicationStatus): 'primary' | 'danger' | 'secondary' | 'success' {
  if (to === 'OFFERED' || to === 'ENROLLED' || to === 'ADMISSION_CERTIFICATE_ISSUED') return 'primary';
  if (to === 'REJECTED') return 'danger';
  if (to === 'TUITION_PAID') return 'success';
  return 'secondary';
}
