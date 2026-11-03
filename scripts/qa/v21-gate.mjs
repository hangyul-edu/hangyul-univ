/**
 * `npm run qa:v21` — the V21 gate (brief §56).
 *
 * Two halves, for the two halves of the pass:
 *
 *   **University** — that the monogram is *gone from the codebase*, not merely unused; that no
 *   institution shows another's image; that every result has an intentional visual tier; that media
 *   and philosophy carry provenance; that the generated prose is gone.
 *
 *   **Payment** — that no raw card data is persisted or logged, that no credential reaches a client,
 *   that the credential column is encrypted at rest, that the foreign-billing TEST configuration is
 *   detected, and that the purchase UI offers no domestic or easy-pay method.
 *
 * The parts that need a real transaction live in `scripts/qa/v21/toss-test-transaction.mjs`, which
 * this gate runs. Nothing here prints a card number, a secret or a credential.
 *
 *   node scripts/qa/v21-gate.mjs [--static]
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const json = (p) => JSON.parse(read(p));
const STATIC_ONLY = process.argv.includes('--static') || process.argv.includes('--no-browser');

const fails = [];
const passes = [];
const check = (name, ok, detail = '') => { (ok ? passes : fails).push(`${name}${detail ? ` — ${detail}` : ''}`); };

const walk = (dir, exts = /\.(tsx?|mjs|s?css)$/) => {
  const out = [];
  const abs = join(ROOT, dir);
  if (!existsSync(abs)) return out;
  for (const e of readdirSync(abs, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'dist' || e.name.startsWith('.')) continue;
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) out.push(...walk(p, exts));
    else if (exts.test(e.name)) out.push(p);
  }
  return out;
};
const SRC = ['apps/marketing-web/src', 'apps/student-web/src', 'packages/ui/src', 'packages/utils/src'];
const allSrc = SRC.flatMap((d) => walk(d));

/* ======================================================================== A. the monogram is gone */

// Not "unused" — **absent**. A dead exported helper is one import away from coming back.
const monogramRefs = allSrc.filter((f) => /\bmonogramOf\b/.test(read(f)));
check('§2 monogramOf() does not exist anywhere in the source', monogramRefs.length === 0, monogramRefs.join(', '));

const monoCss = allSrc.filter((f) => /__mono\b|hero__mono|unicard__mono/.test(read(f)));
check('§2 the monogram CSS is gone', monoCss.length === 0, monoCss.join(', '));

const tierNames = read('packages/utils/src/university.ts');
check('§3 the fourth tier is an identity composition, not a typographic fragment',
  /D_IDENTITY/.test(tierNames) && !/D_TYPOGRAPHIC/.test(tierNames));

// A tile must never set a *substring* of the institution's name as a graphic.
const tile = read('apps/marketing-web/src/pages/Universities.tsx');
check('§2 the result tile sets whole names only',
  !/\.slice\(0,\s*[12]\)|\.substring\(0,\s*[12]\)|\[\.\.\.[a-z]+\]\.slice/i.test(tile));

/* ============================================================== B. the content record and its rights */

const registry = json('server/app/data/korean_institutions.json').institutions;
const content = existsSync(join(ROOT, 'server/app/data/university_content.json'))
  ? json('server/app/data/university_content.json').records : {};
const credits = json('apps/marketing-web/src/media/credits.json');
const creditBySlug = new Map(credits.map((c) => [c.slug, c]));
const SERVABLE = new Set(['HANGYUL_OWNED', 'OWNER_AUTHORISED', 'COMMERCIAL_NO_ATTRIBUTION',
  'CC0_PUBLIC_DOMAIN', 'ATTRIBUTION_SUPPORTED']);

check('the registry is still the canonical 425', registry.length === 425, String(registry.length));

