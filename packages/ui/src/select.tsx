/**
 * The one selection control (V32, REPORT §436).
 *
 * Until V32 `Select` and `FilterSelect` drew their own closed face and stretched a transparent native `<select>`
 * over it, so the *open* menu was the browser's: square, blue-highlighted, in the platform's font, unrelated to
 * anything else on the page. That is the defect the owner's screenshot showed on `/universities`. Styling the
 * closed control is not enough — the opened list is the part people look at — so the list is ours now.
 *
 * Both exports share one engine (`useSelectCore`): the W3C **select-only combobox** pattern. The trigger is a
 * `<button role="combobox">`; focus stays on it while the list is open and `aria-activedescendant` names the
 * option the keyboard is on, so a screen reader hears the label, the value and the position without the focus
 * ever leaving the control. The list is portalled to `document.body` and placed from the trigger's viewport
 * rect (`placePopover`, the same flip-and-clamp the Popover uses), so no `overflow: hidden` ancestor can clip
 * it and it stays on screen under a floating header. On a phone (`max-width: 767px`) the same list opens as a
 * bottom sheet with 48 px rows, because a popover anchored to a 36 px chip at the edge of a 390 px screen is
 * not a usable list.
 *
 * Keyboard: ArrowDown / ArrowUp (open, then move), Home / End, PageUp / PageDown (±10), Enter / Space (open,
 * then choose), Escape (close, keep the value), Tab (choose the active option and move on), Alt+ArrowUp (choose
 * and close), and type-ahead — letters find the next option that starts with the buffer; repeating one letter
 * cycles. Click chooses; hovering moves the active option.
 *
 * API: the props of the controls it replaces. `value` + `onChange` where `onChange` receives an object whose
 * `target.value` is the chosen value (every existing call site reads `e.target.value`), and the options are the
 * same `<option>` / `<optgroup>` children. A `name` renders a hidden input so a plain form still posts the value.
 */
import { Check, ChevronDown } from '@hangyul/icons';
import { useLocale } from '@hangyul/i18n';
import { cx } from '@hangyul/utils';
import {
  Children, forwardRef, isValidElement, useCallback, useEffect, useId, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState,
  type ChangeEvent, type CSSProperties, type KeyboardEvent, type ReactElement, type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

import { Drawer, placePopover, type Placement } from './overlays';

/* ------------------------------------------------------------------------------------------------ options */

export interface SelectOption { value: string; label: ReactNode; text: string; disabled?: boolean }
interface SelectGroup { label: ReactNode; options: SelectOption[] }
type Row = { kind: 'option'; opt: SelectOption; index: number } | { kind: 'group'; label: ReactNode; id: string };

/** Plain text of a label, for the type-ahead and the accessible name. */
function textOf(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children);
  return '';
}

type OptionEl = ReactElement<{ value?: string | number; children?: ReactNode; disabled?: boolean }>;

function readOption(el: OptionEl): SelectOption {
  const label = el.props.children;
  const text = textOf(label);
  return { value: String(el.props.value ?? text), label, text, disabled: !!el.props.disabled };
}

/** `<option>` / `<optgroup>` children → flat rows + the options alone. */
function readChildren(children: ReactNode): { rows: Row[]; options: SelectOption[] } {
  const rows: Row[] = []; const options: SelectOption[] = [];
  let g = 0;
  const push = (opt: SelectOption) => { rows.push({ kind: 'option', opt, index: options.length }); options.push(opt); };
  for (const child of Children.toArray(children)) {
    if (!isValidElement(child)) continue;
    const el = child as ReactElement<{ label?: ReactNode; value?: string | number; children?: ReactNode; disabled?: boolean }>;
    if (el.type === 'optgroup') {
      const group: SelectGroup = { label: el.props.label, options: [] };
      rows.push({ kind: 'group', label: group.label, id: `g${g++}` });
      for (const o of Children.toArray(el.props.children)) if (isValidElement(o)) push(readOption(o as OptionEl));
    } else if (el.type === 'option') {
      push(readOption(el as OptionEl));
    }
  }
  return { rows, options };
}

/* ------------------------------------------------------------------------------------------------ engine */

export type SelectChangeEvent = ChangeEvent<HTMLSelectElement>;

