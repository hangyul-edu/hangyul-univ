import { execFileSync } from 'node:child_process';

/** E2E specs run against the development stack; remove the accounts they created so the demo dataset stays coherent. */
export default function globalTeardown() {
  if (process.env.HG_E2E_KEEP === '1') return;
  execFileSync('node', ['scripts/api.mjs', 'purge-e2e'], { stdio: 'inherit' });
}
