/**
 * Owner requirement 4 — the one upload control: picker and drag & drop share one check (`checkUploads`), refused
 * files say why, and the picker is reachable from the keyboard.
 */
import { FileDrop } from '@hangyul/ui';
import { checkDragItems, checkUpload, checkUploads } from '@hangyul/validation';
import { act, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderUI } from './utils';

const pdf = (name = 'transcript.pdf', size = 1024) => new File([new Uint8Array(size)], name, { type: 'application/pdf' });
const big = () => { const f = pdf('huge.pdf', 10); Object.defineProperty(f, 'size', { value: 16 * 1024 * 1024 }); return f; };

function dt(files: File[]) {
  return {
    files, types: ['Files'],
    items: files.map((f) => ({ kind: 'file', type: f.type })),
    dropEffect: 'none', effectAllowed: 'all',
  };
}
const zone = () => screen.getByRole('group', { name: 'File upload area' });

describe('upload validation (shared by picker and drop)', () => {
  it('checks declared type, name ending, size and emptiness', () => {
    expect(checkUpload(pdf())).toBeNull();
    expect(checkUpload({ name: 'a.exe', size: 10, type: 'application/x-msdownload' })).toBe('validation.fileType');
    expect(checkUpload({ name: 'a.png', size: 10, type: 'application/pdf' })).toBe('validation.fileExtension');
    expect(checkUpload({ name: 'scan.jpeg', size: 10, type: '' })).toBeNull();
    expect(checkUpload({ name: 'scan.heic', size: 10, type: '' })).toBe('validation.fileType');
    expect(checkUpload({ name: 'a.pdf', size: 16 * 1024 * 1024, type: 'application/pdf' })).toBe('validation.fileSize');
    expect(checkUpload({ name: 'a.pdf', size: 0, type: 'application/pdf' })).toBe('validation.fileEmpty');
    // The original signature still works for callers that only know size and type.
    expect(checkUpload({ size: 10, type: 'image/png' })).toBeNull();
  });
  it('refuses a batch over the count, counting files already attached', () => {
    expect(checkUploads([pdf(), pdf()], { maxFiles: 1 }).batchReason).toBe('validation.fileCount');
    expect(checkUploads([pdf(), pdf()], { maxFiles: 5 }, 4).batchReason).toBe('validation.fileCount');
    const r = checkUploads([pdf(), { name: 'x.gif', size: 3, type: 'image/gif' }], { maxFiles: 5 });
    expect(r.accepted).toHaveLength(1);
    expect(r.rejected[0].reason).toBe('validation.fileType');
  });
  it('judges a drag from item types only; an unknown type passes until the drop', () => {
    expect(checkDragItems([{ kind: 'file', type: 'application/pdf' }])).toBeNull();
    expect(checkDragItems([{ kind: 'file', type: 'video/mp4' }])).toBe('validation.fileType');
    expect(checkDragItems([{ kind: 'file', type: '' }, { kind: 'file', type: '' }])).toBe('validation.fileCount');
    expect(checkDragItems([{ kind: 'file', type: '' }])).toBeNull();
  });
});

describe('FileDrop', () => {
  it('drop valid: shows the drag state, then hands over the checked file', () => {
    const onFiles = vi.fn();
    renderUI(<FileDrop onFiles={onFiles} />);
    const f = pdf();
    fireEvent.dragEnter(zone(), { dataTransfer: dt([f]) });
    expect(zone()).toHaveAttribute('data-state', 'drag-valid');
    expect(zone()).toHaveTextContent('Drop to upload');
    fireEvent.drop(zone(), { dataTransfer: dt([f]) });
    expect(onFiles).toHaveBeenCalledWith([f]);
    expect(zone()).not.toHaveAttribute('data-state', 'drag-valid');
  });

  it('drop invalid type: marked while dragging, refused with a reason on drop', () => {
    const onFiles = vi.fn();
    const onReject = vi.fn();
    renderUI(<FileDrop onFiles={onFiles} onReject={onReject} />);
    const gif = new File(['x'], 'cat.gif', { type: 'image/gif' });
    fireEvent.dragEnter(zone(), { dataTransfer: dt([gif]) });
    expect(zone()).toHaveAttribute('data-state', 'drag-invalid');
    expect(zone()).toHaveTextContent('Upload a PDF, JPG, PNG or WEBP file.');
    fireEvent.drop(zone(), { dataTransfer: dt([gif]) });
    expect(onFiles).not.toHaveBeenCalled();
    expect(onReject).toHaveBeenCalledWith('validation.fileType');
    expect(screen.getByRole('alert')).toHaveTextContent('Upload a PDF, JPG, PNG or WEBP file.');
  });

  it('too large: refused on drop with the size reason', () => {
    const onFiles = vi.fn();
    renderUI(<FileDrop onFiles={onFiles} />);
    fireEvent.drop(zone(), { dataTransfer: dt([big()]) });
    expect(onFiles).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('15 MB or smaller');
  });

  it('too many: refused as a whole and says how many fit', () => {
    const onFiles = vi.fn();
    renderUI(<FileDrop onFiles={onFiles} />);
    fireEvent.dragEnter(zone(), { dataTransfer: dt([pdf('a.pdf'), pdf('b.pdf')]) });
    expect(zone()).toHaveAttribute('data-state', 'drag-invalid');
    fireEvent.drop(zone(), { dataTransfer: dt([pdf('a.pdf'), pdf('b.pdf')]) });
    expect(onFiles).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('You can add 1 file at a time.');
  });

  it('the picker goes through the same check', () => {
    const onFiles = vi.fn();
    const { container } = renderUI(<FileDrop onFiles={onFiles} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [big()] } });
    expect(onFiles).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('15 MB or smaller');
    const ok = pdf();
    fireEvent.change(input, { target: { files: [ok] } });
    expect(onFiles).toHaveBeenCalledWith([ok]);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('opens the picker from the keyboard (Enter and Space) and describes its constraints', async () => {
    const user = userEvent.setup();
    const { container } = renderUI(<FileDrop onFiles={() => undefined} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const click = vi.spyOn(input, 'click');
    const btn = screen.getByRole('button', { name: 'Choose a file' });
    expect(btn).toHaveAccessibleDescription(/PDF, JPG, PNG or WEBP · up to 15 MB/);
    await act(async () => { btn.focus(); });
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(click).toHaveBeenCalledTimes(2);
  });

  it('overlay variant: a drop on the composer attaches; status is announced politely', () => {
    const onFiles = vi.fn();
    renderUI(<FileDrop variant="overlay" rules={{ maxFiles: 5 }} already={1} onFiles={onFiles}><textarea aria-label="Message" /></FileDrop>);
    const box = screen.getByLabelText('Message').parentElement as HTMLElement;
    fireEvent.dragEnter(box, { dataTransfer: dt([pdf()]) });
    expect(screen.getByRole('status')).toHaveTextContent('Drop to upload');
    fireEvent.drop(box, { dataTransfer: dt([pdf('a.pdf'), pdf('b.pdf')]) });
    expect(onFiles).toHaveBeenCalledTimes(1);
    expect(onFiles.mock.calls[0][0]).toHaveLength(2);
  });
});
