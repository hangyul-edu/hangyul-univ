# Roadmap

Only open work: launch blockers, external dependencies and next-release priorities. Resolved history is in git and
the changelog table in [REPORT.md](REPORT.md). Measured state: `npm run release:check` and the launch QA section of
the report.

## 1. Launch blockers (in the order they block a public launch)

| # | Blocker | State today | Owner |
|---|---|---|---|
| 1 | **Durable production API host** | The API is reachable only through an ngrok tunnel to the owner's machine running a development configuration — and only while that machine and tunnel are up (on 2026-11-22 the endpoint was offline, so every `/api` call on the four domains failed). `api.univ.talkhangyul.com` fails TLS. Needed: HTTPS origin, managed PostgreSQL + Redis, private S3 bucket with SSE, ClamAV, the worker service, secret manager, scheduled off-host backups; then repoint the four `/api` rewrites ([DEPLOYMENT.md](DEPLOYMENT.md) §9). | Owner / infrastructure |
| 2 | **Design Preview off** | ON for owner review: `VITE_ENABLE_DESIGN_PREVIEW=1` in `build.env` of the student, agency and university `vercel.json`. Set `DESIGN_PREVIEW = false` in `scripts/ops/gen-vercel.mjs`, regenerate, and run `npm run release:preview-gate -- --launch --bundles off` before public launch. | Engineering |
| 3 | **Payments live** | Billing-key-only rail is built and tested (`payments/BILLING.md`), but cannot charge: (a) no live Toss credentials are installed anywhere — install the three live merchants and `HG_PAYMENT_TOKEN_ENCRYPTION_KEY` into the production host's secret store (blocked on #1); (b) per-method live verification with an owner-approved card: **Korean card** — KRW merchant, catalogue is USD-only, so needs KRW prices or a USD-settling contract; **International card** — Toss documents billing for Korean-issued cards only, live confirmation needed; **Toss Pay / Naver Pay** — no billing registration documented by Toss (`PROVIDER_SPEC_REQUIRED`), request the integration contract; (c) register the webhook URL; (d) `npm run release:payment-gate` must pass. Also: the **refund schedule** (`OWNER_POLICY_REQUIRED`) and the **upgrade pricing rule**. | Owner / Toss |
| 4 | **Identity delivery in production** | Registration requires e-mail and SMS codes plus Turnstile. Production SendGrid / Twilio / Turnstile credentials and a live delivery check (`npm run qa:identity-live`) are required; production refuses to boot without the keys. | Owner |
| 5 | **Legal** | Ten company identity fields unset (sections omitted until set); counsel review of privacy/terms/consent/cross-border text; retention periods (every period `OWNER_COUNSEL_REQUIRED`); 통신판매업 신고 ([LEGAL.md](LEGAL.md)). | Owner / counsel |
| 6 | **Security sign-off** | Independent penetration test; production secrets and staff MFA enforced on the real host ([SECURITY.md](SECURITY.md)). | Owner |
| 7 | **Native stores** | iOS not built (Apple / EAS credentials); Android artifacts predate V32 and must be rebuilt from current source with the Play upload key ([`mobile/STORE_READINESS.md`](mobile/STORE_READINESS.md)). | Owner |

## 2. External dependencies that limit quality (not hard blockers)

- **Human native-speaker language review.** Every locale is machine-translated with synthetic (AI-model) review
  only; no locale is human-reviewed ([LOCALIZATION.md](LOCALIZATION.md)). Reviewer questions for the owner are in
  `docs/qa/v32/l10n/LANGUAGE_SIGNOFF.md`. The 86 student strings rewritten from "your counselor" to "the Hangyul team" on
  2026-11-21 (21 locales) are AI-drafted too; points to read first: `visaroute:v5.moreCaveats_*` has only `_one/_other`
  (Arabic and Russian need more plural forms), Nepali uses plain rather than honorific verbs for the team, Bengali
  `mobile:student.home.noCounselor` is literal.
