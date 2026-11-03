# V22 completion — environment diagnosis (2026-10-24 14:57 KST)

Raw evidence: `logs/env-snapshot.txt` (free/swap/df/uptime/top), `logs/kernel-evidence.txt` (dmesg, journalctl of the
previous boot, `/var/log/kern.log`, the host `.wslconfig` read-only, AVD config).

## Measured

| Item | Value |
|---|---|
| VM RAM / swap | 5.8 GiB total (host `.wslconfig` `memory=6GB`, `processors=8`, `swap=8GB`, `autoMemoryReclaim=gradual`) — 8 GiB swap partition is present and in use (288 MiB) |
| Disk | `/` 1007 GB, 67 GB used (7 %) — **no disk exhaustion** |
| Uptime at diagnosis | **3 minutes** — the whole WSL VM restarted at ~14:54; every service of the previous session (API, Vite, Metro, emulator, adb) was gone |
| Kernel OOM evidence | `/var/log/kern.log`: **two global OOM kills in the previous boot** — 14:10:44 (`python3` pid 15189, anon-rss 3.83 GB, total-vm 13.1 GB) and 14:47:09 (`postgres` invoked the killer; victim `python3` pid 6443, anon-rss 3.73 GB, total-vm 13.1 GB). `journalctl -k` carries nothing (no persistent journal); `dmesg` of the current boot is clean |
| The 3.7–3.8 GB `python3` | Not Hangyul Univ. Live processes with the same shape: `python3 -m factory.cli …` (cwd `/root/hangyul-longform`, a video/audio pipeline with `ffmpeg` children, 220–450 MB resident at diagnosis time, peaks >3.7 GB per the OOM record), driven by a second `claude --continue` session (pid 532) |
| Hangyul Univ footprint during the walk (before the restart) | API uvicorn ~200 MB, marketing Vite ~250 MB, Metro ~400–600 MB, Android emulator `hg35` (`hw.ramSize=1536M`, 4 cores, no GPU) launched with `-memory 2048` ≈ 2.3 GB, Claude session ~320 MB |

## Determination

- **WSL OOM: confirmed** (kernel `Out of memory: Killed process` twice in the previous boot). The victim both times was the
  3.7 GB+ `python3` from the *other* project; the global OOM state coincided with this project's emulator + Metro + Vite +
  API all being resident. The VM restart that followed (uptime reset) is consistent with the host recycling the VM after
  the second OOM; there is no kernel panic record.
- **Node memory exhaustion: no evidence** (no Node OOM traces in any persisted log; vitest/Playwright exits were clean).
- **Gradle memory pressure: not implicated** — no Gradle ran in this session; the last Android build was V19's.
- **Emulator memory pressure: contributing** — `-memory 2048` exceeded the AVD's own 1536 MB design and sat next to Metro.
- **Too many Vite/API/test processes: contributing earlier** — the full `npm run dev` runner (API + 4 Vite servers) was
  used during web validation; it was reduced to API-only + marketing-only before the restart.
- **Disk exhaustion: no.**
- **Session/background-process loss: yes, as a consequence** — long-running background validation lost its result each
  time the VM restarted (`/tmp` scratch is wiped), which is why repo-persisted logs under `docs/qa/v22/completion/logs/`
  are now the only record.

## Mitigations applied (local, conservative — no `.wslconfig` change)

1. One emulator only, started with `-memory 1536` (the AVD's own size), no window, no audio, software GPU.
2. Only the services a step needs: API for everything; Metro only during the native walk; marketing Vite only during
   the legal-sheet step; **no** full `npm run dev` stack during the regression (Playwright uses its own isolated stack).
3. One heavy thing at a time, in the foreground, each command's exit code captured with `set -o pipefail … | tee`.
4. The native walk runs as four awaitable stages (`--stage auth|verify|consent|post`), each well inside a foreground
   command timeout, sharing one emulator and one Metro.
5. Playwright `--workers=1`, specs run one at a time with per-spec logs.
6. Gradle release build with `--no-daemon --max-workers=1` and the web/Metro/emulator stopped first.
7. The unrelated `/root/hangyul-longform` processes are **not** touched (they belong to another live session).
