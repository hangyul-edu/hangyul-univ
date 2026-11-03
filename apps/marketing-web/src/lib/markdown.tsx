/**
 * A deliberately small, safe Markdown renderer for editorial content from the content API.
 *
 * - Supports: headings, paragraphs, bullet/numbered lists, tables (with alignment), blockquotes,
 *   horizontal rules, fenced code, **bold**, *italic*, `code` and [links](url).
 * - Never uses dangerouslySetInnerHTML: the source is parsed into a tiny AST and rendered as React
 *   elements, so any raw HTML in the source is shown as literal text (React escapes it).
 * - Links only allow http(s), mailto, same-site paths and fragments. `javascript:`/`data:` etc. are dropped.
 */
import { cx } from '@hangyul/utils';
import { Fragment, useMemo, type ReactNode } from 'react';

export type Inline =
  | { t: 'text'; v: string }
  | { t: 'strong'; c: Inline[] }
  | { t: 'em'; c: Inline[] }
  | { t: 'code'; v: string }
  | { t: 'link'; href: string | null; c: Inline[] };

export type Align = 'left' | 'center' | 'right' | null;

export type Block =
  | { t: 'heading'; level: number; c: Inline[]; id: string; text: string }
  | { t: 'p'; c: Inline[] }
  | { t: 'list'; ordered: boolean; start: number; items: Inline[][] }
  | { t: 'table'; head: Inline[][]; align: Align[]; rows: Inline[][][] }
  | { t: 'quote'; c: Block[] }
  | { t: 'hr' }
  | { t: 'code'; v: string };

// ------------------------------------------------------------------ URLs

/** Returns a safe href or null when the URL uses a scheme we don't allow. */
export function safeHref(raw: string): string | null {
  const url = raw.trim().replace(/^<(.*)>$/, '$1');
  if (!url) return null;
  // Browsers ignore control characters and whitespace inside a scheme ("java\tscript:"), so test without them.
  // eslint-disable-next-line no-control-regex
  const probe = url.replace(/[\u0000- \u007F]+/g, '').toLowerCase();
  if (probe.startsWith('//')) return null; // protocol-relative → could point anywhere
  if (/^(https?:|mailto:)/.test(probe)) return url;
  if (/^[a-z][a-z0-9+.-]*:/.test(probe)) return null; // javascript:, data:, vbscript:, file: …
  return url; // relative path or #fragment
}

export const isExternal = (href: string) => /^(https?:)?\/\//i.test(href) || /^mailto:/i.test(href);

// ------------------------------------------------------------------ Inline parsing

function findClosing(src: string, from: number, marker: string): number {
  let i = from;
  while (i < src.length) {
    if (src[i] === '\\') { i += 2; continue; }
    if (src.startsWith(marker, i)) return i;
    i++;
  }
  return -1;
}

