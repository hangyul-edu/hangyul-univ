import { z } from 'zod';

/** Shared form schemas (web + mobile). Messages are i18n keys resolved by the UI. */
export const loginSchema = z.object({
  email: z.string().trim().min(1, 'validation.required').email('validation.email'),
  password: z.string().min(1, 'validation.required'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    full_name: z.string().trim().min(1, 'validation.required').max(200),
    email: z.string().trim().email('validation.email'),
    phone_country: z.string().length(2, 'validation.required'),
    phone_local: z.string().trim().min(6, 'validation.phone').max(20, 'validation.phone'),
    password: z.string().min(10, 'validation.passwordLength').max(200),
    password_confirm: z.string().min(1, 'validation.required'),
    nationality: z.string().length(2, 'validation.required'),
  })
  .refine((v) => v.password === v.password_confirm, { message: 'validation.passwordMismatch', path: ['password_confirm'] });
export type RegisterInput = z.infer<typeof registerSchema>;

const year = z.coerce.number().int().min(1950).max(2100);

export const educationSchema = z
  .object({
    level: z.enum(['HIGH_SCHOOL', 'ASSOCIATE', 'BACHELOR', 'MASTER', 'DOCTORATE']),
    institution: z.string().trim().min(1, 'validation.required').max(200),
    country: z.string().length(2, 'validation.required'),
    major: z.string().max(160).optional().or(z.literal('')),
    graduation_year: year.optional(),
    graduation_status: z.enum(['GRADUATED', 'EXPECTED', 'IN_PROGRESS']),
    gpa_value: z.coerce.number().min(0).optional(),
    gpa_scale_max: z.coerce.number().positive().optional(),
  })
  .refine((v) => v.gpa_value === undefined || v.gpa_scale_max === undefined || v.gpa_value <= v.gpa_scale_max, {
    message: 'validation.gpaAboveScale',
    path: ['gpa_value'],
  });
export type EducationInput = z.infer<typeof educationSchema>;

export const LANGUAGE_MAX = { TOPIK: 6, IELTS: 9, TOEFL_IBT: 120, DUOLINGO: 160 } as const;
export const languageSchema = z
  .object({
    test: z.enum(['TOPIK', 'IELTS', 'TOEFL_IBT', 'DUOLINGO']),
    score: z.coerce.number().min(0),
    test_date: z.string().optional(),
    is_planned: z.boolean().default(false),
  })
  .refine((v) => v.score <= LANGUAGE_MAX[v.test], { message: 'validation.scoreRange', path: ['score'] });
export type LanguageInput = z.infer<typeof languageSchema>;

export const messageSchema = z.object({ body: z.string().trim().min(1, 'validation.required').max(8000), internal: z.boolean().default(false) });
export const taskSchema = z.object({
  title: z.string().trim().min(1, 'validation.required').max(300),
  due_at: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  visible_to_student: z.boolean().default(false),
});
export const reviewSchema = z.discriminatedUnion('decision', [
  z.object({ decision: z.literal('VERIFIED'), reason: z.string().optional() }),
  z.object({ decision: z.literal('NEEDS_CORRECTION'), reason: z.string().trim().min(3, 'validation.reasonRequired') }),
]);

/** Client-side file checks mirror the server's (the server re-validates by magic bytes). */
export const ALLOWED_UPLOAD_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
export const MAX_UPLOAD_MB = 15;
/** File-name endings accepted for each declared MIME type (extension and declared type must agree). */
export const UPLOAD_EXTENSIONS: Record<string, string[]> = {
  'application/pdf': ['pdf'], 'image/png': ['png'], 'image/jpeg': ['jpg', 'jpeg'], 'image/webp': ['webp'],
};

/** Reason keys (`common:validation.*`); the UI translates them. */
export type UploadReason = 'validation.fileType' | 'validation.fileSize' | 'validation.fileCount' | 'validation.fileEmpty' | 'validation.fileExtension';
export interface UploadRules { types?: string[]; maxMb?: number; maxFiles?: number }
interface FileLike { size: number; type: string; name?: string }

const extOf = (name?: string) => {
  const m = /\.([a-z0-9]+)$/i.exec(name ?? '');
  return m ? m[1].toLowerCase() : '';
};

/**
 * One file: declared MIME (or, when the browser declares none, the name ending), the name ending agreeing with the
 * declared type, size. The same function serves the picker and drag & drop — there is no second path.
 */
export function checkUpload(file: FileLike, rules: UploadRules = {}): UploadReason | null {
  const types = rules.types ?? ALLOWED_UPLOAD_TYPES;
  const maxMb = rules.maxMb ?? MAX_UPLOAD_MB;
  const ext = extOf(file.name);
  if (file.type) {
    if (!types.includes(file.type)) return 'validation.fileType';
    const exts = UPLOAD_EXTENSIONS[file.type];
    if (file.name !== undefined && ext && exts && !exts.includes(ext)) return 'validation.fileExtension';
  } else if (!types.some((t) => (UPLOAD_EXTENSIONS[t] ?? []).includes(ext))) {
    return 'validation.fileType';
  }
  if (file.size > maxMb * 1024 * 1024) return 'validation.fileSize';
  if (file.size === 0) return 'validation.fileEmpty';
  return null;
}

export interface UploadCheck<F> {
  /** Files that passed (empty when the batch was refused as a whole). */
  accepted: F[];
  rejected: { file: F; reason: UploadReason }[];
  /** Set when the whole batch is refused because it holds more files than allowed. */
  batchReason: 'validation.fileCount' | null;
  /** The allowed count, for the `validation.fileCount` message. */
  max: number;
}

/** A batch from the picker or a drop. `already` = files already attached (e.g. chat attachments). */
export function checkUploads<F extends FileLike>(files: F[], rules: UploadRules = {}, already = 0): UploadCheck<F> {
  const max = Math.max(0, (rules.maxFiles ?? 1) - already);
  if (files.length > max) return { accepted: [], rejected: [], batchReason: 'validation.fileCount', max: rules.maxFiles ?? 1 };
  const accepted: F[] = [];
  const rejected: { file: F; reason: UploadReason }[] = [];
  for (const f of files) {
    const r = checkUpload(f, rules);
    if (r) rejected.push({ file: f, reason: r }); else accepted.push(f);
  }
  return { accepted, rejected, batchReason: null, max: rules.maxFiles ?? 1 };
}

/**
 * While dragging only `DataTransferItem.kind/type` are readable (no name, no size). Returns the reason a drop would be
 * refused, when it is already knowable; an empty type is unknown and passes (the drop itself is checked in full).
 */
export function checkDragItems(items: { kind: string; type: string }[], rules: UploadRules = {}, already = 0): UploadReason | null {
  const files = items.filter((i) => i.kind === 'file');
  if (!files.length) return null;
  if (files.length > Math.max(0, (rules.maxFiles ?? 1) - already)) return 'validation.fileCount';
  const types = rules.types ?? ALLOWED_UPLOAD_TYPES;
  if (files.some((i) => i.type && !types.includes(i.type))) return 'validation.fileType';
  return null;
}
