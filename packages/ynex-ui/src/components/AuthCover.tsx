// V8 branded console sign-in (YNEX "sign-in-cover" composition): the form on one side, a product cover on the other.
// The form itself stays the shared LoginScreen (passed as children) so validation, demo access and SSO hand-off are
// unchanged; the cover states what the console is for. Below 1200 px the cover folds into a short band above the form.
// Used by the agency console; the university console adopts it with its own cover text.
import type { ReactNode } from 'react';

import './AuthCover.css';

export interface AuthCoverPoint { icon: ReactNode; title: ReactNode; text: ReactNode }

export function AuthCover({ children, eyebrow, title, lead, points = [], foot, tone = 'cobalt' }: {
  children: ReactNode;
  eyebrow?: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
  points?: AuthCoverPoint[];
  foot?: ReactNode;
  /** Retained for callers; V23 renders one white cover for both consoles. */
  tone?: 'cobalt' | 'navy';
}) {
  return (
    <div className="yx-authcover" data-tone={tone}>
      <div className="yx-authcover__form">{children}</div>
      <aside className="yx-authcover__cover" aria-label={typeof eyebrow === 'string' ? eyebrow : undefined}>
        <div className="yx-authcover__inner">
          {eyebrow && <p className="yx-authcover__eyebrow">{eyebrow}</p>}
          <h2 className="yx-authcover__title">{title}</h2>
          {lead && <p className="yx-authcover__lead">{lead}</p>}
          {points.length > 0 && (
            <ul className="yx-authcover__points">
              {points.map((p, i) => (
                <li key={i}>
                  <span className="yx-authcover__icon" aria-hidden>{p.icon}</span>
                  <span><strong>{p.title}</strong><span>{p.text}</span></span>
                </li>
              ))}
            </ul>
          )}
          {foot && <p className="yx-authcover__foot">{foot}</p>}
        </div>
      </aside>
    </div>
  );
}
