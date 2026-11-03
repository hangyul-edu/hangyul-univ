// Probes Chromium's Intl output for the V8 locales (month name + a country name). Usage: node scripts/qa/_intl-v8.mjs
import { chromium } from '@playwright/test';
const b = await chromium.launch(); const p = await b.newPage();
console.log(await p.evaluate((ls) => ls.map((l) => `${l}: ${new Intl.DateTimeFormat(l, { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, 9, 15)))} | ${new Intl.DisplayNames([l], { type: 'region' }).of('VN')}`).join('\n'),
  ['tk', 'ka', 'he', 'ps', 'hy', 'mr', 'ha', 'yo', 'ig', 'so', 'en']));
await b.close();
