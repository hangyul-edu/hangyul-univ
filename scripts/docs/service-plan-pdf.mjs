#!/usr/bin/env node
/**
 * 한귤 유니브 서비스 기획서 — Markdown 원본을 A4 PDF로 만든다.
 *
 *   node scripts/docs/service-plan-pdf.mjs            → docs/media/한귤유니브_서비스기획서.pdf
 *   node scripts/docs/service-plan-pdf.mjs --html x   → 같은 HTML을 x에 저장 (검수용)
 *
 * 원본: docs/한귤유니브_서비스기획서.md. 지원하는 문법은 원본 맨 위 주석에 적혀 있다.
 * `## ` 하나가 한 페이지이고, 내용이 페이지를 넘치면 빌드가 실패한다 (넘친 페이지 번호를 알려 준다).
 * 글꼴: Pretendard (시스템에 설치된 것 → 없으면 Noto Sans CJK KR).
 */
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = resolve(ROOT, 'docs/한귤유니브_서비스기획서.md');
const OUT = resolve(ROOT, 'docs/media/한귤유니브_서비스기획서.pdf');
const LOGO = resolve(ROOT, "packages/icons/assets/brand/hangyul-univ/hangyul-univ-logo-horizontal-black@2x.png");
const args = process.argv.slice(2);
const htmlOut = args.includes('--html') ? args[args.indexOf('--html') + 1] : null;

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
const dataUri = (p) => {
  const type = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' }[extname(p).toLowerCase()];
  return `data:${type};base64,${readFileSync(p).toString('base64')}`;
};
const cells = (line) => line.replace(/\s*\|\s*$/, '').split('|').map((c) => c.trim());

