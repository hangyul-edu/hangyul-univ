import { AlertCircle, CheckCircle2, FileUp } from '@hangyul/icons';
import { useLocale } from '@hangyul/i18n';
import { cx } from '@hangyul/utils';
import {
  ALLOWED_UPLOAD_TYPES, checkDragItems, checkUploads, MAX_UPLOAD_MB, UPLOAD_EXTENSIONS, type UploadReason, type UploadRules,
} from '@hangyul/validation';
import {
  forwardRef, useCallback, useEffect, useId, useImperativeHandle, useRef, useState, type DragEvent, type ReactNode,
} from 'react';

/** What the zone is doing; `status` from the caller (upload in flight / done / failed) wins over the drag state. */
export type FileDropStatus = 'idle' | 'validating' | 'uploading' | 'success' | 'error';
type DragState = 'none' | 'valid' | 'invalid';

export interface FileDropHandle {
  /** Opens the system file picker (e.g. from a chat composer's paperclip). */
  open: () => void;
}

export interface FileDropProps {
  /** `zone`: a dashed drop area with its own picker button. `overlay`: wraps a composer — the whole area accepts drops
   * and shows the drop UI on top; the caller keeps its own picker control and calls `ref.open()`. */
  variant?: 'zone' | 'overlay';
  /** Put on the picker button so a `<Field htmlFor>` label names it. */
  id?: string;
  rules?: UploadRules;
  /** Files already attached (counts against `rules.maxFiles`). */
  already?: number;
  disabled?: boolean;
  /** Validated files only — picker and drop both go through `checkUploads` first. */
  onFiles: (files: File[]) => void;
  /** Called when a pick/drop is refused (the zone already shows and announces the reason). */
  onReject?: (reason: UploadReason) => void;
  /** Selected/uploaded file to show in the zone. */
  file?: { name: string; size?: number } | null;
  status?: FileDropStatus;
  /** 0–100 while uploading, when the transport reports it. */
  progress?: number;
  /** Error text from the caller (e.g. the server refused the upload). Translated when it is a `validation.*` key. */
  error?: string | null;
  /** Overrides the default idle label ("Choose a file"). */
  label?: ReactNode;
  /** Extra ids for `aria-describedby` on the picker (e.g. a Field hint). */
  describedBy?: string;
  className?: string;
  children?: ReactNode;
}

const hasFiles = (e: { dataTransfer: DataTransfer | null }) => !!e.dataTransfer && Array.from(e.dataTransfer.types ?? []).includes('Files');
const mb = (n: number) => `${(n / 1024 / 1024).toFixed(2)} MB`;

/**
 * The one upload control (owner requirement 4): a keyboard-reachable picker button and a drop target that go through
 * the same `checkUploads` (count, size, name ending + declared type). The server still sniffs the bytes, scans,
 * checks permission and versions — this only refuses early and says why.
 */
