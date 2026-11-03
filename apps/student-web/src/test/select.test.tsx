/**
 * V32 — the canonical selection control: no native <select>, the select-only combobox contract, keyboard and
 * type-ahead, and the `onChange` shape every call site reads (`e.target.value`).
 */
import { FilterSelect, Select } from '@hangyul/ui';
import { fireEvent, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { renderUI } from './utils';

function Harness({ onChange }: { onChange?: (v: string) => void }) {
  const [v, setV] = useState('vn');
  return (
    <label>
      Country
      <Select id="c" value={v} onChange={(e) => { setV(e.target.value); onChange?.(e.target.value); }}>
        <option value="">Choose</option>
        <option value="vn">Vietnam</option>
        <option value="uz">Uzbekistan</option>
        <optgroup label="More">
          <option value="mn">Mongolia</option>
          <option value="np" disabled>Nepal</option>
        </optgroup>
      </Select>
    </label>
  );
}

describe('Select', () => {
  it('renders no native select and exposes the combobox contract', () => {
    renderUI(<Harness />);
    expect(document.querySelector('select')).toBeNull();
    const box = screen.getByRole('combobox');
    expect(box).toHaveAttribute('aria-haspopup', 'listbox');
    expect(box).toHaveAttribute('aria-expanded', 'false');
    expect(box).toHaveTextContent('Vietnam');
  });

  it('opens on click, lists options with the selected one marked, and chooses on click', () => {
    const spy = vi.fn();
    renderUI(<Harness onChange={spy} />);
    fireEvent.click(screen.getByRole('combobox'));
    const list = screen.getByRole('listbox');
    const opts = within(list).getAllByRole('option');
    expect(opts.map((o) => o.textContent)).toEqual(['Choose', 'Vietnam', 'Uzbekistan', 'Mongolia', 'Nepal']);
    expect(opts[1]).toHaveAttribute('aria-selected', 'true');
    expect(within(list).getByRole('group')).toBeInTheDocument();
    fireEvent.click(opts[2]);
    expect(spy).toHaveBeenCalledWith('uz');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(screen.getByRole('combobox')).toHaveTextContent('Uzbekistan');
  });

  it('is driven by the keyboard: arrows, Home/End, Enter, Escape, type-ahead; disabled options are skipped', () => {
    const spy = vi.fn();
    renderUI(<Harness onChange={spy} />);
    const box = screen.getByRole('combobox');
    box.focus();
    fireEvent.keyDown(box, { key: 'ArrowDown' });
    expect(box).toHaveAttribute('aria-expanded', 'true');
    const active = () => document.getElementById(box.getAttribute('aria-activedescendant')!)?.textContent;
    expect(active()).toBe('Vietnam');
    fireEvent.keyDown(box, { key: 'ArrowDown' });
    expect(active()).toBe('Uzbekistan');
    fireEvent.keyDown(box, { key: 'End' });
    expect(active()).toBe('Mongolia'); // Nepal is disabled
    fireEvent.keyDown(box, { key: 'Home' });
    expect(active()).toBe('Choose');
    fireEvent.keyDown(box, { key: 'Escape' });
    expect(box).toHaveAttribute('aria-expanded', 'false');
    expect(spy).not.toHaveBeenCalled(); // Escape keeps the value
    fireEvent.keyDown(box, { key: 'ArrowDown' });
    fireEvent.keyDown(box, { key: 'm' });
    expect(active()).toBe('Mongolia');
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(spy).toHaveBeenCalledWith('mn');
    expect(box).toHaveAttribute('aria-expanded', 'false');
  });

  it('FilterSelect shows category · value and names itself by both', () => {
    renderUI(
      <FilterSelect label="Type" value="" onChange={() => {}}>
        <option value="">All types</option>
        <option value="UNIVERSITY">University</option>
      </FilterSelect>,
    );
    const box = screen.getByRole('combobox', { name: /Type/ });
    expect(box).toHaveTextContent('Type');
    expect(box).toHaveTextContent('All'); // the short reset face, not the option text
    expect(document.querySelector('select')).toBeNull();
  });
});
