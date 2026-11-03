import type { ApplicationStatus, Role } from '@hangyul/types';

/** What the signed-in person may do in the University Console. The API enforces the same rules; the UI hides what would fail. */
export interface Perms {
  /** Move applications through university decisions (review, interview, offer, reject…). */
  canDecide: boolean;
  /** Flag, assign reviewers, set external references. */
  canEdit: boolean;
  /** Server-side applicant CSV export (audited). */
  canExport: boolean;
  /** Propose admission-rule changes (first-party verified data). */
  canEditRules: boolean;
  /** Publish (or discard) proposed admission-rule changes. */
  canPublishRules: boolean;
  /** Create scholarship awards. */
  canAward: boolean;
  /** Commit / cancel awards. */
  canManageAwards: boolean;
  /** Mark awards as paid. */
  canPayAward: boolean;
  /** Partnership economics and scholarship pools. */
  canViewPartnership: boolean;
  /** Download (attachment) documents. */
  canDownloadDocs: boolean;
  readOnly: boolean;
}

/**
 * V22 (REPORT §247 U1): a university has ONE permission. Every member of a university organisation is its admin —
 * the API no longer refuses exports, decisions or analytics to any member, and the console no longer pretends it
 * does. The old admissions-officer / reviewer / analyst values survive only as migration aliases on the server
 * (`canonical_role`), so any `UNIVERSITY_*` role here means "member of the university".
 *
 * Hangyul staff viewing a partner university keep their own rules: operations decide and publish, finance handles
 * awards, counselors read and export, nobody else writes.
 */
const HANGYUL_WRITE: Role[] = ['HANGYUL_SUPER_ADMIN', 'HANGYUL_OPERATIONS'];
const HANGYUL_EXPORT: Role[] = ['HANGYUL_SUPER_ADMIN', 'HANGYUL_OPERATIONS', 'HANGYUL_FINANCE', 'HANGYUL_COUNSELOR'];
const HANGYUL_AWARD: Role[] = ['HANGYUL_SUPER_ADMIN', 'HANGYUL_FINANCE'];
const HANGYUL_MANAGE_AWARDS: Role[] = ['HANGYUL_SUPER_ADMIN', 'HANGYUL_OPERATIONS', 'HANGYUL_FINANCE'];

export const FULL_PERMISSIONS: Perms = {
  canDecide: true, canEdit: true, canExport: true, canEditRules: true, canPublishRules: true, canAward: true, canManageAwards: true, canPayAward: true,
  canViewPartnership: true, canDownloadDocs: true, readOnly: false,
};

export const isUniversityMember = (roles: readonly Role[]): boolean => roles.some((r) => r.startsWith('UNIVERSITY_'));

export function permissionsFor(roles: readonly Role[]): Perms {
  if (isUniversityMember(roles)) return FULL_PERMISSIONS;
  const has = (list: Role[]) => roles.some((r) => list.includes(r));
  const canDecide = has(HANGYUL_WRITE);
  return {
    canDecide,
    canEdit: canDecide,
    canExport: has(HANGYUL_EXPORT),
    canEditRules: canDecide,
    canPublishRules: canDecide,
    canAward: has(HANGYUL_AWARD),
    canManageAwards: has(HANGYUL_MANAGE_AWARDS),
    canPayAward: has(HANGYUL_AWARD),
    canViewPartnership: has(HANGYUL_EXPORT),
    canDownloadDocs: true,
    readOnly: !canDecide,
  };
}

/** Transitions a university performs. Hangyul staff get every transition from the API; the console only offers these. */
export const UNIVERSITY_ACTIONS: ApplicationStatus[] = [
  'UNIVERSITY_REVIEW', 'ADDITIONAL_DOCUMENTS', 'INTERVIEW', 'OFFERED', 'WAITLISTED', 'REJECTED', 'TUITION_PENDING', 'TUITION_PAID',
  'ADMISSION_CERTIFICATE_PENDING', 'ADMISSION_CERTIFICATE_ISSUED', 'ENROLLED',
];

export function decisionActions(allowed: readonly ApplicationStatus[], perms: Pick<Perms, 'canDecide'>): ApplicationStatus[] {
  if (!perms.canDecide) return [];
  return UNIVERSITY_ACTIONS.filter((s) => allowed.includes(s));
}

/** Statuses a university can see (identities appear only from submission onward). */
export const VISIBLE_STATUSES: ApplicationStatus[] = [
  'SUBMITTED', 'UNIVERSITY_REVIEW', 'ADDITIONAL_DOCUMENTS', 'INTERVIEW', 'OFFERED', 'WAITLISTED', 'REJECTED', 'OFFER_ACCEPTED',
  'TUITION_PENDING', 'TUITION_PAID', 'ADMISSION_CERTIFICATE_PENDING', 'ADMISSION_CERTIFICATE_ISSUED', 'VISA_PREPARATION',
  'VISA_SUBMITTED', 'VISA_ISSUED', 'ENROLLED', 'WITHDRAWN',
];

export const PENDING_DECISION: ApplicationStatus[] = ['SUBMITTED', 'UNIVERSITY_REVIEW', 'INTERVIEW', 'WAITLISTED'];
export const OFFER_STATUSES: ApplicationStatus[] = ['OFFERED', 'OFFER_ACCEPTED', 'TUITION_PENDING', 'TUITION_PAID', 'ADMISSION_CERTIFICATE_PENDING', 'ADMISSION_CERTIFICATE_ISSUED'];
