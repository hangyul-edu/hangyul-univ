// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { commentRange } from './logic';
import {
  annotationSeverity, commentOrder, defaultCompare, groupDimensions, isTypingTarget, lengthStats, loadQueueMemory, previousInQueue, queuePosition,
  saveQueueMemory, shortcutFor, step,
} from './writing';

function memStore() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } };
}

describe('V6 writing workspace helpers', () => {
  it('counts words and characters against the limits', () => {
    const s = lengthStats('One two three four.', { word_limit: 3, char_limit: null });
    expect(s.words).toBe(4);
    expect(s.overWords).toBe(1);
    expect(s.chars).toBe(19);
    expect(lengthStats('안녕하세요 저는 학생입니다', { word_limit: null, char_limit: 10 }).overChars).toBe(4);
    expect(lengthStats('', undefined).ratio).toBeNull();
  });

  it('orders comments by their place in the text, general ones last', () => {
    const body = 'Alpha beta. Gamma delta.';
    const cs = [
      { id: 'general', anchor_start: null, anchor_end: null, quote: null, at: '2026-10-01T00:00:00Z' },
      { id: 'second', anchor_start: 12, anchor_end: 17, quote: 'Gamma', at: '2026-09-01T00:00:00Z' },
      { id: 'first', anchor_start: null, anchor_end: null, quote: 'Alpha', at: '2026-10-02T00:00:00Z' },
    ];
    expect(commentOrder(body, cs, commentRange)).toEqual(['first', 'second', 'general']);
  });

  it('steps through comments with wrap-around', () => {
    expect(step(['a', 'b', 'c'], null, 1)).toBe('a');
    expect(step(['a', 'b', 'c'], null, -1)).toBe('c');
    expect(step(['a', 'b', 'c'], 'c', 1)).toBe('a');
    expect(step(['a', 'b', 'c'], 'a', -1)).toBe('c');
    expect(step([], 'a', 1)).toBeNull();
  });

  it('never fires shortcuts while typing or with modifiers', () => {
    const input = document.createElement('input');
    const div = document.createElement('div');
    document.body.append(input, div);
    expect(isTypingTarget(input)).toBe(true);
    expect(shortcutFor({ key: 'a', metaKey: false, ctrlKey: false, altKey: false, target: input })).toBeNull();
    expect(shortcutFor({ key: 'a', metaKey: false, ctrlKey: false, altKey: false, target: div })).toBe('approve');
    expect(shortcutFor({ key: 'r', metaKey: false, ctrlKey: false, altKey: false, target: div })).toBe('changes');
    expect(shortcutFor({ key: ']', metaKey: false, ctrlKey: false, altKey: false, target: div })).toBe('nextEssay');
    expect(shortcutFor({ key: '?', metaKey: false, ctrlKey: false, altKey: false, target: div })).toBe('help');
    expect(shortcutFor({ key: 'c', metaKey: true, ctrlKey: false, altKey: false, target: div })).toBeNull();
    const dlg = document.createElement('div');
    dlg.setAttribute('role', 'dialog');
    const btn = document.createElement('button');
    dlg.append(btn);
    document.body.append(dlg);
    expect(shortcutFor({ key: 'a', metaKey: false, ctrlKey: false, altKey: false, target: btn })).toBeNull();
  });

  it('remembers the queue view and position per user', () => {
    const st = memStore();
    expect(loadQueueMemory('u1', st)).toBeNull();
    saveQueueMemory('u1', { view: 'overdue', ids: ['x', 'y', 'z'] }, st);
    saveQueueMemory('u1', { at: 'y' }, st);
    const m = loadQueueMemory('u1', st)!;
    expect(m.view).toBe('overdue');
    expect(queuePosition(m, 'y')).toBe(1);
    expect(previousInQueue(m, 'y')).toBe('x');
    expect(previousInQueue(m, 'x')).toBeNull();
    expect(loadQueueMemory('u2', st)).toBeNull();
    expect(loadQueueMemory('u1', { getItem: () => '{broken' })).toBeNull();
    expect(() => saveQueueMemory('u1', { at: 'x' }, { getItem: () => null, setItem: () => { throw new Error('quota'); } })).not.toThrow();
  });

  it('groups rubric dimensions, ranks annotation severity, picks the default comparison', () => {
    const g = groupDimensions([{ key: 'A', group: 'QUALITY' }, { key: 'L', group: 'ACCURACY' }, { key: 'B' }]);
    expect(g.map((x) => [x.group, x.dims.map((d) => d.key)])).toEqual([['QUALITY', ['A', 'B']], ['ACCURACY', ['L']]]);
    expect(annotationSeverity(['INFO', 'BLOCKER'])).toBe('blocker');
    expect(annotationSeverity(['WARNING'])).toBe('warning');
    expect(annotationSeverity([])).toBeNull();
    expect(defaultCompare([{ version: 1 }, { version: 2 }, { version: 4 }])).toEqual([2, 4]);
    expect(defaultCompare([{ version: 1 }])).toBeNull();
  });
});
