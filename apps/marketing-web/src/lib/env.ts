/** Where the marketing site sends people to act. All three apps accept `?lang=` to keep the chosen language. */
const trim = (u: string) => u.replace(/\/$/, '');

// The local ports are a development fallback only; a production build without the env var still links to the public
// domains (V32: a build without Vercel's env shipped http://localhost:310x links — qa:marketing-serverless caught it).
const DEV = import.meta.env.DEV;
export const STUDENT_APP_URL = trim(import.meta.env.VITE_STUDENT_APP_URL ?? (DEV ? 'http://localhost:3101' : 'https://app.univ.talkhangyul.com'));
export const AGENCY_APP_URL = trim(import.meta.env.VITE_AGENCY_APP_URL ?? (DEV ? 'http://localhost:3102' : 'https://admin.univ.talkhangyul.com'));
export const UNIVERSITY_APP_URL = trim(import.meta.env.VITE_UNIVERSITY_APP_URL ?? (DEV ? 'http://localhost:3103' : 'https://partner.univ.talkhangyul.com'));

function withLang(base: string, path: string, locale?: string): string {
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  if (!locale || locale === 'en') return url;
  return `${url}${url.includes('?') ? '&' : '?'}lang=${encodeURIComponent(locale)}`;
}

export const studentUrl = (path: string, locale?: string) => withLang(STUDENT_APP_URL, path, locale);
export const agencyUrl = (path: string, locale?: string) => withLang(AGENCY_APP_URL, path, locale);
export const universityUrl = (path: string, locale?: string) => withLang(UNIVERSITY_APP_URL, path, locale);
