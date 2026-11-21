# Fuse — Bugs & Improvements

Checked against `main` @ `90a9124` (2026-11-19). Severity: 🔴 breaks or leaks · 🟠 security · 🟡 wrong but survivable · ⚪ minor. The **T#** column is the task in `timeline.md` that fixes it.

## Bugs

| ID | Sev | Where | Problem | Fix | T# |
|---|---|---|---|---|---|
| B1 | 🔴 | `firecracker.delete.ts` (whole file) | **IPs never go back to the pool.** Nothing sets `IpPool` back to `AVAILABLE`, so after ~253 creates the host is dead | Release the IP as the **last** teardown step (after the process and TAP are gone) | 1 |
| B2 | 🔴 | `vm.service.ts:46-47` | `deleteVmById` runs before `getPortMap`, and `PortMapping` is `onDelete: Cascade`, so the list comes back empty. DNAT rules and `PortPool` rows leak | Read the port maps first, or better: mark `TERMINATING` → teardown → delete the row | 1 |
| B3 | 🔴 | `createVM.controller.ts:19` | `deleteVm` isn't awaited, so the client gets `{}` + 201 instantly and teardown errors become unhandled rejections | `await` it and return 200 | 1 |
| B4 | 🔴 | `firecracker.create.ts:28-74` | No rollback. If boot/SSH fails, the IP, TAP, firecracker process and rootfs copy all leak with no DB record | try/catch with compensating steps in reverse order | 2 |
| B5 | 🟡 | `vm.service.ts:37,55,100` | `catch (e) { throw serviceError(500) }` turns every 400/404 into a 500 and drops the message | Rethrow errors that already carry a `status` | 3 |
| B6 | 🔴 | `firecracker.delete.ts:42` | Firecracker runs under `sudo` (root), so `process.kill(-pid)` from non-root Node → `EPERM`, which gets logged and the VM keeps running | `sudo kill -9 -<pgid>`, or run Firecracker with the jailer as a dedicated user | 4 |
| B7 | 🔴 | `firecracker.process.ts:21-33`, `firecracker.delete.ts:34-50` | PID list is a read-modify-write of one Redis JSON blob, so concurrent creates lose entries (unkillable VMs). Top-level `await getRedisClient()` also crashes on import if Redis is down | Store pid in the `Virtualmachine` row (PG), drop Redis | 4 |
| B8 | 🟠 | all controllers | No backend auth. `userId` comes from the body, so anyone who reaches the API can exec in any VM | API-key middleware, with userId taken from the key | 5 |
| B9 | 🟠 | `frontend/actions/get-user-info.ts:5` | Server actions are public endpoints and this one takes any `id` without checking `auth()`. It returns the full `User`, **including the apiKey** | Get the id from `auth()`, never from the arg; `select` without apiKey | 5 |
| B10 | 🟠 | `frontend/app/page.tsx:93-98`, `schema.prisma:15` | "Generate API key" makes a `Math.random` key client-side that is never saved. Real keys are stored in plaintext | Server action that generates + stores a SHA-256 hash and shows the key once | 5 |
| B11 | 🟡 | `vm.repository.ts:87`, `vm.service.ts:22` | The row is inserted only after a full boot, already `RUNNING`. If the backend crashes mid-create, nothing is on record. `CREATING`/`TERMINATING`/`FAILED` are never used | Insert `CREATING` first, update on success/failure | 2 |
| B12 | 🔴 | `firecracker.ssh.ts:4-5` | `connected`/`lastErr` live at module scope. After the first success they stay `true` forever, so a failed connect still "succeeds". It's also called on every exec (up to ~40 s of retries) | Move them inside the function. Goes away entirely with the agent | 9, 11 |
| B13 | 🟡 | `ssh.exec.ts:24,45,55,61` | User paths are interpolated inside `'...'`, so a `'` in a path breaks out (shell injection inside the guest) | Agent takes argv/paths as structured fields, so no shell | 8 |
| B14 | 🟡 | `ssh.exec.ts:58-61` | `writeFile` puts the whole base64 payload in the command line, so large files hit `ARG_MAX` | Stream bytes over the channel/agent | 8 |
| B15 | ⚪ | `vmExec.service.ts:74` | `!content` rejects `""`, so you can't create an empty file | `content === undefined` | 8 |
| B16 | ⚪ | `vmExec.service.ts:50,56`, `vm.service.ts:69` | Missing params / not found → 500 | 400 / 404 | 3 |
| B17 | ⚪ | `helpers/redis/index.ts:8` | `createClient()` has no URL, so it only works with localhost Redis | Env var (moot after B7) | 4 |
| B18 | 🟡 | `ssh.connect.ts:15-38,53` | A stale `close` handler from a failed attempt deletes the *new* map entry. `disconnectSSH` skips half-open entries. The map is keyed by IP, which gets reused. `createDir` never reconnects | Delete the SSH layer (agent, keyed by VM id) | 11 |
| B19 | 🟡 | `firecracker.create.ts:29`, `firecracker.network.ts`, `firecracker.delete.ts` | `execSync` everywhere, so a multi-GB rootfs copy freezes all requests | `execFile`/`spawn` with promises | 14 |
| B20 | 🟡 | `vm.service.ts:74-92` | `get-host`: find → allocate → create isn't atomic. Two concurrent calls for the same port mean the 2nd `createPortMap` hits the unique constraint and its `PortPool` row stays `ALLOCATED`. `port` isn't validated either | One transaction, or allocate + map in the same tx; validate 1–65535 | 1 |
| B21 | ⚪ | `frontend/app/page.tsx:127-163` | Hardcoded `https://firecracker.pavitr.cloud`, no `catch` (no error shown), and it sends `kernelImage`/`rootfsPath` that the backend ignores | `NEXT_PUBLIC_API_URL`, error toast, drop the dead fields | 3 |
| B22 | ⚪ | `firecracker.network.ts:12,25` | The FORWARD rule uses a hardcoded `--dport 22` instead of `vmPort` and gets added again for each mapping. It only works because of the blanket `-o br0 ACCEPT` | Use `vmPort`, or drop it | 1 |
| B23 | 🟠 | `firecracker.network.ts:46-50` | All VMs share `br0` with `FORWARD -i/-o br0 ACCEPT`, so **tenants can reach each other's VMs** and any host service bound to 172.16.0.1 / 0.0.0.0 | ebtables/iptables to block VM↔VM and VM→host, or one bridge/netns per VM | 5 |
| B24 | ⚪ | `env.ts:11`, `firecracker.network.ts:32`, `firecracker.utils.ts:6`, `firecracker.create.ts:51` | `HOSTADDR` is required but unused. Bridge/gateway are hardcoded instead of coming from `Host.ipRange`. `nameservers` is never applied | Derive them from the Host row, or remove | 19 |
| B25 | ⚪ | `vm.service.ts:78,95` | `messgae` typo in response. create/get return 201 for non-creates | Fix the typo, use 200 | 3 |