export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  let buf = '';
  const flush = () => { if (buf) { out.push({ t: 'text', v: buf }); buf = ''; } };
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    const prev = i > 0 ? src[i - 1] : ' ';
    if (ch === '\\' && i + 1 < src.length && /[\\`*_[\]()#+\-.!|>]/.test(src[i + 1])) {
      buf += src[i + 1];
      i += 2;
      continue;
    }
    if (ch === '`') {
      const end = src.indexOf('`', i + 1);
      if (end > i) {
        flush();
        out.push({ t: 'code', v: src.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }
    if ((ch === '*' || ch === '_') && src[i + 1] === ch) {
      const marker = ch + ch;
      const end = findClosing(src, i + 2, marker);
      if (end > i + 2 && (ch === '*' || !/\w/.test(prev))) {
        flush();
        out.push({ t: 'strong', c: parseInline(src.slice(i + 2, end)) });
        i = end + 2;
        continue;
      }
    }
    if ((ch === '*' || ch === '_') && src[i + 1] !== ' ' && src[i + 1] !== undefined && (ch === '*' || !/\w/.test(prev))) {
      const end = findClosing(src, i + 1, ch);
      if (end > i + 1 && src[end - 1] !== ' ' && (ch === '*' || !/\w/.test(src[end + 1] ?? ' '))) {
        flush();
        out.push({ t: 'em', c: parseInline(src.slice(i + 1, end)) });
        i = end + 1;
        continue;
      }
    }
    if (ch === '[') {
      const close = findClosing(src, i + 1, ']');
      if (close > i && src[close + 1] === '(') {
        const paren = findClosing(src, close + 2, ')');
        if (paren > close) {
          const target = src.slice(close + 2, paren).trim().split(/\s+/)[0] ?? '';
          flush();
          out.push({ t: 'link', href: safeHref(target), c: parseInline(src.slice(i + 1, close)) });
          i = paren + 1;
          continue;
        }
      }
    }
    buf += ch;
    i++;
  }
  flush();
  return out;
}

export function inlineText(nodes: Inline[]): string {
  return nodes.map((n) => (n.t === 'text' || n.t === 'code' ? n.v : inlineText(n.c))).join('');
}

// ------------------------------------------------------------------ Block parsing

const RE_HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const RE_HR = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/;
const RE_LIST = /^\s*([-*+]|\d{1,9}[.)])\s+(.*)$/;
const RE_FENCE = /^\s*(```|~~~)/;
const RE_QUOTE = /^\s{0,3}>\s?(.*)$/;

function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  const cells: string[] = [];
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\' && s[i + 1] === '|') { cur += '|'; i++; continue; }
    if (s[i] === '|') { cells.push(cur.trim()); cur = ''; continue; }
    cur += s[i];
  }
  cells.push(cur.trim());
  return cells;
}

const isTableSep = (line: string | undefined) => !!line && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line);

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 64) || 'section';
}

function startsBlock(line: string, next: string | undefined): boolean {
  return RE_HEADING.test(line) || RE_HR.test(line) || RE_LIST.test(line) || RE_FENCE.test(line) || RE_QUOTE.test(line) || (line.includes('|') && isTableSep(next));
}

export function parseMarkdown(src: string, slugs: Map<string, number> = new Map()): Block[] {
  const lines = (src ?? '').replace(/\r\n?/g, '\n').split('\n');
  const out: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    if (RE_FENCE.test(line)) {
      const fence = RE_FENCE.exec(line)![1];
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(fence)) body.push(lines[i++]);
      i++;
      out.push({ t: 'code', v: body.join('\n') });
      continue;
    }

    const h = RE_HEADING.exec(line);
    if (h) {
      const c = parseInline(h[2]);
      const text = inlineText(c);
      const base = slugify(text);
      const n = slugs.get(base) ?? 0;
      slugs.set(base, n + 1);
      out.push({ t: 'heading', level: h[1].length, c, text, id: n ? `${base}-${n}` : base });
      i++;
      continue;
    }

    if (RE_HR.test(line)) { out.push({ t: 'hr' }); i++; continue; }

    if (RE_QUOTE.test(line)) {
      const body: string[] = [];
      while (i < lines.length && lines[i].trim() && RE_QUOTE.test(lines[i])) body.push(RE_QUOTE.exec(lines[i++])![1]);
      out.push({ t: 'quote', c: parseMarkdown(body.join('\n'), slugs) });
      continue;
    }

    if (line.includes('|') && isTableSep(lines[i + 1])) {
      const head = splitRow(line);
      const align: Align[] = splitRow(lines[i + 1]).map((c) => (c.startsWith(':') && c.endsWith(':') ? 'center' : c.endsWith(':') ? 'right' : c.startsWith(':') ? 'left' : null));
      i += 2;
      const rows: Inline[][][] = [];
      while (i < lines.length && lines[i].trim() && lines[i].includes('|')) {
        const cells = splitRow(lines[i++]);
        rows.push(head.map((_, k) => parseInline(cells[k] ?? '')));
      }
      out.push({ t: 'table', head: head.map(parseInline), align: head.map((_, k) => align[k] ?? null), rows });
      continue;
    }

    const li = RE_LIST.exec(line);
    if (li) {
      const ordered = /\d/.test(li[1]);
      const start = ordered ? parseInt(li[1], 10) : 1;
      const items: string[] = [];
      while (i < lines.length) {
        const cur = lines[i];
        const m = RE_LIST.exec(cur);
        if (m && /\d/.test(m[1]) === ordered) { items.push(m[2]); i++; continue; }
        if (m) break; // a different list type starts
        if (cur.trim() && /^\s{2,}/.test(cur) && items.length) { items[items.length - 1] += ` ${cur.trim()}`; i++; continue; }
        if (!cur.trim()) {
          let j = i + 1;
          while (j < lines.length && !lines[j].trim()) j++;
          const nm = j < lines.length ? RE_LIST.exec(lines[j]) : null;
          if (nm && /\d/.test(nm[1]) === ordered) { i = j; continue; }
        }
        break;
      }
      out.push({ t: 'list', ordered, start, items: items.map(parseInline) });
      continue;
    }

    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && (para.length === 0 || !startsBlock(lines[i], lines[i + 1]))) para.push(lines[i++].trim());
    out.push({ t: 'p', c: parseInline(para.join(' ')) });
  }
  return out;
}

export function headingsOf(blocks: Block[], level = 2): { id: string; text: string }[] {
  return blocks.filter((b): b is Extract<Block, { t: 'heading' }> => b.t === 'heading' && b.level === level).map((b) => ({ id: b.id, text: b.text }));
}

/** Splits an FAQ article ("### Question" + answer paragraphs) into Q/A pairs. */
export function splitFaq(src: string): { q: string; a: string }[] {
  const out: { q: string; a: string }[] = [];
  let cur: { q: string; a: string[] } | null = null;
  for (const line of (src ?? '').replace(/\r\n?/g, '\n').split('\n')) {
    const m = /^#{2,4}\s+(.*)$/.exec(line);
    if (m) {
      if (cur) out.push({ q: cur.q, a: cur.a.join('\n').trim() });
      cur = { q: m[1].trim(), a: [] };
    } else if (cur) cur.a.push(line);
  }
  if (cur) out.push({ q: cur.q, a: cur.a.join('\n').trim() });
  return out.filter((x) => x.q && x.a);
}

// ------------------------------------------------------------------ Rendering

export type LinkRenderer = (href: string, children: ReactNode, key: number) => ReactNode;

function renderInline(nodes: Inline[], renderLink?: LinkRenderer): ReactNode {
  return nodes.map((n, k) => {
    switch (n.t) {
      case 'text': return <Fragment key={k}>{n.v}</Fragment>;
      case 'code': return <code key={k}>{n.v}</code>;
      case 'strong': return <strong key={k}>{renderInline(n.c, renderLink)}</strong>;
      case 'em': return <em key={k}>{renderInline(n.c, renderLink)}</em>;
      case 'link': {
        const kids = renderInline(n.c, renderLink);
        if (!n.href) return <span key={k}>{kids}</span>;
        if (isExternal(n.href)) return <a key={k} href={n.href} target="_blank" rel="noopener noreferrer">{kids}</a>;
        return renderLink ? renderLink(n.href, kids, k) : <a key={k} href={n.href}>{kids}</a>;
      }
      default: return null;
    }
  });
}

function renderBlocks(blocks: Block[], opts: { renderLink?: LinkRenderer; minHeading: number }): ReactNode {
  return blocks.map((b, k) => {
    switch (b.t) {
      case 'heading': {
        const level = Math.min(6, Math.max(opts.minHeading, b.level));
        const Tag = `h${level}` as 'h2';
        return <Tag key={k} id={b.id}>{renderInline(b.c, opts.renderLink)}</Tag>;
      }
      case 'p': return <p key={k}>{renderInline(b.c, opts.renderLink)}</p>;
      case 'hr': return <hr key={k} />;
      case 'code': return <pre key={k}><code>{b.v}</code></pre>;
      case 'quote': return <blockquote key={k}>{renderBlocks(b.c, opts)}</blockquote>;
      case 'list': {
        const items = b.items.map((it, j) => <li key={j}>{renderInline(it, opts.renderLink)}</li>);
        return b.ordered ? <ol key={k} start={b.start !== 1 ? b.start : undefined}>{items}</ol> : <ul key={k}>{items}</ul>;
      }
      case 'table':
        return (
          <div key={k} className="mk-prose__table" role="region" tabIndex={0} aria-label={b.head.map(inlineText).join(' / ')}>
            <table>
              <thead>
                <tr>{b.head.map((c, j) => <th key={j} scope="col" style={b.align[j] ? { textAlign: b.align[j] === 'left' ? 'start' : b.align[j] === 'right' ? 'end' : 'center' } : undefined}>{renderInline(c, opts.renderLink)}</th>)}</tr>
              </thead>
              <tbody>
                {b.rows.map((r, j) => (
                  <tr key={j}>{r.map((c, m) => <td key={m} style={b.align[m] ? { textAlign: b.align[m] === 'left' ? 'start' : b.align[m] === 'right' ? 'end' : 'center' } : undefined}>{renderInline(c, opts.renderLink)}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      default: return null;
    }
  });
}

export function Markdown({ source, blocks, renderLink, minHeading = 2, className }: {
  source?: string;
  blocks?: Block[];
  renderLink?: LinkRenderer;
  /** Demote headings so article bodies never create a second h1. */
  minHeading?: number;
  className?: string;
}) {
  const parsed = useMemo(() => blocks ?? parseMarkdown(source ?? ''), [blocks, source]);
  return <div className={cx('mk-prose', className)}>{renderBlocks(parsed, { renderLink, minHeading })}</div>;
}
