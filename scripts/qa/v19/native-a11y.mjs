/**
 * V19 — **static** accessibility audit of the native student app (REPORT §194.6; the brief's §33).
 *
 * This is deliberately scoped and deliberately labelled. A real accessibility sweep needs a device, TalkBack
 * or VoiceOver, and a human listening to the reading order — none of which this pass had. What a static
 * audit *can* do is find the defects that are visible in the source and that a screen reader will certainly
 * trip over: a pressable with no accessible name, an icon-only control, a touch target below the platform
 * minimum, text that refuses to scale with the user's font size, and animation that ignores Reduce Motion.
 *
 * **Read the findings, do not trust the count.** This script was wrong three times before it was right,
 * and even its final output needed manual inspection:
 *
 *   88 findings  — flagged every `<Button>` call site, not having read `<Button>`, which already sets
 *                  accessibilityRole, accessibilityLabel, accessibilityState and hitSlop itself.
 *   31 findings  — the JSX tag regex stopped at the first `>`, which in `style={({ pressed }) => …}` is
 *                  inside an arrow function, so every multi-line component looked bare. Fixed with a real
 *                  brace/quote-aware `tagBody()` scanner.
 *    6 findings  — all six inspected by hand, all six false: two decorative icon wrappers whose row
 *                  carries the real 56 px touch target, an `<Image>` inside a parent that is itself the
 *                  accessibility element, and a `<Pressable>` whose children arrive via a variable.
 *    0 real
 *
 * So the standing result is **no statically-detectable accessibility defect in the native app** — the
 * shared components in `@hangyul/mobile-ui` do this properly. That is a modest finding, not a clean bill
 * of health: it says nothing about reading order, focus order, contrast in context, or what TalkBack
 * actually announces. See REPORT §194.6.
 *
 *   node scripts/qa/v19/native-a11y.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('../../../', import.meta.url).pathname;
const APP = join(ROOT, 'apps/student-mobile');

const files = [];
const walk = (dir) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== 'android' && e.name !== 'ios') walk(p); }
    else if (/\.tsx$/.test(e.name)) files.push(p);
  }
};
for (const d of ['app', 'src']) { try { walk(join(APP, d)); } catch { /* absent */ } }
// The shared native component library ships into the same bundle.
try { walk(join(ROOT, 'packages/mobile-ui/src')); } catch { /* absent */ }

/**
 * Find the end of a JSX opening tag that starts at `start`.
 *
 * A regex cannot do this, and the first two versions of this script proved it twice over. `<Pressable
 * style={({ pressed }) => [...]}` contains a `>` inside an arrow function, so a non-greedy `[\s\S]*?>`
 * stops there and reports a component with no accessibility props when in fact every one of them is four
 * lines further down. Spot-checking three findings showed all three were wrong that way.
 *
 * So: walk forward tracking brace/paren/bracket depth and string state, and take the first `>` at depth
 * zero. Returns the attribute text and whether the tag is self-closing.
 */
function tagBody(src, start) {
  let i = src.indexOf(' ', start);
  if (i < 0) return null;
  let depth = 0;
  let quote = null;
  for (; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === '\\') { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '{' || c === '(' || c === '[') { depth++; continue; }
    if (c === '}' || c === ')' || c === ']') { depth--; continue; }
    if (c === '>' && depth === 0) {
      const selfClosing = src[i - 1] === '/';
      return { attrs: src.slice(start, selfClosing ? i - 1 : i), end: i + 1, selfClosing };
    }
  }
  return null;
}

const findings = [];
const add = (file, line, kind, detail) =>
  findings.push({ file: relative(ROOT, file), line, kind, detail });

/**
 * Opening tag of a *raw* pressable, with its attribute text.
 *
 * The project's own `<Button>` is deliberately **not** in this list. It is a wrapper that already sets
 * `accessibilityRole="button"`, `accessibilityLabel={accessibilityLabel ?? label}`, `accessibilityState`
 * and `hitSlop` on the Pressable it renders (`packages/mobile-ui/src/components/Button.tsx`), so flagging
 * its call sites produced 42 "no accessible name" and 39 "no role" findings that were all wrong — the
 * first run of this script was, in effect, an audit of a component it had not read. A `<Button>` is
 * checked only for the one thing its wrapper cannot supply: a `label`.
 */
const PRESSABLES = /<(Pressable|TouchableOpacity|TouchableHighlight|TouchableWithoutFeedback)\b/g;
/** Components that handle their own accessibility, and what they need from the caller. */
const WRAPPERS = /<(Button|IconButton|Chip|ListRow|Card)\b/g;

