import { useApi } from '@hangyul/auth';
import { docLabel, useLocale } from '@hangyul/i18n';
import { Check, ChevronRight, Eye, Pencil, Send, X } from '@hangyul/icons';
import type { DossierFinding, DossierPackage, DossierRequestSuggestion, DossierRow, DossierSuggestion } from '@hangyul/types';
import { Button, Input, StatusText, useToast } from '@hangyul/ui';
import { cx, formatDate, type Tone } from '@hangyul/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { Link } from 'react-router';

import '../../dossier.css';
import { lc } from '../../lib/workspace';
import { findingText, packageLine, reasonText, rowAction, summaryText, type RowAction } from '../../lib/dossier';

/** Dossier translation hook: `t('page.title')` reads the `dossier` namespace. */
export function useDT() {
  const l = useLocale(['dossier', 'common']);
  const fmt = (iso: string) => formatDate(iso, l.locale, { day: 'numeric', month: 'short', year: 'numeric' });
  return { ...l, fmt };
}

export function useDossier() {
  const api = useApi();
  return useQuery({ queryKey: ['dossier'], queryFn: () => api.dossier.me(), staleTime: 30_000 });
}

/** Everything that can change when a dossier action happens. */
export function useDossierInvalidate() {
  const qc = useQueryClient();
  return () => {
    ['dossier', 'documents', 'document', 'dashboard', 'application', 'applications', 'package', 'profile'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  };
}

const STATE_TONE: Record<DossierRow['state'], Tone> = { todo: 'warning', review: 'info', ready: 'success', extra: 'neutral' };
const SEV_TONE: Record<DossierFinding['severity'], string> = { BLOCKER: 'danger', WARNING: 'warning', INFO: 'neutral' };

export function FindingLine({ f }: { f: DossierFinding }) {
  const { t, fmt } = useDT();
  return <p className={cx('dz-finding', `dz-finding--${SEV_TONE[f.severity]}`)}>{findingText(t, f, fmt)}</p>;
}

const SAID_BY_SUMMARY = new Set(['NEW_ISSUE_NEEDED', 'LEGALIZATION_NEEDED']);

/** V9 S4: universities a document of this row was sent to (with application and date). */
export interface SentTo { application_id: string; university: string; sent_on: string | null }
export interface Visibility {
  you: true; agency: { organization: string | null; counselor: string | null; consent_at: string | null; consent_granted: boolean } | null;
  hangyul_reviewers: true; universities: 'ONLY_SENT';
  retention: { code: string; legal_exception: boolean; policy_status: 'PENDING_APPROVAL' | 'APPROVED' };
  withdraw: { agency_sharing: boolean; sent_to_university: false; link: string };
}
export const sentToOf = (row: DossierRow): SentTo[] => (row as DossierRow & { sent_to?: SentTo[] }).sent_to ?? [];

function SentToLine({ row }: { row: DossierRow }) {
  const { t, fmt } = useDT();
  const sent = sentToOf(row);
  if (!sent.length) return null;
  const list = sent.map((s) => (s.sent_on ? t('v9.who.sentItem', { university: s.university, date: fmt(s.sent_on) }) : s.university)).join(' · ');
  return <p className="v9-sent"><Send aria-hidden /> {t('v9.who.sentLine', { list })}</p>;
}

/**
 * V9 S4 — PRIMARY QUESTION: "Is my passport safe here — who can see it?" Plain facts from the account: you, your
 * counselor and agency (with the date you agreed), Hangyul reviewers, the universities it was sent to, how long it is
 * kept, and what you can take back.
 */
export function WhoCanSee({ row }: { row?: DossierRow | null }) {
  const { t, fmt } = useDT();
  const q = useDossier();
  const v = (q.data as (typeof q.data & { visibility?: Visibility }) | undefined)?.visibility;
  if (!v) return null;
  const sent = row ? sentToOf(row) : [];
  return (
    <section className="st-drawer-sec v9-who" aria-labelledby="v9-who-title">
      <h3 id="v9-who-title" className="hg-title-sm"><Eye aria-hidden className="v9-who__ico" /> {t('v9.who.title')}</h3>
      <ul className="v9-who__list">
        <li><strong>{t('v9.who.you')}</strong></li>
        {v.agency ? (
          <li><strong>{v.agency.counselor ? t('v9.who.counselor', { name: v.agency.counselor, org: v.agency.organization ?? '' }) : t('v9.who.agency', { org: v.agency.organization ?? '' })}</strong>
            {' '}<span className="hg-muted">{v.agency.consent_at ? t('v9.who.consent', { date: fmt(v.agency.consent_at) }) : t('v9.who.noConsent')}</span></li>
        ) : <li className="hg-muted">{t('v9.who.noAgency')}</li>}
        <li><strong>{t('v9.who.reviewers')}</strong> <span className="hg-muted">{t('v9.who.reviewersWhy')}</span></li>
        {row && (sent.length
          ? sent.map((s) => <li key={s.application_id}><strong>{s.university}</strong> <span className="hg-muted">{s.sent_on ? t('v9.who.sentOn', { date: fmt(s.sent_on) }) : t('v9.who.sent')}</span></li>)
          : <li className="hg-muted">{t('v9.who.notSent')}</li>)}
      </ul>
      <dl className="v9-who__dl">
        <div><dt>{t('v9.who.keptTitle')}</dt><dd>{t('v9.who.kept')} {v.retention.policy_status === 'PENDING_APPROVAL' && <span className="hg-subtle">{t('v9.who.keptPending')}</span>}</dd></div>
        <div><dt>{t('v9.who.withdrawTitle')}</dt><dd>{v.withdraw.agency_sharing ? t('v9.who.withdrawAgency') : t('v9.who.withdrawNone')} {t('v9.who.withdrawSent')} <Link className="hg-link" to={v.withdraw.link}>{t('v9.who.manage')}</Link></dd></div>
      </dl>
    </section>
  );
}

/** One document (or missing requirement): where it can be used, the first note, one action. */
/**
 * One requirement in the dossier.
 *
 * `stateInHeading` (V19): this row is inside a list that is already grouped by state, under a heading that
 * names it. `Documents` builds every list with `rows.filter(r => r.state === s)`, so the state pill was
 * identical on every row of the group and repeated the heading directly above it — eight rows of
 * "할 일 있음" under a section called "직접 해야 할 일". A badge that appears on every row of a list carries
 * no information; it is a wall. It stays wherever rows of different states can sit together.
 */
export function DossierRowItem({ row, onAction, stateInHeading, focused }: {
  row: DossierRow; onAction: (row: DossierRow, action: RowAction) => void; stateInHeading?: boolean;
  /** V26: the requirement a task or notification was about (`/documents?focus=<category>`). */ focused?: boolean;
}) {
  const { t, fmt } = useDT();
  const action = rowAction(row);
  // Inline: the first actionable note only; informational notes live in the drawer.
  // (Applicability notes — newer copy / legalization — are already said by the summary line.)
  const inline = row.findings.filter((f) => f.severity !== 'INFO' && !SAID_BY_SUMMARY.has(f.code));
  const first = inline.find((f) => f.document_id === row.document?.id) ?? inline[0];
  const more = inline.length - (first ? 1 : 0);
  const primary = action !== 'view';
  return (
    <li className={cx('dz-row', stateInHeading && 'dz-row--grouped')} data-state={row.state} data-focus={focused ? 'true' : undefined}>
      <div className="dz-row__main">
        <div className="dz-row__title">{t(`common:docCategory.${row.category}`)}</div>
        <div className="dz-row__summary">{summaryText(t, row.summary, fmt)}</div>
        {first && <FindingLine f={first} />}
        {more > 0 && <button type="button" className="dz-more" onClick={() => onAction(row, 'view')}>{t('finding.more', { count: more })}</button>}
        <SentToLine row={row} />
      </div>
      {/* The state still reaches a screen reader even when the heading above carries it visually, because
          a reader who has jumped straight to this row by its title has not heard the heading. */}
      <div className="dz-row__state">
        {stateInHeading
          ? <span className="hg-sr-only">{t(`state.${row.state}`)}</span>
          : <StatusText tone={STATE_TONE[row.state]} hollow={!row.document}>{t(`state.${row.state}`)}</StatusText>}
      </div>
      <div className="dz-row__action">
        <Button size="sm" variant={primary ? 'secondary' : 'ghost'} onClick={() => onAction(row, action)}>{t(`action.${action}`)}</Button>
      </div>
    </li>
  );
}

/** A university request, answered from the dossier when possible ("Send your existing …"). */
export function RequestItem({ r, onUpload, primary = true }: { r: DossierRequestSuggestion; onUpload: (r: DossierRequestSuggestion) => void; primary?: boolean }) {
  const { t, fmt } = useDT();
  const api = useApi();
  const toast = useToast();
  const refresh = useDossierInvalidate();
  const doc = r.category ? lc(t(`common:docCategory.${r.category}`)) : lc(r.label);
  const send = useMutation({
    mutationFn: () => api.dossier.sendExisting(r.request_id, r.document!.id),
    onSuccess: () => { toast.success(t('requests.sent', { university: r.university })); refresh(); },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <li className="dz-row dz-row--request" data-state="todo">
      <div className="dz-row__main">
        <div className="dz-row__title">{t('requests.asked', { university: r.university, label: docLabel(t, r) })}</div>
        <p className="dz-quote" data-user-content>“{r.note}”</p>
        {r.document && r.action === 'SEND_EXISTING' && <div className="dz-row__summary">{t('requests.have', { title: r.document.title })}</div>}
        {r.action !== 'SEND_EXISTING' && r.document && <p className="dz-finding dz-finding--warning">{reasonText(t, r.reason, fmt)}</p>}
      </div>
      <div className="dz-row__action dz-row__action--wide">
        {r.action === 'SEND_EXISTING'
          ? <Button size="sm" variant={primary ? 'primary' : 'secondary'} loading={send.isPending} onClick={() => send.mutate()}>{t('requests.sendExisting', { doc })}</Button>
          : <Button size="sm" variant={primary ? 'primary' : 'secondary'} onClick={() => onUpload(r)}>{r.action === 'UPLOAD_NEWER' ? t('requests.uploadNewer', { doc }) : t('requests.upload')}</Button>}
      </div>
    </li>
  );
}

function SuggestionItem({ s }: { s: DossierSuggestion }) {
  const { t, fmt } = useDT();
  const api = useApi();
  const toast = useToast();
  const refresh = useDossierInvalidate();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(s.value);
  const id = useId();
  const confirm = useMutation({
    mutationFn: (v?: string) => api.dossier.confirmField(s.id, v),
    onSuccess: () => { toast.success(t('check.confirmed')); refresh(); },
    onError: (e) => toast.error((e as Error).message),
  });
  const reject = useMutation({
    mutationFn: () => api.dossier.rejectField(s.id),
    onSuccess: () => { toast.success(t('check.rejected')); refresh(); },
    onError: (e) => toast.error((e as Error).message),
  });
  const show = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? fmt(v) : v);
  return (
    <li className="dz-sug">
      <div className="dz-sug__head">
        <span className="dz-sug__field">{t(`field.${s.field}`)}</span>
        <span className="dz-sug__value">{show(s.value)}</span>
      </div>
      <p className="dz-sug__meta">
        {t('check.from', { doc: lc(t(`common:docCategory.${s.category}`)) })} · {t(`confidence.${s.confidence}`)}
        {' · '}{s.current_value ? t('check.yours', { value: show(s.current_value) }) : t('check.yoursNone')}
      </p>
      <p className="dz-sug__meta">{s.target ? t('check.willUpdate', { target: t(`check.target.${s.target}`) }) : t('check.noTarget')}</p>
      {editing ? (
        <div className="dz-sug__edit">
          <label htmlFor={id} className="hg-sr-only">{t(`field.${s.field}`)}</label>
          <Input id={id} value={value} onChange={(e) => setValue(e.target.value)} />
          <Button size="sm" variant="primary" loading={confirm.isPending} onClick={() => confirm.mutate(value)}>{t('check.save')}</Button>
          <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setValue(s.value); }}>{t('check.cancel')}</Button>
        </div>
      ) : (
        <div className="dz-sug__actions">
          <Button size="sm" variant="secondary" icon={<Check />} loading={confirm.isPending} onClick={() => confirm.mutate(undefined)}>{t('check.confirm')}</Button>
          <Button size="sm" variant="ghost" icon={<Pencil />} onClick={() => setEditing(true)}>{t('check.edit')}</Button>
          <Button size="sm" variant="ghost" icon={<X />} loading={reject.isPending} onClick={() => reject.mutate()}>{t('check.notRight')}</Button>
        </div>
      )}
    </li>
  );
}

