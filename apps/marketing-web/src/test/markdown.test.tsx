import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { headingsOf, Markdown, parseInline, parseMarkdown, safeHref, splitFaq } from '../lib/markdown';

describe('safeHref', () => {
  it('allows http(s), mailto, paths and fragments', () => {
    expect(safeHref('https://www.hcch.net/x')).toBe('https://www.hcch.net/x');
    expect(safeHref('mailto:a@b.c')).toBe('mailto:a@b.c');
    expect(safeHref('/universities')).toBe('/universities');
    expect(safeHref('#section')).toBe('#section');
  });
  it('drops dangerous or ambiguous schemes', () => {
    expect(safeHref('javascript:alert(1)')).toBeNull();
    expect(safeHref('JaVaScRiPt:alert(1)')).toBeNull();
    expect(safeHref('java\tscript:alert(1)')).toBeNull();
    expect(safeHref(' data:text/html,<script>alert(1)</script>')).toBeNull();
    expect(safeHref('vbscript:msgbox')).toBeNull();
    expect(safeHref('//evil.example')).toBeNull();
  });
});

describe('Markdown renderer', () => {
  it('escapes raw HTML instead of rendering it', () => {
    const src = '<script>alert("x")</script>\n\nHello <b>bold</b> <img src=x onerror=alert(1)>';
    const { container } = render(<Markdown source={src} />);
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('b')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('<script>alert("x")</script>');
    expect(container.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(container.innerHTML).toContain('&lt;script&gt;');
  });

  it('renders safe links and neutralises unsafe ones', () => {
    const { container } = render(<Markdown source={'[Official](https://www.visa.go.kr/) and [bad](javascript:alert(1)) and [catalogue](/universities)'} />);
    const links = container.querySelectorAll('a');
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute('href', 'https://www.visa.go.kr/');
    expect(links[0]).toHaveAttribute('target', '_blank');
    expect(links[0]).toHaveAttribute('rel', 'noopener noreferrer');
    expect(links[1]).toHaveAttribute('href', '/universities');
    expect(container.textContent).toContain('bad');
  });

  it('renders tables with header cells, body rows and alignment', () => {
    const src = '| Study | Typical visa |\n|---|:---:|\n| Associate degree | D-2-1 |\n| **Master\'s** | D-2-3 |';
    const { container } = render(<Markdown source={src} />);
    const ths = container.querySelectorAll('thead th');
    expect([...ths].map((t) => t.textContent)).toEqual(['Study', 'Typical visa']);
    expect(ths[0]).toHaveAttribute('scope', 'col');
    const rows = container.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(2);
    expect(rows[1].querySelector('strong')?.textContent).toBe("Master's");
    expect((rows[0].querySelectorAll('td')[1] as HTMLElement).style.textAlign).toBe('center');
  });

  it('renders bullet and numbered lists, including continuation lines and blank-separated items', () => {
    const src = '- **Tuition** — per semester\n- Housing\n  and utilities\n\n1. Choose\n2. Prepare\n\n3. Apply';
    const { container } = render(<Markdown source={src} />);
    const ul = container.querySelector('ul')!;
    expect(ul.querySelectorAll('li')).toHaveLength(2);
    expect(ul.querySelectorAll('li')[1].textContent).toBe('Housing and utilities');
    expect(ul.querySelector('strong')?.textContent).toBe('Tuition');
    const ol = container.querySelector('ol')!;
    expect(ol.querySelectorAll('li')).toHaveLength(3);
  });

  it('keeps the page to one h1 by demoting headings, and gives them ids', () => {
    const { container } = render(<Markdown source={'# Title\n\n## Main costs\n\ntext\n\n## Main costs'} />);
    expect(container.querySelector('h1')).toBeNull();
    const h2s = container.querySelectorAll('h2');
    expect(h2s).toHaveLength(3);
    expect(h2s[1]).toHaveAttribute('id', 'main-costs');
    expect(h2s[2]).toHaveAttribute('id', 'main-costs-1');
  });

  it('renders blockquotes, emphasis, inline code and horizontal rules', () => {
    const { container } = render(<Markdown source={'> Always *confirm* with `your` university\n\n---\n\nsnake_case_word stays plain'} />);
    expect(container.querySelector('blockquote em')?.textContent).toBe('confirm');
    expect(container.querySelector('blockquote code')?.textContent).toBe('your');
    expect(container.querySelector('hr')).not.toBeNull();
    expect(container.textContent).toContain('snake_case_word');
    expect(container.querySelectorAll('em')).toHaveLength(1);
  });
});

describe('parsing helpers', () => {
  it('parses nested inline marks', () => {
    expect(parseInline('**bold [link](https://x.y)**')).toEqual([
      { t: 'strong', c: [{ t: 'text', v: 'bold ' }, { t: 'link', href: 'https://x.y', c: [{ t: 'text', v: 'link' }] }] },
    ]);
  });
  it('extracts h2 headings for the table of contents', () => {
    expect(headingsOf(parseMarkdown('## One\n\n### Sub\n\n## Two'))).toEqual([{ id: 'one', text: 'One' }, { id: 'two', text: 'Two' }]);
  });
  it('splits an FAQ article into question/answer pairs', () => {
    const faq = splitFaq('### Does Hangyul guarantee admission?\n\nNo.\n\n### Who pays tuition?\n\nYou, directly.\n');
    expect(faq).toEqual([
      { q: 'Does Hangyul guarantee admission?', a: 'No.' },
      { q: 'Who pays tuition?', a: 'You, directly.' },
    ]);
  });
});
