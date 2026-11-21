# Fuse — Timeline

Assumes **24 h/week** (3 h × 5 weekdays + 6 h Sat + 3 h Sun), starting **Mon 2026-11-23**. If the start slips, shift every date by the same offset. Bug IDs (B#) and improvement IDs (I#) refer to `improvements-and-bugs.md`.

## Done so far (from git)

| Dates | What landed |
|---|---|
| 2025-11-15 → 11-23 | First working VM create/exec over SSH, code split into modules, writeFile parsing fix |
| 2026-01-24 | README pass |
| 2026-09-03 → 09-05 | Renamed to Fuse, converted to a pnpm + Turborepo monorepo, Redis race fixes |
| 2026-09-06 → 09-11 | Prisma moved to `packages/db`, multi-host schema (`Host`) |
| 2026-09-13 | IP + port pools in Postgres (`SKIP LOCKED`), so IP allocation no longer uses Redis |
| 2026-09-14 → 09-19 | Env helper, frontend dashboard, end-to-end start working |
| 2026-09-15 | Go agent scaffold (`agent/`, hello-world only) |
| 2026-09-23 → 09-25 | Google auth (Auth.js JWT), seed scripts, host paths from env, backend on `127.0.0.1:4000` |

## Plan

| # | Task | Est h | Week | Depends | Fixes | Done when | Status |
|---|---|---|---|---|---|---|---|
| 1 | Fix delete leaks: release IP, read port maps before row delete, `await` in controller | 4 | W1 | — | B1 B2 B3 B20 B22 | Create→delete ×20 leaves pools fully `AVAILABLE`, no DNAT rules left | ☑ 2026-11-20 |
| 2 | Create rollback + `CREATING`/`RUNNING`/`TERMINATING` status flow | 4 | W1 | 1 | B4 B11 | Kill SSH mid-create → IP, TAP, process, rootfs all cleaned up | ☑ 2026-11-20 |
| 3 | Error handling: keep typed errors, 400/404, frontend `catch` + toast | 2 | W1 | — | B5 B16 B21 B25 | Bad input → 400 with message, missing VM → 404 | ☑ 2026-11-20 |
| 4 | Fix process kill + move PID tracking from Redis to PG, drop Redis | 3 | W1 | 2 | B6 B7 B17 | `ps` shows no firecracker after delete; Redis removed from deps | ☑ 2026-11-20 |
| 5 | Auth: hashed API keys, backend middleware, secure `getUserInfo`, real key rotate | 4 | W1 | — | B8 B9 B10 B23 | Request without a key → 401; can't touch another user's VM | ☑ 2026-11-20 |
| 6 | Agent protocol on paper (framing, request id, errors, readiness) | 2 | W1 | — | — | 1-page spec in `notes/` | ☐ |
| 7 | Go agent: vsock echo server (`mdlayher/vsock`) | 4 | W1 | 6 | — | Host `CONNECT 52` gets echo back from guest | ☐ |
| 8 | Agent commands: exec (stream stdout/stderr, exit code, timeout), write, mkdir | 6 | W2 | 7 | B13 B14 B15 | Same API results as SSH; 10 MB file write works | ☐ |
| 9 | Host side: `PUT /vsock` in create, Node UDS client, readiness wait | 4 | W2 | 7 | B12 | Create waits on agent ready instead of SSH retries | ☐ |
| 10 | Bake agent into rootfs (static `CGO_ENABLED=0` build) + autostart | 3 | W2 | 8 | — | Fresh rootfs boots with agent listening, no manual step | ☐ |
| 11 | Cut controllers over to agent, delete `ssh2` + SSH helpers | 3 | W2 | 9 10 | B12 B18 | `grep ssh2` returns nothing | ☐ |
| 12 | PTY over vsock + WebSocket bridge in backend | 6 | W2 | 11 | — | `top` runs interactively via wscat | ☐ |
| 13 | Terminal UI (xterm.js) in dashboard | 4 | W3 | 12 | — | Click VM → live shell | ☐ |
| 14 | `execSync` → async spawn, non-blocking rootfs copy | 3 | W3 | — | B19 | Other requests respond during a create | ☑ 2026-11-20 |
| 15 | Snapshot / resume (`PATCH /vm` Paused → `/snapshot/create` → `/snapshot/load`) | 10 | W3 | 11 | — | Pause VM, kill process, restore, state + agent intact | ☑ 2026-11-20 (untested on KVM) |
| 16 | Quotas + TTL/idle reaper + startup orphan reconcile | 4 | W3 | 2 4 | I3 I4 | Restart backend → orphans cleaned; user capped at N VMs | ☐ |
| 17 | Usage metering (VM-seconds, exec count) + dashboard card | 3 | W4 | 16 | I5 | "Usage this month" per user | ☐ |
| 18 | Ops: `/health`, structured logs, host setup script, deploy demo | 4 | W4 | 5 | I6 I7 I8 | Public demo on a KVM host | ☐ |
| 19 | Cleanup + docs: dead code, stale READMEs, demo video | 3 | W4 | all | B24 I9 I10 | Reviewer can follow README to a running VM | ☐ |

**Total ≈ 76 h** (~3.2 weeks at 24 h/wk, plus buffer).

## Weeks

| Week | Dates | Tasks | Hours | Milestone |
|---|---|---|---|---|
| W1 | Nov 23 – Nov 29 | 1–7 | 23 | **M1:** no leaks, auth on, agent echoes over vsock |
| W2 | Nov 30 – Dec 6 | 8–12 | 22 | **M2:** SSH deleted, exec + PTY over vsock |
| W3 | Dec 7 – Dec 13 | 13–16 | 21 | **M3:** terminal in UI, snapshot/resume, reaper |
| W4 | Dec 14 – Dec 20 | 17–19 + buffer | 10 + 14 buffer | **Ship:** metering, live demo, docs |

Highest overrun risk is **#15 snapshot/resume**, followed by **#10 rootfs baking**. W4's buffer is there to absorb that. Log actual hours against the estimates to catch slippage early.
