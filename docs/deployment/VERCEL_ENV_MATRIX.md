# Vercel environment matrix

Names and purposes only. **No values.** Web variables are inlined at build time, so changing one requires a redeploy.

M = Marketing (`hangyul-univ`), S = Student, A = Agency, U = University, API = `hangyul-univ-api` (not yet deployed).

| variable | M | S | A | U | API | Production | Preview | Secret? | source / purpose |
|---|---|---|---|---|---|---|---|---|---|
| `VITE_MARKETING_URL` | ✓ | ✓ | ✓ | ✓ | | `https://univ.talkhangyul.com` | same | no | links back to the public site (`Register.tsx`, `Services.tsx`, university `Programs.tsx`) |
| `VITE_STUDENT_APP_URL` | ✓ | ✓ | ✓ | ✓ | | `https://app.univ.talkhangyul.com` | same | no | marketing CTAs (`marketing-web/src/lib/env.ts`), `productUrl()` in `packages/ui/src/devaccess.tsx` |
| `VITE_AGENCY_APP_URL` | ✓ | ✓ | ✓ | ✓ | | `https://admin.univ.talkhangyul.com` | same | no | as above |
| `VITE_UNIVERSITY_APP_URL` | ✓ | ✓ | ✓ | ✓ | | `https://partner.univ.talkhangyul.com` | same | no | as above |
| `VERCEL_GIT_COMMIT_SHA`, `VERCEL_ENV` | auto | auto | auto | auto | auto | system | system | no | written into `/build-info.json` |
| `HG_ENV` | | | | | ✓ | `production` | `staging` | no | fail-closed start-up checks |
| `HG_DATABASE_URL` | | | | | ✓ | managed Postgres | separate DB | **yes** | SQLAlchemy URL (`postgresql+psycopg://…`) |
| `HG_REDIS_URL` | | | | | ✓ | managed Redis (TLS `rediss://`) | separate | **yes** | OTP, rate limits, signup sessions |
| `HG_JWT_SECRET` | | | | | ✓ | ≥ 32 random chars | different | **yes** | access tokens |
| `HG_FILE_URL_SECRET` | | | | | ✓ | ≥ 32 random chars, ≠ JWT | different | **yes** | signed file URLs |
| `HG_MFA_ENCRYPTION_KEY` | | | | | ✓ | 32 bytes, base64url | different | **yes** | staff TOTP secrets |
| `HG_PAYMENT_TOKEN_ENCRYPTION_KEY` | | | | | ✓ | 32 bytes | different | **yes** | stored payment credentials envelope |
| `HG_PUBLIC_ORIGIN` | | | | | ✓ | `https://app.univ.talkhangyul.com` | preview URL | no | links in e-mail and SMS |
| `HG_PUBLIC_API_ORIGIN` | | | | | ✓ | `https://api.univ.talkhangyul.com` | | no | provider callbacks |
| `HG_CORS_ORIGINS` | | | | | ✓ | the four https domains | | no | only needed for non-proxied callers; browsers use the same-origin rewrite |
| `HG_STORAGE_BACKEND`, `HG_S3_BUCKET`, `HG_S3_SSE`, `HG_S3_REGION`, `HG_S3_ACCESS_KEY_ID`, `HG_S3_SECRET_ACCESS_KEY` (`HG_S3_ENDPOINT_URL` for non-AWS) | | | | | ✓ | `s3`, private bucket, `AES256`/`aws:kms` | separate bucket | keys **yes** | private documents |
| `HG_MALWARE_SCANNER`, `HG_CLAMD_HOST`, `HG_CLAMD_PORT` | | | | | ✓ | `clamd` + reachable host | | no | upload scanning (required in production) |
| `HG_TURNSTILE_SITE_KEY` / `HG_TURNSTILE_SECRET_KEY` | | | | | ✓ | production widget for the four hostnames | | secret **yes** | signup / login CAPTCHA |
| `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`, `SENDGRID_FROM_NAME` | | | | | ✓ | | | key **yes** | e-mail verification |
| `TWILIO_ACCOUNT_SID`, `TWILIO_API_KEY_SID`, `TWILIO_API_KEY_SECRET`, `TWILIO_MESSAGING_SERVICE_SID` | | | | | ✓ | | | **yes** | SMS verification |
| `HG_PAYMENT_PROVIDER`, `HG_TOSS_ENV`, `HG_TOSS_RETURN_ORIGIN`, `HG_TOSS_*_MID/CLIENT_KEY/SECRET_KEY/SECURITY_KEY` | | | | | ✓ | production refuses Toss test keys; live keys only after merchant approval | test keys allowed | **yes** | `HG_TOSS_RETURN_ORIGIN=https://app.univ.talkhangyul.com` |


`VITE_DEMO_LOGINS` and `VITE_REVIEW_MODE` were removed in V32 with the features they switched; no build reads them.
