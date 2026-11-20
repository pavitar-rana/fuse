# Fuse

**Self-hosted cloud sandboxes on Firecracker microVMs.** Spin up an isolated Linux VM, run code in it over an API, tear it down when you're done. Same idea as E2B, Daytona, or Modal sandboxes, built from the hypervisor up.

## Why

Running untrusted code (AI agents, user submissions, CI jobs) needs real isolation, and containers don't give you that. Fuse uses [Firecracker](https://firecracker-microvm.github.io/), the KVM microVM behind AWS Lambda, so every workload gets its own kernel, its own rootfs and its own TAP device on a private bridge.

There are no orchestration frameworks or managed services in the stack. It's the Firecracker API socket, Linux networking primitives and TypeScript.

## Repo layout

```
apps/backend/    Express control plane: VM lifecycle, networking, exec (currently over SSH)
apps/frontend/   Next.js dashboard: Google sign-in, VM list, create/delete
packages/db/     Shared Prisma schema + client (@fuse/db), seed scripts
agent/           Go guest agent (vsock), early scaffold, not wired in yet
```

pnpm workspaces + Turborepo. One Prisma schema serves both apps.

## How it works today

**Create** (`POST /firecracker/create`)
1. Reserve an IP from `IpPool` in Postgres (`FOR UPDATE SKIP LOCKED`) and insert the `Virtualmachine` row as `CREATING`
2. Copy the golden rootfs → `VM_DIR/vm-<id>.ext4` (`cp --reflink=auto`)
3. Create the TAP, attach it to `br0` (172.16.0.1/24) as an isolated port, set up NAT masquerade on `UPLINK_IFACE`
4. Spawn `firecracker --api-sock /tmp/firecracker-<id>.socket` and store its PGID on the row
5. `PUT /boot-source`, `/drives/rootfs`, `/network-interfaces/eth0`, `/machine-config`, `/actions InstanceStart`
6. Wait for SSH, then mark the row `RUNNING`

If any step fails, everything acquired so far is torn down (port maps, process, socket, rootfs, TAP, then the IP) and the row is marked `FAILED`.

**Exec**: `run`, `write` and `create-dir` all go over SSH as root, and each user's files live under `/root/<projectId>/`.

**Expose a port** (`POST /firecracker/get-host`): reserves a host port from `PortPool`, adds an iptables DNAT rule and returns `ADDR_PREFIX:<hostPort>`.

**Delete**: mark `TERMINATING` → remove port maps (DNAT + `PortPool`) → `sudo kill` the process group → remove socket, rootfs copy, TAP → release the IP → delete the row. Every step is idempotent, so a failed delete can be retried.

