import type * as T from '@hangyul/types';

/**
 * Typed Hangyul Univ API client (web + React Native).
 * - Access token lives in memory only.
 * - Web: refresh token is an httpOnly cookie scoped to /api/v1/auth (tokenStore omitted).
 * - Mobile: refresh token is kept in the OS keychain via a TokenStore (expo-secure-store).
 * - A 401 triggers exactly one refresh attempt; concurrent requests share it.
 */

export interface TokenStore {
  getRefreshToken(): Promise<string | null>;
  setRefreshToken(token: string | null): Promise<void>;
}

export class ApiError extends Error {
  /**
   * V32: the service itself could not be reached — a network failure, our own timeout, a gateway answer (502/503/504)
   * or a non-JSON error page where the API should be (a host with no API behind `/api/*`). Distinct from a 4xx the
   * API answered on purpose, so the apps can show "we're getting the service ready" instead of a raw transport message.
   */
  constructor(public status: number, message: string, public body?: unknown, public unreachable = false) {
    super(message);
    this.name = 'ApiError';
  }
  get isAuth() { return this.status === 401; }
  get isForbidden() { return this.status === 403; }
  get isNotFound() { return this.status === 404; }
}

type Query = Record<string, string | number | boolean | null | undefined | (string | number)[]>;

/** V22 accounts (server api/v1/accounts.py `_account`). */
export interface AccountRow {
  user_id: string; full_name: string; email: string; active: boolean; last_login_at: string | null; email_verified: boolean; invited_at: string | null;
  role: 'AGENCY_ADMIN' | 'UNIVERSITY_ADMIN';
}
export interface AgencyAccountsResponse { organization: { id: string; name: string }; role: 'AGENCY_ADMIN'; accounts: AccountRow[] }
export interface AccountInviteResponse {
  account: AccountRow; organization: { id: string; name: string };
  /** `delivery` is `console` in development (the code is printed, not mailed), `failed` when the mail provider refused. */
  invite: { challenge_id: string | null; delivery: string; expires_in?: number };
}
export interface UniversityAccount extends AccountRow {
  organization: { id: string; name: string };
  university: { id: string; slug: string; name_en: string; name_ko: string } | null;
}
interface RequestOptions { method?: string; query?: Query; body?: unknown; form?: FormData; signal?: AbortSignal; raw?: boolean; timeoutMs?: number; headers?: Record<string, string> }

/**
 * **How long a request may hang before it is treated as failed** (V19, REPORT §207).
 *
 * `fetch` has no timeout. A connection that opens and then stalls — a phone moving between cells, a proxy
 * that accepts and never answers — leaves the promise pending for as long as the OS keeps the socket, so
 * react-query never leaves `isPending` and the screen shows skeletons forever. The V19 error matrix found
 * exactly that on every page's `timeout` row: eight skeletons still animating after nine seconds, no error,
 * no retry, nothing for the reader to do. "No infinite spinner" is in the brief's zero-acceptance list and
 * this was the one way to produce one.
 *
 * A timeout surfaces as `ApiError(408)`, which is the real status for it: the retry policy in
 * `bootWebApp` only retries 5xx, so a stalled request fails once and shows the page's own error state with
 * its retry button rather than stacking three more 20-second waits behind it.
 *
 * Uploads get far longer. A passport scan on a slow connection legitimately takes more than 20 seconds, and
 * cancelling one at the default would be a worse bug than the one being fixed.
 */
const TIMEOUT_MS = 20_000;
const UPLOAD_TIMEOUT_MS = 180_000;

/**
 * One signal that aborts on either the caller's signal or the deadline, without needing `AbortSignal.any`
 * — which Hermes does not ship, and this client runs in the native app too.
 */
function deadline(caller: AbortSignal | undefined, ms: number) {
  const ctrl = new AbortController();
  const state = { timedOut: false };
  const timer = setTimeout(() => { state.timedOut = true; ctrl.abort(); }, ms);
  const onAbort = () => ctrl.abort();
  if (caller) {
    if (caller.aborted) onAbort();
    else caller.addEventListener('abort', onAbort, { once: true });
  }
  return {
    signal: ctrl.signal,
    get timedOut() { return state.timedOut; },
    release() {
      clearTimeout(timer);
      caller?.removeEventListener('abort', onAbort);
    },
  };
}

export interface ApiClientConfig {
  baseUrl: string; // '' for same-origin (Vite proxy) or 'http://10.0.2.2:8001' on Android emulator
  client: T.ClientApp;
  tokenStore?: TokenStore;
  onSessionChange?: (session: T.Session | null) => void;
  fetchImpl?: typeof fetch;
  /** V29: the current UI language, sent as Accept-Language so server-resolved names follow the interface. */
  getLocale?: () => string | undefined;
}

