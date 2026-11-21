# Start Again

## Where you left off
- Last commit **2026-09-25** `90a9124`: backend moved to `127.0.0.1:4000`.
- Before that (Sep 23): Google auth, seed scripts, host paths read from env.
- **Works:** create VM → exec / write → get-host (expose a port).
- **Broken:** delete. Explained below.
- **Not started:** Go agent. `agent/main.go` is still a hello-world.
- `apps/backend/notes/startagain.md` is the old plan (Python agent, "Wick"). It's stale, so ignore it.

## Why delete is broken (4 bugs stacked)
1. `createVM.controller.ts:19`: `deleteVm` isn't `await`ed. The client gets `{}` straight away and errors vanish.
2. `vm.service.ts:46-47`: the VM row is deleted **before** its port maps are read. Cascade wipes them, so the DNAT rules and ports are never freed.
3. `firecracker.delete.ts`: the IP is **never** set back to `AVAILABLE`, so the pool drains.
4. `firecracker.delete.ts:42`: `process.kill` on a `sudo`-spawned firecracker fails with `EPERM`, so the VM keeps running.

**Correct order:** mark `TERMINATING` → read port maps → kill process (`sudo kill`) → remove TAP, socket and rootfs → free ports → free IP → delete row.

## Get it running (~30 min)
1. Linux KVM host: `ls /dev/kvm`, check Redis and Postgres are up.
2. `pnpm install`, then `cd packages/db && npx prisma migrate deploy`.
3. `pnpm seed:host` → put the printed `HOST_ID` in `apps/backend/.env`.
4. Check the `.env` paths exist: `FIRECRACKER_BIN`, `KERNEL_IMAGE`, `ROOTFS_GOLDEN`, `VM_DIR`, `VM_SSH_KEY`.
5. `pnpm dev`, then `curl` create → run `ls` → delete.
6. After delete, check what leaked: `ps aux | grep firecracker`, `ip link | grep tap_`, `sudo iptables -t nat -L`, `IpPool`/`PortPool` rows.

## First week
1. Fix delete (bugs 1–4 above) and get one clean create → delete cycle working.
2. Roll back a failed create (insert the row as `CREATING` first).
3. Add backend API-key auth and an `auth()` check in `getUserInfo`.
4. Write the agent protocol on paper, then build the Go vsock echo server.

Full plan: `timeline.md`. All bugs: `improvements-and-bugs.md`.
