/**
 * V31 translation-quality gate — static part (brief Part 52). `npm run qa:v31-l10n`
 *
 * It cannot judge naturalness (that is what docs/qa/v31/l10n/records/ are for). It catches the mechanical and the
 * dangerous, across ALL 56 bundles (malformed) and the 34 market locales (stale/forbidden/untranslated):
 *
 *   placeholder     a {{x}} missing or extra vs English (same key)                         — every bundle
 *   tags            <tag> structure differs from English                                  — every bundle
 *   plural          an x_one without x_other, or extra CLDR forms without x_other         — every bundle
 *   hangul          Hangul inside a non-Korean string (Korean leaking into a translation) — every bundle
 *   script          the dominant script is wrong for the locale (e.g. Latin Russian)       — market locales
 *   untranslated    a market string identical to its English and ≥ 4 words (not a name)   — market locales, A-keys
 *   stale           V15 / pre-V31 terminology the contract no longer has                  — en + market locales
 *   forbidden       glossary-forbidden renderings (consular confirmation, visa issuance…)  — en + market locales
 *   pt-variant      Brazilian forms in European Portuguese                                 — pt
 *   rtl-mark        an RTL string that starts with Latin/digits and has no RTL mark         — ar/fa/ur (warning)
 *   ko-particles    delegated to `npm run qa:v28-particles`
 *
 * Exit 1 on any non-warning finding. Writes docs/qa/v31/l10n/gate.json.
 */
import fs from 'node:fs';

const DIR = 'packages/i18n/locales';
const ALL = fs.readdirSync(DIR).filter((d) => fs.statSync(`${DIR}/${d}`).isDirectory());
const MARKETS = fs.readFileSync('packages/i18n/src/markets.ts', 'utf8').match(/locale: '([a-zA-Z-]+)'/g).map((s) => s.slice(9, -1));
const CUSTOMER_NS = ['common', 'marketing', 'student', 'mobile', 'concierge', 'visaroute', 'dossier', 'success', 'writing'];
const A = new Set(fs.readFileSync('docs/qa/v28/l10n/keys-A.txt', 'utf8').split('\n').filter(Boolean));
const flat = (o, p = '', out = {}) => { for (const [k, v] of Object.entries(o ?? {})) { const q = p ? `${p}.${k}` : k; if (v && typeof v === 'object') flat(v, q, out); else if (typeof v === 'string') out[q] = v; } return out; };
const load = (loc, ns) => { try { return flat(JSON.parse(fs.readFileSync(`${DIR}/${loc}/${ns}.json`, 'utf8'))); } catch { return {}; } };
// `particle` is the Korean particle-pair parameter (V28 qa:v28-particles) — Korean-only by design.
const ph = (s) => [...new Set([...s.matchAll(/\{\{\s*([\w.]+)\s*(?:,[^}]*)?\}\}/g)].map((m) => m[1]).filter((x) => !/^particle/.test(x)))].sort().join(',');
// Compared as a multiset: word order may legitimately move a tag (Hindi puts the <br> after the span).
const tags = (s) => [...s.matchAll(/<\/?([a-zA-Z][\w-]*)[^>]*>/g)].map((m) => m[0].startsWith('</') ? `/${m[1]}` : m[1]).sort().join(',');
const PLURAL = /_(zero|one|two|few|many|other)$/;
const SCRIPT = {
  Cyrl: ['ru', 'uk', 'kk', 'ky', 'mn', 'sr', 'tg'], Arab: ['ar', 'fa', 'ur', 'ps'], Deva: ['hi', 'ne', 'mr'], Beng: ['bn'],
  Thai: ['th'], Mymr: ['my'], Hans: ['zh-Hans', 'zh-Hant'], Jpan: ['ja'], Grek: ['el'], Hebr: ['he'], Laoo: ['lo'], Khmr: ['km'],
};
const RE = { Cyrl: /\p{Script=Cyrillic}/u, Arab: /\p{Script=Arabic}/u, Deva: /\p{Script=Devanagari}/u, Beng: /\p{Script=Bengali}/u, Thai: /\p{Script=Thai}/u,
  Mymr: /\p{Script=Myanmar}/u, Hans: /\p{Script=Han}/u, Jpan: /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u, Grek: /\p{Script=Greek}/u, Hebr: /\p{Script=Hebrew}/u,
  Laoo: /\p{Script=Lao}/u, Khmr: /\p{Script=Khmer}/u };
