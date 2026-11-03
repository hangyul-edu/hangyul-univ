import type { CSSProperties, ReactNode } from 'react';

/**
 * A self-contained block with a title, optional action and footer note (metric definitions, sample sizes).
 * V7: rendered in YNEX card anatomy (card custom-card · card-header with accent-bar card-title · card-body · card-footer).
 */
export function Panel({ title, sub, action, children, foot, id, style }: { title: ReactNode; sub?: ReactNode; action?: ReactNode; children: ReactNode; foot?: ReactNode; id?: string; style?: CSSProperties }) {
  return (
    <section className="card custom-card uc-panel uv7-panel" aria-labelledby={id} style={style}>
      <div className="card-header justify-content-between">
        <h2 className="card-title" id={id}>{title}</h2>
        {action && <div className="yx-cardtools">{action}</div>}
      </div>
      <div className="card-body">
        {sub && <p className="fs-12 text-muted mb-3 uv7-panel__sub">{sub}</p>}
        {children}
      </div>
      {foot && <div className="card-footer fs-12 text-muted">{foot}</div>}
    </section>
  );
}
