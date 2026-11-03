/**
 * In-page inspector for the V30 visual crawl. `inspect(locale)` is serialised into the page by Playwright, so it
 * must be self-contained (no closures over module scope).
 *
 * V28 checks (unchanged in intent): horizontal-scroll, clipped-text, overlapping-controls, hidden-primary,
 * offscreen-modal, blank-main, broken-image, raw-key, mixed-locale. V28 skipped every control inside `[inert]` —
 * the very place the V30 marquee defect lived — so nothing here skips `inert`; it is reported instead.
 *
 * V30 geometry checks (brief §45 — heuristics, they find candidates; they do not judge beauty):
 *   inert-visible        a visible link/button inside `[inert]`: it looks clickable and the pointer passes through
 *   blocked-control      the centre of a visible control resolves to something else (overlay / mask / z-index)
 *   oversized-select     a non-full-width native select whose box is ≥ 40 px wider than value + chevron need
 *   detached-chevron     a compact control (< 320 px) with ≥ 28 px of empty space between its label and chevron
 *   toolbar-height       controls side by side in one row whose heights differ by > 6 px
 *   off-center-label     a centred button whose content sits > 6 px off-centre horizontally or > 3 px vertically
 *   pointer-dead-zone    `cursor: pointer` on an area that is not inside any interactive element
 *   partial-hit-card     a card whose one link carries its heading but covers < 55 % of the card (no stretched link)
 *   internal-external    an internal link carrying the external ↗ / external-link icon
 *   tiny-target          an interactive element smaller than 24 × 24 that is not an inline text link
 */
