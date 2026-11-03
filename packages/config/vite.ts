import { purgeCSSPlugin } from '@fullhuman/postcss-purgecss';
import react from '@vitejs/plugin-react';
import rtlcss from 'postcss-rtlcss';
import { execSync } from 'node:child_process';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin as PostcssPlugin } from 'postcss';
import type { Plugin, UserConfig } from 'vite';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * V7 template CSS pipeline, applied only to stylesheets that come from the licensed-template adapters
 * (packages/eduan-ui, packages/ynex-ui):
 * - Eduan is written with physical properties → postcss-rtlcss adds the [dir=rtl] mirror rules.
 * - Production builds purge selectors no Hangyul source file uses (templates ship hundreds of demo-only rules).
 *   Class names built at runtime are safelisted by pattern.
 */
/**
 * V14, brief Part 60 — remove the CSS specificity debt V13 recorded, at its root.
 *
 * `postcss-rtlcss` with `safeBothPrefix` rewrites every rule it touches to carry a `[dir]`, `[dir="ltr"]` or
 * `[dir="rtl"]` prefix, so that the LTR and RTL variants of a rule have equal specificity and source order
 * decides between them. That is correct and necessary.
 *
 * The side effect is not. An attribute selector adds a class-level component, so Eduan's **element** rules —
 * `p { margin-bottom: 0 }`, `:where(.ed) :is(h1…h6) { margin-bottom: 15px }` — go from (0,0,1) to (0,1,1) and
 * start outranking every single-class rule in our own layers. V13 measured the damage: eight of the thirteen
 * composition rules on the public site were silently dead, the hero's buttons sat flush against its lede, and
 * every heading was 15 px from whatever followed it whatever the design said.
 *
 * V13 worked around it by authoring the composition block at `.kn .kn-*` (0,2,0). That works, and it is the
 * start of a specificity race: the next template rule to gain a prefix needs (0,3,0) to beat, and so on.
 *
 * The root cause is that a **scoping** prefix is contributing **specificity**. `:where()` is exactly the tool
 * for that — it matches identically and contributes zero. So this runs after rtlcss and rewrites
 *
 *     [dir] p                  →  :where([dir]) p                  (0,1,1) → (0,0,1)
 *     [dir="ltr"] .ed-foo      →  :where([dir="ltr"]) .ed-foo      (0,2,0) → (0,1,0)
 *
 * The cascade then behaves the way the authors of both stylesheets expected: an element rule loses to a class
 * rule, LTR and RTL variants still tie and are still decided by order, and nothing needs `!important` or an
 * extra ancestor. `npm run qa:composition` reads computed values on real pages and proves it.
 */
const unspecificDirPrefix: PostcssPlugin = {
  postcssPlugin: 'hangyul-rtl-where',
  OnceExit(root) {
    root.walkRules((rule) => {
      if (!rule.selector.includes('[dir')) return;
      rule.selectors = rule.selectors.map((sel) =>
        // Only a prefix rtlcss itself generated: a `[dir…]` at the very start of the selector, not one an
        // author wrote in the middle of it (`.kn-marquee [dir="rtl"] …` keeps its weight).
        sel.replace(/^(\[dir(?:="(?:ltr|rtl)")?\])/, ':where($1)'));
    });
  },
};

/** The PurgeCSS options the production build applies to the licensed template adapters. Exported so a source-level
 *  prune (scripts/qa/v26/prune-marketing-base.mjs) can apply exactly the rule the build applies — one definition. */
export const templatePurgeOptions = {
  content: [`${ROOT}/apps/*/src/**/*.{tsx,ts,html}`, `${ROOT}/apps/*/index.html`, `${ROOT}/packages/*/src/**/*.{tsx,ts}`],
  defaultExtractor: (c: string) => c.match(/[\w-/:%.]+(?<!:)/g) ?? [],
  // Only class names that are *built at runtime* (template literals) need safelisting; static ones are found in the sources.
  safelist: {
    standard: [/^yx-/, /^ed-/, /-transparent$/, /^bg-(primary|secondary|success|warning|danger|info|teal|orange|purple|light)$/,
      /^text-(primary|secondary|success|warning|danger|info|muted|default)$/, /^col-(sm|md|lg|xl|xxl)-\d+$/, /^g-\d$/,
      /^(active|show|open|sticky|is-[a-z-]+|info-open|overlay-open|collapsed)$/],
  },
  // Attributes set at runtime on <html>/<body>/elements (layout state, RTL, ARIA state selectors).
  dynamicAttributes: ['dir', 'lang', 'data-menu-styles', 'data-nav-layout', 'data-toggled', 'data-vertical-style', 'data-header-styles',
    'data-theme-mode', 'data-icon-overlay', 'data-page-style', 'data-width', 'data-menu-position', 'data-header-position',
    'data-product', 'data-surface', 'data-state', 'data-missing', 'data-page', 'aria-pressed', 'aria-selected', 'aria-current', 'aria-expanded', 'aria-invalid'],
  keyframes: false,
  variables: false,
};