let cross = 0; let unservable = 0; let noProvenance = 0; let uncredited = 0;
const owner = new Map();
for (const [slug, rec] of Object.entries(content)) {
  for (const m of [rec.media?.hero, ...(rec.media?.gallery ?? [])].filter(Boolean)) {
    if (m.university_id && m.university_id !== slug) cross += 1;
    const prior = owner.get(m.asset);
    if (prior && prior !== slug) cross += 1;
    owner.set(m.asset, slug);
    const credit = creditBySlug.get(m.asset);
    if (!credit || !SERVABLE.has(credit.rights_status)) { unservable += 1; continue; }
    for (const f of ['media_source', 'license_or_permission', 'local_path']) if (!m[f]) noProvenance += 1;
    // §15 — an attribution-bearing asset must carry what the credit needs.
    if (credit.attribution_required) {
      const a = m.attribution_requirement;
      if (!a || !a.author || !a.license || !a.license_url || !a.source_url) uncredited += 1;
    }
  }
}
check('§8 no photograph is assigned to two institutions', cross === 0, `${cross}`);

// §8 again, within one page: the hero must not also be the gallery's first picture. 44 institutions
// showed the same photograph twice until V21 — full-bleed at the top and again under "Around the
// campus" — which is padding rather than a second view of the place.
const heroRepeats = Object.entries(content).filter(([, r]) => {
  const hero = r.media?.hero?.asset;
  return hero && (r.media?.gallery ?? []).some((g) => g.asset === hero);
}).map(([slug]) => slug);
check('§8 no institution shows its hero photograph twice', heroRepeats.length === 0,
  `${heroRepeats.length}: ${heroRepeats.slice(0, 3).join(', ')}`);

// §8, the same question asked of the other two things a tile can draw. Both are clean today; they are
// checked because "is this actually this institution's?" is the question three passes of gates kept
// not asking, and a shared mark or film would be the same defect as a shared photograph.
const sharedBy = (get) => {
  const owner = new Map(); const dups = new Set();
  for (const [slug, r] of Object.entries(content)) {
    const key = get(r);
    if (!key) continue;
    if (owner.has(key)) { dups.add(owner.get(key)); dups.add(slug); } else owner.set(key, slug);
  }
  return [...dups];
};
const dupLogos = sharedBy((r) => r.logo?.local_path ?? r.logo?.url);
const dupVideos = sharedBy((r) => r.youtube?.video_id);
check('§8 no official mark is shared by two institutions', dupLogos.length === 0, dupLogos.slice(0, 4).join(', '));
check('§8 no official film is shared by two institutions', dupVideos.length === 0, dupVideos.slice(0, 4).join(', '));
check('§15 every rendered photograph is under a licence Hangyul may serve', unservable === 0, `${unservable}`);
check('§15 every rendered asset carries its provenance', noProvenance === 0, `${noProvenance}`);
check('§15 every credited photograph carries author, licence and source', uncredited === 0, `${uncredited}`);

// §3 — a *city* photograph may not be attached to an institution, and may not appear on a tile.
const cityOnInstitution = Object.values(content)
  .flatMap((r) => [r.media?.hero, ...(r.media?.gallery ?? [])].filter(Boolean))
  .filter((m) => m.kind === 'CITY' || m.kind === 'REGION_FALLBACK').length;
check('§3 no city photograph is attached to an institution', cityOnInstitution === 0, `${cityOnInstitution}`);
check('§3 the result tile does not fall back to city photography',
  /const photo = v\.campus;/.test(tile) && !/v\.campus \?\? v\.city/.test(tile));
// §3 — and neither does the detail hero. It did until V21: Daegu Cyber University, an online
// university, led with Bulguksa because its province has a stock photograph, which put a temple
// under one institution's name and the same temple under every other institution in Gyeongbuk.
const heroSrc = read('packages/ui/src/university.tsx');
check('§3 the detail hero does not fall back to city photography',
  !/visual\.campus \?\? visual\.city/.test(heroSrc) && /const photo = visual\.campus \?\? null;/.test(heroSrc));

// §16 — a channel is official or it is not stored; a video belongs to its channel.
let unverifiedChannel = 0; let orphanVideo = 0;
for (const rec of Object.values(content)) {
  const yt = rec.youtube;
  if (!yt) continue;
  // V23: `own-site-rendered` — the same own-site rule, read from the JavaScript-rendered homepage (REPORT §279).
  if (!['own-site', 'own-site-rendered', 'wikidata:P2397'].includes(yt.verified_via)) unverifiedChannel += 1;
  if (yt.video_id && !yt.channel_id) orphanVideo += 1;
}
check('§16 every stored channel records how ownership was verified', unverifiedChannel === 0, `${unverifiedChannel}`);
check('§16 no video is stored without its channel', orphanVideo === 0, `${orphanVideo}`);

