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
export function checkUpload(file: { size: number; type: string }): string | null {
  if (!ALLOWED_UPLOAD_TYPES.includes(file.type)) return 'validation.fileType';
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) return 'validation.fileSize';
  return null;
}