function templateCss(isBuild: boolean): PostcssPlugin {
  const rtl = rtlcss({ safeBothPrefix: true });
  const purge = purgeCSSPlugin(templatePurgeOptions);
  return {
    postcssPlugin: 'hangyul-template-css',
    async Once(root, helpers) {
      const file = root.source?.input.file ?? '';
      const isEduan = file.includes('/packages/eduan-ui/');
      const isYnex = file.includes('/packages/ynex-ui/');
      // V26 (REPORT §348): the V6 marketing stylesheets this plugin used to purge *by path* (`src/styles.css`, `src/v6.css`)
      // were merged into `src/styles/base.css` and their dead rules removed at source (scripts/qa/v26/prune-marketing-base.mjs),
      // so the app layer is now the same in dev and in production. A path-matched rule here was a trap: the consolidation
      // renamed the files and the purge silently stopped (+27 KB shipped until the bundle size was attributed). Only the
      // licensed template adapters remain, and `qa:v26` checks that every path this file matches still exists.
      if (!isEduan && !isYnex) return;
      if (isEduan) {
        await (rtl as unknown as { Once: (r: typeof root, h: typeof helpers) => unknown }).Once(root, helpers);
        (unspecificDirPrefix as unknown as { OnceExit: (r: typeof root) => void }).OnceExit(root);
      }
      if (isBuild) await (purge as unknown as { OnceExit: (r: typeof root, h: typeof helpers) => unknown }).OnceExit(root, helpers);
    },
  };
}

/**
 * Deployment (2026-11): a non-sensitive build marker at `/build-info.json`, so "which commit is this domain serving?"
 * is one request instead of a dashboard hunt. Vercel provides the SHA and environment; a local build asks git.
 * Contains the app, commit, build time and environment only — never configuration or secrets.
 */
function buildInfo(): Plugin {
  const commit = (() => {
    if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA;
    try {
      return execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    } catch {
      return 'unknown';
    }
  })();
  return {
    name: 'hangyul-build-info',
    apply: 'build',
    generateBundle() {
      const info = {
        app: basename(process.cwd()).replace(/-web$/, ''),
        commit,
        builtAt: new Date().toISOString(),
        environment: process.env.VERCEL_ENV ?? 'local',
      };
      this.emitFile({ type: 'asset', fileName: 'build-info.json', source: `${JSON.stringify(info, null, 2)}\n` });
    },
  };
}

/**
 * Shared Vite config for the four web apps.
 * - /api is proxied to FastAPI so auth cookies are first-party and no CORS is needed in dev.
 * - Heavy vendor code (charts, table) is split into separate chunks.
 */
export function hangyulViteConfig(port: number, extra: Partial<UserConfig> = {}): UserConfig {
  const api = process.env.HG_API_URL ?? 'http://127.0.0.1:8001';
  const isBuild = process.argv.includes('build');
  return {
    plugins: [react(), buildInfo()],
    css: {
      preprocessorOptions: {
        scss: {
          api: 'modern-compiler',
          loadPaths: [`${ROOT}/node_modules`],
          quietDeps: true,
          // Template sources use legacy @import / global functions; they are kept verbatim on purpose.
          silenceDeprecations: ['import', 'global-builtin', 'color-functions', 'slash-div', 'mixed-decls'],
        },
      },
      postcss: { plugins: [templateCss(isBuild)] },
    },
    server: {
      port,
      strictPort: true,
      host: true,
      proxy: { '/api': { target: api, changeOrigin: false } },
    },
    preview: { port, strictPort: true, proxy: { '/api': { target: api } } },
    build: {
      target: 'es2022',
      sourcemap: false,
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('recharts') || id.includes('d3-') || id.includes('victory-vendor')) return 'charts';
            if (id.includes('@tanstack/react-table')) return 'table';
            if (id.includes('i18next')) return 'i18n';
            if (id.includes('react-dom') || id.includes('react-router') || id.includes('/react/')) return 'react';
            return undefined;
          },
        },
      },
    },
    test: { environment: 'jsdom', globals: true, setupFiles: ['./src/test/setup.ts'], css: false },
    ...extra,
  } as UserConfig;
}