- **Usability sessions.** Protocol prepared ([`research/v9-validation-protocols.md`](research/v9-validation-protocols.md)); not run. No human screen-reader walk-through.
- **University data.** Verified admission guides for 8 universities (bachelor's, 2027 Spring); verified language
  rules for 43 institutions; 176 "needs checking" because the official rule is unpublished in a usable form or not
  yet researched.
- **Programme-level data beyond 8 universities.** Programmes, intakes, fees and required documents exist only where an official guide was read (8 universities; Kyungpook's guide download loops on redirects, Sungkyunkwan has no guide on record). Parsers for Study in Korea, NIIED/GKS and other government sources are registered but SKIPPED until written; street addresses and dormitories are not researched (0).
- **University photography.** 166 / 425 institutions have their own campus photograph; the rest need commissioned or
  university-supplied photography (`OWNER_AUTHORISED`); 50 KOGL-1 originals await manual download
  (`docs/qa/v25/MANUAL_MEDIA_ACQUISITION.md`).
- **University agreements.** No real university agreement is recorded; nothing is labelled "partner" until one is.
- **Regulation.** MOE standard agreement text and MOJ registration rules are announced but not final ([LEGAL.md](LEGAL.md) L1–L2).
- **Source licensing.** Confirm commercial bulk-reuse terms for 대학알리미 and Study in Korea data.

## 3. Next-release priorities

1. Stand up the production API host and seed reference data; rerun deployment smoke on all four domains.
2. Console languages: `console-locales.ts` was regenerated on 2026-11-20 — still ko and en only (other locales' console
   namespaces are 17–35 % complete). Offering more console languages needs a console translation pass.
3. Programme-level catalogue from verified official guides beyond the first 8 universities (no demo rows, ever).
4. Legal wording: the privacy policy and terms (10 keys under `marketing.v12.privacy.*` / `v12.terms.*`, every locale)
   still name a "partner agency"; they were left for counsel. Product copy was aligned with the direct-operation model
   in the launch pass (1,820 strings, 53 locales, machine-translated — include in the native-speaker review).
5. Retarget the release tooling at the current docs layout: `release:check` still reads V29 chain logs under `docs/qa/`
   (removed in the cleanup) that must be regenerated; current QA output belongs in `docs/qa/launch-final/`.
6. Real-account journeys against the connected API. Student → message → Operations now passes end to end on the isolated
   stack (`e2e/student-ops-message.spec.ts`, real API and builds); not yet run against the owner's database (needs real accounts).
7. Replace flag emoji in the phone-country picker with the SVG flag set (emoji flags do not render on Windows); move
   remaining single-column grids to `minmax(0, 1fr)`.
8. Native: build and run all three apps on a device or emulator and review the redesigned screens (not visually verified in the final pass); iOS build. The QA machine has no `/dev/kvm` and exposes no CPU virtualisation, so an Android emulator cannot run there: this needs a machine with KVM/HAXM or a real device.
9. SAML and SCIM for university SSO when a real IdP is connected (OIDC is implemented).
10. Performance attribution of LCP on a quiet host (lab numbers were taken on a saturated machine). 2026-11-22 lab: every
    critical page LCP ≤ 2.5 s except the Marketing home at 1440 (2.46–2.90 s across two runs — the hero headline waits for
    the client bundle; prerender the home) and the Operations case at 1440 (2.58 s — its conversation loads after the workspace).
11. Student application as a sectioned workspace (requirements · documents · writing · timeline · messages) instead of one
    long page; the 2026-11-22 pass removed repetition but kept the single scroll.
12. Operations at scale: with 1,071 students on one development API process, Today's first ranked row appears in ≈1.2 s but
    every count settles only after ≈5 s (requests serialise in one Python process). Run the production API with several
    workers and re-measure (`scripts/qa/launch-final/ops-scale.mjs`); `GET /agency/today/queue` alone is ≈1.05 s.

## 4. Explicitly not planned

Admission probabilities, scores or rankings of likelihood; "guaranteed admission" claims; essay generation;
collecting tuition; storing university portal passwords; publishing unverified facts; a marketplace of external
agencies as a service layer.
