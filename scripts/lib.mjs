import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const SERVER = join(ROOT, 'server');
export const VENV_BIN = join(SERVER, '.venv', process.platform === 'win32' ? 'Scripts' : 'bin');
export const PY = join(VENV_BIN, process.platform === 'win32' ? 'python.exe' : 'python');
export const hasVenv = () => existsSync(PY);

export const c = { dim: (s) => `\x1b[2m${s}\x1b[0m`, bold: (s) => `\x1b[1m${s}\x1b[0m`, green: (s) => `\x1b[32m${s}\x1b[0m`, yellow: (s) => `\x1b[33m${s}\x1b[0m`, red: (s) => `\x1b[31m${s}\x1b[0m`, orange: (s) => `\x1b[38;5;208m${s}\x1b[0m` };

export function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', cwd: ROOT, ...opts });
  if (r.status !== 0 && !opts.allowFail) {
    console.error(c.red(`✖ ${cmd} ${args.join(' ')} failed (exit ${r.status})`));
    process.exit(r.status ?? 1);
  }
  return r.status === 0;
}

export function which(cmd) {
  return spawnSync(process.platform === 'win32' ? 'where' : 'which', [cmd], { stdio: 'ignore' }).status === 0;
}