const scriptOf = (loc) => Object.entries(SCRIPT).find(([, ls]) => ls.includes(loc))?.[0];
// Names/brands/tests that legitimately stay Latin.
const LATIN_OK = /^(?:[\s\d.,:;()\-–/+%$·|&'’"!?]|Hangyul|Univ|TOPIK|TOEFL|IELTS|iBT|TEPS|TOEIC|PTE|Duolingo|GKS|D-2|D-4|USD|KRW|PDF|CSV|SNS|ID|OK|URL|Email|E-mail|Apostille|Basic|All-in-One|Premium|Kakao|WhatsApp|Zalo|Telegram|LINE|Google|Apple|Toss|Visa|Mastercard|[A-Z][\w.-]*\s?(?:University|Institute|College))+$/;
const STALE = [/\bminutes? of (?:consultation|counsel)/i, /\b1:1 sessions? per month\b/i, /\bResponsible[- ]team\b/i, /\bApplications managed\b/];
// Official terms stay legal ("Visa issuance restricted" = 비자발급제한대학, "Certificate for Confirmation of Visa Issuance");
// what is forbidden is HANGYUL issuing visas, or an un-negated guarantee.
const FORBIDDEN = [/consular confirmation/i, /(?<!not |n't |no |never |cannot |can't )\bguarantee(?:d|s)? (?:your )?(?:admission|acceptance|success|a visa|a place)\b/i, /\b(?:we|Hangyul)\b(?![^.]{0,20}\b(?:not|n't)\b)[^.?]{0,30}\bissues? (?:your |the )?visa[^?]*$/i,
  /영사\s*확인서?\s*\(confirmation\)/, /보장합니다/];
// Disclaimer lists whose heading carries the negation ("What Hangyul does not do: guarantee admission…").
const NEGATED_CONTEXT = [/^marketing:howPage\.doesnt\./];
const PT_BR = /\b(?:você|vocês|cadastro|celular|tela|ônibus|registrar-se|equipe|time de)\b/i;
const findings = []; const warn = [];
const add = (sev, check, loc, key, detail) => (sev === 'warn' ? warn : findings).push({ check, loc, key, detail });

const en = Object.fromEntries(CUSTOMER_NS.concat(['agency', 'university']).map((ns) => [ns, load('en', ns)]));
for (const loc of ALL) {
  if (loc === 'en') continue;
  const market = MARKETS.includes(loc);
  for (const ns of Object.keys(en)) {
    const t = load(loc, ns); const src = en[ns];
    const bases = new Set(Object.keys(t).filter((k) => PLURAL.test(k)).map((k) => k.replace(PLURAL, '')));
    const offered = CUSTOMER_NS.includes(ns) || ['ko', 'en'].includes(loc);   // consoles offer ko/en only (V29)
    for (const b of bases) if (!(`${b}_other` in t) && (`${b}_other` in src)) add(offered ? 'err' : 'warn', 'plural', loc, `${ns}:${b}`, 'forms without _other');
    for (const [k, v] of Object.entries(t)) {
      const base = k.replace(PLURAL, '');
      const s = src[k] ?? src[`${base}_other`] ?? src[base];
      if (s === undefined) continue;                                         // stale key; not this gate's business
      // A plural form may legitimately drop {{count}} (ar _zero/_one/_two, ja/ko have one form): compare without it.
      const noCount = (x) => x.split(',').filter((y) => y && y !== 'count').join(',');
      if (PLURAL.test(k) ? noCount(ph(v)) !== noCount(ph(s)) : ph(v) !== ph(s)) add('err', 'placeholder', loc, `${ns}:${k}`, `${ph(v)} ≠ ${ph(s)}`);
      if (tags(v) !== tags(s)) add('err', 'tags', loc, `${ns}:${k}`, `${tags(v)} ≠ ${tags(s)}`);
      // A Korean official name glossed in parentheses (외국인등록증) is deliberate: it is what the student sees on the form.
      const unglossed = v.replace(/[(（]\s*[\p{Script=Hangul}\s·]+\s*[)）]/gu, '');
      if (loc !== 'ko' && /\p{Script=Hangul}/u.test(unglossed) && !/\p{Script=Hangul}/u.test(s)) add('err', 'hangul', loc, `${ns}:${k}`, v.slice(0, 60));
      if (!market || !CUSTOMER_NS.includes(ns) || loc === 'ko') continue;
      const sc = scriptOf(loc);
      // Wrong script = an ENGLISH SENTENCE in a non-Latin locale (≥ 2 common English function words), not a Latin name.
      const englishy = (v.replace(/\{\{[^}]+\}\}|<[^>]+>|\$t\([^)]*\)/g, '').match(/\b(?:the|your|you|and|with|this|that|from|will|have|are|is|for|not|can|of|to)\b/gi) ?? []).length >= 2;
      if (sc && !RE[sc].test(v) && englishy) add('err', 'script', loc, `${ns}:${k}`, v.slice(0, 60));
      if (A.has(`${ns}:${k}`) && v === s && s.split(/\s+/).length >= 4 && !LATIN_OK.test(s) && !/^https?:/.test(s)) add('err', 'untranslated', loc, `${ns}:${k}`, s.slice(0, 60));
      if (loc === 'pt' && PT_BR.test(v)) add('err', 'pt-variant', loc, `${ns}:${k}`, v.slice(0, 60));
      if (['ar', 'fa', 'ur'].includes(loc) && /^[A-Za-z0-9$]/.test(v) && !/^[‏‫]/.test(v)) add('warn', 'rtl-mark', loc, `${ns}:${k}`, v.slice(0, 40));
    }
  }
}
for (const loc of ['en', ...MARKETS]) for (const ns of CUSTOMER_NS) for (const [k, v] of Object.entries(load(loc, ns))) {
  for (const re of STALE) if (re.test(v)) add('err', 'stale', loc, `${ns}:${k}`, v.slice(0, 70));
  if (!NEGATED_CONTEXT.some((r) => r.test(`${ns}:${k}`))) for (const re of FORBIDDEN) if (re.test(v)) add('err', 'forbidden', loc, `${ns}:${k}`, v.slice(0, 70));
}
// Owner-verbatim copy (V11 fidelity gate) is the owner's to change: reported, never failed here.
// Known, reasoned exceptions: Korean carries an extra parameter its caller does pass (REPORT §430).
const KNOWN = new Set(['ko|marketing:v20.dir.cityShot', 'ko|writing:finding.PROMPT_PART_MISSING_other']);
const owner = new Set(JSON.parse(fs.readFileSync('docs/qa/v11/koreanasha-copy.json', 'utf8')).strings.map((s) => `marketing:${s.hangyulKey}`));
const owned = findings.filter((f) => owner.has(f.key) && ['ko', 'ru'].includes(f.loc));
const open = findings.filter((f) => !owned.includes(f) && !KNOWN.has(`${f.loc}|${f.key}`));
const by = {}; for (const f of open) by[f.check] = (by[f.check] ?? 0) + 1;
fs.writeFileSync('docs/qa/v31/l10n/gate.json', JSON.stringify({ at: new Date().toISOString(), bundles: ALL.length, markets: MARKETS.length, by, open: open.length, ownerFlagged: owned, warnings: warn.length, findings: open.slice(0, 400) }, null, 1));
console.log(JSON.stringify({ bundles: ALL.length, markets: MARKETS.length, by, ownerFlagged: owned.length, warnings: warn.length }));
for (const f of open.slice(0, 40)) console.log(`  ✗ ${f.check} ${f.loc} ${f.key}: ${f.detail}`);
console.log(open.length ? `qa:v31-l10n: FAIL — ${open.length}` : 'qa:v31-l10n: OK');
process.exit(open.length ? 1 : 0);