function usePhone(): boolean {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(max-width: 767px)');
    const sync = () => setPhone(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  return phone;
}

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

interface CoreArgs {
  value: string | number | readonly string[] | undefined;
  options: SelectOption[];
  disabled?: boolean;
  name?: string;
  onChange?: (e: SelectChangeEvent) => void;
  onOpenChange?: (open: boolean) => void;
}

function useSelectCore({ value, options, disabled, name, onChange, onOpenChange }: CoreArgs) {
  const uid = useId();
  const listId = `${uid}-list`;
  const current = value === undefined ? undefined : String(value);
  const selectedIndex = useMemo(() => {
    const i = options.findIndex((o) => o.value === current);
    // Like a native select: a value no option carries shows the first option.
    return i >= 0 ? i : options.length ? 0 : -1;
  }, [options, current]);
  const [open, setOpenState] = useState(false);
  const [active, setActive] = useState(selectedIndex);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const buffer = useRef({ text: '', at: 0 });

  const setOpen = useCallback((v: boolean) => {
    if (disabled && v) return;
    setOpenState(v);
    onOpenChange?.(v);
    if (v) setActive(selectedIndex >= 0 ? selectedIndex : 0);
  }, [disabled, onOpenChange, selectedIndex]);

  const commit = useCallback((index: number) => {
    const opt = options[index];
    if (!opt || opt.disabled) return;
    setOpen(false);
    if (opt.value !== current) {
      const target = { value: opt.value, name: name ?? '' } as unknown as HTMLSelectElement;
      onChange?.({ target, currentTarget: target, type: 'change' } as unknown as SelectChangeEvent);
    }
  }, [options, current, name, onChange, setOpen]);

  const enabled = useMemo(() => options.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0), [options]);
  const step = useCallback((from: number, delta: number) => {
    if (!enabled.length) return from;
    const pos = enabled.indexOf(from);
    const base = pos >= 0 ? pos : delta > 0 ? -1 : enabled.length;
    const next = Math.min(Math.max(base + delta, 0), enabled.length - 1);
    return enabled[next];
  }, [enabled]);

  const typeahead = useCallback((key: string) => {
    const now = Date.now();
    const b = buffer.current;
    b.text = now - b.at > 500 ? key : b.text + key;
    b.at = now;
    const q = b.text.toLowerCase();
    const same = q.length > 1 && q.split('').every((c) => c === q[0]);
    const start = active >= 0 ? active : -1;
    const order = [...enabled.filter((i) => i > start), ...enabled.filter((i) => i <= start)];
    const hit = same
      ? order.find((i) => options[i].text.toLowerCase().startsWith(q[0]))
      : order.find((i) => options[i].text.toLowerCase().startsWith(q));
    if (hit !== undefined) { setActive(hit); if (!open) commit(hit); }
  }, [active, enabled, options, open, commit]);

  const onKeyDown = useCallback((e: KeyboardEvent) => {
    if (disabled) return;
    const k = e.key;
    if (!open) {
      if (k === 'ArrowDown' || k === 'ArrowUp' || k === 'Enter' || k === ' ' || k === 'Home' || k === 'End') {
        e.preventDefault(); setOpen(true);
        if (k === 'Home') setActive(step(-1, 1));
        if (k === 'End') setActive(step(options.length, -1));
        return;
      }
      if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); typeahead(k); }
      return;
    }
    switch (k) {
      case 'ArrowDown': e.preventDefault(); setActive((a) => step(a, 1)); break;
      case 'ArrowUp': e.preventDefault(); if (e.altKey) commit(active); else setActive((a) => step(a, -1)); break;
      case 'PageDown': e.preventDefault(); setActive((a) => step(a, 10)); break;
      case 'PageUp': e.preventDefault(); setActive((a) => step(a, -10)); break;
      case 'Home': e.preventDefault(); setActive(step(-1, 1)); break;
      case 'End': e.preventDefault(); setActive(step(options.length, -1)); break;
      case 'Enter': case ' ': e.preventDefault(); commit(active); break;
      case 'Escape': e.preventDefault(); e.stopPropagation(); setOpen(false); break;
      case 'Tab': commit(active); break; // the browser then moves focus on
      default:
        if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); typeahead(k); }
    }
  }, [disabled, open, setOpen, step, options.length, typeahead, commit, active]);

  // Outside click closes. `mousedown`, so a click that lands on another control opens that one in the same gesture.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || listRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown, { passive: true });
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('touchstart', onDown); };
  }, [open, setOpen]);

  // Keep the active option in view as the keyboard moves it.
  useEffect(() => {
    if (!open || active < 0) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView?.({ block: 'nearest' });
  }, [open, active]);

  const optionId = (i: number) => `${uid}-o${i}`;
  return { uid, listId, open, setOpen, active, setActive, commit, onKeyDown, triggerRef, listRef, selectedIndex, optionId, current };
}

/* ------------------------------------------------------------------------------------------------ list */