for (const f of files) {
  const src = readFileSync(f, 'utf8');
  const lineOf = (idx) => src.slice(0, idx).split('\n').length;

  for (const m of src.matchAll(PRESSABLES)) {
    const body = tagBody(src, m.index);
    if (!body) continue;
    const tag = m[1];
    const { attrs, end, selfClosing } = body;
    const line = lineOf(m.index);
    const hasName = /accessibilityLabel|aria-label/.test(attrs);
    const hasRole = /accessibilityRole|role=/.test(attrs);
    // Does the element wrap any literal text? If it is self-closing it certainly does not.
    const wrapsText = !selfClosing && /<(Text|AppText|ThemedText)\b/.test(src.slice(end, end + 600));
    if (!hasName && !wrapsText) add(f, line, 'no-accessible-name', `<${tag}> has neither accessibilityLabel nor visible text`);
    if (!hasRole) add(f, line, 'no-role', `<${tag}> declares no accessibilityRole`);
    if (!/accessibilityState/.test(attrs) && /\b(selected|checked|expanded)\b/i.test(attrs)) {
      add(f, line, 'state-not-exposed', `<${tag}> looks stateful but exposes no accessibilityState`);
    }
  }

  // Wrappers: only the thing the wrapper cannot infer.
  for (const m of src.matchAll(WRAPPERS)) {
    const body = tagBody(src, m.index);
    if (!body) continue;
    if (!/\blabel\s*=|\btitle\s*=|accessibilityLabel/.test(body.attrs)) {
      add(f, lineOf(m.index), 'wrapper-no-label', `<${m[1]}> is given neither label nor accessibilityLabel`);
    }
  }

  // Text that opts out of the reader's font size.
  for (const m of src.matchAll(/allowFontScaling\s*=\s*\{?false/g)) {
    add(f, lineOf(m.index), 'font-scaling-off', 'allowFontScaling={false} overrides the OS text size');
  }
  // Touch targets below the platform minimum (44pt iOS / 48dp Android).
  for (const m of src.matchAll(/(?:width|height|minWidth|minHeight)\s*:\s*(\d+)\s*,/g)) {
    const v = Number(m[1]);
    const ctx = src.slice(Math.max(0, m.index - 220), m.index + 60);
    if (v > 0 && v < 44 && /Pressable|Touchable|hitSlop|button|Button|icon|Icon/i.test(ctx) && !/hitSlop/.test(ctx)) {
      add(f, lineOf(m.index), 'small-target', `${m[0].trim()} on a control, below the 44pt/48dp minimum and no hitSlop nearby`);
    }
  }
  // Animation that does not consult Reduce Motion.
  if (/Animated\.|withTiming|withSpring|useSharedValue/.test(src) && !/isReduceMotionEnabled|useReducedMotion|AccessibilityInfo/.test(src)) {
    const m = /Animated\.|withTiming|withSpring|useSharedValue/.exec(src);
    add(f, lineOf(m.index), 'motion-unguarded', 'animates without consulting AccessibilityInfo/Reduce Motion');
  }
  // An image that conveys meaning needs a name; a decorative one must be hidden.
  for (const m of src.matchAll(/<Image\b/g)) {
    const body = tagBody(src, m.index);
    if (!body) continue;
    if (!/accessibilityLabel|accessible\s*=\s*\{?false|accessibilityElementsHidden|importantForAccessibility/.test(body.attrs)) {
      add(f, lineOf(m.index), 'image-unlabelled', '<Image> is neither labelled nor marked decorative');
    }
  }
}

const byKind = new Map();
for (const f of findings) {
  if (!byKind.has(f.kind)) byKind.set(f.kind, []);
  byKind.get(f.kind).push(f);
}

console.log(`Static native accessibility audit — ${files.length} .tsx files\n`);
console.log('kind'.padEnd(22), 'count');
for (const [k, v] of [...byKind].sort((a, b) => b[1].length - a[1].length)) {
  console.log(k.padEnd(22), String(v.length).padStart(5));
}
console.log(`\n${findings.length} finding(s) total\n`);
for (const [k, v] of [...byKind].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`── ${k}`);
  for (const f of v.slice(0, 8)) console.log(`   ${f.file}:${f.line}  ${f.detail}`);
  if (v.length > 8) console.log(`   … and ${v.length - 8} more`);
}
console.log('\nStatic only, and historically noisy: every finding above must be opened and read before it is');
console.log('believed — see this file\'s header for three rounds of false positives. A device, a screen');
console.log('reader and a human listening to the reading order are still required. REPORT §194.6.');
