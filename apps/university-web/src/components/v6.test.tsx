import { renderHook, render, screen } from '@testing-library/react';

import { SERIES } from '../lib/palette';
import { setupI18n } from '../test/i18n';
import { Provenance } from './common';
import { Fact, useRateFact } from './Preparation';

beforeAll(() => setupI18n());

describe('V6 university console', () => {
  it('withholds a rate below the minimum sample and always states n', () => {
    const { result } = renderHook(() => useRateFact());
    const low = result.current({ value: 1, numerator: 3, denominator: 3 }, 'applications');
    expect(low.withheld).toBe(true);
    expect(low.value).toBe('Too few to rate');
    expect(low.context).toBe('3 of 3 applications');
    const ok = result.current({ value: 0.8182, numerator: 9, denominator: 11 }, 'applications');
    expect(ok.withheld).toBe(false);
    expect(ok.value).toBe('82%');
  });

  it('renders a fact as label, value and population', () => {
    render(<dl><Fact label="Complete on first review" value="82%" context="9 of 11 applications" /></dl>);
    expect(screen.getByText('Complete on first review').tagName).toBe('DT');
    expect(screen.getByText('9 of 11 applications')).toBeInTheDocument();
  });

  it('shows no per-row development label for seeded rows', () => {
    const { container } = render(<Provenance data={{ verification_status: 'DEMO' }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('never uses tangerine in console chart series', () => {
    SERIES.forEach((c) => expect(c.toUpperCase()).not.toMatch(/^#(FF6700|CC4E00|FF5000)$/));
  });
});