function qs(query?: Query): string {
  if (!query) return '';
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === '' || v === false) continue;
    if (Array.isArray(v)) v.forEach((x) => p.append(k, String(x)));
    else p.append(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

export function createApiClient(cfg: ApiClientConfig) {
  let accessToken: string | null = null;
  let session: T.Session | null = null;
  let refreshing: Promise<boolean> | null = null;
  const f = cfg.fetchImpl ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const base = `${cfg.baseUrl.replace(/\/$/, '')}/api/v1`;

  const setSession = async (tr: T.TokenResponse | null) => {
    accessToken = tr?.access_token ?? null;
    session = tr ? { user: tr.user, roles: tr.roles, memberships: tr.memberships, active_org: tr.active_org } : null;
    if (cfg.tokenStore) await cfg.tokenStore.setRefreshToken(tr?.refresh_token ?? null);
    cfg.onSessionChange?.(session);
  };

  async function parse(res: Response) {
    if (res.status === 204) return undefined;
    const ct = res.headers.get('content-type') ?? '';
    return ct.includes('application/json') ? res.json() : res.text();
  }

  // V32: whether the last session restore failed because the service could not be reached (not because the visitor
  // simply has no session). The auth provider reads it to show the service-unavailable state instead of the login page.
  let unavailable = false;

  async function refresh(): Promise<boolean> {
    if (!refreshing) {
      refreshing = (async () => {
        try {
          const refresh_token = cfg.tokenStore ? await cfg.tokenStore.getRefreshToken() : undefined;
          if (cfg.tokenStore && !refresh_token) { unavailable = false; return false; }
          const res = await f(`${base}/auth/refresh`, {
            method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ client: cfg.client, refresh_token }),
          });
          if (!res.ok || res.status === 204) {
            unavailable = res.status !== 204 && res.status !== 401 && isUnreachable(res, await parse(res).catch(() => undefined));
            await setSession(null);
            return false;
          }
          unavailable = false;
          await setSession((await res.json()) as T.TokenResponse);
          return true;
        } catch {
          unavailable = true;
          return false;
        } finally {
          setTimeout(() => { refreshing = null; }, 0);
        }
      })();
    }
    return refreshing;
  }

  /** A gateway answer, or an error page that is not the API's JSON, where the API should be. */
  function isUnreachable(res: Response, data: unknown): boolean {
    if (res.status === 502 || res.status === 503 || res.status === 504) return true;
    const json = (res.headers.get('content-type') ?? '').includes('application/json');
    return !json && (res.status === 404 || res.status === 405 || res.status >= 500) && typeof data !== 'object';
  }

  async function request<R>(path: string, opts: RequestOptions = {}, retried = false): Promise<R> {
    const headers: Record<string, string> = { ...(opts.headers ?? {}) };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    // V29: the UI language, not the browser's — the API resolves university names for the reader (app/core/localnames.py).
    const lng = cfg.getLocale?.();
    if (lng && !headers['Accept-Language']) headers['Accept-Language'] = lng;
    let body: BodyInit | undefined;
    if (opts.form) body = opts.form;
    else if (opts.body !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(opts.body); }
    const limit = opts.timeoutMs ?? (opts.form ? UPLOAD_TIMEOUT_MS : TIMEOUT_MS);
    const dl = deadline(opts.signal, limit);
    let res: Response;
    try {
      res = await f(`${base}${path}${qs(opts.query)}`, { method: opts.method ?? 'GET', headers, body, credentials: 'include', signal: dl.signal });
    } catch (e) {
      // Only our own deadline becomes a 408. A caller that aborted (a component unmounting, a superseded
      // search) must keep throwing its AbortError, or react-query would record a cancelled query as failed.
      if (dl.timedOut) throw new ApiError(408, `Request timed out after ${Math.round(limit / 1000)}s`, undefined, true);
      if (e instanceof TypeError) throw new ApiError(0, 'Service unreachable', undefined, true);
      throw e;
    } finally {
      dl.release();
    }
    if (res.status === 401 && !retried && !path.startsWith('/auth/login')) {
      if (await refresh()) return request<R>(path, opts, true);
    }
    if (!res.ok) {
      const data = await parse(res).catch(() => undefined);
      const detail = (data as { detail?: unknown })?.detail;
      const msg = typeof detail === 'string' ? detail : Array.isArray(detail) ? detail.map((d: { msg?: string }) => d.msg).join(', ') : res.statusText;
      throw new ApiError(res.status, msg || `Request failed (${res.status})`, data, isUnreachable(res, data));
    }
    if (opts.raw) return res as unknown as R;
    return (await parse(res)) as R;
  }

  const get = <R>(path: string, query?: Query, signal?: AbortSignal) => request<R>(path, { query, signal });
  const post = <R>(path: string, body?: unknown, query?: Query) => request<R>(path, { method: 'POST', body, query });
  const put = <R>(path: string, body?: unknown) => request<R>(path, { method: 'PUT', body });
  const patch = <R>(path: string, body?: unknown) => request<R>(path, { method: 'PATCH', body });
  const del = <R>(path: string) => request<R>(path, { method: 'DELETE' });

  return {
    config: cfg,
    get session() { return session; },
    /** V32: the last session restore failed because the service was unreachable. */
    get unavailable() { return unavailable; },
    get isAuthenticated() { return !!accessToken; },
    request, get, post, put, patch, del,

    auth: {
      async login(email: string, password: string, org_id?: string) {
        const tr = await post<T.TokenResponse>('/auth/login', { email, password, client: cfg.client, org_id });
        await setSession(tr);
        return tr;
      },
      // ---------------- V22 identity & registration (REPORT §244, §253)
      signupConfig: () => get<T.SignupConfig>('/auth/signup/config'),
      signupSession: (captcha_token: string | null, locale: string) => post<{ signup_session: string; expires_in: number }>('/auth/signup/session', { captcha_token, locale }),
      sendCode: (signup_session: string | null, body: { channel: 'EMAIL' | 'SMS'; target: string; phone_country?: string | null; purpose?: 'SIGNUP' | 'CONTACT'; locale: string }) =>
        request<T.VerificationSent>('/auth/verification/send', { method: 'POST', body, headers: signup_session ? { 'X-Signup-Session': signup_session } : {} }),
      verifyCode: (challenge_id: string, code: string) => post<T.VerificationVerified>('/auth/verification/verify', { challenge_id, code }),
      forgotPassword: (email: string, locale: string) => post<{ accepted: boolean; challenge_id?: string }>('/auth/forgot-password', { email, locale }),
      resetPassword: (body: { challenge_id: string; code: string; new_password: string; new_password_confirm: string }) => post<{ ok: boolean }>('/auth/reset-password', body),
      changeEmail: (email: string, proof: string) => post<{ email: string; email_verified: boolean }>('/auth/contact/email', { email, proof }),
      changePhone: (phone: string, phone_country: string | null, proof: string) => post<{ phone: string; phone_verified: boolean }>('/auth/contact/phone', { phone, phone_country, proof }),
      async register(body: T.RegisterBody, signup_session: string) {
        const tr = await request<T.TokenResponse>('/auth/register', { method: 'POST', body, headers: { 'X-Signup-Session': signup_session } });
        await setSession(tr);
        return tr;
      },
      async logout() {
        const refresh_token = cfg.tokenStore ? await cfg.tokenStore.getRefreshToken() : undefined;
        await post('/auth/logout', { client: cfg.client, refresh_token }).catch(() => undefined);
        await setSession(null);
      },
      restore: refresh,
      me: () => get<T.Session>('/auth/me'),
      async switchOrg(org_id: string) {
        const tr = await post<T.TokenResponse>('/auth/switch-org', { org_id, client: cfg.client });
        await setSession(tr);
        return tr;
      },
    },

    meta: {
      countries: (q?: string, priority_only?: boolean) => get<T.Country[]>('/meta/countries', { q, priority_only }),
      locales: () => get<T.LocaleInfo[]>('/meta/locales'),
      taxonomy: () => get<{ fields: string[]; regions: string[] }>('/meta/taxonomy'),
      fx: () => get<T.FxTable>('/meta/fx'),
    },

    catalog: {
      programs: (query: Query) => get<T.Page<T.Program>>('/programs', query),
      program: (id: string) => get<T.Program>(`/programs/${id}`),
      universities: (query: Query) => get<T.Page<T.UniversityCard>>('/universities', query),
      university: (slug: string) => get<T.UniversityDetail>(`/universities/${slug}`),
      scholarships: (query?: Query) => get<T.Scholarship[]>('/scholarships', query),
      compare: (program_ids: string[]) => post<CompareRow[]>('/compare', { program_ids }),
      content: (locale: string, content_type?: string, country?: string) => get<T.ContentArticle[]>('/content', { locale, content_type, country }),
      article: (slug: string, locale: string) => get<T.ContentArticle>(`/content/${slug}`, { locale }),
      /** Public by default; `include_internal` adds the seeded-data provenance rows the HQ registry needs. */
      sources: (query?: Query) => get<T.Page<T.SourceRecord>>('/sources', query),
      legalizationPath: (country: string, category?: string, university_id?: string) =>
        get<T.LegalizationInfo>('/documents/legalization-path', { country, category, university_id }),
    },

    /** V12 — the public Korean institution directory. Institution-level facts only; no account needed. */
    directory: {
      regions: () => get<T.DirectoryRegions>('/directory/regions'),
      institutions: (query: Query) => get<T.Page<T.InstitutionCard>>('/directory/institutions', query),
      institution: (slug: string) => get<T.InstitutionDetail>(`/directory/institutions/${slug}`),
      /** V27 — verified scholarships + language rules, and the scholarship summary for the visitor's answers. */
      admissions: (slug: string, query: Query) => get<T.InstAdmissions>(`/directory/institutions/${slug}/admissions`, query),
    },

    /** Anonymous endpoints (no account needed). */
    public: {
      quickEligibility: (body: T.QuickEligibilityInput) => post<T.QuickEligibilityResult>('/public/quick-eligibility', body),
      /** V27 — every relevant institution in four honest groups (REPORT §356). */
      fit: (body: T.FitInput) => post<T.FitResult>('/public/fit', body),
      quickEligibilityOptions: () => get<{ degrees: T.DegreeLevel[]; language_kinds: T.QuickLanguageKind[]; limits: Record<string, { min: number; max: number }> }>('/public/quick-eligibility/options'),
    },

    me: {
      dashboard: () => get<T.Dashboard>('/me/dashboard'),
      budget: (program_ids?: string[], housing?: 'DORM' | 'OFF_CAMPUS') => get<T.BudgetResponse>('/me/budget', { program_ids: program_ids?.length ? program_ids.join(',') : undefined, housing }),
      profileUnlocks: () => get<T.ProfileUnlocks>('/me/profile/unlocks'),
      profile: () => get<T.StudentProfile>('/me/profile'),
      updateProfile: (body: Partial<T.StudentProfile> & Record<string, unknown>) => patch<T.StudentProfile>('/me/profile', body),
      addEducation: (body: Record<string, unknown>) => post<{ id: string; gpa_percent: number | null }>('/me/educations', body),
      updateEducation: (id: string, body: Record<string, unknown>) => put<{ id: string }>(`/me/educations/${id}`, body),
      deleteEducation: (id: string) => del(`/me/educations/${id}`),
      addLanguage: (body: Record<string, unknown>) => post<{ id: string }>('/me/languages', body),
      deleteLanguage: (id: string) => del(`/me/languages/${id}`),
      matches: (query?: Query) => get<T.MatchResponse>('/me/matches', query),
      saved: () => get<T.UniversityCard[]>('/me/saved'),
      save: (universityId: string, program_id?: string) => put(`/me/saved/${universityId}`, program_id ? { program_id } : undefined),
      unsave: (universityId: string) => del(`/me/saved/${universityId}`),
      scholarships: () => get<T.Scholarship[]>('/me/scholarships'),
      services: () => get<T.ServicesResponse>('/me/services'),
      plan: () => get<T.StudentPlan | null>('/me/plan'),
      addOns: () => get<T.ServiceAddOn[]>('/me/add-ons'),
      // V29: approving returns the order to pay — the add-on is granted only once that order is PAID.
      decideAddOn: (id: string, approve: boolean) => post<{ id: string; status: string; plan: T.StudentPlan | null;
        order: { order_id: string; amount_minor: number; currency: string; status: string; card_form: boolean } | null }>(`/me/add-ons/${id}`, { approve }),
      checkout: (product_code: string, purchase_terms_version?: string) => post<T.OrderResult>('/me/orders', { product_code, purchase_terms_version }),
      /** 결제 승인 — the server asks Toss, with its own stored amount. Idempotent for the caller. */
      confirmToss: (body: { payment_key: string; order_id: string; amount: number }) =>
        post<T.PaymentResult>('/me/payments/toss/confirm', body),
      cancelOrder: (orderId: string) => post<T.PaymentResult>(`/me/orders/${orderId}/cancel`, {}),
      /**
       * **Local QA only: the plan's paid state, without a payment** (V21 b, REPORT §243.2).
       *
       * It performs the same activation a successful payment performs — a real Order, a real PAID
       * state, the real entitlements — and it reaches no payment provider at all: no Toss call, no
       * card, no billing key, no provider transaction id. The server answers 404 unless it is running
       * in development/test, so this is never a path in production.
       */
      /** V29 — the same non-production paid-state action for an approved add-on's order (production answers 404). */
      /**
       * V21 — register the card **and** pay, in one call (brief §34, §35).
       *
       * The card's digits leave the browser exactly once, over HTTPS, to Hangyul's own API. There is
       * no provider SDK in the bundle and no window to open: the server holds the secret key and
       * talks to Toss. The amount is **not** a parameter — the server priced the order.
       */
      payOrderWithCard: (orderId: string, card: T.CardInput, saveCard = true) =>
        post<T.PaymentResult & { payment_method?: T.StudentPaymentMethod; already_paid?: boolean }>(
          `/me/orders/${orderId}/pay-with-card`, { card, save_card: saveCard }),
      /** Pay with a card already on file. Refuses with `CARD_NOT_REUSABLE` where the merchant
       *  configuration issues no reusable credential (REPORT §229.2). */
      payOrderWithSavedCard: (orderId: string) =>
        post<T.PaymentResult & { already_paid?: boolean }>(`/me/orders/${orderId}/pay-with-saved-card`, {}),
      /** Which merchant configuration is live, and whether the card form is Hangyul's. No keys. */
      paymentsConfig: () => get<T.PaymentsConfig>('/me/payments/config'),
      paymentMethods: () => get<{ items: T.StudentPaymentMethod[] }>('/me/payment-methods'),
      deletePaymentMethod: (id: string) => del<{ deleted: boolean; remote: string }>(`/me/payment-methods/${id}`),
      orders: () => get<{ id: string; product_code: string; product_name: string; status: string; amount_minor: number; currency: string; paid_at: string | null }[]>('/me/orders'),
      offers: () => get<{ items: T.StudentOffer[] }>('/me/offers'),
      assignment: () => get<{ organization: string; organization_id: string; counselor: T.PublicUser | null; languages: string[]; since: string } | null>('/me/assignment'),
      housing: () => get<T.HousingInfo>('/me/housing'),
      updateHousing: (body: Record<string, unknown>) => put('/me/housing', body),
      arrival: () => get<T.ArrivalInfo>('/me/arrival'),
      updateArrival: (body: Record<string, unknown>) => put('/me/arrival', body),
      appointments: () => get<Appointment[]>('/me/appointments'),
      supportTickets: () => get<{ id: string; category: string; subject: string; status: string; priority: string; created_at: string; conversation_id?: string | null }[]>('/me/support-tickets'),
      createSupportTicket: (body: { category: 'VISA' | 'HOUSING' | 'ACADEMIC' | 'HEALTH' | 'FINANCE' | 'OTHER'; subject: string; body: string }) =>
        post<{ id: string; conversation_id: string }>('/me/support-tickets', body),
      enrollment: () => get<{ university: string; cohort: string; status: string; enrolled_on: string; expected_graduation: string | null; visa_expires_on: string | null } | null>('/me/enrollment'),
      consents: () => get<{ purpose: string; granted: boolean; version: string; at: string }[]>('/me/consents'),
      setConsent: (purpose: string, granted: boolean) => post('/me/consents', { purpose, granted }),
      dataRequest: (kind: 'DELETE' | 'EXPORT', note?: string) => post<{ id: string; status: string; due_at: string }>('/me/data-requests', { kind, note }),
      dataRequests: () => get<{ id: string; kind: string; status: string; created_at: string; due_at: string }[]>('/me/data-requests'),
    },

    applications: {
      list: (query?: Query) => get<T.Page<T.Application>>('/applications', query),
      create: (program_id: string, intake_id?: string) => post<T.Application>('/applications', { program_id, intake_id }),
      get: (id: string) => get<T.ApplicationDetail>(`/applications/${id}`),
      transition: (id: string, body: { to: T.ApplicationStatus; note?: string; interview_at?: string; tuition_amount_krw?: number; tuition_due?: string; offer_scholarship_note?: string; external_reference?: string }) =>
        post<T.ApplicationDetail>(`/applications/${id}/transition`, body),
      update: (id: string, body: { flagged?: boolean; flag_reason?: string | null; external_reference?: string; university_reviewer_id?: string | null }) =>
        patch<T.Application>(`/applications/${id}`, body),
      requestDocument: (id: string, body: { label: string; note: string; category?: T.DocumentCategory; due_date?: string }) =>
        post<T.DocumentRequest>(`/applications/${id}/document-requests`, body),
      fulfillRequest: (requestId: string, document_id: string) => post<T.DocumentRequest>(`/document-requests/${requestId}/fulfill`, { document_id }),
      cancelRequest: (requestId: string) => post<T.DocumentRequest>(`/document-requests/${requestId}/cancel`),
    },

    documents: {
      list: (query?: Query) => get<T.Page<T.VaultDocument>>('/documents', query),
      reviewQueue: (query?: Query) => get<T.Page<T.VaultDocument>>('/documents/review-queue', query),
      get: (id: string) => get<T.VaultDocument>(`/documents/${id}`),
      /** `student_user_id` lets assigned agency staff (and Hangyul) upload on a student's behalf. */
      upload: (file: Blob | { uri: string; name: string; type: string }, meta: { category: T.DocumentCategory; title?: string; issuing_country?: string; issue_date?: string; expires_on?: string; language?: string; document_id?: string; student_user_id?: string }) => {
        const form = new FormData();
        form.append('file', file as Blob, (file as { name?: string }).name ?? 'upload');
        Object.entries(meta).forEach(([k, v]) => { if (v) form.append(k, String(v)); });
        return request<T.VaultDocument>('/documents', { method: 'POST', form });
      },
      update: (id: string, body: Record<string, unknown>) => patch<T.VaultDocument>(`/documents/${id}`, body),
      review: (id: string, decision: 'VERIFIED' | 'NEEDS_CORRECTION', reason?: string, checks?: Record<string, unknown>[]) => post<T.VaultDocument>(`/documents/${id}/review`, { decision, reason, checks }),
      bulk: (body: { ids: string[]; action: 'VERIFY' | 'ASSIGN_REVIEWER' | 'REQUEST_CORRECTION'; reviewer_user_id?: string; reason?: string }) =>
        post<{ ok: number; failed: number; results: { id: string; ok: boolean; error?: string }[] }>('/documents/bulk', body),
      downloadUrl: (id: string, disposition: 'inline' | 'attachment' = 'inline', version?: number) =>
        post<{ url: string; expires_in: number; filename: string; mime_type: string }>(`/documents/${id}/download-url`, undefined, { disposition, version }),
    },

    essays: {
      list: (query?: Query) => get<T.Page<T.EssaySummary>>('/essays', query),
      get: (id: string) => get<T.Essay>(`/essays/${id}`),
      create: (body: { essay_type: T.EssayType; title: string; prompt?: string; word_limit?: number; application_id?: string; body?: string }) => post<T.Essay>('/essays', body),
      save: (id: string, body: string, opts?: { note?: string; prompt?: string; new_version?: boolean }) => put<T.Essay>(`/essays/${id}`, { body, ...opts }),
      setStatus: (id: string, status: T.EssayStatus, note?: string) => post<T.Essay>(`/essays/${id}/status`, { status, note }),
      comment: (id: string, body: { body: string; quote?: string; anchor_start?: number; anchor_end?: number; suggestion?: string; internal?: boolean }) =>
        post<{ id: string }>(`/essays/${id}/comments`, body),
      resolve: (id: string, commentId: string, apply_suggestion = false) => post<T.Essay>(`/essays/${id}/comments/${commentId}/resolve`, undefined, { apply_suggestion }),
      diff: (id: string, a: number, b: number) => get<{ a: number; b: number; ops: { op: 'equal' | 'insert' | 'delete'; text: string }[] }>(`/essays/${id}/diff`, { a, b }),
    },

    tasks: {
      list: (query?: Query) => get<T.Page<T.Task>>('/tasks', query),
      create: (body: Record<string, unknown>) => post<T.Task>('/tasks', body),
      update: (id: string, body: { status?: T.TaskStatus; owner_user_id?: string | null; due_at?: string; priority?: T.TaskPriority }) => patch<T.Task>(`/tasks/${id}`, body),
    },

    messages: {
      conversations: (student_id?: string, opts?: { needs_reply?: boolean }) => get<T.ConversationSummary[]>('/conversations', { student_id, needs_reply: opts?.needs_reply || undefined }),
      start: (body: { subject: string; body: string; student_id?: string; application_id?: string; kind?: string }) => post<{ id: string }>('/conversations', body),
      thread: (id: string) => get<T.ConversationDetail>(`/conversations/${id}/messages`),
      send: (id: string, body: { body: string; internal?: boolean; mentions?: string[]; create_task?: boolean; task_due_at?: string; attachment_ids?: string[] }) =>
        post<{ id: string }>(`/conversations/${id}/messages`, body),
      /** Upload a file first, then pass its id in `attachment_ids` when sending. */
      uploadAttachment: (conversationId: string, file: Blob | { uri: string; name: string; type: string }) => {
        const form = new FormData();
        form.append('file', file as Blob, (file as { name?: string }).name ?? 'upload');
        return request<T.MessageAttachment>(`/conversations/${conversationId}/attachments`, { method: 'POST', form });
      },
      attachmentUrl: (attachmentId: string, disposition: 'inline' | 'attachment' = 'attachment') =>
        post<{ url: string; expires_in: number; filename: string; mime_type: string }>(`/attachments/${attachmentId}/download-url`, undefined, { disposition }),
      markRead: (id: string) => post(`/conversations/${id}/read`),
    },

    notifications: {
      list: (unread_only = false) => get<{ unread: number; items: T.NotificationItem[] }>('/notifications', { unread_only }),
      readAll: () => post('/notifications/read-all'),
      read: (id: string) => post(`/notifications/${id}/read`),
    },

    visa: {
      list: (query?: Query) => get<T.Page<T.VisaCase>>('/visa', query),
      get: (id: string) => get<T.VisaCase>(`/visa/${id}`),
      eligibility: () => get<{ visa_type: T.VisaType; reason: string; status: T.VisaStatus; checklist?: T.VisaChecklistItem[] }>('/visa/eligibility'),
      update: (id: string, body: Record<string, unknown>) => patch<T.VisaCase>(`/visa/${id}`, body),
    },

    agency: {
      students: (query?: Query) => get<T.Page<T.AgencyStudentRow>>('/agency/students', query),
      // V15: what the student bought, what is promised and what is left (REPORT §119).
      studentPlan: (id: string) => get<T.StudentPlan | null>(`/agency/students/${id}/plan`),
      /** V29: a catalogue code and an exact unit price inside its range (or a quote with its scope). */
      offerAddOn: (id: string, body: { code: string; quantity?: number; unit_amount_minor: number; scope?: string | null; note?: string | null;
        subject_type?: 'essay' | 'application' | null; subject_id?: string | null }) =>
        post<{ id: string; status: string; amount_minor: number; currency: string }>(`/agency/students/${id}/add-ons`, body),
      /** V29: the dates the contract leaves to be set when the service begins. */
      setServiceTerm: (id: string, body: { service_started_at?: string | null; service_ends_at?: string | null; arrival_at?: string | null; dedicated_owner_user_id?: string | null }) =>
        patch<T.StudentPlan>(`/agency/students/${id}/service-term`, body),
      withdrawAddOn: (id: string, addOnId: string) => del(`/agency/students/${id}/add-ons/${addOnId}`),
      /** V15: service delivery — how much of what was sold has been delivered (REPORT §119, Insights #4). */
      planUtilization: () => get<T.PlanUtilization>('/agency/plan-utilization'),
      studentViews: () => get<T.AgencyStudentViewCounts>('/agency/students/views'),
      today: () => get<T.AgencyToday>('/agency/today'),
      /** V5 outcome metrics (admission, documents, writing, services) with definitions; n < 5 withheld. */
      outcomeMetrics: (days = 90) => get<T.OutcomeMetrics>(`/agency/outcome-metrics?days=${days}`),
      stageCounts: () => get<Partial<Record<T.PipelineStage, number>>>('/agency/stage-counts'),
      savedViews: () => get<T.AgencySavedView[]>('/agency/saved-views'),
      createSavedView: (body: { name: string; scope: 'PERSONAL' | 'TEAM'; filters: Record<string, unknown>; columns?: string[] | null; sort?: string | null }) =>
        post<T.AgencySavedView>('/agency/saved-views', body),
      updateSavedView: (id: string, body: { name: string; scope: 'PERSONAL' | 'TEAM'; filters: Record<string, unknown>; columns?: string[] | null; sort?: string | null }) =>
        patch<T.AgencySavedView>(`/agency/saved-views/${id}`, body),
      deleteSavedView: (id: string) => del(`/agency/saved-views/${id}`),
      pipeline: (counselor_id?: string) => get<{ stages: T.PipelineStage[]; columns: Record<T.PipelineStage, T.AgencyStudentRow[]> }>('/agency/pipeline', { counselor_id }),
      student: (id: string) => get<T.StudentWorkspace>(`/agency/students/${id}`),
      setStage: (id: string, stage: T.PipelineStage, note?: string) => post(`/agency/students/${id}/stage`, { stage, note }),
      bulk: (body: { student_ids: string[]; action: 'SET_STAGE' | 'ASSIGN_COUNSELOR' | 'REGENERATE_TASKS'; stage?: T.PipelineStage; counselor_id?: string }) =>
        post<{ updated: number }>('/agency/students/bulk', body),
      analytics: (query?: Query) => get<T.AgencyAnalytics>('/agency/analytics', query),
      performance: (query?: Query) => get<T.AgencyPerformance>('/agency/performance', query),
      studentMatches: (id: string) => get<{ engine_version: string; student_id: string; items: { program_id: string; tier: T.MatchTier; eligible: boolean; score: number; reasons: T.MatchReason[] }[] }>(`/agency/students/${id}/matches`),
      team: () => get<{ organization: { id: string; name: string; languages: string[]; capacity_active_cases: number | null; sla_first_response_hours: number | null; specialties: { kind: string; value: string }[] }; members: { user_id: string; full_name: string; email: string; role: T.Role; title: string | null; languages: string[]; active: boolean }[] }>('/agency/team'),
      deadlines: (days = 30) => get<{ id: string; title: string; title_key?: string | null; title_params?: Record<string, unknown> | null; task_type: T.TaskType; due_at: string; overdue: boolean; priority: T.TaskPriority; student: T.PublicUser | null; link: string | null; owner: T.PublicUser | null }[]>('/agency/deadlines', { days }),
      assignmentCandidates: (studentId: string) => get<{ organization_id: string; name: string; score: number; breakdown: T.MatchFactor[]; at_capacity: boolean }[]>(`/agency/assignment-candidates/${studentId}`),
      overrideAssignment: (body: { student_id: string; organization_id: string; counselor_id?: string; reason: string }) => post('/agency/assignments/override', body),
      orders: () => get<{ id: string; student: T.PublicUser; product_code: string; product_name: string; status: string; amount_minor: number; currency: string; paid_at: string | null; created_at: string; provider: string | null; is_demo_payment: boolean }[]>('/agency/orders'),
      appointments: () => get<Appointment[]>('/agency/appointments'),
      createAppointment: (body: { student_id: string; starts_at: string; kind?: string; duration_minutes?: number; channel?: string; notes?: string }) => post<{ id: string }>('/agency/appointments', body),
      closeAppointment: (id: string, body: { status: 'COMPLETED' | 'NO_SHOW' | 'CANCELLED'; outcome_notes?: string; next_task_title?: string; next_task_due_at?: string }) =>
        post<{ ok: boolean }>(`/agency/appointments/${id}/close`, body),
      agencies: () => get<{ id: string; name: string; country_code: string | null; languages: string[]; capacity: number | null; active_cases: number; is_partner: boolean }[]>('/agency/agencies'),
      // ---------------- V22 accounts (REPORT §246 A5): one permission per agency, a roster instead of a role matrix.
      accounts: () => get<AgencyAccountsResponse>('/agency/team/accounts'),
      invite: (body: { email: string; full_name: string; locale: string }) => post<AccountInviteResponse>('/agency/team/invite', body),
      /** Open work moves to colleagues by the assignment engine unless `to` names someone per kind (server LeaveIn). */
      deactivateMember: (userId: string, body: { reason: string; to?: Record<string, string> }) => post<unknown>(`/agency/team/members/${userId}/deactivate`, { to: {}, ...body }),
      reactivateMember: (userId: string) => post<unknown>(`/agency/team/members/${userId}/reactivate`),
    },

    /** V22 — Hangyul-only administration of university accounts (REPORT §247, §252.2). */
    hq: {
      universityAccounts: () => get<{ accounts: UniversityAccount[] }>('/agency/hq/university-accounts'),
      inviteUniversityAccount: (body: { email: string; full_name: string; university_id: string; locale: string }) =>
        post<AccountInviteResponse & { university: { id: string; slug: string; name_en: string } }>('/agency/hq/university-accounts/invite', body),
      disableUniversityAccount: (userId: string) => post<UniversityAccount>(`/agency/hq/university-accounts/${userId}/disable`),
      enableUniversityAccount: (userId: string) => post<UniversityAccount>(`/agency/hq/university-accounts/${userId}/enable`),
      reassignUniversityAccount: (userId: string, university_id: string) => post<UniversityAccount>(`/agency/hq/university-accounts/${userId}/reassign`, { university_id }),
    },

    university: {
      overview: (university_id?: string) => get<{ university: { id: string; name_en: string; name_ko: string; slug: string; certification_status: string; is_partner: boolean; brand_color: string | null } }>('/university/overview', { university_id }),
      analytics: (query?: Query) => get<T.UniversityAnalytics>('/university/analytics', query),
      programs: (university_id?: string) => get<T.Program[]>('/university/programs', { university_id }),
      updateRequirements: (programId: string, body: Record<string, unknown>) => patch<T.Program>(`/university/programs/${programId}/requirements`, body),
      partnership: (university_id?: string) => get<T.Partnership[]>('/university/partnership', { university_id }),
      createAward: (body: { pool_id: string; student_id: string; amount_krw: number; application_id?: string; note?: string }) => post<{ id: string }>('/university/scholarship-awards', body),
      awardStatus: (id: string, status: 'COMMITTED' | 'PAID' | 'CANCELLED') => post(`/university/scholarship-awards/${id}/status`, { status }),
      cohorts: (university_id?: string) => get<T.CohortStudent[]>('/university/cohorts', { university_id }),
      team: (university_id?: string) => get<{ user_id: string; full_name: string; role: T.Role; title: string | null }[]>('/university/team', { university_id }),
      admissionsFunnel: (query?: Query) => get<T.AdmissionsFunnel>('/university/admissions-funnel', query),
      metrics: (query?: Query) => get<T.UniversityMetrics>('/university/metrics', query),
      attention: (query?: Query) => get<T.UniversityAttention>('/university/attention', query),
      outcomes: (by: T.UniversityOutcomes['by'], university_id?: string) => get<T.UniversityOutcomes>('/university/outcomes', { by, university_id }),
      proposeRequirements: (programId: string, body: Record<string, unknown>) => post<T.RequirementProposal>(`/university/programs/${programId}/requirement-proposals`, body),
      proposals: (status: 'PENDING' | 'PUBLISHED' | 'DISCARDED' = 'PENDING', university_id?: string) => get<T.RequirementProposal[]>('/university/requirement-proposals', { status, university_id }),
      decideProposal: (id: string, decision: 'publish' | 'discard') => post<T.RequirementProposal>(`/university/requirement-proposals/${id}/${decision}`),
      exports: (university_id?: string) => get<T.ExportHistory>('/university/exports', { university_id }),
      exportCsv: (kind: 'outcomes' | 'metrics', university_id?: string) => request<Response>(`/university/export/${kind}.csv`, { raw: true, query: { university_id } }),
      agencies: (university_id?: string) => get<{ id: string; name: string; country_code: string | null; applications: number; is_demo: boolean }[]>('/university/agencies', { university_id }),
      /** V8: optionally only the selected applications (`ids`) or the current list filters. */
      exportApplications: (university_id?: string, filters: Query = {}) => request<Response>('/university/export/applications.csv', { raw: true, query: { university_id, ...filters } }),
      /** V8: one definition per metric (numerator, denominator, population, intake, date range, small-sample rule). */
      glossary: () => get<T.UniversityGlossary>('/university/glossary'),
      /** V8 safe bulk actions — never a decision; per-item results. */
      bulk: (action: T.UniversityBulkAction, body: { ids: string[]; reviewer_id?: string | null; category?: string; label?: string; note?: string; due_date?: string }) =>
        post<T.BulkResult>(`/university/bulk/${action}`, body),
      undoAdminCheck: (applicationId: string) => del(`/university/applications/${applicationId}/admin-check`),
      exportPresets: (university_id?: string) => get<T.ExportPresets>('/university/export-presets', { university_id }),
      saveExportPreset: (body: { name: string; base: T.ExportPresetKey; columns: string[]; filters: Record<string, string> }, university_id?: string) =>
        post<{ id: string }>('/university/export-presets', body, { university_id }),
      deleteExportPreset: (id: string) => del(`/university/export-presets/${id}`),
      runExportPreset: (kind: T.ExportPresetKey, query: Query = {}) => request<Response>(`/university/export/preset/${kind}.csv`, { raw: true, query }),
      ruleHistory: (programId: string) => get<T.RuleHistory>(`/university/programs/${programId}/rule-history`),
      /** V4: what a student sees for this program (requirements, first-year cost, deadline, documents). */
      studentPreview: (programId: string) => get<T.Program & { first_year_range_krw?: { low: number | null; high: number | null; basis: string; tuition_year: number | null; housing?: string | null; excludes: string[] } | null; required_documents?: { category: T.DocumentCategory; label: string; required: boolean; legalization_required: boolean; translation_required?: boolean; notes: string | null }[] }>(`/university/programs/${programId}/student-preview`),
    },

    /** V5 dossier: universal dossier, applicability, findings, extraction suggestions, packages, reuse. */
    dossier: {
      me: () => get<T.Dossier>('/me/dossier'),
      student: (studentId: string) => get<T.Dossier>(`/agency/students/${studentId}/dossier`),
      package: (applicationId: string) => get<T.DossierPackageResponse>(`/applications/${applicationId}/package`),
      reuse: (query: { category: T.DocumentCategory; application_id?: string; request_id?: string }) => get<T.DossierReuse>('/me/dossier/reuse', query),
      decide: (body: { category: T.DocumentCategory; decision: 'KEEP' | 'REPLACE' | 'ADD_VERSION'; document_id?: string; application_id?: string }) =>
        post<{ id: string; kind: string }>('/me/dossier/reuse-decisions', body),
      sendExisting: (requestId: string, document_id: string) => post<T.DocumentRequest>(`/dossier/requests/${requestId}/send-existing`, { document_id }),
      confirmField: (fieldId: string, value?: string) => post<T.DossierSuggestion>(`/dossier/extractions/${fieldId}/confirm`, value === undefined ? {} : { value }),
      rejectField: (fieldId: string) => post<T.DossierSuggestion>(`/dossier/extractions/${fieldId}/reject`),
      finding: (findingId: string, action: 'resolve' | 'dismiss' | 'reopen', note?: string) => post<T.DossierFinding>(`/dossier/findings/${findingId}/${action}`, { note }),
      translation: (documentId: string, status: 'PROVIDED' | 'NEEDED' | null) => post<{ document_id: string; translation: string }>(`/dossier/documents/${documentId}/translation`, { status }),
      analyze: (documentId: string) => post<Record<string, unknown>>(`/dossier/documents/${documentId}/analyze`),
      metrics: (query?: { since?: string; until?: string }) => get<T.DossierMetrics>('/dossier/metrics', query),
    },

    sso: {
      lookup: (email: string) => get<T.SSOLookup>('/sso/lookup', { email }),
      config: () => get<{ protocol: string; issuer: string; allowed_domains: string[]; default_role: T.Role; enabled: boolean; enforce: boolean; client_secret_present: boolean } | null>('/sso/config'),
    },

    templates: {
      list: (kind?: T.TemplateKind) => get<{ items: T.MessageTemplate[]; placeholders: string[]; kinds: T.TemplateKind[] }>('/templates', { kind }),
      create: (body: { title: string; body: string; kind: T.TemplateKind; scope: 'PERSONAL' | 'TEAM' | 'ORG'; locale?: string }) => post<T.MessageTemplate>('/templates', body),
      update: (id: string, body: { title: string; body: string; kind: T.TemplateKind; scope: 'PERSONAL' | 'TEAM' | 'ORG'; locale?: string }) => patch<T.MessageTemplate>(`/templates/${id}`, body),
      remove: (id: string) => del(`/templates/${id}`),
    },

    admin: {
      checkSource: (id: string, changed: boolean, note?: string) => post<T.SourceRecord>(`/sources/${id}/check`, { changed, note }),
      reviews: (open_only = true) => get<T.FreshnessReviewItem[]>('/freshness/reviews', { open_only }),
      resolveReview: (id: string, resolution: 'CONFIRMED' | 'UPDATED' | 'ARCHIVED') => post(`/freshness/reviews/${id}/resolve`, { resolution }),
      scan: () => post<{ created: number }>('/freshness/scan'),
      audit: (query?: Query) => get<T.Page<T.AuditEntry>>('/audit', query),
    },

    /** V5 visa concierge: researched route, reuse, preparation form (student's own check), tracking with evidence, help. */
    visaRoute: {
      mine: () => get<T.VisaRoutePlan>('/me/visa-route'),
      student: (studentId: string) => get<T.VisaRoutePlan>(`/visa-route/students/${studentId}`),
      answer: (body: { value?: string; sponsor?: string }) => put<T.VisaRoutePlan>('/me/visa-route/answers', body),
      confirmSection: (section: string, values?: Record<string, string>) => post<T.VisaRoutePlan>(`/me/visa-route/form/${section}`, { values }),
      editSection: (section: string) => del<T.VisaRoutePlan>(`/me/visa-route/form/${section}`),
      item: (key: string, body: { document_id?: string; received?: boolean }) => post<T.VisaRoutePlan>(`/me/visa-route/items/${key}`, body),
      appointment: (body: { on: string | null; status?: 'PLANNED' | 'BOOKED' | null; reference?: string | null; post_key?: string | null }) => put<T.VisaRoutePlan>('/me/visa-route/appointment', body),
      handoff: () => post<T.VisaRoutePlan>('/me/visa-route/handoff'),
      submission: (body: { submitted_on: string; reference?: string | null; document_id?: string | null }) => post<T.VisaRoutePlan>('/me/visa-route/submission', body),
      request: (body: { note: string; due_on?: string | null }) => post<T.VisaRoutePlan>('/me/visa-route/requests', body),
      requestSent: (id: string, document_id?: string) => post<T.VisaRoutePlan>(`/me/visa-route/requests/${id}/sent`, { document_id }),
      decision: (body: { decision: 'APPROVED' | 'REFUSED'; decided_on: string; document_id?: string | null }) => post<T.VisaRoutePlan>('/me/visa-route/decision', body),
      issued: (body: { document_id: string; issued_on?: string | null; expires_on?: string | null }) => post<T.VisaRoutePlan>('/me/visa-route/issued', body),
      help: (message: string) => post<T.VisaRoutePlan>('/me/visa-route/help', { message }),
      staffRequest: (studentId: string, body: { note: string; due_on?: string | null }) => post<T.VisaRoutePlan>(`/visa-route/students/${studentId}/requests`, body),
      staffAppointment: (studentId: string, body: { on: string | null; status?: 'PLANNED' | 'BOOKED' | null; reference?: string | null }) => put<T.VisaRoutePlan>(`/visa-route/students/${studentId}/appointment`, body),
      packReviewed: (studentId: string) => post<T.VisaRoutePlan>(`/visa-route/students/${studentId}/pack-reviewed`),
      today: () => get<{ items: Record<string, unknown>[] }>('/agency/visa-today'),
    },

    /** V5 concierge: service cases (pickup, housing, residence card, help), arrival journey, vendors. */
    concierge: {
      myCases: () => get<{ items: T.ServiceCase[] }>('/me/service-cases'),
      request: (body: { type: T.ServiceCaseType; note?: string; details?: Record<string, unknown> }) => post<T.ServiceCase>('/me/service-cases', body),
      step: (id: string, body: { status: string; note?: string; document_id?: string; details?: Record<string, unknown> }) => post<T.ServiceCase>(`/me/service-cases/${id}/step`, body),
      cancel: (id: string) => post<T.ServiceCase>(`/me/service-cases/${id}/cancel`),
      feedback: (id: string, body: { ok: boolean; comment?: string }) => post(`/me/service-cases/${id}/feedback`, body),
      journey: () => get<T.ArrivalJourney>('/me/arrival-journey'),
      setItems: (completed_items: string[]) => put<{ ok: boolean; completed_items: string[] }>('/me/arrival-journey/items', { completed_items }),
      setFlight: (body: { number: string; airport: string; scheduled_arrival: string; terminal?: string | null }) => put<T.FlightInfo>('/me/flight', body),
      requestPickup: (body: { passengers: number; luggage: number; destination_kind: string; destination_address?: string | null; special_requests?: string | null; contact_method: string; contact_handle?: string | null }) =>
        post<T.ServiceCase>('/me/pickup', body),
      housing: () => get<T.HousingInfo & T.HousingPlan>('/me/housing'),
      updatePlan: (body: { option?: T.HousingOption; profile?: Record<string, unknown>; move_in?: Record<string, unknown> }) => put('/me/housing-plan', body),
      dormApply: (dormitory_id: string, status: 'PLANNING' | 'APPLIED' = 'PLANNING') => post<T.ServiceCase>('/me/housing/dorm-application', { dormitory_id, status }),
      listingInterest: (id: string) => post<T.ServiceCase>(`/me/housing/listings/${id}/interest`),
      leaseReview: (body: Record<string, unknown>) => post<T.ServiceCase>('/me/housing/lease-review', body),
      help: () => get<{ categories: string[]; emergency: T.EmergencyInfo; requests: T.ServiceCase[] }>('/me/help'),
      askHelp: (body: { category: string; message: string }) => post<T.ServiceCase & { emergency?: T.EmergencyInfo }>('/me/help', body),
      // staff
      queue: (query?: { view?: T.ServiceView; type?: string; owner?: string; student_id?: string }) => get<T.ServiceQueue>('/agency/service-cases', query),
      case: (id: string) => get<T.ServiceCase>(`/agency/service-cases/${id}`),
      create: (body: { student_id: string; type: T.ServiceCaseType; note?: string; details?: Record<string, unknown>; due_at?: string }) => post<T.ServiceCase>('/agency/service-cases', body),
      update: (id: string, body: Record<string, unknown>) => patch<T.ServiceCase>(`/agency/service-cases/${id}`, body),
      addEvent: (id: string, body: { kind: 'NOTE' | 'FLIGHT_CHANGE' | 'PROOF' | 'NO_SHOW' | 'STUDENT_UPDATE'; body?: string; visibility?: 'INTERNAL' | 'STUDENT'; attachment_document_id?: string; estimated_arrival?: string; terminal?: string }) =>
        post<T.ServiceCase>(`/agency/service-cases/${id}/events`, body),
      vendors: (kind?: string) => get<{ items: T.ServiceVendor[]; kinds: string[]; can_manage: boolean }>('/agency/vendors', { kind }),
      createVendor: (body: Record<string, unknown>) => post<T.ServiceVendor>('/agency/vendors', body),
      updateVendor: (id: string, body: Record<string, unknown>) => patch<T.ServiceVendor>(`/agency/vendors/${id}`, body),
      metrics: (days = 90) => get<T.ServiceMetrics>('/agency/service-metrics', { days }),
    },

    /** V5 success: strategy per application, portfolio, submission hub (guided hand-off + evidence). */
    success: {
      myStrategy: () => get<T.MyStrategy>('/me/strategy'),
      strategy: (appId: string) => get<T.ApplicationStrategy>(`/applications/${appId}/strategy`),
      studentStrategy: (studentId: string) => get<{ items: T.ApplicationStrategy[] }>(`/agency/students/${studentId}/strategy`),
      myPortfolio: () => get<T.Portfolio>('/me/portfolio'),
      studentPortfolio: (studentId: string) => get<T.Portfolio>(`/agency/students/${studentId}/portfolio`),
      reviewPortfolio: (studentId: string, body: { decision: T.PortfolioDecision; note?: string }) => post<T.Portfolio>(`/agency/students/${studentId}/portfolio/review`, body),
      submission: (appId: string) => get<T.SubmissionView>(`/applications/${appId}/submission`),
      evidence: (appId: string) => get<T.SubmissionEvidence>(`/applications/${appId}/submission`),
      handoff: (appId: string) => post<T.SubmissionView>(`/applications/${appId}/submission/handoff`),
      confirm: (appId: string, body: T.SubmissionConfirmInput) => post<T.SubmissionView>(`/applications/${appId}/submission/confirm`, body),
      fee: (appId: string, body: { status: T.ApplicationFeeStatus; amount?: number; paid_on?: string }) => post<T.SubmissionView>(`/applications/${appId}/submission/fee`, body),
      connectors: (university_id?: string) => get<{ items: T.SubmissionConnectorInfo[]; research_file: boolean }>('/submission/connectors', { university_id }),
      /** V6 authorised agency submission: student consent, withdrawal, agency failure report, agency queue. */
      authorize: (appId: string, consent_version: string) => post<T.SubmissionView>(`/applications/${appId}/submission/authorize`, { accept: true, consent_version }),
      revoke: (appId: string, reason?: string) => post<T.SubmissionView>(`/applications/${appId}/submission/authorization/revoke`, { reason }),
      failure: (appId: string, reason: string) => post<T.SubmissionView>(`/applications/${appId}/submission/failure`, { reason }),
      queue: (view: T.SubmissionQueueView = 'ready') => get<T.SubmissionQueue>('/agency/submissions', { view }),
    },

    /** V5 writing review (server/app/api/v1/writing.py). */
    writing: {
      queue: (view: T.WritingQueueView) => get<T.WritingQueue>('/writing/queue', { view }),
      next: (essayId: string) => get<{ id: string | null }>(`/writing/essays/${essayId}/next`),
      runChecks: (essayId: string) => post<T.Essay>(`/writing/essays/${essayId}/checks`),
      dismissFinding: (essayId: string, findingId: string, note: string) => post<T.Essay>(`/writing/essays/${essayId}/findings/${findingId}/dismiss`, { note }),
      rate: (essayId: string, dimension: string, rating: T.RubricRating, note?: string) => put<T.Essay>(`/writing/essays/${essayId}/rubric/${dimension}`, { rating, note }),
      candidates: (essayId: string) => get<{ items: T.WritingCandidate[]; current: string | null; can_override: boolean }>(`/writing/essays/${essayId}/candidates`),
      assign: (essayId: string, user_id: string, reason: string) => post<T.Essay>(`/writing/essays/${essayId}/reviewer`, { user_id, reason }),
      prompts: (query?: Query) => get<{ items: T.WritingPrompt[] }>('/writing/prompts', query),
      attachPrompt: (essayId: string, body: { prompt_id?: string; prompt?: Record<string, unknown> }) => post<T.Essay>(`/writing/essays/${essayId}/prompt`, body),
      approve: (essayId: string, override_reason?: string, note?: string) => post<T.Essay>(`/essays/${essayId}/status`, { status: 'APPROVED', override_reason, note }),
      approved: (applicationId: string) => get<{ application_id: string; items: T.ApprovedEssay[] }>(`/writing/applications/${applicationId}/approved`),
      insights: (period_days = 90) => get<T.WritingInsights>('/writing/insights', { period_days }),
      policy: () => get<{ first: number; revision: number; final: number }>('/writing/policy'),
    },

    /**
     * V29 staff two-step verification (TOTP). Appended — nothing above changed behaviour.
     *
     * Calls made *before* a session exists (verify, and any call carrying an enrollment token) go through
     * `direct`, not `request`: `request` would replace the explicit `Authorization` header with a stale access
     * token if one were held, and would answer a 401 (`MFA_TOKEN_EXPIRED`) by trying a cookie refresh — which
     * could silently sign in whoever used this browser last. Calls made with the normal session use `request`.
     */
    mfa: (() => {
      const direct = async <R>(path: string, body?: unknown, bearer?: string): Promise<R> => {
        const headers: Record<string, string> = {};
        if (bearer) headers.Authorization = `Bearer ${bearer}`;
        if (body !== undefined) headers['Content-Type'] = 'application/json';
        const dl = deadline(undefined, TIMEOUT_MS);
        let res: Response;
        try {
          res = await f(`${base}${path}`, {
            method: body === undefined ? 'GET' : 'POST', headers, credentials: 'include', signal: dl.signal,
            body: body === undefined ? undefined : JSON.stringify(body),
          });
        } catch (e) {
          if (dl.timedOut) throw new ApiError(408, `Request timed out after ${Math.round(TIMEOUT_MS / 1000)}s`);
          throw e;
        } finally {
          dl.release();
        }
        if (!res.ok) {
          const data = await parse(res).catch(() => undefined);
          const detail = (data as { detail?: unknown })?.detail;
          const msg = typeof detail === 'string' ? detail
            : detail && typeof detail === 'object' && typeof (detail as { message?: unknown }).message === 'string' ? (detail as { message: string }).message
              : res.statusText;
          throw new ApiError(res.status, msg || `Request failed (${res.status})`, data);
        }
        return (await parse(res)) as R;
      };
      return {
        /**
         * Staff sign-in that understands the two-step answers. `setSession` runs only for a real session; the
         * MFA and enrolment answers carry a short-lived token for the next step instead. Any other error is rethrown.
         */
        async loginStaff(email: string, password: string, org_id?: string): Promise<StaffLoginResult> {
          try {
            const tokens = await post<T.TokenResponse>('/auth/login', { email, password, client: cfg.client, org_id });
            await setSession(tokens);
            return { kind: 'session', tokens };
          } catch (e) {
            const code = mfaErrorCode(e);
            const d = mfaErrorDetail(e);
            if (e instanceof ApiError && e.status === 401 && code === 'MFA_REQUIRED' && typeof d?.mfa_token === 'string') {
              return {
                kind: 'mfa', mfa_token: d.mfa_token, expires_in: Number(d.expires_in ?? 300),
                methods: Array.isArray(d.methods) ? (d.methods as MfaMethod[]) : ['totp', 'recovery_code'],
              };
            }
            if (e instanceof ApiError && e.status === 403 && code === 'MFA_ENROLLMENT_REQUIRED' && typeof d?.enrollment_token === 'string') {
              return { kind: 'enroll', enrollment_token: d.enrollment_token, expires_in: Number(d.expires_in ?? 900) };
            }
            throw e;
          }
        },
        /** Second step of sign-in: a 6-digit code or one recovery code. Completes the login (sets the session). */
        async verify(mfa_token: string, answer: { code: string } | { recovery_code: string }) {
          const tr = await direct<T.TokenResponse>('/auth/mfa/verify', { mfa_token, client: cfg.client, ...answer });
          await setSession(tr);
          return tr;
        },
        /** With `enrollment_token` this works before a session exists (sign-in enrolment); otherwise uses the session. */
        status: (enrollment_token?: string) => (enrollment_token
          ? direct<MfaStatus>('/auth/mfa/status', undefined, enrollment_token)
          : get<MfaStatus>('/auth/mfa/status')),
        enroll: (enrollment_token?: string) => (enrollment_token
          ? direct<MfaEnrollment>('/auth/mfa/enroll', {}, enrollment_token)
          : post<MfaEnrollment>('/auth/mfa/enroll', {})),
        /**
         * Confirms the authenticator with a first code and returns the 10 recovery codes (shown once). Called with
         * an enrollment token, the answer also carries the session the sign-in was waiting for — it is set here,
         * so the caller behaves as after any completed login.
         */
        async activate(code: string, enrollment_token?: string) {
          const res = enrollment_token
            ? await direct<MfaActivation>('/auth/mfa/activate', { code }, enrollment_token)
            : await post<MfaActivation>('/auth/mfa/activate', { code });
          if (res.tokens) await setSession(res.tokens);
          return res;
        },
        /** Issues 10 new recovery codes; the old ones stop working. Needs a current authenticator code. */
        regenerateRecoveryCodes: (code: string) => post<{ recovery_codes: string[] }>('/auth/mfa/recovery-codes', { code }),
      };
    })(),
  };
}

