import { initI18n } from '@hangyul/i18n';
import type { ChatMessage } from '@hangyul/types';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeAll, describe, expect, it } from 'vitest';

import { missingRequired } from './ApplicationPanel';
import { MessageBubble } from './MessageThread';

beforeAll(async () => {
  await initI18n({ namespaces: ['agency', 'common'], locale: 'en' });
});

const base: ChatMessage = {
  id: 'm1', body: 'Hello Lan, your documents look good.', internal: false, at: '2026-09-27T09:00:00Z', author: { id: 'u1', full_name: 'Trương Mỹ Linh' },
  mine: false, mentions: [], created_task_id: null, attachment_document_id: null,
};

function renderBubble(m: ChatMessage, names: string[] = []) {
  return render(<MemoryRouter><ul><MessageBubble m={m} names={names} /></ul></MemoryRouter>);
}

describe('MessageBubble', () => {
  it('renders a normal message without the internal banner', () => {
    renderBubble(base);
    const item = screen.getByRole('listitem');
    expect(item).toHaveAttribute('data-internal', 'false');
    expect(within(item).queryByRole('note')).toBeNull();
    expect(item).toHaveTextContent('Hello Lan');
  });

  it('clearly labels internal notes as not visible to the student', () => {
    renderBubble({ ...base, id: 'm2', internal: true, body: 'Parents asked about the bank balance — follow up.' });
    const item = screen.getByRole('listitem');
    expect(item).toHaveAttribute('data-internal', 'true');
    expect(item.className).toContain('ag-msg--internal');
    expect(within(item).getByRole('note')).toHaveTextContent('Internal, not visible to the student');
  });

  it('highlights @mentions of known teammates', () => {
    renderBubble({ ...base, internal: true, body: '@Lê Hoàng Long can you take this?' }, ['Lê Hoàng Long']);
    const mark = screen.getByText('@Lê Hoàng Long');
    expect(mark.tagName).toBe('MARK');
  });

  it('links to the task created from a message', () => {
    renderBubble({ ...base, created_task_id: 't1' });
    expect(screen.getByRole('link', { name: /task created/i })).toHaveAttribute('href', '/tasks');
  });
});

describe('submission guard', () => {
  it('lists required checklist items that are still missing', () => {
    const item = (label: string, required: boolean, status: string) => ({ label, required, status }) as never;
    expect(missingRequired({ checklist: [item('Passport', true, 'VERIFIED'), item('Transcript', true, 'MISSING'), item('CV', false, 'MISSING')] })).toEqual(['Transcript']);
  });
});