**Pause / resume**: pause freezes the guest, writes a full snapshot (`VM_DIR/vm-<id>.snap` + `vm-<id>.mem`, the mem file is the size of the VM's RAM), then kills Firecracker and removes the TAP, so a paused VM uses no RAM or CPU. It keeps its IP, port maps and rootfs, because the guest's network config is inside the snapshot. Resume recreates the TAP, starts a new Firecracker, loads the snapshot (`resume_vm: true`), waits for SSH and deletes the snapshot files. A failed resume leaves the snapshot in place so you can retry.

**Isolation**: TAPs are isolated bridge ports (no VM↔VM traffic), and `INPUT -i br0` drops anything a guest initiates toward the host.

## Data model (`packages/db/prisma/schema.prisma`)

| Model | Purpose |
|---|---|
| `User` | Auth.js user + `apiKeyHash` (SHA-256) and `apiKeyPrefix` for display |
| `Host` | One row per physical host. The backend selects its row via `HOST_ID` |
| `IpPool` / `PortPool` | Per-host allocatable IPs and host ports (`AVAILABLE`/`ALLOCATED`) |
| `Virtualmachine` | IP, MAC, socket, rootfs path, vCPU/mem, status, Firecracker PGID, host |
| `PortMapping` | VM port → host port |

## Running it

**Requirements:** Linux host with KVM (`/dev/kvm`), passwordless `sudo` for `ip`/`iptables`/`firecracker`, Node ≥ 22.18 (the backend runs `.ts` directly through Node type-stripping), pnpm 11, Postgres, a Firecracker binary, an uncompressed kernel (`vmlinux`) and an ext4 rootfs with sshd plus your public key in `/root/.ssh/authorized_keys`.

```bash
pnpm install                      # also runs prisma generate
cd packages/db && npx prisma migrate deploy
pnpm seed:host                    # prints HOST_ID; seeds IPs .2–.254, ports 8000–8999
pnpm seed:user                    # optional dev user; prints a fresh API key once
cd ../.. && pnpm dev              # backend :4000 (127.0.0.1), frontend :3000
```

**Env vars**

| File | Vars |
|---|---|
| `apps/backend/.env` | `DATABASE_URL` `DIRECT_URL` `HOST_ID` `ADDR_PREFIX` (public URL prefix for exposed ports) `HOSTADDR` (required but unused right now) `FIRECRACKER_BIN` `KERNEL_IMAGE` `ROOTFS_GOLDEN` `VM_DIR` `VM_SSH_KEY` `UPLINK_IFACE` `INTERNAL_API_SECRET` (shared with the frontend) |
| `apps/frontend/.env` | `DATABASE_URL` `AUTH_SECRET` `AUTH_GOOGLE_ID` `AUTH_GOOGLE_SECRET` `INTERNAL_API_SECRET` `FUSE_API_URL` (default `http://127.0.0.1:4000`) |
| `packages/db/.env` | `DATABASE_URL` (pooled, used by the apps and seed scripts) `DIRECT_URL` (direct, used only by `prisma migrate`) (+ optional `SEED_*` overrides) |

The dashboard calls the backend from Next server actions (server-to-server), so the browser never talks to the API directly.

## API (all `POST`, JSON body)

Every `/firecracker/*` route needs `Authorization: Bearer fc_...` (generate a key in the dashboard or with `pnpm seed:user`). The user comes from the key, never from the body. Errors are `{ message }` with 400 (bad input), 401, 404 (not your VM / doesn't exist), 409 (VM not `RUNNING`) or 500.

| Route | Body | Notes |
|---|---|---|
| `/firecracker/create` | `config{memSize?, vcpuCount?}` | 128–3072 MiB (default 512), 1–2 vCPU (default 1) → 201 |
| `/firecracker/delete` | `id` | works in any state |
| `/firecracker/pause` | `id` | `RUNNING` → `PAUSING` → `PAUSED`: snapshot to disk, process stopped |
| `/firecracker/resume` | `id` | `PAUSED` → `RESUMING` → `RUNNING`: restored from the snapshot |
| `/firecracker/get-host` | `id, port` | returns public URL for a guest port (1–65535) |
| `/firecracker/exec/run` | `id, projectId, command, path?` | runs in `/root/<projectId>` by default |
| `/firecracker/exec/write` | `id, projectId, path, content` | path is relative to the project dir; `""` is allowed |
| `/firecracker/exec/create-dir` | `id, path` | |

`GET /health` is unauthenticated. The backend only listens on `127.0.0.1`, so put it behind a proxy you control.

## Status

Working prototype and solo project. Create → exec → expose port → delete works on a single host. Remaining known issues are tracked locally in `notes/improvements-and-bugs.md`.

## TODO

**P0: correctness / leaks**
- [x] Release `IpPool` row on delete (IPs currently leak forever)
- [x] Read port maps *before* deleting the VM row (cascade wipes them → DNAT rules + `PortPool` leak)
- [x] `await` `deleteVm` in the controller
- [x] Roll back on failed create (IP, TAP, process, rootfs) and insert the row as `CREATING` first
- [x] Delete flow: `TERMINATING` → teardown → delete row
- [x] Reset `connected`/`lastErr` per call in `attemptSSHConnection`
- [x] Kill Firecracker with `sudo kill` (plain `process.kill` on a root process → `EPERM`)
- [x] Stop services from swallowing typed errors (every failure becomes a 500)

**P0: security**
- [x] Backend API-key middleware (hash keys, resolve key → user, drop `userId` from bodies)
- [x] Check the session in the `getUserInfo` server action (any caller can read any user + apiKey)
- [x] Real API key generate/rotate (the dashboard button makes a fake key client-side)

**P1: guest agent (replace SSH)**
- [ ] Protocol: length-prefixed or NDJSON frames with request ids
- [ ] Go agent: vsock echo, then exec / write / mkdir with streaming + exit codes
- [ ] Host: `PUT /vsock` on create, Node UDS client (`CONNECT <port>\n`), readiness check
- [ ] Bake agent into rootfs + autostart, then delete `ssh2` and the SSH helpers
- [ ] PTY over vsock + xterm.js terminal in the dashboard

**P2: platform**
- [x] Replace `execSync` with async spawn (rootfs copy blocks the event loop)
- [x] Track PIDs in Postgres and drop Redis
- [ ] Reconcile orphans on startup
- [ ] Snapshot / resume
- [ ] Per-user quotas, VM TTL / idle reaper, usage metering
- [ ] Structured logs, host setup script, live demo
- [ ] Stop committing `agent/agent-main`

Schedule: `notes/timeline.md` (local).
