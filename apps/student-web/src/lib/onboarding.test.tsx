import type { ApiClient } from '@hangyul/api-client';
import type { StudentProfile } from '@hangyul/types';
import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { StepView } from '../components/ProfileSteps';
import { renderUI } from '../test/utils';
import { normalizeGpa, taskBucket, wordCount } from './format';
import { draftFromProfile, gpaPreview, langError, patchForStep, saveStep, stepValid, type Draft } from './onboarding';

const baseProfile = {
  id: 'p1', nationality: 'VN', residence_country: 'VN', date_of_birth: '1998-07-21', gender: null, has_passport: true, passport_number_masked: '••••512',
  passport_expiry: '2031-09-01', target_degree: 'BACHELOR', target_intake_year: 2027, target_intake_term: 'SPRING', desired_fields: ['business'],
  preferred_regions: ['Seoul'], preferred_university_ids: [], annual_budget_krw: 24_000_000, needs_scholarship: true, housing_preference: 'DORM',
  korean_self_level: 'INTERMEDIATE', english_self_level: 'ADVANCED', previous_korean_visa: null, current_korean_visa: null, in_korea_now: false,
  financial_sponsor: 'PARENTS', academic_priorities: [], career_goal: 'Marketing', onboarding_step: 7, onboarding_completed: true, pipeline_stage: 'READY_TO_APPLY',
  educations: [{ id: 'e1', level: 'HIGH_SCHOOL', institution: 'Hai Phong HS', country: 'VN', major: null, start_year: null, graduation_year: 2025, graduation_status: 'GRADUATED', gpa_value: 8.4, gpa_scale_min: 0, gpa_scale_max: 10, gpa_percent: 84, gpa_override_note: null }],
  languages: [{ id: 'l1', test: 'TOPIK', score: 4, test_date: '2026-04-12', expires_on: null, is_planned: false, verified: true }],
  is_demo: true,
} as StudentProfile;

describe('onboarding draft logic', () => {
  it('builds a draft from an existing profile so students resume where they left off', () => {
    const d = draftFromProfile(baseProfile);
    expect(d.nationality).toBe('VN');
    expect(d.edu).toMatchObject({ id: 'e1', gpa_value: '8.4', gpa_scale_max: '10', level: 'HIGH_SCHOOL' });
    expect(d.langs.TOPIK).toMatchObject({ selected: true, score: '4', planned: false, id: 'l1' });
    expect(d.langs.IELTS.selected).toBe(false);
  });

  it('sends only the fields that belong to each step, and never an empty passport number', () => {
    const d = draftFromProfile(baseProfile);
    expect(patchForStep('goals', d)).toEqual({ target_degree: 'BACHELOR', desired_fields: ['business'], target_intake_year: 2027, target_intake_term: 'SPRING' });
    expect(patchForStep('passport', d)).not.toHaveProperty('passport_number');
    expect(patchForStep('passport', { ...d, passport_number: ' C123 ' })).toHaveProperty('passport_number', 'C123');
    expect(patchForStep('passport', { ...d, in_korea_now: false, current_korean_visa: 'D-4' }).current_korean_visa).toBeNull();
  });

  it('only blocks progress on the minimum required answers', () => {
    const empty = draftFromProfile(null);
    expect(stepValid('basics', empty)).toBe(false);
    expect(stepValid('basics', { ...empty, nationality: 'NP', residence_country: 'NP' })).toBe(true);
    expect(stepValid('preferences', empty)).toBe(true);
    const tooHigh: Draft = { ...empty, edu: { ...empty.edu, level: 'BACHELOR', gpa_value: '4.8', gpa_scale_max: '4.5' } };
    expect(stepValid('education', tooHigh)).toBe(false);
  });

  it('validates test score ranges but accepts "planning to take"', () => {
    expect(langError('TOPIK', { selected: true, score: '7', planned: false })).toBe('validation.scoreRange');
    expect(langError('IELTS', { selected: true, score: '6.5', planned: false })).toBeNull();
    expect(langError('TOEFL_IBT', { selected: true, score: '', planned: true })).toBeNull();
  });

  it('normalizes GPA the same way as the server', () => {
    expect(normalizeGpa(8.4, 0, 10)).toBe(84);
    expect(normalizeGpa(3.2, 0, 4.5)).toBe(71.1);
    expect(normalizeGpa(5, 0, 4)).toBe(100);
    expect(gpaPreview({ level: 'HIGH_SCHOOL', institution: '', country: '', major: '', graduation_status: '', graduation_year: '', gpa_value: '8,4', gpa_scale_max: '10' })).toBe(84);
  });

  it('replaces a changed language score and leaves unchanged ones alone', async () => {
    const api = {
      me: {
        deleteLanguage: vi.fn().mockResolvedValue(undefined),
        addLanguage: vi.fn().mockResolvedValue({ id: 'new' }),
        updateProfile: vi.fn().mockResolvedValue(baseProfile),
      },
    } as unknown as ApiClient;
    const d = draftFromProfile(baseProfile);
    d.langs.TOPIK.score = '5';
    d.langs.IELTS = { selected: true, score: '', planned: true };
    await saveStep(api, 'language', d, baseProfile, { onboarding_step: 4 });
    expect(api.me.deleteLanguage).toHaveBeenCalledWith('l1');
    expect(api.me.addLanguage).toHaveBeenCalledWith({ test: 'TOPIK', score: 5, is_planned: false });
    expect(api.me.addLanguage).toHaveBeenCalledWith({ test: 'IELTS', score: 0, is_planned: true });
    expect(api.me.updateProfile).toHaveBeenCalledWith(expect.objectContaining({ korean_self_level: 'INTERMEDIATE', onboarding_step: 4 }));
  });
});

describe('education step', () => {
  it('shows a live normalized GPA preview with the methodology note', () => {
    renderUI(<StepView step="education" draft={draftFromProfile(baseProfile)} set={() => undefined} countries={[]} fields={[]} regions={[]} />);
    expect(screen.getByText('8.4 / 10 → 84%')).toBeInTheDocument();
    expect(screen.getByText(/simple linear scale/)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'High school' })).toHaveAttribute('aria-checked', 'true');
  });
});

describe('small helpers', () => {
  it('groups tasks into overdue / this week / later', () => {
    const now = new Date('2026-09-27T12:00:00Z');
    expect(taskBucket('2026-09-20T00:00:00Z', now)).toBe('overdue');
    expect(taskBucket('2026-10-01T00:00:00Z', now)).toBe('week');
    expect(taskBucket('2026-11-01T00:00:00Z', now)).toBe('later');
    expect(taskBucket(null, now)).toBe('later');
  });
  it('counts words like a person would', () => {
    expect(wordCount('  Hello   Korea\nagain ')).toBe(3);
    expect(wordCount('')).toBe(0);
  });
});