export const FileDrop = forwardRef<FileDropHandle, FileDropProps>(function FileDrop(
  { variant = 'zone', id, rules: r, already = 0, disabled, onFiles, onReject, file, status = 'idle', progress, error, label, describedBy, className, children },
  ref,
) {
  const { t } = useLocale('common');
  const rules: UploadRules = { types: ALLOWED_UPLOAD_TYPES, maxMb: MAX_UPLOAD_MB, maxFiles: 1, ...r };
  const many = (rules.maxFiles ?? 1) > 1;
  const input = useRef<HTMLInputElement>(null);
  const zone = useRef<HTMLDivElement>(null);
  const depth = useRef(0);
  const [drag, setDrag] = useState<DragState>('none');
  const [dragReason, setDragReason] = useState<UploadReason | null>(null);
  const [reject, setReject] = useState<string | null>(null);
  const constraintsId = useId();
  const statusId = useId();
  const btnId = useId();

  const reasonText = useCallback((reason: UploadReason) => t(reason, { count: rules.maxFiles ?? 1, mb: rules.maxMb }), [t, rules.maxFiles, rules.maxMb]);

  const handle = (list: File[]) => {
    if (!list.length || disabled) return;
    const res = checkUploads(list, rules, already);
    if (res.batchReason) {
      setReject(reasonText(res.batchReason));
      onReject?.(res.batchReason);
      return;
    }
    if (res.rejected.length) {
      const msg = res.rejected.map((x) => (list.length > 1 ? t('upload.rejected', { name: x.file.name, reason: reasonText(x.reason) }) : reasonText(x.reason))).join(' ');
      setReject(msg);
      onReject?.(res.rejected[0].reason);
    } else {
      setReject(null);
    }
    if (res.accepted.length) onFiles(res.accepted);
  };

  useImperativeHandle(ref, () => ({ open: () => { if (!disabled) input.current?.click(); } }), [disabled]);

  // While the zone is mounted, a file dropped beside it must not make the browser navigate away to the file.
  useEffect(() => {
    const guard = (e: globalThis.DragEvent) => {
      if (!hasFiles(e)) return;
      if (zone.current && e.target instanceof Node && zone.current.contains(e.target)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'none';
    };
    window.addEventListener('dragover', guard);
    window.addEventListener('drop', guard);
    return () => { window.removeEventListener('dragover', guard); window.removeEventListener('drop', guard); };
  }, []);

  const inspect = (e: DragEvent) => {
    const items = Array.from(e.dataTransfer?.items ?? []).map((i) => ({ kind: i.kind, type: i.type }));
    const reason = checkDragItems(items, rules, already);
    setDrag(reason ? 'invalid' : 'valid');
    setDragReason(reason);
    return reason;
  };
  const onDragEnter = (e: DragEvent) => {
    if (!hasFiles(e) || disabled) return;
    e.preventDefault();
    depth.current += 1;
    inspect(e);
  };
  const onDragOver = (e: DragEvent) => {
    if (!hasFiles(e) || disabled) return;
    e.preventDefault();
    const reason = drag === 'none' ? inspect(e) : dragReason;
    if (e.dataTransfer) e.dataTransfer.dropEffect = reason ? 'none' : 'copy';
  };
  const onDragLeave = (e: DragEvent) => {
    if (!hasFiles(e) || disabled) return;
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) { setDrag('none'); setDragReason(null); }
  };
  const onDrop = (e: DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth.current = 0;
    setDrag('none');
    setDragReason(null);
    if (disabled) return;
    handle(Array.from(e.dataTransfer.files ?? []));
  };

  const errText = error ? (/^validation\.[a-zA-Z]+$/.test(error) ? t(error, { count: rules.maxFiles ?? 1 }) : error) : null;
  const shownError = reject ?? (status === 'error' ? errText : null);
  const state: string = drag === 'valid' ? 'drag-valid' : drag === 'invalid' ? 'drag-invalid' : shownError ? 'error' : status;
  const message =
    drag === 'valid' ? t('upload.dropHere')
    : drag === 'invalid' ? (dragReason ? reasonText(dragReason) : t('upload.cantAdd'))
    : shownError ? shownError
    : status === 'validating' ? t('upload.checking')
    : status === 'uploading' ? (typeof progress === 'number' ? t('upload.uploadingPct', { pct: Math.round(progress) }) : t('upload.uploading'))
    : status === 'success' && file ? t('upload.done', { name: file.name })
    : file ? t('upload.selected', { name: file.name })
    : '';
  const constraints = many
    ? t('upload.constraintsMany', { mb: rules.maxMb, count: rules.maxFiles })
    : t('upload.constraints', { mb: rules.maxMb });
  const accept = [...(rules.types ?? []), ...(rules.types ?? []).flatMap((x) => (UPLOAD_EXTENSIONS[x] ?? []).map((e) => `.${e}`))].join(',');

  const hidden = (
    <input ref={input} type="file" className="hg-sr-only" tabIndex={-1} aria-hidden accept={accept} multiple={many} disabled={disabled}
      onChange={(e) => { const l = Array.from(e.target.files ?? []); e.target.value = ''; handle(l); }} />
  );
  const live = <span id={statusId} className="hg-sr-only" role="status" aria-live="polite">{shownError && drag === 'none' ? '' : message}</span>;
  const dragHandlers = { onDragEnter, onDragOver, onDragLeave, onDrop };

  if (variant === 'overlay') {
    return (
      <div ref={zone} className={cx('hg-filedrop-overlay', className)} data-state={state} {...dragHandlers}>
        {children}
        {drag !== 'none' && (
          <div className="hg-filedrop-overlay__veil" aria-hidden>
            {drag === 'invalid' ? <AlertCircle /> : <FileUp />}
            <span>{message}</span>
          </div>
        )}
        {reject && drag === 'none' && <p className="hg-filedrop__error" role="alert">{reject}</p>}
        {hidden}
        {live}
      </div>
    );
  }

  const busy = status === 'uploading' || status === 'validating';
  return (
    <div ref={zone} className={cx('hg-filedrop', className)} data-state={state} data-has={!!file || undefined} aria-busy={busy || undefined}
      role="group" aria-label={t('upload.zone')} {...dragHandlers}>
      <span className="hg-filedrop__icon" aria-hidden>
        {state === 'success' ? <CheckCircle2 /> : state === 'error' || state === 'drag-invalid' ? <AlertCircle /> : <FileUp />}
      </span>
      {drag !== 'none' ? (
        <span className="hg-filedrop__drag">{message}</span>
      ) : (
        <>
          <button type="button" id={id ?? btnId} className="hg-filedrop__pick" disabled={disabled || busy}
            aria-describedby={cx(constraintsId, statusId, describedBy) || undefined} onClick={() => input.current?.click()}>
            {file ? t('upload.replace') : label ?? (many ? t('upload.chooseMany') : t('upload.choose'))}
          </button>
          {file
            ? <span className="hg-filedrop__file">{file.name}{typeof file.size === 'number' ? ` · ${mb(file.size)}` : ''}</span>
            : <span className="hg-filedrop__or">{many ? t('upload.orDragMany') : t('upload.orDrag')}</span>}
          <span className="hg-filedrop__constraints" id={constraintsId}>{constraints}</span>
          {status === 'uploading' && typeof progress === 'number' && (
            <span className="hg-filedrop__bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)} aria-label={t('upload.uploading')}>
              <span style={{ inlineSize: `${Math.max(0, Math.min(100, progress))}%` }} />
            </span>
          )}
          {(busy || state === 'success') && message && <span className="hg-filedrop__status" aria-hidden>{message}</span>}
          {shownError && <span className="hg-filedrop__error" role="alert">{shownError}</span>}
        </>
      )}
      {hidden}
      {live}
    </div>
  );
});