// ---------- parse ----------
let md = readFileSync(SRC, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
const meta = {};
const fm = md.match(/^---\n([\s\S]*?)\n---\n/);
if (fm) {
  for (const l of fm[1].split('\n')) { const i = l.indexOf(':'); if (i > 0) meta[l.slice(0, i).trim()] = l.slice(i + 1).trim(); }
  md = md.slice(fm[0].length);
}

const pages = [];
let page = null;
const lines = md.split('\n');
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.startsWith('## ')) {
    const m = line.slice(3).match(/^(\d{2})\s+(.*)$/);
    page = { num: m ? m[1] : '', title: m ? m[2] : line.slice(3), blocks: [] };
    pages.push(page);
    continue;
  }
  if (!page) continue;
  if (line.startsWith('```')) {
    const [kind, ...rest] = line.slice(3).trim().split(' ');
    const body = [];
    while (++i < lines.length && !lines[i].startsWith('```')) if (lines[i].trim()) body.push(lines[i]);
    page.blocks.push({ type: 'fence', kind, arg: rest.join(' '), body });
    continue;
  }
  if (line.startsWith('### ')) { page.blocks.push({ type: 'h3', text: line.slice(4) }); continue; }
  if (line.startsWith('> ')) { page.blocks.push({ type: 'quote', text: line.slice(2) }); continue; }
  const img = line.match(/^!\[(.*)\]\((.+)\)$/);
  if (img) { page.blocks.push({ type: 'img', alt: img[1], src: resolve(ROOT, 'docs', img[2]) }); continue; }
  if (line.startsWith('|')) {
    const rows = [];
    for (; i < lines.length && lines[i].startsWith('|'); i++) rows.push(lines[i]);
    i--;
    const parse = (r) => r.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
    page.blocks.push({ type: 'table', head: parse(rows[0]), rows: rows.slice(2).map(parse) });
    continue;
  }
  if (/^- /.test(line)) {
    const items = [];
    for (; i < lines.length && /^- /.test(lines[i]); i++) items.push(lines[i].slice(2));
    i--;
    page.blocks.push({ type: 'ul', items });
    continue;
  }
  if (line.trim()) {
    const buf = [line];
    while (i + 1 < lines.length && lines[i + 1].trim() && !/^(#|```|> |- |\||!\[)/.test(lines[i + 1])) buf.push(lines[++i]);
    page.blocks.push({ type: 'p', text: buf.join(' ') });
  }
}

// ---------- render ----------
const fences = {
  cards: (b) => {
    const n = Number(b.arg) || 2;
    if (n === 1) { // a vertical list of questions
      return `<ol class="questions">${cells(b.body.join(' | ')).map((q) => `<li>${inline(q)}</li>`).join('')}</ol>`;
    }
    return `<div class="cards cols-${n}">${b.body.map((l) => {
      const [t, d, m] = cells(l);
      return `<div class="card"><h4>${inline(t)}</h4><p>${inline(d ?? '')}</p>${m ? `<p class="meta">${inline(m)}</p>` : ''}</div>`;
    }).join('')}</div>`;
  },
  relation: (b) => `<div class="relation">${b.body.map((l, k) => {
    const [t, d] = cells(l);
    return `${k ? '<span class="arrow" aria-hidden="true"></span>' : ''}<div class="node${k === 1 ? ' is-brand' : ''}"><strong>${inline(t)}</strong><span>${inline(d)}</span></div>`;
  }).join('')}</div>`,
  compare: (b) => {
    const [l, r] = cells(b.arg);
    return `<div class="compare"><div class="compare-head"><span>${inline(l)}</span><span>${inline(r)}</span></div>${b.body.map((x) => {
      const [a, c] = cells(x);
      return `<div class="compare-row"><p class="pain">${inline(a)}</p><span class="to" aria-hidden="true">→</span><p class="fix">${inline(c)}</p></div>`;
    }).join('')}</div>`;
  },
  users: (b) => `<div class="users">${b.body.map((l) => {
    const [name, who, goal, where] = cells(l);
    return `<div class="user"><h4>${inline(name)}</h4><p class="who">${inline(who)}</p><p class="goal-label">가장 원하는 것</p><p class="goal">${inline(goal)}</p><p class="where">${inline(where)}</p></div>`;
  }).join('')}</div>`,
  flow: (b) => `<ol class="flow" style="grid-template-columns: repeat(${b.body.length}, 1fr); --half: ${50 / b.body.length}%">${b.body.map((l, k) => {
    const [t, d] = cells(l);
    return `<li><span class="dot">${k + 1}</span><strong>${inline(t)}</strong><span class="desc">${inline(d)}</span></li>`;
  }).join('')}</ol>`,
  plans: (b) => `<div class="plans">${b.body.map((l) => {
    const [name, price, who, tag] = cells(l);
    return `<div class="plan${tag ? ' is-core' : ''}">${tag ? `<span class="tag">${inline(tag)}</span>` : ''}<h4>${inline(name)}</h4><p class="price">${inline(price)}</p><p>${inline(who)}</p></div>`;
  }).join('')}</div>`,
  principles: (b) => `<ol class="principles">${b.body.map((l, k) => {
    const [t, d] = cells(l);
    return `<li><span class="n">${String(k + 1).padStart(2, '0')}</span><div><h4>${inline(t)}</h4><p>${inline(d)}</p></div></li>`;
  }).join('')}</ol>`,
  swatches: (b) => `<div class="swatches">${b.body.map((l) => {
    const [hex, name, use] = cells(l);
    return `<div class="sw"><span class="chip" style="background:${hex}"></span><strong>${inline(name)}</strong><span>${inline(use)}</span><code>${esc(hex)}</code></div>`;
  }).join('')}</div>`,
  dodont: (b) => `<div class="dodont">${b.body.map((l, k) => {
    const [head, ...items] = cells(l);
    return `<div class="dd${k ? (b.arg === 'plain' ? ' is-other' : ' is-dont') : ''}"><h4>${inline(head)}</h4><ul>${items.join(', ').split(/,\s*/).map((x) => `<li>${inline(x)}</li>`).join('')}</ul></div>`;
  }).join('')}</div>`,
  summary: (b) => `<div class="summary">${b.body.map((l) => {
    const [who, what] = cells(l);
    return `<div class="sum"><span>${inline(who)}</span><p>${inline(what)}</p></div>`;
  }).join('')}</div>`,
};

const renderBlock = (b, isLead) => {
  switch (b.type) {
    case 'p': return `<p class="${isLead ? 'lead' : 'body'}">${inline(b.text)}</p>`;
    case 'h3': return `<h3>${inline(b.text)}</h3>`;
    case 'quote': return `<blockquote>${inline(b.text)}</blockquote>`;
    case 'ul': return `<ul>${b.items.map((x) => `<li>${inline(x)}</li>`).join('')}</ul>`;
    case 'img': {
      if (!existsSync(b.src)) throw new Error(`missing image ${b.src}`);
      return `<figure><img src="${dataUri(b.src)}" alt=""><figcaption>${inline(b.alt)}</figcaption></figure>`;
    }
    case 'table': return `<table><thead><tr>${b.head.map((h) => `<th>${inline(h)}</th>`).join('')}</tr></thead><tbody>${b.rows.map((r) => `<tr>${r.map((c, k) => (k ? `<td>${inline(c)}</td>` : `<th scope="row">${inline(c)}</th>`)).join('')}</tr>`).join('')}</tbody></table>`;
    case 'fence': {
      const f = fences[b.kind];
      if (!f) throw new Error(`unknown block \`\`\`${b.kind}`);
      return f(b);
    }
    default: return '';
  }
};

const total = pages.length + 1;
const cover = `<section class="page cover">
  <img class="logo" src="${dataUri(LOGO)}" alt="Hangyul">
  <div class="cover-main">
    <p class="kicker">${esc(meta.kicker ?? '')}</p>
    <h1>${esc(meta.title ?? '')}</h1>
    <p class="cover-sub">${esc(meta.subtitle ?? '')}</p>
  </div>
  <div class="cover-band" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div>
  <p class="cover-meta">${esc(meta.meta ?? '')}</p>
</section>`;

const body = pages.map((p, k) => {
  const firstP = p.blocks.findIndex((b) => b.type === 'p');
  const content = p.blocks.map((b, j) => renderBlock(b, j === firstP && j <= 1)).join('\n');
  return `<section class="page" data-page="${k + 2}">
  <header class="page-head"><span class="num">${esc(p.num)}</span><h2>${inline(p.title)}</h2></header>
  <div class="content">${content}</div>
  <footer class="page-foot"><span>${esc(meta.footer ?? '')}</span><span>${k + 2} / ${total}</span></footer>
</section>`;
}).join('\n');

const css = `
@page { size: A4; margin: 0; }
:root {
  --ink: #181A1F; --ink-2: #3D3A35; --muted: #6A655D; --line: #E8E4DD; --line-soft: #F0ECE6;
  --warm: #F6F3EE; --warm-2: #FBFAF7; --accent: #CC4E00; --accent-text: #B84600; --accent-soft: #FFF1E7; --brand: #FF5000;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { background: #fff; }
body { font-family: 'Pretendard', 'Noto Sans CJK KR', sans-serif; color: var(--ink); font-size: 10.5pt; line-height: 1.62;
  word-break: keep-all; overflow-wrap: break-word; text-wrap: pretty; -webkit-print-color-adjust: exact; print-color-adjust: exact; letter-spacing: -0.005em; }
.page { width: 210mm; height: 297mm; padding: 22mm 20mm 18mm; position: relative; overflow: hidden; page-break-after: always; display: flex; flex-direction: column; }
.page:last-child { page-break-after: auto; }
.content { flex: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: column; }
.page-head { margin-bottom: 9mm; }
.page-head .num { display: block; font-size: 9pt; font-weight: 700; color: var(--accent-text); letter-spacing: 0.08em; margin-bottom: 2.5mm; }
.page-head h2 { font-size: 22pt; line-height: 1.25; font-weight: 700; letter-spacing: -0.02em; }
.page-foot { position: absolute; left: 20mm; right: 20mm; bottom: 10mm; display: flex; justify-content: space-between; font-size: 8pt; color: var(--muted); border-top: 0.5pt solid var(--line); padding-top: 2.5mm; }
p.lead { font-size: 12.5pt; line-height: 1.6; color: var(--ink); font-weight: 500; margin-bottom: 5mm; max-width: 158mm; }
p.body { color: var(--ink-2); margin-bottom: 4mm; max-width: 165mm; }
h3 { font-size: 11.5pt; font-weight: 700; margin: 6mm 0 3mm; }
ul { list-style: none; margin: 1mm 0 3mm; }
ul li { position: relative; padding-left: 4.5mm; color: var(--ink-2); margin-bottom: 1.8mm; }
ul li::before { content: ''; position: absolute; left: 0.5mm; top: 0.62em; width: 1.6mm; height: 1.6mm; border-radius: 50%; background: var(--accent); }
blockquote { border-left: 1.2mm solid var(--brand); padding: 2mm 0 2mm 5mm; margin: 2mm 0 5mm; font-size: 13pt; line-height: 1.55; font-weight: 600; color: var(--ink); }
strong { font-weight: 700; }

.cards { display: grid; gap: 4mm; margin: 1mm 0 4mm; }
.cards.cols-2 { grid-template-columns: 1fr 1fr; }
.cards.cols-3 { grid-template-columns: 1fr 1fr 1fr; }
.cards.cols-4 { grid-template-columns: repeat(4, 1fr); }
.card { border-top: 0.6mm solid var(--ink); padding-top: 3mm; }
.card h4 { font-size: 10.5pt; font-weight: 700; margin-bottom: 1.2mm; }
.card p { font-size: 9.5pt; color: var(--ink-2); line-height: 1.58; }

.relation { display: flex; align-items: stretch; gap: 0; margin: 1mm 0 5mm; }
.relation .node { flex: 1; border: 0.3mm solid var(--line); border-radius: 2mm; padding: 3.5mm 3mm; background: #fff; display: flex; flex-direction: column; gap: 1mm; }
.relation .node strong { font-size: 10pt; }
.relation .node span { font-size: 8.6pt; color: var(--muted); line-height: 1.45; }
.relation .node.is-brand { border-color: var(--accent); background: var(--accent-soft); }
.relation .arrow { width: 6mm; flex: none; position: relative; }
.relation .arrow::before { content: ''; position: absolute; left: 1.2mm; right: 1.6mm; top: 50%; border-top: 0.3mm solid var(--muted); }
.relation .arrow::after { content: ''; position: absolute; right: 1.2mm; top: calc(50% - 0.9mm); border: 0.9mm solid transparent; border-left: 1.2mm solid var(--muted); border-right: 0; }

.compare { margin-top: 2mm; }
.compare-head { display: grid; grid-template-columns: 1fr 8mm 1.15fr; font-size: 9pt; font-weight: 700; color: var(--muted); padding-bottom: 2mm; border-bottom: 0.4mm solid var(--ink); }
.compare-head span:last-child { grid-column: 3; color: var(--accent-text); }
.compare-row { display: grid; grid-template-columns: 1fr 8mm 1.15fr; padding: 4.2mm 0; border-bottom: 0.3mm solid var(--line); align-items: start; }
.compare-row .pain { font-weight: 600; color: var(--ink); padding-right: 3mm; }
.compare-row .to { color: var(--accent); font-weight: 700; text-align: center; }
.compare-row .fix { color: var(--ink-2); font-size: 10pt; }

.users { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4mm; margin: 1mm 0 4mm; }
.user { background: var(--warm-2); border: 0.3mm solid var(--line); border-radius: 2.5mm; padding: 5mm 4.5mm; display: flex; flex-direction: column; }
.user h4 { font-size: 13pt; font-weight: 700; margin-bottom: 1.5mm; }
.user .who { font-size: 9.3pt; color: var(--muted); line-height: 1.5; min-height: 2.9em; }
.user .goal-label { margin-top: 5mm; font-size: 8pt; font-weight: 700; color: var(--accent-text); letter-spacing: 0.04em; }
.user .goal { font-size: 10.5pt; font-weight: 600; line-height: 1.5; margin-top: 1mm; flex: 1; }
.user .where { margin-top: 5mm; padding-top: 2.5mm; border-top: 0.3mm solid var(--line); font-size: 8.6pt; color: var(--muted); }

.flow { list-style: none; display: grid; margin: 2mm 0 7mm; position: relative; }
.flow::before { content: ''; position: absolute; left: var(--half); right: var(--half); top: 3.6mm; border-top: 0.4mm solid var(--line); }
.flow li { position: relative; text-align: center; padding: 0 1.2mm; }
.flow .dot { display: inline-flex; width: 7.2mm; height: 7.2mm; border-radius: 50%; align-items: center; justify-content: center; background: #fff; border: 0.4mm solid var(--ink); font-size: 8.5pt; font-weight: 700; position: relative; }
.flow li:first-child .dot { background: var(--accent); border-color: var(--accent); color: #fff; }
.flow strong { display: block; margin-top: 2.5mm; font-size: 10.5pt; }
.flow .desc { display: block; margin-top: 1.2mm; font-size: 8.4pt; line-height: 1.45; color: var(--ink-2); }

figure { margin: 1mm 0 5mm; }
figure img { width: 100%; display: block; border: 0.3mm solid var(--line); border-radius: 2mm; }
figcaption { font-size: 8.4pt; color: var(--muted); margin-top: 2mm; }

table { width: 100%; border-collapse: collapse; margin: 1mm 0 5mm; font-size: 9.4pt; }
th, td { text-align: left; vertical-align: top; padding: 2.4mm 2.5mm; border-bottom: 0.3mm solid var(--line); line-height: 1.5; }
thead th { font-size: 8.6pt; color: var(--muted); font-weight: 700; border-bottom: 0.4mm solid var(--ink); }
tbody th { font-weight: 600; color: var(--ink); white-space: nowrap; }
td { color: var(--ink-2); }

.plans { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4mm; margin: 1mm 0 6mm; }
.plan { border: 0.3mm solid var(--line); border-radius: 2.5mm; padding: 4.5mm; position: relative; }
.plan.is-core { border-color: var(--accent); box-shadow: inset 0 0.8mm 0 var(--accent); }
.plan h4 { font-size: 11pt; font-weight: 700; }
.plan .price { font-size: 19pt; font-weight: 700; letter-spacing: -0.02em; margin: 0.5mm 0 2mm; }
.plan p { font-size: 9.2pt; color: var(--ink-2); line-height: 1.5; }
.plan .tag { position: absolute; top: 4.5mm; right: 4.5mm; font-size: 7.6pt; font-weight: 700; color: var(--accent-text); background: var(--accent-soft); padding: 0.6mm 2mm; border-radius: 10mm; }

.questions { list-style: none; counter-reset: q; margin: 0 0 6mm; display: grid; grid-template-columns: 1fr 1fr; column-gap: 8mm; }
.questions li { counter-increment: q; padding: 2.4mm 0 2.4mm 9mm; position: relative; font-weight: 600; border-bottom: 0.3mm solid var(--line); }
.questions li::before { content: 'Q' counter(q); position: absolute; left: 0; top: 2.4mm; font-size: 8.6pt; font-weight: 700; color: var(--accent-text); }

.principles { list-style: none; display: grid; grid-template-columns: 1fr 1fr; column-gap: 9mm; row-gap: 0; margin-bottom: 6mm; }
.principles li { display: flex; gap: 3.5mm; padding: 3.6mm 0; border-bottom: 0.3mm solid var(--line); }
.principles .n { font-size: 9pt; font-weight: 700; color: var(--accent-text); padding-top: 0.5mm; width: 5mm; flex: none; }
.principles h4 { font-size: 10.8pt; font-weight: 700; margin-bottom: 1mm; }
.principles p { font-size: 9.2pt; color: var(--ink-2); line-height: 1.55; }

.swatches { display: grid; grid-template-columns: repeat(5, 1fr); gap: 3mm; margin: 0 0 4mm; }
.sw { display: flex; flex-direction: column; gap: 0.6mm; font-size: 8.4pt; }
.sw .chip { height: 11mm; border-radius: 1.5mm; border: 0.3mm solid var(--line); margin-bottom: 1.5mm; }
.sw strong { font-size: 9pt; }
.sw span { color: var(--muted); line-height: 1.4; }
.sw code { font-family: inherit; color: var(--muted); font-size: 8pt; }

.dodont { display: grid; grid-template-columns: 1.35fr 1fr; gap: 4mm; margin: 0 0 5mm; }
.dd { border: 0.3mm solid var(--line); border-radius: 2.5mm; padding: 4mm 4.5mm; background: var(--warm-2); }
.dd h4 { font-size: 9.6pt; font-weight: 700; margin-bottom: 2mm; color: var(--accent-text); }
.dd.is-dont { background: #fff; }
.dd.is-dont h4 { color: var(--muted); }
.dd ul { margin: 0; display: flex; flex-wrap: wrap; gap: 1.6mm; }
.dd ul li { padding: 0.8mm 2.6mm; margin: 0; border-radius: 10mm; background: #fff; border: 0.3mm solid var(--line); font-size: 8.8pt; color: var(--ink); }
.dd ul li::before { display: none; }
.dd.is-dont ul li { color: var(--muted); text-decoration: line-through; text-decoration-color: #B8B2A8; background: var(--warm-2); }
.card p.meta { margin-top: 1.6mm; font-size: 8.6pt; color: var(--muted); }
.dd.is-other { background: #fff; }
.dd.is-other h4 { color: var(--ink); }
.summary { display: flex; flex-direction: column; margin: 4mm 0 12mm; }
.sum { display: grid; grid-template-columns: 38mm 1fr; padding: 7mm 0; border-bottom: 0.3mm solid var(--line); align-items: baseline; }
.sum:first-child { border-top: 0.4mm solid var(--ink); }
.sum span { font-size: 10pt; font-weight: 700; color: var(--accent-text); }
.sum p { text-wrap: balance; font-size: 15pt; font-weight: 600; line-height: 1.45; letter-spacing: -0.01em; }

.cover { padding: 26mm 22mm 20mm; background: #fff; }
.cover .logo { height: 11mm; width: auto; align-self: flex-start; }
.cover-main { margin-top: 70mm; }
.cover .kicker { font-size: 11pt; font-weight: 700; color: var(--accent-text); letter-spacing: 0.04em; margin-bottom: 5mm; }
.cover h1 { font-size: 44pt; line-height: 1.15; font-weight: 800; letter-spacing: -0.03em; }
.cover-sub { font-size: 15pt; margin-top: 6mm; color: var(--ink-2); font-weight: 500; max-width: 140mm; line-height: 1.5; }
.cover-band { display: flex; gap: 2mm; margin-top: auto; margin-bottom: 8mm; }
.cover-band span { height: 1.4mm; flex: 1; background: var(--line); border-radius: 1mm; }
.cover-band span:first-child { background: var(--brand); }
.cover-meta { font-size: 9pt; color: var(--muted); }
`;

const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${esc(meta.title ?? '')} ${esc(meta.kicker ?? '')}</title><style>${css}</style></head><body>${cover}${body}</body></html>`;
if (htmlOut) writeFileSync(htmlOut, html);

const browser = await chromium.launch();
const pageCtx = await browser.newPage();
await pageCtx.setContent(html, { waitUntil: 'load' });
await pageCtx.evaluate(() => document.fonts.ready);
const problems = await pageCtx.evaluate(() => {
  const out = [];
  const fontOk = document.fonts.check('12px Pretendard');
  if (!fontOk) out.push('Pretendard not available — fell back');
  document.querySelectorAll('.page').forEach((p, i) => {
    const c = p.querySelector('.content');
    if (c && c.scrollHeight > c.clientHeight + 1) out.push(`page ${i + 1} overflows by ${c.scrollHeight - c.clientHeight}px`);
  });
  return out;
});
await pageCtx.pdf({ path: OUT, format: 'A4', printBackground: true, preferCSSPageSize: true });
await browser.close();
for (const p of problems) console.error(`WARN ${p}`);
console.log(`${OUT} · ${total} pages`);
if (problems.some((p) => p.includes('overflows'))) process.exit(1);
