// The 33 exposed market locales, read from packages/i18n/src/markets.ts (the single source).
import fs from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const src = fs.readFileSync(path.join(ROOT, 'packages/i18n/src/markets.ts'), 'utf8');
const block = src.slice(src.indexOf('export const MARKETS'), src.indexOf('];', src.indexOf('export const MARKETS')));
export const MARKET_LOCALES = [...new Set([...block.matchAll(/locale: '([a-zA-Z-]+)'/g)].map((m) => m[1]))];
if (import.meta.url === `file://${process.argv[1]}`) console.log(MARKET_LOCALES.length, MARKET_LOCALES.join(' '));
