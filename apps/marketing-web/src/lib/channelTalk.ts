/**
 * Channel Talk (channel.io): public customer support on the marketing site, and nowhere else.
 *
 * Ported from the Hangyul website (hangyul-web, `src/app/[locale]/(home)/layout.tsx`), which uses the same Channel
 * Talk workspace:
 *   - the official snippet: a `ChannelIO` queue stub, then one async `<script src=…/ch-plugin-web.js>`;
 *   - `boot` with the public plugin key only. Visitors are anonymous: no member id, profile, email or phone;
 *   - the plugin key comes from the environment (`VITE_CHANNEL_IO_KEY`). With no key nothing loads, which is how
 *     local development and CI run. The plugin key is a public identifier and is not a secret.
 *
 * Differences from the reference, because this is a client-rendered SPA rather than a Next.js server layout:
 *   - it loads once per document (module guard + `window.ChannelIOInitialized`), after `load` and when the browser
 *     is idle, so it never competes with the LCP element. Route changes never inject the SDK again;
 *   - the messenger follows the site language: Channel Talk supports `ko`, `ja` and `en`, and every other site
 *     language falls back to English;
 *   - a failed script load is final. The queue stub stays in place, so later `ChannelIO(...)` calls are no-ops,
 *     and the SDK is not requested again, there are no retries, and nothing is thrown.
 */

export const CHANNEL_SDK_SRC = 'https://cdn.channel.io/plugin/ch-plugin-web.js';

export type ChannelLanguage = 'ko' | 'ja' | 'en';

type ChannelFn = ((...args: unknown[]) => void) & { q?: unknown[][]; c?: (args: unknown[]) => void };

declare global {
  interface Window {
    ChannelIO?: ChannelFn;
    ChannelIOInitialized?: boolean;
  }
}

/** Maps a site locale (`ko`, `ja`, `zh-Hans`, `pt-BR`, …) to a language Channel Talk's messenger supports. */
export function channelLanguage(locale: string | undefined): ChannelLanguage {
  const base = (locale ?? '').toLowerCase().split('-')[0];
  return base === 'ko' || base === 'ja' ? base : 'en';
}

let booted = false;
let current: ChannelLanguage | null = null;

function installStub(w: Window): ChannelFn {
  if (w.ChannelIO) return w.ChannelIO;
  const ch: ChannelFn = (...args: unknown[]) => { ch.c!(args); };
  ch.q = [];
  ch.c = (args) => { ch.q!.push(args); };
  w.ChannelIO = ch;
  return ch;
}

function injectScript(w: Window) {
  if (w.ChannelIOInitialized) return;
  w.ChannelIOInitialized = true;
  const s = w.document.createElement('script');
  s.async = true;
  s.src = CHANNEL_SDK_SRC;
  s.dataset.channelTalk = 'sdk';
  // Unavailable (blocked, offline, CSP): keep the site exactly as it is. No retry, no console noise.
  s.onerror = () => { s.remove(); delete w.document.documentElement.dataset.channelTalk; };
  w.document.head.appendChild(s);
}

function whenIdleAfterLoad(w: Window, run: () => void) {
  const idle = () => {
    const ric = (w as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    if (ric) ric(run, { timeout: 3000 }); else w.setTimeout(run, 1);
  };
  if (w.document.readyState === 'complete') idle();
  else w.addEventListener('load', idle, { once: true });
}

/** Boots Channel Talk once per document. Later calls only update the messenger language. */
export function startChannelTalk(pluginKey: string | undefined, locale: string | undefined, w: Window = window): boolean {
  if (!pluginKey) return false;
  const language = channelLanguage(locale);
  if (booted) {
    setChannelLanguage(locale, w);
    return true;
  }
  booted = true;
  current = language;
  const ch = installStub(w);
  ch('boot', { pluginKey, language });
  // Lets the site keep its last footer line clear of the launcher on phones (styles/site.css).
  w.document.documentElement.dataset.channelTalk = 'on';
  whenIdleAfterLoad(w, () => injectScript(w));
  return true;
}

/** The visitor switched the site language: switch the messenger too (documented `updateUser.language`). */
export function setChannelLanguage(locale: string | undefined, w: Window = window) {
  if (!booted || !w.ChannelIO) return;
  const language = channelLanguage(locale);
  if (language === current) return;
  current = language;
  w.ChannelIO('updateUser', { language });
}

/** Test-only: forget the per-document state. */
export function __resetChannelTalkForTests() {
  booted = false;
  current = null;
}
