/**
 * V22 — the last sanity gate for a verbatim statement and for an official destination link, shared by the
 * research script (at capture) and the apply script (at merge), so a looser older capture cannot survive.
 */
const HEADS = ['건학이념', '교육이념', '창학정신', '건학정신', '설립이념', '교육목표', '교육목적', '교훈', '비전', '미션', '인재상', '핵심가치', '대학이념'];
/** Chrome, profiles, captions, tab labels — things a statement is not. */
const JUNK = /하위분류|선택됨|고객님|e-?mail|@|PhD|Professor|Dr\.|나타내는 표|학칙\s*및\s*규정|조직도|대학현황|열린총장실|캠퍼스 안내|발전계획|홍보관|사이트맵|바로가기|더보기|전체보기|목록|이전글|다음글|첨부파일|다운로드|조회수|작성자|등록일|location\.href|javascript|function\s*\(|onclick|window\.|document\.|<\/?[a-z]+>|소개합니다\.\s*\S+만의|말씀에 귀를|패키지를 활용하여|평가(?:합니다|한다|함)?\s*$|^\s*\d+\s*$/i;

/** Returns the cleaned quote, or null when the text is not a statement. */
export function cleanStatement(quote, kind = 'other') {
  let q = (quote ?? '').replace(/\s+/g, ' ').trim();
  q = q.replace(/^[\s,.:;|·\-–—>»및]+/, '').replace(/^(및|and)\s+\S+\s+/, '').trim();
  if (q.length < 12) return null;
  if (JUNK.test(q)) return null;
  if (HEADS.filter((h) => q.includes(h)).length >= 3) return null;        // a menu listing its siblings
  // Two or three bare words are a menu fragment — unless the heading was 교훈/핵심가치, where "도의, 진리, 화협" *is* the statement.
  if (!['motto', 'core_values'].includes(kind) && /^(\S+\s+){0,2}\S+$/.test(q) && !/[.다]$/.test(q) && q.length < 20) return null;
  return q;
}

/** An official destination must be a page, not the homepage again and not a notice-board entry. */
export function plausibleDestination(url, home) {
  try {
    const u = new URL(url);
    const h = home ? new URL(home) : null;
    const path = u.pathname.replace(/\/+$/, '');
    if (h && u.origin === h.origin && (path === '' || /^\/(index|main|home|default)\.[a-z]+$/i.test(path) || path === h.pathname.replace(/\/+$/, ''))) return false;
    if (/\/(board|bbs|notice|news)\b.*\/(view|read|detail)|\b(no|seq|nttId|bbsId|articleNo)=\d+/i.test(url) && /view|read|detail|articleNo|nttId/i.test(url)) return false;
    return true;
  } catch { return false; }
}
