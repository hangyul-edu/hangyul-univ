/** Server-backed message templates (personal · team · organization) with language variants (V9, REPORT §59 A5). */
import { useAuth } from '@hangyul/auth';
import { useLocale } from '@hangyul/i18n';
import type { MessageTemplate, TemplateKind } from '@hangyul/types';
import { useQuery } from '@tanstack/react-query';

export const TEMPLATE_KEY = ['templates'] as const;

/** A student's likely language from their nationality, when their app language is not known (same map as the server). */
const COUNTRY_LANG: Record<string, string> = {
  VN: 'vi', CN: 'zh', MN: 'mn', UZ: 'uz', NP: 'ne', MM: 'my', JP: 'ja', ID: 'id', TH: 'th', IN: 'hi', BD: 'bn', PK: 'ur', LK: 'si', PH: 'fil',
  KZ: 'kk', KG: 'ky', TJ: 'tg', RU: 'ru', KH: 'km', KR: 'ko', US: 'en',
};
export function langOfCountry(code: string | null | undefined): string | null {
  return code ? COUNTRY_LANG[code.toUpperCase()] ?? null : null;
}

export interface TemplateGroup { key: string; picked: MessageTemplate; variants: MessageTemplate[]; matchedStudent: boolean }

/** The variant to insert: the student's language → the console language → English → the first one. */
export function pickVariant(variants: MessageTemplate[], studentLang: string | null | undefined, uiLang: string): { t: MessageTemplate; matchedStudent: boolean } {
  const base = (l: string | null | undefined) => (l ?? '').split('-')[0].toLowerCase();
  const by = (l: string | null | undefined) => variants.find((v) => base(v.locale) === base(l));
  const s = studentLang ? by(studentLang) : undefined;
  if (s) return { t: s, matchedStudent: true };
  return { t: by(uiLang) ?? by('en') ?? variants[0], matchedStudent: false };
}

/** Group templates by language group (one entry per template, every language variant attached). */
export function groupTemplates(items: MessageTemplate[], studentLang: string | null | undefined, uiLang: string): TemplateGroup[] {
  const groups = new Map<string, MessageTemplate[]>();
  for (const x of items) {
    const k = `${x.scope}:${x.group_key ?? x.id}`;
    groups.set(k, [...(groups.get(k) ?? []), x]);
  }
  return [...groups.entries()].map(([key, variants]) => {
    const p = pickVariant(variants, studentLang, uiLang);
    return { key, picked: p.t, variants, matchedStudent: p.matchedStudent };
  });
}

export function useServerTemplates(kinds?: TemplateKind[], studentLang?: string | null) {
  const { api } = useAuth();
  const q = useQuery({ queryKey: TEMPLATE_KEY, queryFn: () => api.templates.list(), staleTime: 5 * 60_000 });
  const { locale } = useLocale('agency');
  const lang = locale.split('-')[0];
  const all = (q.data?.items ?? []) as MessageTemplate[];
  const scoped = kinds ? all.filter((x) => kinds.includes(x.kind)) : all;
  const groups = groupTemplates(scoped, studentLang, lang);
  // One entry per template (its best language variant) — the shape older callers expect.
  const items = groups.map((g) => g.picked);
  return { ...q, items, groups, all, placeholders: q.data?.placeholders ?? [], canPublishOrg: !!(q.data as { can_publish_org?: boolean } | undefined)?.can_publish_org };
}

/** Fill {{placeholders}} with known values; unknown placeholders are left visible so the sender notices them. */
export function fillTemplate(body: string, vars: Record<string, string | null | undefined>): string {
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k: string) => (vars[k] ? String(vars[k]) : m));
}
