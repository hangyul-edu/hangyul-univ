/**
 * V22 — fold the V22 discovery outputs into the canonical content record, with provenance (brief A–E).
 *
 * The four raw files and the media pick are *inputs*; this is the only V22 script that writes
 * `server/app/data/university_content.json`, and every write below says where its value came from.
 * Rules, in order of what they protect:
 *
 *   • **Rights** — a hero/gallery asset is written only when `credits.json` classes it servable and, for
 *     an attribution-bearing licence, the credit is complete. A logo is written only in the no-credit
 *     class. Nothing hot-links; every asset is a local file.
 *   • **Subject** — the hero is never also in the gallery; an asset belongs to exactly one institution.
 *   • **Reviewed text is untouchable** — `education_philosophy` at HANGYUL_REVIEWED is never modified.
 *     V22's verbatim statements go to a *separate* `philosophy_candidate` field at SOURCED_UNREVIEWED,
 *     which no page renders. A V20 SOURCE_CAPTURED statement that fails a sanity check (script fragments,
 *     chrome words) is removed, because it was never source material.
 *   • **Verified channels only** — `youtube` is written with `verified_via` ∈ {own-site, wikidata:P2397}
 *     and the page it was found on; a video never without its channel.
 *   • **Facts are structured** — founding year (P571) and founding body (P112) are stored as fields with
 *     their Wikidata source, never as prose. Official destinations fill only where the record had none.
 *   • **Every institution has a record** — the 100 that had none get one, so the coverage table and the
 *     seeder see 425 rows with the same shape.
 *
 *   node scripts/universities/v22-apply.mjs [--dry]
 */
import { join } from 'node:path';
import { content, readJson, registry, ROOT, saveContent, TODAY } from './lib.mjs';
import { FREE, SERVABLE } from './v22-licences.mjs';
import { cleanStatement, plausibleDestination } from './v22-statements.mjs';

const DRY = process.argv.includes('--dry');
const raw = (n) => readJson(join(ROOT, 'server/app/data/raw', n), { records: {} }).records ?? {};
const wd = raw('v22_wikidata.json');
const official = raw('v22_official.json');
const youtube = raw('v22_youtube.json');
const picked = readJson(join(ROOT, 'scripts/universities/curated/v22-media-picked.json'), { records: {} }).records ?? {};
const credits = new Map(readJson(join(ROOT, 'apps/marketing-web/src/media/credits.json'), []).map((c) => [c.slug, c]));
const commons = raw('v22_commons_candidates.json');

const doc = content();
const insts = registry();
const tally = {};
const bump = (k, n = 1) => { tally[k] = (tally[k] ?? 0) + n; };
const put = (rec, k, v, key) => { if (v !== undefined && v !== null && v !== '' && rec[k] === undefined) { rec[k] = v; bump(key ?? k); } };

