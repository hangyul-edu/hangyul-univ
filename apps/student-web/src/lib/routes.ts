/**
 * V9 S1 — "Routes, not a dead end". Shape of `routes` returned by the quick check (`POST /public/quick-eligibility`),
 * `GET /me/matches` and the early home (`GET /me/dashboard`). Counts come from published requirements through the
 * matching engine; nothing here is an offer or a prediction.
 */
export interface RouteStep { kind: 'TOPIK' | 'IELTS'; level: number; count: number }
export interface RouteProgram { program_id: string; program_name: string; university_name: string; university_slug: string; city: string; tuition_per_term: number | null }
export interface LanguageRoutes {
  blocked_count: number;
  open_now: number;
  degree: string;
  not_an_offer: true;
  engine_version: string;
  smallest_step: RouteStep | null;
  steps: RouteStep[];
  korean_first: null | {
    count: number;
    term_semesters: number | null;
    term_semesters_range: [number, number] | null;
    tuition_per_term_min: number | null;
    tuition_per_term_max: number | null;
    year_cost_min: number | null;
    year_cost_max: number | null;
    year_cost_basis: 'SAMPLE' | 'ESTIMATE';
    visa_from: 'D-4-1';
    visa_to: 'D-2';
    opens_at: RouteStep | null;
    programs: RouteProgram[];
  };
  english: null | {
    count: number;
    ielts_from: number | null;
    toefl_from: number | null;
    by_level: { ielts: number | null; toefl_ibt: number | null; count: number }[];
  };
}

/** Explore links that list exactly the programs a route counts. */
export function routeLinks(degree: string): { korean: string; english: string } {
  return {
    korean: '/explore?tab=all&degree=LANGUAGE&open_only=1',
    english: `/explore?tab=all&degree=${encodeURIComponent(degree)}&language=ENGLISH&open_only=1`,
  };
}

/** Which route leads: a Korean language program when one accepts the student now, else the smallest test step. */
export function leadRoute(r: LanguageRoutes): 'korean' | 'english' | 'step' {
  if (r.korean_first && r.korean_first.count > 0) return 'korean';
  if (r.english && r.english.count > 0) return 'english';
  return 'step';
}
