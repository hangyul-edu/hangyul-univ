# Single sign-on for university and agency staff

Status (V3): **OIDC implemented and tested against a fake identity provider; SAML 2.0 defined as an interface only.**
No real IdP has been connected yet — nothing below is claimed to work with a specific vendor until it has been tried.

## What exists

| Piece | Where |
|---|---|
| Provider abstraction (`SSOProvider`), generic `OIDCProvider`, `SAMLProvider` placeholder | `server/app/core/sso.py` |
| Organisation configuration `OrgSSOConfig` and in-flight login state `SSOLoginState` | `server/app/models/university_ops.py` |
| Endpoints `/api/v1/sso/lookup`, `/start`, `/callback`, `/config` (GET/PUT) | `server/app/api/v1/sso.py` |
| Password sign-in refused when an organisation **enforces** SSO for the user's email domain | `server/app/api/v1/auth.py` (`_sso_enforced`) |
| Console UI: "Continue with your university account" appears only when the typed email's domain has SSO | `apps/university-web/src/pages/Login.tsx` |
| Tests (RS256 ID tokens, JWKS, PKCE, state reuse, bad nonce, foreign domain, admin-only config) | `server/tests/test_v3_university_sso.py` |

Password authentication, refresh-token rotation and sessions are unchanged: after a successful IdP login the callback
issues exactly the same refresh cookie as password sign-in and redirects to the console, which restores the session with
its normal `/auth/refresh` call.

## Flow (OIDC authorization code + PKCE)

1. The console calls `GET /api/v1/sso/lookup?email=` as the user types. The response reveals only whether the domain
   uses SSO, the organisation's name and the protocol.
2. The browser navigates to `/api/v1/sso/start?config_id=…&client=university`. The server creates `state`, `nonce` and a
   PKCE verifier (stored server-side in `sso_login_states`, valid 10 minutes, single use) and redirects to the IdP.
3. The IdP redirects to `/api/v1/sso/callback?code&state`. The server:
   - checks the state (unknown, reused or expired → 400);
   - exchanges the code at the token endpoint with the PKCE verifier (and the client secret if configured);
   - validates the ID token signature against the IdP's JWKS (RS256/ES256), `iss`, `aud`, `exp`, `iat`, `sub` and the `nonce`;
   - requires a verified email whose domain is in `allowed_domains`;
   - finds the user by email or creates one (random unusable password), and adds a membership in the organisation if
     missing. Since V22 a tenant has exactly one role, so an SSO-provisioned member of a university becomes `UNIVERSITY_ADMIN`
     and of an agency `AGENCY_ADMIN` whatever `default_role` says; only Hangyul's own organisation still chooses a
     `HANGYUL_*` role, and `HANGYUL_SUPER_ADMIN` is refused;
   - writes a `LoginEvent` (reason `sso`) and an audit entry, sets the refresh cookie and redirects to `/?sso=1`.

## Configuration

Organisation admins (`UNIVERSITY_ADMIN`, `AGENCY_ADMIN`) or Hangyul super admins use `PUT /api/v1/sso/config`:

```json
{
  "protocol": "OIDC",
  "issuer": "https://login.microsoftonline.com/<tenant-id>/v2.0",
  "client_id": "<application id>",
  "client_secret_ref": "HG_SSO_PNU_CLIENT_SECRET",
  "allowed_domains": ["pusan.ac.kr"],
  "default_role": "UNIVERSITY_ADMIN",
  "enabled": true,
  "enforce": false
}
```

**Secrets are never stored in the database.** `client_secret_ref` is the *name* of an environment variable (or a
secret-manager entry mounted into the environment). `GET /sso/config` only reports whether it is present.

## Deployment requirements

1. Register the application at the IdP with redirect URI `https://<console-host>/api/v1/sso/callback` for each console
   (university and agency consoles are separate origins) and scopes `openid email profile`.
2. Set `HG_SSO_CALLBACK_URL` to that public URL when the API sits behind a proxy or on a different host; otherwise the
   callback URL is derived from the request. The callback must be served **on the console's own origin** (same-origin
   `/api` proxy, as in development) so the refresh cookie lands where the console reads it.
3. Provide the client secret through the variable named in `client_secret_ref` (public clients can omit it — PKCE is always used).
4. Outbound HTTPS from the API to the IdP's discovery, JWKS and token endpoints (discovery and JWKS are cached for one hour).
5. `HG_ENV=production` so cookies are `Secure`.
6. Decide per organisation whether to `enforce` SSO. Keep at least one break-glass admin account on a domain that is not enforced.

## Not implemented yet

- **SAML 2.0**: needs a maintained signed-assertion library (e.g. `python3-saml` or `pysaml2`), SP metadata
  (`/api/v1/sso/saml/metadata`), IdP certificate rotation and assertion replay protection. Choosing `SAML` today shows
  "SAML sign-in is not available yet" instead of pretending to work.
- SCIM provisioning / automatic de-provisioning (removing a person at the IdP does not yet remove their membership;
  existing sessions end when the refresh token expires or an admin deactivates the membership).
- A console settings screen for SSO (configuration is API-only in V3).