/** The V20 crawler's SOURCE_CAPTURED statements, sanity-checked: a JS fragment is not a philosophy. */
const JUNK = /location\.href|javascript|function\s*\(|return false|onclick|window\.|document\.|\{|\}|=>|href=|<\/?[a-z]+>|바로가기|프린트|만족도조사|트위터|카카오톡|페이스북/i;

for (const inst of insts) {
  const rec = (doc.records[inst.slug] ??= {});
  if (Object.keys(rec).length === 0) bump('records created');
  const w = wd[inst.slug];

  /* ----------------------------------------------------------------------------- Wikidata facts */
  if (w?.status === 'OK') {
    put(rec, 'wikidata_id', w.qid);
    put(rec, 'source_url', w.source_url);
    rec.verified_at = TODAY;
    if (!inst.name_en && !rec.name_en && w.label_en && /^[\x20-\x7E]+$/.test(w.label_en)) put(rec, 'name_en', w.label_en);
    put(rec, 'website_url', inst.website_url || w.websites.find((u) => /^https?:/.test(u)));
    const year = w.inceptions.map((d) => Number(d.slice(0, 4))).filter((y) => y > 1000 && y <= 2026).sort()[0];
    if (year && !rec.founded_year) { rec.founded_year = year; rec.founded_year_source = { source: 'wikidata:P571', source_url: w.source_url, verified_at: TODAY }; bump('founded_year (P571)'); }
    if (w.founders.length && !rec.founding_body) { rec.founding_body = { name: w.founders[0], source: 'wikidata:P112', source_url: w.source_url, verified_at: TODAY, verification_status: 'REGISTRY_ASSERTED' }; bump('founding_body (P112)'); }
    const motto = w.mottos.find((m) => m.lang === 'ko') ?? w.mottos.find((m) => m.lang === 'en') ?? w.mottos[0];
    if (motto && !rec.motto && rec.education_philosophy?.verification_status !== 'HANGYUL_REVIEWED') {
      rec.motto = { ko: w.mottos.find((m) => m.lang === 'ko')?.text ?? null, en: w.mottos.find((m) => m.lang === 'en')?.text ?? null, source_url: w.source_url, verified_at: TODAY, verification_status: 'REGISTRY_ASSERTED' };
      if (!rec.motto.ko && !rec.motto.en) rec.motto.ko = motto.text;
      bump('motto (P1451)');
    }
  }

  /* ---------------------------------------------------------------------------- official site */
  const o = official[inst.slug];
  if (o) {
    if (o.status === 'OK') {
      rec.official_site = { url: o.resolved_home ?? o.website, status: 'OK', checked: o.checked, pages_read: o.pages_read, website_source: o.website_source, ...(o.tls_fallback ? { tls_fallback: true } : {}), ...(o.ua_fallback ? { ua_fallback: true } : {}) };
      bump('official site reachable');
    } else if (!rec.official_site || rec.official_site.status !== 'OK') {
      rec.official_site = { url: o.website ?? rec.official_site?.url ?? null, status: o.status, checked: o.checked, pages_read: o.pages_read ?? 0, detail: o.last_error ?? o.detail ?? null };
    }
    const home = o.resolved_home ?? o.website;
    const dest = (u) => (u && plausibleDestination(u, home) ? u : undefined);
    put(rec, 'international_office_url', dest(o.links?.international), 'international_office_url (new)');
    put(rec, 'international_admissions_url', dest(o.links?.admissions), 'international_admissions_url (new)');
    put(rec, 'dormitory_url', dest(o.links?.dormitory), 'dormitory_url (new)');
    put(rec, 'philosophy_url', dest(o.links?.philosophy), 'philosophy_url (new)');
    if (o.youtube_links?.length) {
      const links = [...new Set([...(rec.youtube_candidates?.links ?? []), ...o.youtube_links.map((l) => l.url)])];
      rec.youtube_candidates = { links, found_on: rec.youtube_candidates?.found_on ?? o.youtube_links[0].found_on, found_on_v22: Object.fromEntries(o.youtube_links.map((l) => [l.url, l.found_on])), verified_at: o.checked };
    }
    const statements = (o.statements ?? []).map((s) => ({ ...s, quote: cleanStatement(s.quote, s.kind) })).filter((s) => s.quote);
    if (statements.length) {
      rec.philosophy_candidate = {
        statements: statements.map((s) => ({ kind: s.kind, heading: s.heading, quote: s.quote, source_url: s.source_url, fetched_at: s.fetched_at })),
        verification_status: 'SOURCED_UNREVIEWED',
        _note: 'Verbatim text from the institution’s own page, captured by v22-research-official.mjs. Not rendered. Review → curated/philosophy.json.',
      };
      bump('philosophy_candidate (SOURCED_UNREVIEWED)');
    }
  }
  const sc = rec.education_philosophy;
  if (sc && sc.verification_status === 'SOURCE_CAPTURED' && JUNK.test(sc.statement ?? '')) { delete rec.education_philosophy; bump('junk SOURCE_CAPTURED statements removed'); }

  /* ------------------------------------------------------------------------------------ media */
  const p = picked[inst.slug];
  const servable = (a) => a && credits.has(a.asset) && SERVABLE.has(credits.get(a.asset).rights_status);
  const assetFor = (a, kind) => {
    const c = credits.get(a.asset);
    return {
      asset: a.asset, university_id: inst.slug, kind,
      license_or_permission: c.license, rights_status: c.rights_status, media_source: c.source_url, official_asset: false,
      attribution_requirement: c.attribution_required ? { author: c.author, license: c.license, license_url: c.license_url, source_url: c.source_url } : null,
      local_path: `media/${a.asset}`, focal_x: 50, focal_y: 50, alt_key: 'v21.media.alt.campus',
      width: c.width, height: c.height, found_via: a.found_via ?? c.found_via ?? null, verified_at: TODAY,
    };
  };
  if (p) {
    const existingHero = rec.media?.hero;
    const hero = servable(p.hero) ? assetFor(p.hero, 'CAMPUS') : null;
    const heroAsset = hero?.asset ?? existingHero?.asset ?? null;
    const gallery = (p.gallery ?? []).filter(servable).map((g) => assetFor(g, 'CAMPUS')).filter((g) => g.asset !== heroAsset);
    // The pick is authoritative for an institution it covers: a gallery it no longer lists is removed, so an
    // asset pruned by a tightened rule cannot survive in the record.
    if (p.hero !== undefined || p.gallery !== undefined) {
      rec.media = { ...(rec.media ?? {}), ...(hero ? { hero } : {}) };
      if (gallery.length) rec.media.gallery = gallery; else delete rec.media.gallery;
      if (hero && (!existingHero || existingHero.asset !== hero.asset)) bump(existingHero ? 'hero replaced' : 'hero added');
      if (gallery.length) bump('gallery photographs', gallery.length);
    }
    if (p.logo && !rec.logo?.url && FREE.test(p.logo.licence)) {
      rec.logo = {
        url: `/${p.logo.local_path}`, local_path: p.logo.local_path, licence: p.logo.licence, width: p.logo.width, height: p.logo.height,
        source: 'wikimedia-commons', media_source: p.logo.source_url, license_or_permission: p.logo.licence, official_asset: false,
        attribution_requirement: null, rights_status: 'CC0_PUBLIC_DOMAIN', source_url: p.logo.source_url, found_via: p.logo.via,
        verified_at: TODAY, verification_status: 'REGISTRY_ASSERTED',
      };
      bump('logo added');
    }
  }
  // Candidates that exist but were refused — recorded so the coverage table can say "found but blocked".
  const cm = commons[inst.slug];
  if (cm?.blocked?.length) {
    const photoBlocked = cm.blocked.filter((b) => b.kind === 'photo' && /^licence/.test(b.why));
    const logoBlocked = cm.blocked.filter((b) => b.kind === 'logo' && /^licence/.test(b.why));
    const prev = (rec.media?.blocked ?? []).filter((b) => b.source !== 'v22');
    const add = [...photoBlocked.slice(0, 3).map((b) => ({ slot: 'photo', file: b.title, licence: b.licence, why: b.why, source: 'v22' })), ...logoBlocked.slice(0, 2).map((b) => ({ slot: 'logo', file: b.title, licence: b.licence, why: b.why, source: 'v22' }))];
    if (add.length) rec.media = { ...(rec.media ?? {}), blocked: [...prev, ...add] };
  }

  /* --------------------------------------------------------------------------------- YouTube */
  const y = youtube[inst.slug];
  if (y?.channel && (y.status === 'CHANNEL_AND_VIDEO' || y.status === 'CHANNEL_ONLY')) {
    const prevYt = rec.youtube;
    if (!prevYt || prevYt.channel_id === y.channel.id) {
      rec.youtube = {
        channel_id: y.channel.id, channel_url: y.channel.url, channel_title: y.channel.title,
        verified_via: y.channel.via, source_url: y.channel.source_url ?? prevYt?.source_url ?? rec.official_site?.url ?? null,
        verified_at: y.checked, verification_status: 'REGISTRY_ASSERTED',
        ...(y.video ? { video_id: y.video.id, video_title: y.video.title, video_found_via: y.video.from } : {}),
      };
      if (!prevYt) bump('channel added');
      if (y.video && !prevYt?.video_id) bump('intro film added');
    }
  }
}

if (!DRY) saveContent(doc);
console.log(`V22 apply${DRY ? ' (dry run)' : ''}`);
for (const [k, v] of Object.entries(tally).sort()) console.log(`  ${k.padEnd(44)} ${v}`);
console.log(`  records in content document              ${Object.keys(doc.records).length}`);
console.log('  → server/app/data/university_content.json\n');
