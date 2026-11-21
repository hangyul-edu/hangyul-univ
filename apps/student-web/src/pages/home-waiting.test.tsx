/**
 * The home's waiting state (student page pass, 2026-11).
 *
 * `next_action.code === 'WAIT'` is what the API serves when nothing is the student's to do. It is as common as
 * the action state, so it is specified: a calm statement instead of a primary button, then who is doing what —
 * the Hangyul team, the university — from the same records, never an invented status or date.
 */
import type { Dashboard } from '@hangyul/types';
import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { isWaiting, underReview, withUniversity } from '../lib/journey';
import { renderUI } from '../test/utils';

const api = vi.hoisted(() => ({
  tasks: { list: vi.fn() },
  me: { appointments: vi.fn(), housing: vi.fn() },
}));
vi.mock('@hangyul/auth', () => ({ useApi: () => api, useAuth: () => ({ session: { user: { id: 'student-1' } } }) }));

import { HomeBody } from './Dashboard';

const app = (id: string, status: string, university: string) => ({
  id, status, readiness_percent: 100, submitted_at: '2026-11-01T00:00:00Z',
  program: { id: `p-${id}`, name_en: 'Business Administration (BBA)', degree_level: 'BACHELOR', field: 'BUSINESS', instruction_language: 'KOREAN' },
  university: { id: `u-${id}`, name_en: university, name_ko: university, slug: 'u', city: 'Busan', brand_color: null, photo: null },
  intake: { id: `i-${id}`, year: 2027, term: 'SPRING', application_deadline: '2026-12-04', semester_start: '2027-03-02' },
});

const dashboard = (over: Partial<Dashboard> = {}): Dashboard => ({
  greeting_name: 'Lan',
  journey: { stage: 'DECISION', stages: [] },
  profile: { percent: 100, steps: [], onboarding_completed: true },
  readiness: { percent: 100, basis: '', applications: 1 },
  next_action: { code: 'WAIT', title: "You're all caught up", link: '/applications', params: {} },
  deadlines: [], recommendations: [], applications: [app('a1', 'UNIVERSITY_REVIEW', 'Pusan National University')],
  missing_documents: [], document_counts: { VERIFIED: 9 },
  counselor: { organization: 'Hangyul Univ Operations', organization_id: 'o1', counselor: null, languages: ['en'], since: '2026-09-15T00:00:00Z' },
  unread_messages: 0, scholarships: { eligible: 0, possible: 0, top: [] }, visa: null, arrival: null, cost_estimate: null, open_tasks: 0,
  ...over,
} as unknown as Dashboard);

describe('the waiting-state model', () => {
  it('is the API signal, not an inference from counts', () => {
    expect(isWaiting(dashboard())).toBe(true);
    expect(isWaiting(dashboard({ next_action: { code: 'TASK', title: 't', link: '/tasks', params: {} } }))).toBe(false);
  });

  it('names an application as "with the university" by the shared waiting-on model, and as reviewed only in UNIVERSITY_REVIEW', () => {
    const d = { applications: ['DRAFT', 'READY', 'SUBMITTED', 'UNIVERSITY_REVIEW', 'WAITLISTED', 'OFFERED', 'VISA_SUBMITTED'].map((status) => ({ status })) };
    expect(withUniversity(d).map((a) => a.status)).toEqual(['SUBMITTED', 'UNIVERSITY_REVIEW', 'WAITLISTED']);
    expect(underReview(d).map((a) => a.status)).toEqual(['UNIVERSITY_REVIEW']);
  });
});

