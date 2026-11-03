// V29 — builds each web app's Content-Security-Policy from infra/csp.json (the single source).
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const APP_DIRS = { marketing: 'marketing-web', student: 'student-web', agency: 'agency-web', university: 'university-web' };

export function loadPolicy(path = resolve(ROOT, 'infra/csp.json')) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

/** Directive map for one app: common ∪ each enabled feature ∪ the API origin (when the API is not same-origin). */
export function directivesFor(policy, app) {
  const conf = policy.apps[app];
  if (!conf) throw new Error(`unknown app ${app}`);
  const out = {};
  for (const [k, v] of Object.entries(policy.common)) out[k] = [...v];
  for (const f of conf.features) {
    const feat = policy.features[f];
    if (!feat) throw new Error(`unknown CSP feature ${f}`);
    for (const [k, v] of Object.entries(feat)) out[k] = [...new Set([...(out[k] ?? []), ...v])];
  }
  if (policy.api_origin) out['connect-src'] = [...new Set([...out['connect-src'], policy.api_origin])];
  if (policy.report_uri) out['report-uri'] = [policy.report_uri];
  return out;
}

export function headerFor(policy, app) {
  return Object.entries(directivesFor(policy, app)).map(([k, v]) => (v.length ? `${k} ${v.join(' ')}` : k)).join('; ');
}

export function problems(policy) {
  const out = [];
  for (const app of Object.keys(policy.apps)) {
    const d = directivesFor(policy, app);
    for (const [k, v] of Object.entries(d)) {
      if (v.includes("'unsafe-eval'")) out.push(`${app}: ${k} contains 'unsafe-eval'`);
      if (k !== 'style-src' && v.includes("'unsafe-inline'")) out.push(`${app}: ${k} contains 'unsafe-inline' (only style-src may)`);
      if (v.includes('*') || v.includes('http:') || v.includes('https:')) out.push(`${app}: ${k} has a scheme/host wildcard`);
    }
    if (!(d['frame-ancestors'] ?? []).length) out.push(`${app}: frame-ancestors missing`);
    if (!(d['object-src'] ?? []).includes("'none'")) out.push(`${app}: object-src must be 'none'`);
  }
  return out;
}