function OptionList({ core, rows, labelledBy, sheet, className }: {
  core: ReturnType<typeof useSelectCore>; rows: Row[]; labelledBy: string; sheet?: boolean; className?: string;
}) {
  return (
    <div
      ref={core.listRef} id={core.listId} role="listbox" aria-labelledby={labelledBy} tabIndex={-1}
      className={cx('hg-listbox', sheet && 'hg-listbox--sheet', className)}
      onKeyDown={sheet ? core.onKeyDown : undefined}
    >
      {rows.map((r) => r.kind === 'group' ? (
        <div key={r.id} role="group" aria-labelledby={`${core.uid}-${r.id}`}>
          <div id={`${core.uid}-${r.id}`} className="hg-listbox__group">{r.label}</div>
        </div>
      ) : (
        <div
          key={r.index} id={core.optionId(r.index)} role="option" data-index={r.index}
          aria-selected={r.index === core.selectedIndex} aria-disabled={r.opt.disabled || undefined}
          data-active={r.index === core.active || undefined}
          className="hg-listbox__opt"
          onMouseMove={() => { if (core.active !== r.index && !r.opt.disabled) core.setActive(r.index); }}
          onClick={() => core.commit(r.index)}
        >
          <span className="hg-listbox__text">{r.opt.label}</span>
          {r.index === core.selectedIndex && <Check className="hg-listbox__check" aria-hidden />}
        </div>
      ))}
    </div>
  );
}

/** Desktop: the list portalled and placed from the trigger; it measures itself hidden for one frame, like the Popover. */
function Popup({ core, rows, labelledBy, minWidth }: { core: ReturnType<typeof useSelectCore>; rows: Row[]; labelledBy: string; minWidth: number }) {
  const [place, setPlace] = useState<Placement | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useIsoLayoutEffect(() => {
    if (!core.open) { setPlace(null); return; }
    const anchor = core.triggerRef.current, panel = panelRef.current;
    if (!anchor || !panel) return;
    const measure = () => setPlace((prev) => {
      const next = placePopover(anchor, panel, 'start');
      return prev && (['top', 'left', 'width', 'avail', 'side'] as const).every((k) => prev[k] === next[k]) ? prev : next;
    });
    measure();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    ro?.observe(panel);
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => { ro?.disconnect(); window.removeEventListener('scroll', measure, true); window.removeEventListener('resize', measure); };
  }, [core.open]);
  if (!core.open) return null;
  const style: CSSProperties = place
    ? { top: place.top, left: place.left, minWidth, '--hg-popover-avail': `${place.avail}px` } as CSSProperties
    : { top: 0, left: 0, minWidth, visibility: 'hidden' };
  return createPortal(
    <div ref={panelRef} className="hg-select-popup" data-placement={place?.side} style={style}>
      <OptionList core={core} rows={rows} labelledBy={labelledBy} />
    </div>,
    document.body,
  );
}

/** Phone: the same list as a bottom sheet. */
function Sheet({ core, rows, title, labelledBy }: { core: ReturnType<typeof useSelectCore>; rows: Row[]; title: ReactNode; labelledBy: string }) {
  // Focus the list so the keyboard works inside the sheet (the trigger is behind the overlay).
  useEffect(() => { if (core.open) core.listRef.current?.focus(); }, [core.open, core.listRef]);
  return (
    <Drawer open={core.open} onClose={() => core.setOpen(false)} title={title} sheet>
      <OptionList core={core} rows={rows} labelledBy={labelledBy} sheet />
    </Drawer>
  );
}

/* ------------------------------------------------------------------------------------------------ Select (form) */

export interface SelectProps {
  id?: string;
  name?: string;
  value?: string | number | readonly string[];
  onChange?: (e: SelectChangeEvent) => void;
  disabled?: boolean;
  invalid?: boolean;
  compact?: boolean;
  className?: string;
  style?: CSSProperties;
  title?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  children?: ReactNode;
}