export function inspect(locale) {
  const out = [];
  const vis = (el) => { const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && +s.opacity > 0 && r.width > 0 && r.height > 0; };
  const label = (el) => `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''} "${(el.innerText || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 40)}"`;
  const srOnly = (el) => { for (let e = el; e; e = e.parentElement) { const s = getComputedStyle(e); if (s.clip === 'rect(0px, 0px, 0px, 0px)' || s.clipPath === 'inset(50%)' || /\b(hg-sr|sr-only|visually-hidden)\b/.test(e.className || '')) return true; } return false; };
  const W = innerWidth, H = innerHeight;
  const pinned = (el) => { for (let e = el; e; e = e.parentElement) { const p = getComputedStyle(e).position; if (p === 'fixed' || p === 'sticky') return true; } return false; };
  const shown = (el) => el.getClientRects().length && (!el.checkVisibility || el.checkVisibility({ checkVisibilityCSS: true, opacityProperty: true }));
  const inView = (r) => r.bottom > 0 && r.top < H && r.right > 0 && r.left < W;
  const INTERACTIVE = 'a[href], button, input, select, textarea, label, summary, [role=button], [role=tab], [role=link], [role=option], [role=switch], [role=radio], [role=checkbox], [role=menuitem], [role=slider], [tabindex]:not([tabindex="-1"])';

  if (document.documentElement.scrollWidth > W + 1) out.push({ check: 'horizontal-scroll', detail: `${document.documentElement.scrollWidth} > ${W}` });
  const controls = [...document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=tab]')];
  const live = [];
  for (const el of controls) {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || srOnly(el) || el.closest('[hidden]')) continue;
    if (!shown(el)) continue;
    const r = el.getBoundingClientRect();
    if (el.closest('[inert]') && r.width > 0 && inView(r) && !el.closest('[aria-modal=true]')) {
      // Content behind an open modal is legitimately inert; a visible control on the page itself is not.
      // Flag only the marquee signature: the pointer at its centre falls through to the element's OWN container,
      // i.e. nothing covers it — the user sees it and cannot click it. A closed off-canvas sidebar is inert but
      // painted under the page (the hit lands on unrelated content), so it is not reported.
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (!document.querySelector('[aria-modal=true], dialog[open]') && hit && hit.contains(el)) out.push({ check: 'inert-visible', detail: label(el) });
      continue;
    }
    if (el.closest('[aria-hidden=true]') && el.tabIndex >= 0) out.push({ check: 'aria-hidden-focusable', detail: label(el) });
    if ((r.width === 0 || r.height === 0) && (el.innerText || '').trim() && s.display !== 'contents') out.push({ check: 'zero-size-control', detail: label(el) });
    if (r.width > 0 && el.scrollWidth > el.clientWidth + 2 && s.overflow.includes('hidden') && s.textOverflow !== 'ellipsis' && !el.title && el.clientWidth > 0
      && ![...el.querySelectorAll('*')].some((c) => getComputedStyle(c).textOverflow === 'ellipsis')) out.push({ check: 'clipped-text', detail: label(el) });
    if (+s.opacity > 0 && r.width > 0) live.push([el, r, s]);
  }
  const boxes = live.filter(([el, r]) => inView(r) && !el.closest('[aria-hidden=true]'));
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const [a] = boxes[i]; const [b] = boxes[j];
    if (a.contains(b) || b.contains(a) || pinned(a) !== pinned(b)) continue;
    const clipped = (el) => { let c = null; for (let e = el.parentElement; e; e = e.parentElement) { if (getComputedStyle(e).overflowX !== 'visible') { c = e.getBoundingClientRect(); break; } }
      return [...el.getClientRects()].map((r) => c ? { left: Math.max(r.left, c.left), right: Math.min(r.right, c.right), top: Math.max(r.top, c.top), bottom: Math.min(r.bottom, c.bottom) } : r); };
    const hit = clipped(a).some((p) => clipped(b).some((q) => Math.min(p.right, q.right) - Math.max(p.left, q.left) > 4 && Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top) > 4));
    if (hit) out.push({ check: 'overlapping-controls', detail: `${label(a)} × ${label(b)}` });
  }
  const modalOpen = !!document.querySelector('[aria-modal=true], dialog[open]');
  // blocked-control — every visible control in the viewport, not just primaries (V28 checked primaries only).
  // The part of a box a user can actually see: clipped by every overflow-hiding ancestor (a truncated title link's
  // own rect runs on under the next column; its geometric centre is in the clipped-away part).
  const visibleRect = (el) => {
    let { left, right, top, bottom } = el.getBoundingClientRect();
    for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') { const c = e.getBoundingClientRect(); left = Math.max(left, c.left); right = Math.min(right, c.right); top = Math.max(top, c.top); bottom = Math.min(bottom, c.bottom); }
    }
    return { left, right, top, bottom, width: right - left, height: bottom - top };
  };
  for (const [el, r0] of boxes) {
    const r = visibleRect(el);
    if (r.width < 4 || r.height < 4 || r.top < 0 || r.bottom > H || r.left < 0 || r.right > W) continue;
    if (modalOpen && !el.closest('[aria-modal=true], dialog[open]')) continue;
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (!hit || el.contains(hit) || hit.contains(el)) continue;
    if (pinned(hit) && !pinned(el)) continue;                                    // content scrolling under the header
    if (hit.closest('label')?.contains(el) || (el.id && hit.closest(`label[for="${CSS.escape(el.id)}"]`))) continue; // visually-hidden input under its label
    if (el.matches('input[type=checkbox], input[type=radio], input[type=file]') && +getComputedStyle(el).opacity < 0.05) continue;
    out.push({ check: 'blocked-control', detail: `${label(el)} under ${label(hit)}` });
  }
  for (const el of document.querySelectorAll('.hg-btn--primary, .btn-primary, [data-variant=primary]')) {
    if (!vis(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.top < 0 || r.bottom > H || r.left < 0 || r.right > W) continue;
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (hit && !el.contains(hit) && !hit.contains(el) && !(pinned(hit) && !pinned(el)) && !(modalOpen && !el.closest('[aria-modal=true], dialog[open]'))) out.push({ check: 'hidden-primary', detail: `${label(el)} under ${label(hit)}` });
  }
  for (const d of document.querySelectorAll('[role=dialog], dialog[open]')) {
    if (!vis(d)) continue;
    const r = d.getBoundingClientRect();
    if (r.left < -1 || r.right > W + 1 || r.top < -1) out.push({ check: 'offscreen-modal', detail: label(d) });
  }

  // ---- V30 geometry ---------------------------------------------------------------------------------------
  const textWidth = (el, text) => { const cs = getComputedStyle(el); const c = document.createElement('canvas').getContext('2d'); c.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`; return c.measureText(text).width; };
  for (const sel of document.querySelectorAll('select')) {
    if (!shown(sel) || sel.closest('.hg-fsel') || +getComputedStyle(sel).opacity < 0.05) continue;
    const r = sel.getBoundingClientRect(); const pcs = getComputedStyle(sel.parentElement);
    const contentW = sel.parentElement.clientWidth - parseFloat(pcs.paddingLeft) - parseFloat(pcs.paddingRight);
    if (r.width >= contentW - 4) continue;                                       // a full-width form field — fine
    const cs = getComputedStyle(sel);
    const need = parseFloat(cs.paddingInlineStart) + textWidth(sel, sel.selectedOptions[0]?.text ?? '') + 16 + 22;
    if (r.width - need >= 40) out.push({ check: 'oversized-select', detail: `${label(sel)} "${sel.selectedOptions[0]?.text}" ${Math.round(r.width)}px for ${Math.round(need)}px of content` });
  }
  for (const svg of document.querySelectorAll('svg.lucide-chevron-down, svg.lucide-chevrons-up-down, svg.lucide-chevron-right, svg.lucide-chevron-left')) {
    const host = svg.closest('button, a[href], summary, [role=button], [data-control]');
    if (!host || !shown(host)) continue;
    const hr = host.getBoundingClientRect(); if (hr.width >= 320 || hr.width === 0) continue;
    const sr = svg.getBoundingClientRect(); if (!sr.width || !shown(svg)) continue;
    const range = document.createRange(); let tr = null;
    for (const n of [...host.querySelectorAll('*'), host].flatMap((e) => [...e.childNodes]).filter((n) => n.nodeType === 3 && n.nodeValue.trim())) {
      range.selectNodeContents(n); const b = range.getBoundingClientRect(); if (!b.width) continue;
      tr = tr ? { left: Math.min(tr.left, b.left), right: Math.max(tr.right, b.right) } : { left: b.left, right: b.right };
    }
    if (!tr) continue;
    const gap = sr.left >= tr.right ? sr.left - tr.right : tr.left - sr.right;
    if (gap >= 28) out.push({ check: 'detached-chevron', detail: `${label(host)} ${Math.round(gap)}px between label and chevron` });
  }
  const CTRL = 'button, a.hg-btn, a.kn-btn, a.btn, select, input:not([type=checkbox]):not([type=radio]):not([type=hidden]), .hg-fsel, [role=search], .hg-input-icon, .hg-seg';
  const rows = new Set([...document.querySelectorAll(CTRL)].map((c) => c.parentElement).filter(Boolean));
  for (const row of rows) {
    const rs = getComputedStyle(row);
    if (!rs.display.includes('flex') || rs.flexDirection.startsWith('column') || !shown(row)) continue;
    const kids = [...row.children].filter((k) => shown(k) && (k.matches(CTRL) || k.querySelector(':scope > .hg-fsel, :scope > select'))).map((k) => [k, k.getBoundingClientRect()])
      .filter(([k, r]) => r.height >= 28 && r.width >= 28 && !k.closest('[aria-hidden=true]'));
    if (kids.length < 2) continue;
    // Only controls sharing one visual line.
    const line = kids.filter(([, r]) => Math.abs((r.top + r.bottom) / 2 - (kids[0][1].top + kids[0][1].bottom) / 2) < 12);
    if (line.length < 2) continue;
    const hs = line.map(([, r]) => r.height); const d = Math.max(...hs) - Math.min(...hs);
    if (d > 6) out.push({ check: 'toolbar-height', detail: `${label(row)}: ${line.map(([k, r]) => `${label(k).slice(0, 34)}=${Math.round(r.height)}`).join(' | ')}` });
  }
  for (const b of document.querySelectorAll('button, a.hg-btn, a.kn-btn, a.btn, [role=button]')) {
    if (!shown(b) || b.closest('[aria-hidden=true]')) continue;
    const r = b.getBoundingClientRect(); if (r.width < 32 || r.width > 420 || r.height < 24) continue;
    const cs = getComputedStyle(b);
    if (!(cs.justifyContent === 'center' || (cs.display.includes('block') && cs.textAlign === 'center'))) continue;
    let u = null;
    for (const c of b.querySelectorAll('*')) { if (c.closest('svg') !== c && c.closest('svg')) continue; if ((c.children.length && c.tagName !== 'svg') || !shown(c)) continue; const q = c.getBoundingClientRect(); if (!q.width) continue; u = u ? { l: Math.min(u.l, q.left), r: Math.max(u.r, q.right), t: Math.min(u.t, q.top), b: Math.max(u.b, q.bottom) } : { l: q.left, r: q.right, t: q.top, b: q.bottom }; }
    const range = document.createRange();
    for (const n of [...b.childNodes, ...[...b.querySelectorAll('*')].flatMap((e) => [...e.childNodes])].filter((n) => n.nodeType === 3 && n.nodeValue.trim())) {
      range.selectNodeContents(n); for (const q of range.getClientRects()) u = u ? { l: Math.min(u.l, q.left), r: Math.max(u.r, q.right), t: Math.min(u.t, q.top), b: Math.max(u.b, q.bottom) } : { l: q.left, r: q.right, t: q.top, b: q.bottom };
    }
    if (!u) continue;
    const bl = parseFloat(cs.borderLeftWidth), br = parseFloat(cs.borderRightWidth), pl = parseFloat(cs.paddingLeft), pr = parseFloat(cs.paddingRight);
    const L = u.l - (r.left + bl + pl), R = (r.right - br - pr) - u.r;
    const T = u.t - r.top, B = r.bottom - u.b;
    if (Math.abs(L - R) > 6 && L > -1 && R > -1) out.push({ check: 'off-center-label', detail: `${label(b)} left ${Math.round(L)} / right ${Math.round(R)}` });
    else if (Math.abs(T - B) > 3.5 && r.height <= 64 && T > 0 && B > 0) out.push({ check: 'off-center-label', detail: `${label(b)} top ${Math.round(T)} / bottom ${Math.round(B)}` });
  }
  const pointerTops = [...document.querySelectorAll('body *')].filter((el) => {
    if (el.matches(INTERACTIVE) || el.closest(INTERACTIVE)) return false;
    const cs = getComputedStyle(el); if (cs.cursor !== 'pointer') return false;
    const p = el.parentElement; return !p || getComputedStyle(p).cursor !== 'pointer';
  });
  for (const el of pointerTops) {
    if (!shown(el) || (modalOpen && !el.closest('[aria-modal=true], dialog[open]'))) continue; const r = el.getBoundingClientRect(); if (!inView(r) || r.width * r.height < 400) continue;
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (hit && (hit.matches(INTERACTIVE) || hit.closest(INTERACTIVE))) continue;
    out.push({ check: 'pointer-dead-zone', detail: label(el) });
  }
  for (const card of document.querySelectorAll('[class*="card"], [class*="tile"]')) {
    if (!shown(card) || card.matches(INTERACTIVE) || card.closest('a[href], button')) continue;
    const links = [...card.querySelectorAll('a[href]')].filter(shown);
    if (links.length !== 1) continue;
    const a = links[0]; if (!a.querySelector('h2, h3, h4')) continue;
    const after = getComputedStyle(a, '::after');
    if (after.position === 'absolute' && after.content !== 'none') continue;   // a stretched link covers the card
    const cr = card.getBoundingClientRect(), ar = a.getBoundingClientRect();
    if (cr.width * cr.height > 0 && (ar.width * ar.height) / (cr.width * cr.height) < 0.55 && cr.height > 120)
      out.push({ check: 'partial-hit-card', detail: `${label(card)} link covers ${Math.round(100 * ar.width * ar.height / (cr.width * cr.height))} %` });
  }
  for (const a of document.querySelectorAll('a[href]')) {
    if (!shown(a)) continue;
    let internal = false; try { internal = new URL(a.href).origin === location.origin; } catch { /* mailto: etc */ }
    if (internal && a.querySelector('svg.lucide-external-link, svg.lucide-arrow-up-right, svg.lucide-square-arrow-out-up-right')) out.push({ check: 'internal-external', detail: `${label(a)} → ${a.getAttribute('href')}` });
  }
  // WCAG 2.5.8: a target under 24 × 24 passes if a 24-px circle on its centre touches no other target (spacing
  // exception). Inline text links and transparent, borderless text buttons (sort headers, "view" links) are text.
  const targets = live.filter(([el, r]) => inView(r) && !el.closest('[aria-hidden=true]'));
  const textLike = (el) => { const cs = getComputedStyle(el); return (cs.backgroundColor === 'rgba(0, 0, 0, 0)' || cs.backgroundColor === 'transparent') && parseFloat(cs.borderTopWidth) === 0 && (el.innerText || '').trim().length > 0 && !el.querySelector('svg:only-child'); };
  for (const [el, r] of targets) {
    if (r.width >= 24 && r.height >= 24) continue;
    if (el.matches('a') && getComputedStyle(el).display === 'inline') continue;
    if (textLike(el)) continue;
    if (el.matches('input[type=checkbox], input[type=radio]') && el.closest('label')) continue;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const crowded = targets.some(([o, q]) => o !== el && !o.contains(el) && !el.contains(o)
      && Math.hypot(Math.max(q.left - cx, 0, cx - q.right), Math.max(q.top - cy, 0, cy - q.bottom)) < 12);
    if (crowded) out.push({ check: 'tiny-target', detail: `${label(el)} ${Math.round(r.width)}×${Math.round(r.height)} (within 12 px of another target)` });
  }

  const main = document.querySelector('main') ?? document.body;
  if ((main.innerText || '').trim().length < 20) out.push({ check: 'blank-main', detail: `${(main.innerText || '').trim().length} chars` });
  for (const img of document.images) if (img.complete && img.naturalWidth === 0 && img.currentSrc && vis(img)) out.push({ check: 'broken-image', detail: img.currentSrc.slice(0, 100) });
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const RAW = /(?:^|\s)((?:[a-z][a-zA-Z0-9]*)\.(?:[a-zA-Z0-9_]+\.)+[a-zA-Z0-9_]+)(?=$|\s)/;
  const EN = /\b(?:the|your|you|and|with|this|that|from|will|have|been|are|is|for|not|can)\b/gi;
  let leaks = 0; const leakSamples = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n.nodeValue.trim(); if (t.length < 3) continue;
    const el = n.parentElement; if (!el || !vis(el) || el.closest('script,style,code,pre,[translate=no],[data-no-l10n],[data-user-content]')) continue;
    const m = RAW.exec(t); if (m && !/\.(?:com|kr|org|net|ac|go|edu|io|png|jpg|svg|pdf)\b/i.test(m[1]) && !/@/.test(t)) out.push({ check: 'raw-key', detail: m[1] });
    if (locale !== 'en' && !el.closest('[lang^=en]')) {
      const words = t.replace(/⁨[^⁩]*⁩/g, '').match(EN) ?? [];
      if (words.length >= 2) { leaks += 1; if (leakSamples.length < 5) leakSamples.push(t.slice(0, 70)); }
    }
  }
  if (leaks) out.push({ check: 'mixed-locale', detail: `${leaks} English text nodes: ${leakSamples.join(' | ')}` });
  return out;
}