export interface CompareRow {
  program: T.Program;
  match: T.Match | null;
  next_intake: T.Intake | null;
  estimated_annual_cost_krw: number | null;
  first_year_range_krw?: T.FirstYearRange;
  scholarships: T.Scholarship[];
  dormitory: boolean;
  document_count: number;
  legalization_documents: number;
  partner: boolean;
}

export interface Appointment {
  id: string; kind: string; starts_at: string; duration_minutes: number; channel: string; status: string; notes: string | null;
  host: T.PublicUser | null; student?: T.PublicUser;
  /** Agency view (V3): close-out, context and the follow-up it produced. */
  outcome_notes?: string | null; bucket?: 'upcoming' | 'follow_up' | 'done';
  application?: { id: string; university: string | null } | null; service_plan?: string | null;
  follow_up_task?: { id: string; title: string; due_at: string | null; done: boolean } | null;
}

export type ApiClient = ReturnType<typeof createApiClient>;

// ---------------------------------------------------------------- V29 staff two-step verification (TOTP)
export type MfaMethod = 'totp' | 'recovery_code';
export interface MfaStatus {
  enrolled: boolean; pending: boolean; enabled_at: string | null; recovery_codes_remaining: number;
  /** The account must use two-step verification (production policy for staff). */
  required: boolean;
  /** The account may use it at all (staff accounts). */
  eligible: boolean;
}
export interface MfaEnrollment { secret: string; otpauth_uri: string; issuer: string; account: string }
export interface MfaActivation {
  enabled: true; recovery_codes: string[];
  /** Non-null only when activated with an enrollment token: the session the sign-in was waiting for. */
  tokens: T.TokenResponse | null;
}
export type StaffLoginResult =
  | { kind: 'session'; tokens: T.TokenResponse }
  | { kind: 'mfa'; mfa_token: string; expires_in: number; methods: MfaMethod[] }
  | { kind: 'enroll'; enrollment_token: string; expires_in: number };
export type MfaErrorCode =
  | 'MFA_REQUIRED' | 'MFA_ENROLLMENT_REQUIRED' | 'MFA_CODE_INVALID' | 'MFA_TOKEN_EXPIRED' | 'MFA_LIMITED' | 'MFA_ALREADY_ENABLED';

/** The `detail` object of a FastAPI-style error body (`{"detail": {...}}`), when it is an object. */
export function mfaErrorDetail(e: unknown): Record<string, unknown> | null {
  if (!(e instanceof ApiError)) return null;
  const detail = (e.body as { detail?: unknown } | undefined)?.detail;
  return detail && typeof detail === 'object' && !Array.isArray(detail) ? (detail as Record<string, unknown>) : null;
}
/** The machine-readable `detail.code` of an API error (e.g. `MFA_CODE_INVALID`), or null. */
export function mfaErrorCode(e: unknown): MfaErrorCode | (string & {}) | null {
  const code = mfaErrorDetail(e)?.code;
  return typeof code === 'string' ? code : null;
}