/** The form select: a field in a form or a compact control in a table toolbar. Same look as `Input`. */
export const Select = forwardRef<HTMLButtonElement, SelectProps>(function Select(
  { id, name, value, onChange, disabled, invalid, compact, className, style, title, children, ...aria }, ref,
) {
  const { rows, options } = useMemo(() => readChildren(children), [children]);
  const core = useSelectCore({ value, options, disabled, name, onChange });
  useImperativeHandle(ref, () => core.triggerRef.current as HTMLButtonElement);
  const phone = usePhone();
  const selected = options[core.selectedIndex];
  const valueId = `${core.uid}-v`;
  // The accessible name: a `<label for={id}>` names a button on its own (the Field pattern); otherwise aria-label /
  // aria-labelledby. Nothing is synthesised, so a bogus reference can never override the real label.
  const labelledBy = aria['aria-labelledby'];
  const sheetTitle = aria['aria-label'] ?? title ?? (id && typeof document !== 'undefined' ? document.querySelector(`label[for="${id}"]`)?.textContent : undefined) ?? '';
  return (
    <>
      <button
        ref={core.triggerRef} type="button" id={id} title={title}
        role="combobox" aria-haspopup="listbox" aria-expanded={core.open} aria-controls={core.open ? core.listId : undefined}
        aria-activedescendant={core.open && !phone && core.active >= 0 ? core.optionId(core.active) : undefined}
        aria-label={aria['aria-label']} aria-labelledby={labelledBy}
        aria-describedby={aria['aria-describedby']} aria-invalid={invalid || undefined} aria-disabled={disabled || undefined}
        disabled={disabled} data-open={core.open || undefined}
        className={cx('hg-sel', compact && 'hg-sel--sm', className)} style={style}
        onClick={() => core.setOpen(!core.open)} onKeyDown={phone ? undefined : core.onKeyDown}
      >
        <span id={valueId} className="hg-sel__value">{selected?.label ?? ' '}</span>
        <ChevronDown className="hg-sel__chev" aria-hidden />
      </button>
      {name && <input type="hidden" name={name} value={selected?.value ?? ''} />}
      {phone
        ? <Sheet core={core} rows={rows} title={sheetTitle} labelledBy={labelledBy ?? valueId} />
        : <Popup core={core} rows={rows} labelledBy={labelledBy ?? valueId} minWidth={core.triggerRef.current?.offsetWidth ?? 0} />}
    </>
  );
});

/* ------------------------------------------------------------------------------------------------ FilterSelect */

export interface FilterSelectProps extends Omit<SelectProps, 'compact' | 'invalid'> {
  /** The category, always visible ("학교 유형", "Status"). Also the accessible name. */
  label: string;
  /** Hide the visible category when the toolbar already names it (the accessible name stays). */
  hideLabel?: boolean;
  size?: 'sm' | 'md';
  /** The filter is narrowing results (a non-default value) — drawn as selected. */
  active?: boolean;
  /** For stretching inside a drawer / sheet column. */
  block?: boolean;
  /** The reset option (value `""`) shows as a short "All" after the category; `false` shows the option text; a string overrides. */
  allLabel?: string | false;
}

/**
 * A **filter** select for toolbars (V30 face, V32 list). The face is `category · value ⌄` sized to the text it
 * shows, and `active` marks a filter that is narrowing the results.
 */
export const FilterSelect = forwardRef<HTMLButtonElement, FilterSelectProps>(function FilterSelect(
  { label, hideLabel, size = 'md', active, block, allLabel, id, name, value, onChange, disabled, className, style, title, children, ...aria }, ref,
) {
  const { t } = useLocale('common');
  const { rows, options } = useMemo(() => readChildren(children), [children]);
  const core = useSelectCore({ value, options, disabled, name, onChange });
  useImperativeHandle(ref, () => core.triggerRef.current as HTMLButtonElement);
  const phone = usePhone();
  const selected = options[core.selectedIndex];
  const face = selected?.value === '' && allLabel !== false && !hideLabel ? (allLabel ?? t('common:v30.filter.all')) : selected?.label ?? '';
  const labelId = `${core.uid}-l`, valueId = `${core.uid}-v`;
  const narrowing = active ?? (value !== undefined && value !== '');
  return (
    <>
      <button
        ref={core.triggerRef} type="button" id={id} title={title}
        role="combobox" aria-haspopup="listbox" aria-expanded={core.open} aria-controls={core.open ? core.listId : undefined}
        aria-activedescendant={core.open && !phone && core.active >= 0 ? core.optionId(core.active) : undefined}
        aria-labelledby={`${labelId} ${valueId}`} aria-describedby={aria['aria-describedby']} aria-disabled={disabled || undefined}
        disabled={disabled} data-open={core.open || undefined} data-control="select" data-active={narrowing || undefined}
        className={cx('hg-fsel', size === 'sm' && 'hg-fsel--sm', block && 'hg-fsel--block', className)} style={style}
        onClick={() => core.setOpen(!core.open)} onKeyDown={phone ? undefined : core.onKeyDown}
      >
        <span className="hg-fsel__face">
          <span id={labelId} className={cx('hg-fsel__label', hideLabel && 'hg-sr-only')}>{label}</span>
          <span id={valueId} className="hg-fsel__value">{face}</span>
          <ChevronDown className="hg-fsel__chev" aria-hidden />
        </span>
      </button>
      {name && <input type="hidden" name={name} value={selected?.value ?? ''} />}
      {phone
        ? <Sheet core={core} rows={rows} title={label} labelledBy={labelId} />
        : <Popup core={core} rows={rows} labelledBy={labelId} minWidth={Math.max(core.triggerRef.current?.offsetWidth ?? 0, 180)} />}
    </>
  );
});
