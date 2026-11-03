import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import { setupI18n } from '../test/i18n';
import { KpiTile } from './Kpi';

beforeAll(() => setupI18n());

describe('KpiTile', () => {
  it('shows the value, sample size and an accessible definition', () => {
    render(<KpiTile label="Yield" value="80%" definition="Enrolled ÷ offered, for the selected cohort." sample={5} />);
    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(screen.getByText('n = 5')).toBeInTheDocument();
    const btn = screen.getByRole('button', { name: 'Definition of Yield' });
    expect(btn).toHaveAccessibleDescription('Enrolled ÷ offered, for the selected cohort.');
  });

  it('never renders a number when data is insufficient', () => {
    render(<KpiTile label="Visa conversion" value="100%" insufficient sample={4} />);
    expect(screen.queryByText('100%')).not.toBeInTheDocument();
    expect(screen.getByText('Not enough data yet')).toBeInTheDocument();
    expect(screen.getByText('Based on 4 records. Shown once there are 5.')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-tile')).toHaveClass('uc-kpi--insufficient');
  });

  it('links to the underlying list', () => {
    render(<MemoryRouter><KpiTile label="Applicants" value="9" to="/applicants" /></MemoryRouter>);
    expect(screen.getByRole('link', { name: /View list/ })).toHaveAttribute('href', '/applicants');
  });
});