describe('the home while nothing is the student\'s to do', () => {
  beforeEach(() => {
    api.tasks.list.mockResolvedValue({ items: [], total: 0 });
    api.me.appointments.mockResolvedValue([]);
    api.me.housing.mockResolvedValue({ case: null });
  });

  it('says who is reviewing and that nothing is needed — with no primary action', () => {
    const { container } = renderUI(<HomeBody d={dashboard()} />);
    expect(container.querySelector('.sp-home')).toHaveAttribute('data-state', 'waiting');
    expect(screen.getByRole('heading', { level: 2, name: 'Your application is being reviewed by Pusan National University' })).toBeInTheDocument();
    expect(screen.getByText('Nothing to do right now')).toBeInTheDocument();
    expect(screen.getByText(/Nothing needs your attention right now\. We'll notify you as soon as something changes\./)).toBeInTheDocument();
    // Calm, not urgent: the way on is a secondary link, and nothing on the page is a tangerine primary button.
    expect(screen.getByRole('link', { name: 'View applications' })).toHaveAttribute('href', '/applications');
    expect(container.querySelector('.hg-btn--primary')).toBeNull();
    expect(screen.queryByText('Your next step')).toBeNull();
  });

  it('then answers what Hangyul is doing, what the university is doing, and what comes next', () => {
    renderUI(<HomeBody d={dashboard()} />);
    const team = screen.getByRole('region', { name: 'What the Hangyul team is doing' });
    expect(within(team).getByText('Checking progress with the Pusan National University admissions office')).toBeInTheDocument();
    const uni = screen.getByRole('region', { name: 'What the university is doing' });
    expect(within(uni).getByText('University is reviewing')).toBeInTheDocument();
    expect(within(uni).getByText(/Pusan National University · Business Administration \(BBA\)/)).toBeInTheDocument();
    // No dated event exists in this payload: the page says so rather than inventing one.
    const next = screen.getByRole('region', { name: 'Coming up' });
    expect(within(next).getByText('No deadlines in the coming weeks.')).toBeInTheDocument();
  });

  it('says each application once: in the university lane, with the way to all of them — not again in a list below', () => {
    renderUI(<HomeBody d={dashboard()} />);
    const uni = screen.getByRole('region', { name: 'What the university is doing' });
    expect(within(uni).getByText(/Pusan National University · Business Administration \(BBA\) · Spring 2027/)).toBeInTheDocument();
    expect(within(uni).getByRole('link', { name: 'View all' })).toHaveAttribute('href', '/applications');
    expect(screen.queryByRole('region', { name: 'Your applications' })).toBeNull();
    expect(screen.getAllByText(/Business Administration \(BBA\)/)).toHaveLength(2); // the team's line and the university's line
  });

  it('still lists an application the university lane does not show', () => {
    const d = dashboard({ applications: [app('a1', 'UNIVERSITY_REVIEW', 'Pusan National University'), app('a2', 'ENROLLED', 'Kyungpook National University')] as never });
    renderUI(<HomeBody d={d} />);
    const list = screen.getByRole('region', { name: 'Your applications' });
    expect(within(list).getByText('Kyungpook National University')).toBeInTheDocument();
    expect(within(list).queryByText('Pusan National University')).toBeNull();
  });

  it('never calls an application "reviewed" that a university is not reviewing', () => {
    renderUI(<HomeBody d={dashboard({ applications: [app('a1', 'WAITLISTED', 'Pusan National University')] as never })} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Nothing to do right now' })).toBeInTheDocument();
    expect(screen.queryByText(/being reviewed/)).toBeNull();
    expect(within(screen.getByRole('region', { name: 'What the university is doing' })).getByText('Waitlisted')).toBeInTheDocument();
  });

  it('does not point at a "next step above" when there is none, and has no university line for a closed application', () => {
    renderUI(<HomeBody d={dashboard({ applications: [app('a1', 'ENROLLED', 'Pusan National University')] as never })} />);
    expect(screen.queryByText(/Your next step is above/)).toBeNull();
    expect(screen.getByText(/Nothing is in progress on our side right now\. We'll tell you as soon as that changes\./)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'What the university is doing' })).toBeNull();
  });

  it('says plainly that nothing has been sent while every application is still being prepared', () => {
    renderUI(<HomeBody d={dashboard({ applications: [app('a1', 'READY', 'Pusan National University')] as never })} />);
    expect(within(screen.getByRole('region', { name: 'What the university is doing' })).getByText('Nothing has been sent to a university yet.')).toBeInTheDocument();
    expect(screen.getByText('Preparing your submission to Pusan National University')).toBeInTheDocument();
  });

  it('keeps the one primary action when there is something to do', () => {
    const d = dashboard({ next_action: { code: 'FINISH_APPLICATION', title: 'Finish', link: '/applications/a1', params: { university: 'Pusan National University', remaining: 2 } }, applications: [app('a1', 'DOCUMENT_PREPARATION', 'Pusan National University')] as never });
    const { container } = renderUI(<HomeBody d={d} />);
    expect(container.querySelector('.sp-home')).toHaveAttribute('data-state', 'action');
    expect(container.querySelectorAll('.hg-btn--primary')).toHaveLength(1);
    expect(screen.getByText('Your next step')).toBeInTheDocument();
  });

  it('names the university of the next step from the application itself, with the programme on its own line', () => {
    // The server sends the flat English "university · programme" label; the home re-reads the names from the
    // application (reader's language) and keeps the title to the university and the task.
    const d = dashboard({
      next_action: { code: 'APPLICATION_ITEM', title: 'Fix your academic transcript for Pusan National University · Business Administration (BBA)', link: '/applications/a1',
        params: { item: 'FIX', label: 'academic transcript', university: 'Pusan National University · Business Administration (BBA)', application_id: 'a1', category: 'TRANSCRIPT', remaining: 2, due_at: '2026-12-04' } },
      applications: [app('a1', 'DOCUMENT_PREPARATION', 'Pusan National University')] as never,
    });
    const { container } = renderUI(<HomeBody d={d} />);
    const title = screen.getByRole('heading', { level: 2, name: /academic transcript/ });
    expect(title.textContent).toContain('Pusan National University');
    expect(title.textContent).not.toContain('Business Administration');
    expect(container.querySelector('.sh-next__context')?.textContent).toBe('Business Administration (BBA) · Spring 2027');
  });

  it('never shows the internal organisation behind the team to the student', () => {
    renderUI(<HomeBody d={dashboard()} />);
    expect(screen.queryByText(/Hangyul Univ Operations/)).toBeNull();
  });
});