**Already fixed since `apps/backend/notes/startagain.md`:** IP check-then-act race (now PG `SKIP LOCKED`), hardcoded `/home/...` paths and SSH key (now env), `:undefined` URLs for VM ≥ 20 (now `PortPool`), backend port clashing with the VM port range (now `127.0.0.1:4000`).

## Improvements

| ID | Area | Idea | Why |
|---|---|---|---|
| I1 | Arch | `ExecTransport` interface (SSH impl → agent impl) | Lets you swap SSH for vsock without touching controllers |
| I2 | Arch | Explicit VM state machine (`CREATING→RUNNING→PAUSED→TERMINATING→TERMINATED/FAILED`) | Makes B4/B11 and snapshot logic tractable |
| I3 | Ops | Startup reconciler: compare PG rows vs `/tmp/firecracker-*.socket`, TAPs, processes | Cleans up orphans after crashes |
| I4 | Limits | Per-user max VMs, VM TTL / idle reaper | 253 IPs per host is a hard ceiling |
| I5 | Billing | Metering table (VM-seconds, exec count) | Needed for "usage this month" |
| I6 | Ops | `/health`, pino structured logs with vmId on every line | Debugging multi-step create |
| I7 | Ops | One-time host setup script (br0, sysctl, NAT) instead of re-running per create | Less `sudo` per request, idempotent boot |
| I8 | API | zod validation + REST shape (`POST /vms`, `DELETE /vms/:id`, `POST /vms/:id/exec`) | Clear contract, fewer 500s |
| I9 | Hygiene | Remove `constants.ts`, `uuid`, `ts-node`, empty `apps/backend/types.ts`, unused `import { error }` (`vm.repository.ts:3`), commented code, unused `Session`/`VerificationToken` (JWT strategy) | Noise |
| I10 | Hygiene | Gitignore `agent/agent-main` (2.4 MB binary). Rewrite the stale `apps/backend/README.md` (port 8080, npm) and `apps/frontend/DASHBOARD.md` | Docs match reality |
| I11 | Perf | CoW rootfs (dm-snapshot / overlay) instead of a full copy | Create time stops scaling with image size |
| I12 | Perf | Warm pool of pre-booted VMs (or snapshots) | Sub-100 ms "create" |
| I13 | Arch | `packages/shared` for protocol + API types | Frontend/backend/agent share one schema |
| I14 | Security | Run Firecracker through the **jailer** (chroot, cgroups, seccomp, non-root uid) | "Isolation is the product", and it also fixes B6 |
| I15 | Security | Egress policy + rate limiting per VM | Stops sandboxes being used for abuse |
| I16 | Tests | Integration test: create → exec → write → get-host → delete, asserting pools are back to `AVAILABLE` | Catches B1/B2 regressions |
