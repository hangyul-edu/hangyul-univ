import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CHANNEL_SDK_SRC, __resetChannelTalkForTests, channelLanguage, startChannelTalk } from '../lib/channelTalk';

const KEY = 'test-plugin-key';
const sdkScripts = () => document.querySelectorAll(`script[src="${CHANNEL_SDK_SRC}"]`);

describe('Channel Talk (marketing only)', () => {
  beforeEach(() => {
    __resetChannelTalkForTests();
    delete window.ChannelIO;
    delete window.ChannelIOInitialized;
    document.querySelectorAll('script[data-channel-talk]').forEach((s) => s.remove());
    delete document.documentElement.dataset.channelTalk;
    vi.stubGlobal('requestIdleCallback', (cb: () => void) => { cb(); return 1; });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('loads nothing without a plugin key (local development, CI)', () => {
    expect(startChannelTalk(undefined, 'en')).toBe(false);
    expect(window.ChannelIO).toBeUndefined();
    expect(sdkScripts()).toHaveLength(0);
    expect(document.documentElement.dataset.channelTalk).toBeUndefined();
  });

  it('boots anonymously, once, and injects the SDK exactly once across re-renders and route changes', () => {
    startChannelTalk(KEY, 'en');
    startChannelTalk(KEY, 'en');
    startChannelTalk(KEY, 'en');
    expect(sdkScripts()).toHaveLength(1);
    expect(document.documentElement.dataset.channelTalk).toBe('on');
    const boots = window.ChannelIO!.q!.filter((a) => a[0] === 'boot');
    expect(boots).toEqual([['boot', { pluginKey: KEY, language: 'en' }]]);
  });

  it('follows the site language with the closest supported messenger language', () => {
    expect(channelLanguage('ko')).toBe('ko');
    expect(channelLanguage('ja')).toBe('ja');
    expect(channelLanguage('zh-Hans')).toBe('en');
    expect(channelLanguage('ar')).toBe('en');
    expect(channelLanguage(undefined)).toBe('en');
    startChannelTalk(KEY, 'vi');
    startChannelTalk(KEY, 'ko');
    startChannelTalk(KEY, 'ko');
    startChannelTalk(KEY, 'ru');
    const updates = window.ChannelIO!.q!.filter((a) => a[0] === 'updateUser');
    expect(updates).toEqual([['updateUser', { language: 'ko' }], ['updateUser', { language: 'en' }]]);
    expect(sdkScripts()).toHaveLength(1);
  });

  it('a failed SDK load is final: no throw, no retry, the stub keeps swallowing calls', () => {
    startChannelTalk(KEY, 'en');
    const s = sdkScripts()[0] as HTMLScriptElement;
    expect(() => s.dispatchEvent(new Event('error'))).not.toThrow();
    expect(sdkScripts()).toHaveLength(0);
    expect(document.documentElement.dataset.channelTalk).toBeUndefined();
    startChannelTalk(KEY, 'ja');
    expect(sdkScripts()).toHaveLength(0);
    expect(() => window.ChannelIO!('showMessenger')).not.toThrow();
  });
});

// Isolation (Student, Operations, University and native carry no Channel Talk) is checked against the production
// bundles by `npm run qa:channel-talk` (scripts/qa/channel-talk-isolation.mjs).
