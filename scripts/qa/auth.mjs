// V32 — how QA scripts sign in: the real password login with the FIXTURE accounts of an isolated test/e2e database.
// There is no demo-login endpoint and no test-account button any more; a gate that needs a session asks for one here.
export const FIXTURE_PASSWORD = 'Hangyul!2026';

/** An access token for a fixture account. `api` is the API origin + '/api/v1' (e.g. http://localhost:8090/api/v1). */
export async function apiToken(api, email, client, password = FIXTURE_PASSWORD) {
  const r = await fetch(`${api}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password, client }) });
  if (!r.ok) throw new Error(`login failed for ${email} (${r.status})`);
  return (await r.json()).access_token;
}
