import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import { setupI18n } from '../test/i18n';
import { LifecycleFunnel } from './LifecycleFunnel';

beforeAll(() => setupI18n());

const FUNNEL = [
  { stage: 'INTERESTED', count: 13 }, { stage: 'PREPARING', count: 2 }, { stage: 'APPLIED', count: 9 }, { stage: 'ADMITTED', count: 5 },
  { stage: 'TUITION_PAID', count: 4 }, { stage: 'VISA_ISSUED', count: 4 }, { stage: 'ARRIVED', count: 9 }, { stage: 'ENROLLED', count: 43 },
  { stage: 'RETAINED', count: 36 }, { stage: 'GRADUATED', count: 27 },
];

describe('LifecycleFunnel', () => {
  it('explains that preparing students are aggregate-only and not linkable', () => {
    render(<MemoryRouter><LifecycleFunnel funnel={FUNNEL} /></MemoryRouter>);
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(10);
    const preparing = rows[1];
    expect(within(preparing).getByText(/[Ii]dentities stay hidden until the student submits/)).toBeInTheDocument();
    expect(within(preparing).queryByRole('link')).not.toBeInTheDocument();
  });

  it('links stages to filtered lists with the active filters', () => {
    render(<MemoryRouter><LifecycleFunnel funnel={FUNNEL} extraParams={{ nationality: 'VN' }} /></MemoryRouter>);
    const visa = screen.getByRole('link', { name: 'Visa issued' });
    expect(visa.getAttribute('href')).toBe('/applicants?status=VISA_ISSUED&status=ENROLLED&nationality=VN');
    expect(screen.getByRole('link', { name: 'Graduated' })).toHaveAttribute('href', '/graduation');
  });

  it('shows conversion only where it is meaningful', () => {
    render(<MemoryRouter><LifecycleFunnel funnel={FUNNEL} /></MemoryRouter>);
    const rows = screen.getAllByRole('listitem');
    expect(within(rows[3]).getByText('56%')).toBeInTheDocument(); // 5 of 9 admitted
    expect(within(rows[6]).getByText('incl. earlier cohorts')).toBeInTheDocument(); // arrived 9 > visa 4
  });
});
