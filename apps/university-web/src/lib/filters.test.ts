import { applicantsLink, countActive, parseApplicantParams, parseFilters, writeApplicantParams, writeFilters } from './filters';

describe('analytics filter params', () => {
  it('parses valid filters and normalizes case', () => {
    const f = parseFilters(new URLSearchParams('intake=2027-spring&nationality=vn&degree=bachelor&program_id=006e2d62-d1f7-48aa-96a8-24ff9d53692a'));
    expect(f).toEqual({ intake: '2027-SPRING', nationality: 'VN', degree: 'BACHELOR', program_id: '006e2d62-d1f7-48aa-96a8-24ff9d53692a' });
    expect(countActive(f)).toBe(4);
  });

  it('drops malformed values instead of sending them to the API', () => {
    const f = parseFilters(new URLSearchParams('intake=spring&nationality=Vietnam&degree=PHD&agency_id=<script>&program_id='));
    expect(f).toEqual({});
    expect(countActive(f)).toBe(0);
  });

  it('writes filters while preserving unrelated params', () => {
    const next = writeFilters(new URLSearchParams('tab=risk&nationality=CN'), { intake: '2027-SPRING' });
    expect(next.get('tab')).toBe('risk');
    expect(next.get('intake')).toBe('2027-SPRING');
    expect(next.has('nationality')).toBe(false);
  });

  it('round-trips through the URL', () => {
    const f = { intake: '2026-FALL', agency_id: '3a770450-794e-431c-ac3b-98d0a4778c8f' };
    expect(parseFilters(writeFilters(new URLSearchParams(), f))).toEqual(f);
  });
});

describe('applicant list params', () => {
  it('defaults sensibly', () => {
    expect(parseApplicantParams(new URLSearchParams())).toEqual({
      status: [], program_id: undefined, nationality: undefined, agency_id: undefined, flagged: undefined, q: undefined, sort: 'decision', page: 1, page_size: 20, // V26: decision-first is the default (REPORT §336 U2)
    });
  });

  it('accepts repeated and comma-separated statuses, dedupes and ignores unknown ones', () => {
    const p = parseApplicantParams(new URLSearchParams('status=OFFERED&status=interview,OFFERED,BOGUS&flagged=true&sort=readiness&page=3&page_size=50'));
    expect(p.status).toEqual(['OFFERED', 'INTERVIEW']);
    expect(p.flagged).toBe(true);
    expect(p.sort).toBe('readiness');
    expect(p.page).toBe(3);
    expect(p.page_size).toBe(50);
  });

  it('rejects invalid sort, page and page size', () => {
    const p = parseApplicantParams(new URLSearchParams('sort=name&page=-4&page_size=7'));
    expect(p.sort).toBe('decision');
    expect(p.page).toBe(1);
    expect(p.page_size).toBe(20);
  });

  it('builds drill-down links that parse back to the same filters', () => {
    const link = applicantsLink({ status: ['ADDITIONAL_DOCUMENTS'], nationality: 'VN', flagged: true });
    expect(link.startsWith('/applicants?')).toBe(true);
    const p = parseApplicantParams(new URLSearchParams(link.split('?')[1]));
    expect(p.status).toEqual(['ADDITIONAL_DOCUMENTS']);
    expect(p.nationality).toBe('VN');
    expect(p.flagged).toBe(true);
    expect(applicantsLink({})).toBe('/applicants');
    // The default sort is omitted from the URL and any other sort is written — both directions, so a changed default shows up here.
    expect(writeApplicantParams({ page: 1, sort: 'decision', page_size: 20 }).toString()).toBe('');
    expect(writeApplicantParams({ page: 1, sort: 'submitted', page_size: 20 }).toString()).toBe('sort=submitted');
  });
});
