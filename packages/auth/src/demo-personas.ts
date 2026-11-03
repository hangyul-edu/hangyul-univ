/** Development-only Demo access personas. Never import this statically from product code (see packages/ui/src/devaccess.tsx). */
export type DemoProduct = 'student' | 'agency' | 'university';
export interface DemoPersona { email: string; product: DemoProduct; group: 'student' | 'agency' | 'university' | 'hangyul'; name: string; role: string; context: string }

/**
 * Personas offered by the development-only "Demo access" picker. Sign-in goes through `/auth/demo-login`,
 * which the API only serves outside production and only for seeded demo accounts — no password is shown.
 */
export const DEMO_PERSONAS: readonly DemoPersona[] = [
  { group: 'student', product: 'student', email: 'student.new@demo.hangyul.kr', name: 'Dilnoza Karimova', role: 'Exploring', context: 'Uzbekistan · first look at Korea, TOPIK 2' },
  { group: 'student', product: 'student', email: 'student@demo.hangyul.kr', name: 'Nguyễn Thị Lan', role: 'Preparing applications', context: 'Vietnam · 3 applications, documents in progress' },
  { group: 'student', product: 'student', email: 'student.nepal@demo.hangyul.kr', name: 'Aarati Shrestha', role: 'Ready to submit', context: 'Nepal · application package complete' },
  { group: 'student', product: 'student', email: 'student.authorize@demo.hangyul.kr', name: 'Võ Thanh Tâm', role: 'Authorize agency submission', context: 'Vietnam · development fixture, consent before an agency submits' },
  { group: 'student', product: 'student', email: 'student.offer@demo.hangyul.kr', name: 'Bùi Thu Hà', role: 'Offer received', context: 'Vietnam · two offers to compare' },
  { group: 'student', product: 'student', email: 'student.visa@demo.hangyul.kr', name: 'Võ Quốc Bảo', role: 'Visa preparation', context: 'Vietnam · admitted, preparing D-2 documents' },
  { group: 'student', product: 'student', email: 'student.myanmar@demo.hangyul.kr', name: 'Hnin Wai Phyo', role: 'Visa preparation (Burmese)', context: 'Myanmar · app in Burmese' },
  { group: 'student', product: 'student', email: 'student.arrival@demo.hangyul.kr', name: 'Phạm Gia Huy', role: 'Visa issued', context: 'Vietnam · flight added, pickup requested' },
  { group: 'student', product: 'student', email: 'student.arrived@demo.hangyul.kr', name: 'Lê Thảo Vy', role: 'Arrived in Korea', context: 'Vietnam · residence card next' },
  // V22: one permission per tenant — every Lotus Bridge account is an administrator with identical access (REPORT §246).
  { group: 'agency', product: 'agency', email: 'counselor@lotus.demo.hangyul.kr', name: 'Trương Mỹ Linh', role: 'Administrator 1', context: 'Lotus Bridge Education' },
  { group: 'agency', product: 'agency', email: 'manager@lotus.demo.hangyul.kr', name: 'Đinh Thị Hoa', role: 'Administrator 2', context: 'Lotus Bridge Education · same permissions' },
  { group: 'agency', product: 'agency', email: 'reviewer@lotus.demo.hangyul.kr', name: 'Lotus Bridge administrator', role: 'Administrator 3', context: 'Lotus Bridge Education · same permissions' },
  { group: 'agency', product: 'agency', email: 'writing@demo.hangyul.kr', name: 'Yoo Ha-neul', role: 'Writing reviewer', context: 'Personal statements and study plans' },
  // V22: every university account is an administrator of its assigned university (REPORT §247).
  { group: 'university', product: 'university', email: 'admin@pusan.univ.demo.hangyul.kr', name: 'Moon Ji-young', role: 'Administrator 1', context: 'Pusan National University' },
  { group: 'university', product: 'university', email: 'admissions@pusan.univ.demo.hangyul.kr', name: 'Yang Hyun-woo', role: 'Administrator 2', context: 'Pusan National University · same permissions' },
  { group: 'university', product: 'university', email: 'admin@sungkyunkwan.univ.demo.hangyul.kr', name: 'SKKU administrator', role: 'Administrator', context: 'Sungkyunkwan University · a different tenant' },
  { group: 'hangyul', product: 'agency', email: 'ops@demo.hangyul.kr', name: 'Park Ji-ho', role: 'Operations', context: 'Hangyul · all agencies and services' },
  { group: 'hangyul', product: 'agency', email: 'admin@demo.hangyul.kr', name: 'Hangyul admin', role: 'Admin', context: 'Hangyul · full access' },
  { group: 'hangyul', product: 'agency', email: 'finance@demo.hangyul.kr', name: 'Hangyul finance', role: 'Finance', context: 'Hangyul · payments and partnerships' },
];

/**
 * What the **테스트 계정으로 로그인** button on each product's login page offers (V23, REPORT §268 P7).
 *
 * The first entry is the one-click default, chosen for what its landing screen demonstrates. The rest sit behind
 * "다른 테스트 계정 선택" and are capped at four: each is a *state* a reviewer genuinely needs to see, not a list of
 * every seeded row. V22 made agency and university tenants one-role, so the console extras are not "other roles" —
 * they are Hangyul's own operations view (agency) and a second university (university, to see tenant isolation).
 *
 * Labels are inline (ko + en; other languages fall back to English) because this module is dropped from production
 * builds together with the emails — see packages/ui/src/test-access.tsx.
 */
export interface TestAccount { email: string; ko: string; en: string }
export const TEST_ACCOUNTS: Record<DemoProduct, TestAccount[]> = {
  student: [
    { email: 'student@demo.hangyul.kr', ko: '지원 준비 중인 학생', en: 'Student preparing applications' },
    { email: 'student.new@demo.hangyul.kr', ko: '처음 둘러보는 학생', en: 'Student exploring for the first time' },
    { email: 'student.offer@demo.hangyul.kr', ko: '합격 통보를 받은 학생', en: 'Student with offers' },
    { email: 'student.visa@demo.hangyul.kr', ko: '비자를 준비하는 학생', en: 'Student preparing a visa' },
    { email: 'student.arrived@demo.hangyul.kr', ko: '한국에 도착한 학생', en: 'Student who has arrived in Korea' },
  ],
  agency: [
    { email: 'counselor@lotus.demo.hangyul.kr', ko: '에이전시 관리자', en: 'Agency administrator' },
    { email: 'ops@demo.hangyul.kr', ko: '한귤 운영팀', en: 'Hangyul operations' },
  ],
  university: [
    { email: 'admin@pusan.univ.demo.hangyul.kr', ko: '대학 관리자 (부산대학교)', en: 'University administrator (Pusan National University)' },
    { email: 'admin@sungkyunkwan.univ.demo.hangyul.kr', ko: '다른 대학 관리자 (성균관대학교)', en: 'Another university (Sungkyunkwan University)' },
  ],
};

/** @deprecated V16 name, kept for callers that still import it. */
export const CONSOLE_TEST_ROLES: Record<Exclude<DemoProduct, 'student'>, { email: string; labelKey: string }[]> = {
  agency: TEST_ACCOUNTS.agency.map((a) => ({ email: a.email, labelKey: 'role.AGENCY_ADMIN' })),
  university: TEST_ACCOUNTS.university.map((a) => ({ email: a.email, labelKey: 'role.UNIVERSITY_ADMIN' })),
};