// §13 — only a reviewed philosophy renders, and it names its source.
const badPhilosophy = Object.values(content).filter((r) => {
  const p = r.education_philosophy;
  if (!p) return false;
  if (p.verification_status === 'HANGYUL_REVIEWED') return !p.source_url;
  return !!p.summary_ko || !!p.summary_en;   // an unreviewed record must carry no prose
}).length;
check('§13 only reviewed philosophies carry prose, and each names its source', badPhilosophy === 0, `${badPhilosophy}`);

/* ================================================================= C. the generated prose is gone */

const detail = read('apps/marketing-web/src/pages/UniversityDetail.tsx');
check('§11 the composed identity sentence is deleted', !/identitySentence\s*\(/.test(detail));
const en = json('packages/i18n/locales/en/marketing.json');
const deadSay = Object.keys(en.v20?.uni?.say ?? {}).filter((k) => k !== 'estab');
check('§11 its strings are gone from the bundle', deadSay.length === 0, deadSay.join(','));
check('§9 "Living in {{city}}" is no longer a per-university heading', !/v20\.uni\.cityTitle/.test(detail));

/* ======================================================================= D. payment: nothing leaks */

const paymentSrc = ['server/app/api/v1/student.py', 'server/app/services/foreign_card.py',
  'server/app/core/crypto.py', 'apps/student-web/src/components/CardForm.tsx',
  'packages/api-client/src/index.ts'];
for (const f of paymentSrc) check(`${f} exists`, existsSync(join(ROOT, f)));

const api = read('server/app/api/v1/student.py');
const provider = read('server/app/services/foreign_card.py');
const crypto = read('server/app/core/crypto.py');

check('§29 the card model forbids unknown fields', /model_config = \{"extra": "forbid"\}/.test(api));
const cardModel = /class _CardIn[\s\S]*?\n\nclass /.exec(api)?.[0] ?? '';
check('§29 the card request model exists', cardModel.length > 0);
// The declarations only — the docstring *names* these fields in order to say they are refused.
const cardFields = cardModel.replace(/\"\"\"[\s\S]*?\"\"\"/g, '');
check('§29 no Korean card password or identity number is accepted',
  cardModel.length > 0 && !/cardPassword|card_password|identity_number|customerIdentityNumber/.test(cardFields));
check('§29 the raw card type cannot be printed', /__repr__/.test(provider) && /redacted/.test(provider));
check('§32 the credential is sealed with AES-256-GCM', /AESGCM/.test(crypto));
check('§32 the envelope is bound to the row it belongs to', /aad/.test(crypto) && /aad=str\(m?e?t?h?o?d?\.?user_id\)|aad=str\(method\.user_id\)/.test(api));
const payloadBody = /def _method_payload[\s\S]*?\n    \}\n/.exec(api)?.[0] ?? '';
check('§43 the stored-card payload builder exists', payloadBody.length > 0);
check('§43 the credential is never returned to a client',
  payloadBody.length > 0
  && !/billing_key|customer_key/.test(payloadBody)
  && !/billing_key|billingKey/.test(read('packages/api-client/src/index.ts'))
  // `TossCheckout.customer_key` is the 결제창 SDK handle (literally "ANONYMOUS"), a different field
  // from the stored method's credential handle; the credential itself is what may not appear.
  && !/billing_key|billingKey/.test(read('packages/types/src/index.ts')));
check('§31 the customerKey is random and server-generated', /secrets\.token_urlsafe\(24\)/.test(api));
check('§30 the card endpoint is authenticated and rate-limited',
  /_card_rate_limited/.test(api) && /require_student/.test(api));
check('§39 the charge carries an order-derived idempotency key', /idempotency_key=f"hg-keyin-\{order\.id\}"/.test(api));
check('§40 a declined card does not cancel the order',
  /if \(orderId && !card\)/.test(read('apps/student-web/src/pages/Services.tsx')));
check('§42 deleting a card revokes it at the provider first', /revoke_billing_key/.test(api));

// §24 — test readiness is independent of the live flags.
const cfg = read('server/app/core/config.py');
check('§24 foreign billing has its own TEST and LIVE states',
  /def foreign_billing_test_ready/.test(cfg) && /def foreign_billing_live_ready/.test(cfg));
const testReady = /def foreign_billing_test_ready[\s\S]*?\n\n    @property/.exec(cfg)?.[0] ?? '';
check('§24 the TEST readiness property exists', testReady.length > 0);
check('§24 TEST readiness does not depend on the four live contract flags',
  testReady.length > 0 && !/usd_readiness|live_usd_checkout/.test(testReady));
check('§24 LIVE readiness refuses a test_ key', /startswith\("test_"\)/.test(cfg));

// §48 — no domestic or easy-pay method in the plan purchase UI.
const services = read('apps/student-web/src/pages/Services.tsx');
check('§48 the purchase UI offers no domestic or easy-pay method',
  !/토스페이|네이버페이|카카오페이|계좌이체|국내카드|EASY_PAY/.test(services));

// §58 — no secret, no test PAN, no credential literal anywhere in the tracked tree.
const SCAN = ['scripts', 'apps', 'packages', 'server/app', 'docs', 'e2e'];
const LEAKS = [
  [/\btest_sk_[A-Za-z0-9]{10,}/, 'a Toss secret key'],
  [/\blive_sk_[A-Za-z0-9]{10,}/, 'a live Toss secret key'],
  [/\bbln_[A-Za-z0-9]{10,}/, 'a billing key'],
  [/4111\s?1111\s?1111\s?1111/, 'a full test card number'],
  [/"cardPassword"\s*:\s*"\d/, 'a card password literal'],
];
const leakHits = [];
for (const root of SCAN) {
  for (const f of walk(root, /\.(tsx?|mjs|js|py|json|md|css|scss)$/)) {
    const body = read(f);
    for (const [re, what] of LEAKS) {
      if (re.test(body)) leakHits.push(`${f}: ${what}`);
    }
  }
}
check('§58 no secret, credential or full test PAN in the tracked tree', leakHits.length === 0, leakHits.slice(0, 5).join(' | '));

/* ========================================================== D2. every university route answers (§56) */

// All 425, not a sample. Through the API the page reads, because 425 browser navigations is twenty
// minutes and this answers the same question: is there a university here with a name and a region?
if (!STATIC_ONLY) {
  const API = 'http://localhost:8001/api/v1/directory/institutions';
  const slugs = registry.map((i) => i.slug);
  const broken = [];
  const BATCH = 24;
  for (let i = 0; i < slugs.length; i += BATCH) {
    await Promise.all(slugs.slice(i, i + BATCH).map(async (slug) => {
      try {
        const r = await fetch(`${API}/${slug}`);
        if (!r.ok) { broken.push(`${slug}:${r.status}`); return; }
        const b = await r.json();
        if (!b.name_ko || !b.region) broken.push(`${slug}:incomplete`);
      } catch (e) { broken.push(`${slug}:${String(e).slice(0, 30)}`); }
    }));
  }
  check(`§56 every one of the ${slugs.length} university routes answers with a named institution`,
    broken.length === 0, broken.slice(0, 5).join(', '));
}

/* ================================================================== E. rendered + real transaction */

if (!STATIC_ONLY) {
  const { chromium } = await import('@playwright/test');
  const BASE = 'http://localhost:3100';
  const reachable = await fetch(BASE).then((r) => r.ok).catch(() => false);
  if (!reachable) {
    fails.push(`the marketing app is not answering on ${BASE} — run \`npm run dev\` first`);
  } else {
    const browser = await chromium.launch();
    for (const width of [390, 1440]) {
      const ctx = await browser.newContext({ viewport: { width, height: width < 700 ? 844 : 1000 } });
      const page = await ctx.newPage();
      const errors = [];
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 140)); });
      page.on('pageerror', (e) => errors.push(`UNCAUGHT ${String(e).slice(0, 140)}`));

      await page.goto(`${BASE}/universities`, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
      await page.waitForTimeout(900);
      const dir = await page.evaluate(() => {
        const cards = [...document.querySelectorAll('.mk-unicard')];
        return {
          cards: cards.length,
          tierless: cards.filter((c) => !c.dataset.tier).length,
          blank: cards.filter((c) => !c.querySelector('img, .mk-unicard__ident, .mk-unicard__markwrap')).length,
          // A tile must not set a 1–3 character graphic. The identity composition is a full name.
          fragments: cards.filter((c) => {
            const el = c.querySelector('.mk-unicard__ident-name');
            return el ? (el.textContent ?? '').trim().length <= 4 : false;
          }).length,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });
      // §15 — a thumbnail is a use. Every photograph whose licence requires a credit must show one
      // *on the page*, not merely carry one in the record. The grid printed none of them until V21
      // (§232.4), and the data-only version of this check passed the whole time.
      const needCredit = [...new Set(Object.values(content)
        .flatMap((r) => [r.media?.hero, ...(r.media?.gallery ?? [])].filter(Boolean))
        .filter((m) => m.attribution_requirement?.author)
        .map((m) => m.asset))];
      const uncredited = await page.evaluate((assets) => {
        const set = new Set(assets);
        return [...document.querySelectorAll('.mk-unicard')]
          .filter((c) => {
            const img = c.querySelector('img');
            if (!img) return false;
            const hit = assets.find((a) => img.src.includes(a));
            return !!hit && set.has(hit) && !c.querySelector('.mk-unicard__credit');
          })
          .map((c) => c.querySelector('.mk-unicard__name')?.textContent?.trim());
      }, needCredit);
      check(`§15 every credited photograph shows its credit at ${width}`, uncredited.length === 0,
        uncredited.slice(0, 3).join(', '));

      check(`§3 every result at ${width} has an intentional visual tier`, dir.tierless === 0, `${dir.tierless} of ${dir.cards}`);
      check(`§18 no result at ${width} renders an empty frame`, dir.blank === 0, `${dir.blank}`);
      check(`§2 no result at ${width} renders a chopped-name fragment`, dir.fragments === 0, `${dir.fragments}`);
      check(`§54 the directory has no horizontal overflow at ${width}`, dir.overflow <= 1, `${dir.overflow}px`);

      /*
       * The sampled set covers the cases that matter, and each is here for a reason:
       *   catholic-kkottongnae  tier D, the institution whose cropped syllables started this pass
       *   chungnam-national     a **credited** photograph, without which the credit check is moot
       *   kyungsung             a formerly-broken page
       *   daegu-cyber           tier D **in a region that has stock photography** (Gyeongbuk) — the
       *                         exact shape of §239.5. Without it the hero-fallback check never fires
       *                         on a page that could regress, which is how the defect survived.
       */
      for (const slug of ['catholic-kkottongnae-university', 'chungnam-national-university',
        'kyungsung-university', 'daegu-cyber-university']) {
        await page.goto(`${BASE}/universities/${slug}`, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
        await page.waitForTimeout(600);
        const d = await page.evaluate(() => ({
          h1: document.querySelectorAll('h1').length,
          mono: document.querySelectorAll('.hg-uni-hero__mono, .mk-unicard__mono').length,
          iframes: document.querySelectorAll('iframe').length,
          eagerBelow: [...document.images].filter((i) => i.loading !== 'lazy' && i.getBoundingClientRect().top > window.innerHeight).length,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          heroCredit: (document.querySelector('.hg-uni-hero__credit')?.textContent ?? '').trim(),
          // V23: the identity hero's province mark (/media/region-mark/*.svg) is location metadata, not a photograph.
          heroImg: [...document.querySelectorAll('.hg-uni-hero img')].find((i) => !i.currentSrc.includes('/media/region-mark/'))?.currentSrc?.split('/').pop() ?? null,
          text: document.body.innerText,
        }));
        check(`§10 ${slug} @${width} draws no name fragment`, d.mono === 0, `${d.mono}`);
        // Whatever the hero draws must be **this institution's** photograph, never a regional one.
        const ownAsset = content[slug]?.media?.hero?.asset ?? null;
        check(`§3 ${slug} @${width} shows its own photograph in the hero, or none`,
          !d.heroImg || (!!ownAsset && d.heroImg.includes(ownAsset)), `${d.heroImg}`);
        // §15 again, on the detail hero: a photograph whose licence names an author must print it.
        const heroNeedsCredit = !!content[slug]?.media?.hero?.attribution_requirement?.author;
        check(`§15 ${slug} @${width} prints its hero credit when the licence requires one`,
          !heroNeedsCredit || /\S/.test(d.heroCredit), heroNeedsCredit ? `"${d.heroCredit}"` : 'n/a');
        check(`§12 ${slug} @${width} has exactly one h1`, d.h1 === 1, `${d.h1}`);
        check(`§55 ${slug} @${width} embeds no iframe before the click`, d.iframes === 0, `${d.iframes}`);
        check(`§55 ${slug} @${width} loads nothing below the fold eagerly`, d.eagerBelow === 0, `${d.eagerBelow}`);
        check(`§54 ${slug} @${width} has no horizontal overflow`, d.overflow <= 1, `${d.overflow}px`);
        check(`§11 ${slug} @${width} prints no generated database sentence`,
          !/now teaching across|년에 문을 열었고|개 학과를 두고 있습니다/.test(d.text));
      }
      check(`no console error on the university surfaces at ${width}`, errors.length === 0, errors.slice(0, 2).join(' | '));
      await ctx.close();
    }
    // §20 — the student's university page reuses the canonical identity.
    //
    // It used to draw `UniMark`: a coloured square holding the first letter of the English name, which
    // is the monogram idea V21 deleted from the public site. A student is owed the same thing a visitor
    // is — the real mark where there is one, and no invented graphic where there is not.
    const sctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const spage = await sctx.newPage();
    await spage.goto('http://localhost:3101/login', { waitUntil: 'networkidle' }).catch(() => {});
    await spage.fill('#email', 'student@demo.hangyul.kr').catch(() => {});
    await spage.fill('#password', 'Hangyul!2026').catch(() => {});
    await spage.click('button[type=submit]').catch(() => {});
    await spage.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 }).catch(() => {});
    let studentChecked = 0;
    for (const slug of ['kyung-hee-university', 'catholic-kkottongnae-university']) {
      await spage.goto(`http://localhost:3101/universities/${slug}`, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
      await spage.waitForTimeout(800);
      const d = await spage.evaluate(() => ({
        h1: document.querySelectorAll('h1').length,
        letterChip: document.querySelectorAll('.su-head .hg-mark').length,
      }));
      if (d.h1 === 0) continue;   // not signed in, or the route moved — reported below
      studentChecked += 1;
      check(`§20 the student page for ${slug} draws no invented letter mark`, d.letterChip === 0, `${d.letterChip}`);
    }
    check('§20 the student university page was reachable to check', studentChecked === 2, `${studentChecked} of 2`);
    await sctx.close();
    await browser.close();
  }

  // §44 — the real Toss TEST transaction, through the product.
  try {
    const out = execFileSync('node', [join(ROOT, 'scripts/qa/v21/toss-test-transaction.mjs')],
      { encoding: 'utf8', timeout: 240000, cwd: ROOT });
    const m = /(\d+) passed, (\d+) failed/.exec(out);
    check('§44 the real Toss TEST transaction runs end to end',
      !!m && Number(m[2]) === 0, m ? `${m[1]} passed, ${m[2]} failed` : 'no result line');
  } catch (e) {
    const out = String(e.stdout ?? e);
    const m = /(\d+) passed, (\d+) failed/.exec(out);
    check('§44 the real Toss TEST transaction runs end to end', false, m ? `${m[1]} passed, ${m[2]} failed` : String(e).slice(0, 160));
  }
}

/* ================================================================================== F. the verdict */

console.log(`\nV21 gate — ${passes.length} passed, ${fails.length} failed\n`);
for (const f of fails) console.log(`  ✖ ${f}`);
if (!fails.length) console.log('  all checks passed');
console.log('');
process.exit(fails.length ? 1 : 0);