/** "We found this information. Please check it." — only values that differ from (or are missing in) the profile. */
export function SuggestionList({ items, matching }: { items: DossierSuggestion[]; matching: number }) {
  const { t } = useDT();
  if (!items.length && !matching) return null;
  return (
    <div className="dz-check" id="check">
      {items.length > 0 && <ul className="hg-panel dz-sugs">{items.map((s) => <SuggestionItem key={s.id} s={s} />)}</ul>}
      {matching > 0 && <p className="dz-matching"><Check aria-hidden /> {t('check.matching', { count: matching })}</p>}
    </div>
  );
}

const BUCKET_MARK: Record<string, string> = { ready: '✓', student: '!', counselor: '●', request: '!' };

/** Per-application package: one line, the list on demand. */
export function PackageItem({ p }: { p: DossierPackage }) {
  const { t, fmt } = useDT();
  const s = p.summary;
  return (
    <li className="dz-pkg" id={`pkg-${p.application.id}`} data-complete={s.complete || undefined}>
      <div className="dz-pkg__head">
        <Link to={`/applications/${p.application.id}`} className="dz-pkg__uni">{p.application.university}</Link>
        <span className="dz-pkg__prog">{p.application.program}</span>
      </div>
      <p className={cx('dz-pkg__line', s.complete && 'dz-pkg__line--done')}>{packageLine(t, s)}</p>
      {!s.complete && (
        <details className="dz-pkg__details">
          <summary>{t('package.show')}</summary>
          <ul className="dz-pkg__items">
            {p.items.map((i) => (
              <li key={i.key} data-bucket={i.bucket}>
                <span className="dz-pkg__mark" aria-hidden>{BUCKET_MARK[i.bucket]}</span>
                <span className="hg-sr-only">{t(`package.bucket.${i.bucket}`)}: </span>
                <span className="dz-pkg__label">{docLabel(t, i)}</span>
                {i.bucket !== 'ready' && <span className="dz-pkg__why">{i.kind === 'request' ? <span data-user-content>“{i.note}”</span> : reasonText(t, i.reason, fmt) || t(`package.bucket.${i.bucket}`)}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </li>
  );
}

/** Compact package line for the application workspace (V4 page): "12 requirements · 10 ready · 1 waiting for you". */
export function PackageLine({ applicationId }: { applicationId: string }) {
  const { t } = useDT();
  const api = useApi();
  const q = useQuery({ queryKey: ['package', applicationId], queryFn: () => api.dossier.package(applicationId), staleTime: 30_000 });
  const d = q.data;
  if (!d || !('items' in d)) return null;
  return (
    <p className={cx('dz-pkgline', d.summary.complete && 'dz-pkgline--done')}>
      {d.summary.complete && <Check aria-hidden />}
      <span>{packageLine(t, d.summary)}</span>
      <Link to={`/documents#pkg-${applicationId}`} className="dz-pkgline__link">{t('page.title')}<ChevronRight aria-hidden className="hg-flip-rtl" /></Link>
    </p>
  );
}
