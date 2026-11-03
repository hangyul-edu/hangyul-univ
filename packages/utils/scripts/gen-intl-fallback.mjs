// Regenerates locale fallbacks for languages Chromium's reduced ICU lacks, from Node full-ICU CLDR data.
// Usage: node packages/utils/scripts/gen-intl-fallback.mjs az kk km ky lo mn ne si tg uz  → prints a JSON object to merge.
const locs = process.argv.slice(2);
const codes = [];
for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) codes.push(String.fromCharCode(a, b));
const out = {};
for (const l of locs) {
  const dn = new Intl.DisplayNames([l], { type: 'region', fallback: 'none' });
  const regions = {};
  for (const c of codes) { try { const v = dn.of(c); if (v) regions[c] = v; } catch { /* not a region */ } }
  const m = (opt) => Array.from({ length: 12 }, (_, i) => new Intl.DateTimeFormat(l, { month: opt, timeZone: 'UTC' }).format(new Date(Date.UTC(2026, i, 15))));
  const w = (opt) => Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(l, { weekday: opt, timeZone: 'UTC' }).format(new Date(Date.UTC(2026, 1, 1 + i))));
  const rtf = new Intl.RelativeTimeFormat(l, { numeric: 'auto' });
  const plain = new Intl.RelativeTimeFormat(l);
  const unitWord = (u) => plain.formatToParts(5, u).filter((p) => p.type === 'literal').map((p) => p.value).join(' ').trim();
  const units = Object.fromEntries(['second', 'minute', 'hour', 'day', 'month', 'year'].map((u) => [u, unitWord(u)]));
  const tmpl = (n) => plain.formatToParts(n, 'day').map((p) => (p.type === 'integer' ? '{n}' : p.value)).join('').replace(units.day, '{u}');
  const ymdProbe = new Intl.DateTimeFormat(l, { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'UTC' }).formatToParts(new Date(Date.UTC(2026, 9, 1)));
  out[l] = {
    monthsShort: m('short'), monthsLong: m('long'), weekdaysShort: w('short'), weekdaysLong: w('long'),
    ymd: ymdProbe[0].type === 'year',
    rel: { now: rtf.format(0, 'second'), past: tmpl(-5), future: tmpl(5), units,
      // Exact per-unit templates (the unit word often changes between past and future, e.g. Nepali).
      tpl: Object.fromEntries(['second', 'minute', 'hour', 'day', 'month', 'year'].flatMap((u) => [-5, 5].map((n) => [`${n < 0 ? 'past' : 'future'}.${u}`, plain.formatToParts(n, u).map((p) => (p.type === 'integer' ? '{n}' : p.value)).join('')]))), day: { '-1': rtf.format(-1, 'day'), '0': rtf.format(0, 'day'), '1': rtf.format(1, 'day') } },
    regions,
  };
}
console.log(JSON.stringify(out));
