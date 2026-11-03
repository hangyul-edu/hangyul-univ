// V9 U4: on phones a table becomes summary rows — the row's name and its one priority number stay visible; the rest of
// the row's evidence opens in place (native <details>, keyboard and screen-reader friendly). Never a sideways scroll.
import { ChevronDown } from '@hangyul/icons';
import type { ReactNode } from 'react';

export interface SummaryItem {
  key: string;
  title: ReactNode;
  /** The priority field(s), right-aligned in the summary row. */
  summary?: ReactNode;
  /** Secondary line under the title. */
  meta?: ReactNode;
  /** Label/value pairs shown when the row is expanded. */
  fields?: { label: ReactNode; value: ReactNode }[];
  /** Anything else shown when expanded (e.g. a link to the records). */
  extra?: ReactNode;
}

export function SummaryList({ items, label, empty }: { items: SummaryItem[]; label: string; empty?: ReactNode }) {
  if (!items.length) return <>{empty ?? null}</>;
  return (
    <ul className="uv9-sumlist" aria-label={label}>
      {items.map((it) => {
        const expandable = !!(it.fields?.length || it.extra);
        const head = (
          <>
            <span className="uv9-sumlist__main">
              <span className="uv9-sumlist__title">{it.title}</span>
              {it.meta ? <span className="uv9-sumlist__meta">{it.meta}</span> : null}
            </span>
            {it.summary !== undefined ? <span className="uv9-sumlist__sum">{it.summary}</span> : null}
            {expandable ? <ChevronDown aria-hidden className="uv9-sumlist__chev" /> : null}
          </>
        );
        return (
          <li key={it.key}>
            {expandable ? (
              <details className="uv9-sumlist__row">
                <summary>{head}</summary>
                <div className="uv9-sumlist__body">
                  {it.fields?.length ? (
                    <dl className="uv9-sumlist__kv">
                      {it.fields.map((f, i) => (
                        <div key={i}><dt>{f.label}</dt><dd>{f.value}</dd></div>
                      ))}
                    </dl>
                  ) : null}
                  {it.extra}
                </div>
              </details>
            ) : <div className="uv9-sumlist__row uv9-sumlist__row--flat">{head}</div>}
          </li>
        );
      })}
    </ul>
  );
}
