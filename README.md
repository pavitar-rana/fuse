# Fuse

**Self-hosted cloud sandboxes on Firecracker microVMs.** Spin up an isolated Linux VM in seconds, run code in it over an API, tear it down when you're done. Think E2B, Daytona, or Modal sandboxes, built from the hypervisor up.

## Why this exists

Running untrusted code (AI agents, user submissions, CI jobs) needs real isolation, not containers pretending to be it. Fuse uses [Firecracker](https://firecracker-microvm.github.io/), the same KVM-based microVM tech behind AWS Lambda, to give every workload its own kernel, its own rootfs, and its own network namespace, with boot times measured in hundreds of milliseconds.

No orchestration frameworks. No managed services. Just the Firecracker API socket, Linux networking primitives, and TypeScript.

## What's inside

```
apps/
  backend/    Express control plane: VM lifecycle, networking, SSH exec
  frontend/   Next.js dashboard: API keys, VM fleet, resource stats
```

**Control plane** (`apps/backend`)

- Provisions microVMs directly against the Firecracker HTTP API over Unix sockets
- Per-VM copy-on-create rootfs, deterministic MAC derivation, IP pool allocation
- Builds the network by hand: TAP interfaces, `br0` bridge, NAT forwarding, host port mapping
- Executes commands and writes files inside guests over SSH
- PostgreSQL via Prisma for users, projects, and VM state; Redis for hot-path session and VM tracking
- Multi-tenant with API-key auth and per-user project isolation

**Dashboard** (`apps/frontend`)

- Next.js App Router, React 19, Tailwind v4, Radix primitives
- Auth.js with a shared Prisma adapter, so the backend and frontend agree on identity
- Fleet view: status, vCPU and memory allocation, one-click provisioning

**Repo** is a pnpm workspace with Turborepo for task orchestration and caching.

## Engineering notes

- **Isolation is the product.** Every design choice starts from "what if the guest is hostile?" Guests get a real kernel boundary, a private L2 segment, and nothing else.
- **Own the primitives.** The networking layer is raw `ip` and `iptables` calls, not a CNI plugin. It's less magic, easier to debug, and cheaper to run.
- **Boring, typed, end to end.** TypeScript on both sides, one Prisma schema, one source of truth for the data model.

## Running it

Requires a Linux host with KVM

## Status

Working prototype. Solo project. Active development on scheduling, snapshot/restore, and resource quotas.
