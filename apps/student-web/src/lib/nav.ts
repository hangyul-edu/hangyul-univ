import type { JourneyStage } from '@hangyul/types';

/**
 * V11 student navigation (REPORT §76).
 *
 * V8 gave the rail five slots that **changed with the journey stage**: Compare appeared while exploring,
 * Documents while applying, Visa after an offer, Arrival and Housing after that. Nothing was ever unreachable,
 * but the student had to re-learn where things were three times on the way to Korea, and the rail could not be
 * used as a fixed landmark. That is the "I must learn their modules" problem the brief names.
 *
 * V11 makes the rail **constant**: four destinations plus the menu, the same four on the first day and the day
 * they land. They map one-to-one onto the four questions a student actually has —
 *
 *   home          "What should I do now?"
 *   universities  "Where can I study?"
 *   applications  "How is my application going?"
 *   messages      "Can I ask someone?"
 *
 * Everything that used to rotate through the rail is reached from the work that needs it: documents and essays
 * from the application they belong to, visa/housing/arrival from the journey once they are real, tasks from the
 * home screen (which *is* the task list), comparison and saved universities from inside Universities.
 */
export type NavStage = 'explore' | 'apply' | 'admitted' | 'arrival';
export type NavSlot = 'home' | 'universities' | 'applications' | 'messages';

export function navStage(stage: JourneyStage | undefined, visaStatus?: string | null): NavStage {
  if (!stage) return 'apply';
  if (stage === 'ARRIVAL' || stage === 'STUDENT_LIFE' || visaStatus === 'ISSUED') return 'arrival';
  if (stage === 'ENROLL' || stage === 'VISA') return 'admitted';
  if (stage === 'APPLY' || stage === 'DECISION') return 'apply';
  return 'explore';
}

/** The rail. Not a function of stage any more — that is the point. */
export const NAV_SLOTS: NavSlot[] = ['home', 'universities', 'applications', 'messages'];

export const SLOT_PATH: Record<NavSlot, string> = {
  home: '/', universities: '/explore', applications: '/applications', messages: '/messages',
};

/**
 * `navStage` still decides what the **menu** offers: the Korea group (visa, housing, arrival) is only shown
 * once those steps can actually be acted on. Showing a student a Housing page before they have an offer is a
 * menu item that can only disappoint.
 */
export const KOREA_STAGES: NavStage[] = ['admitted', 'arrival'];

/**
 * V22 (REPORT §248 S4): three destinations stop being pages. Their routes stay so nothing 404s:
 *
 *   /tasks          → /?show=tasks          the home reveals the full task list
 *   /budget         → /compare#budget        budget is a section of Compare; `?programs=` carries over as `?ids=`
 *   /notifications  stays a page, but leaves the menu — the bell is the entry point
 */
export const TASKS_REDIRECT = '/?show=tasks';

export function budgetRedirect(search: string): string {
  const sp = new URLSearchParams(search);
  const ids = (sp.get('programs') ?? sp.get('ids') ?? '').split(',').filter(Boolean);
  return `/compare${ids.length ? `?ids=${ids.join(',')}` : ''}#budget`;
}
