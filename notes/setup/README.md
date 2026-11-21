# Moving Fuse to a new Google Cloud account

The current GCP account expires around **2026-11-30**. When it goes, the server,
its IP, its disk **and the Google OAuth client** go with it.

What does **not** move, because it lives elsewhere and keeps working:
- **Supabase DB:** users, API keys, the `Config` table, and the host's IP and port pools. `HOST_ID` stays the same, so don't re-run `seed:host`.
- **Cloudflare DNS** (`pavitar.dev`): just repoint two A records.
- **Code:** GitHub.

## What is on the server that isn't in git

| Thing | Path on server | In backup as |
|---|---|---|
| Guest kernel | `/mnt/vm-images/vmlinux` | `images.tar.gz` |
| Golden rootfs (Ubuntu 24.04 with node 24 via nvm, 6 GiB sparse, ~2 GiB real) | `/mnt/vm-images/ubuntu.ext4` | `images.tar.gz` |
| XFS loop disk the images sit on (needed for `cp --reflink`) | `/var/lib/fuse-images.img` → `/mnt/vm-images`, plus an fstab line | recreated by `restore.sh` |
| Guest SSH key | `/opt/fuse-keys/vm_ssh_key` | `env/vm_ssh_key` |
| Firecracker v1.16.1 | `/usr/local/bin/firecracker` | `env/firecracker` |
| `.env` files ×3 (backend, frontend, packages/db) | `~/fuse/...` | `env/*.env` |
| pm2 config | `~/fuse/ecosystem.config.cjs` | `env/ecosystem.config.cjs` |
| Caddy config | `/etc/caddy/Caddyfile` | `env/Caddyfile` |

Everything else (bridge `br0`, iptables rules, TAPs) is created by the backend at
runtime, so there's nothing to copy.

## The shortcut: backup and restore (≈30 min)

The backup already exists in `notes/setup/backup/` (made 2026-11-22, 655 MB,
checksums in `SHA256SUMS`). To refresh it:

```bash
bash notes/setup/backup.sh
```

> `backup/` holds secrets (DB URLs, OAuth secret, the guest SSH key). `notes/` is
> gitignored, so it never gets pushed. Don't upload it anywhere public. Copying it to
> a private drive as a second copy is a good idea.

### Step 1: Create the new server (new account)

In the new account: create a project, link billing, and enable the Compute Engine API. Then on your Mac:

```bash
gcloud auth login                      # sign in with the NEW account
gcloud config configurations create fuse-new
gcloud config set project <NEW_PROJECT_ID>
gcloud config set compute/zone asia-south2-b

# Static IP, so it never changes on reboot
gcloud compute addresses create fuse-ip --region asia-south2
gcloud compute addresses describe fuse-ip --region asia-south2 --format='value(address)'

# Same shape as today: 4 vCPU / 8 GB Intel, Debian 13, 100 GB disk.
# Nested virtualization is what gives you /dev/kvm. Without it nothing works.
gcloud compute instances create fuse \
  --machine-type n2-standard-4 \
  --enable-nested-virtualization \
  --min-cpu-platform "Intel Cascade Lake" \
  --image-family debian-13 --image-project debian-cloud \
  --boot-disk-size 100GB --boot-disk-type pd-balanced \
  --address fuse-ip \
  --tags fuse,http-server,https-server

# Firewall: web (Caddy) and the exposed-port range (PortPool is 8000-8999)
gcloud compute firewall-rules create allow-web \
  --allow tcp:80,tcp:443 --target-tags http-server,https-server
gcloud compute firewall-rules create fuse-vm-ports \
  --allow tcp:8000-8999 --target-tags fuse
```

Nested virtualization only works on **Intel** machine types (N1, N2, C2, C3…), not AMD or ARM.
If `n2-standard-4` isn't available on a free trial, use `n1-standard-2` and drop
`--min-cpu-platform`. Then lower `maxHostMemMb` in the `Config` table to fit.

Point your SSH alias at it, in `~/.ssh/config`:

```
Host fuse
  HostName <NEW_IP>
  User pavitarrana
  IdentityFile ~/.ssh/google_compute_engine
```

Run `gcloud compute ssh fuse` once first, so Google pushes your key to the VM.

### Step 2: Restore

```bash
scp -r notes/setup/backup fuse:~/fuse-backup
scp notes/setup/restore.sh fuse:~/
ssh fuse 'bash ~/restore.sh ~/fuse-backup <NEW_IP>'
```

`restore.sh` does the following and is safe to re-run:
1. Checks `/dev/kvm` and adds you to the `kvm` group.
2. Installs git, iptables, xfsprogs and caddy.
3. Installs Firecracker.
4. Creates the 50 G XFS loop disk with reflink and the fstab entry, then unpacks the kernel and rootfs.
5. Installs the guest SSH key.
6. Makes `ip_forward` persistent.
7. Installs nvm, node 24, pnpm 11 and pm2.
8. Clones the repo and drops in the `.env` files.
9. Rewrites `ADDR_PREFIX`, `HOSTADDR` and `UPLINK_IFACE` for the new box.
10. Runs `pnpm install` and the frontend build.
11. Sets up Caddy.
12. Runs `pm2 start` plus `pm2 save` plus `pm2 startup`.

### Step 3: DNS (Cloudflare → pavitar.dev → DNS)

Edit the two A records to `<NEW_IP>` and keep them **DNS only** (grey cloud):
- `fuse` → `<NEW_IP>`
- `firecracker` → `<NEW_IP>`

Caddy picks up Let's Encrypt certificates on its own within a minute of DNS resolving.
If it doesn't, check `sudo journalctl -u caddy -n 50`.

### Step 4: Google sign-in (new OAuth client): don't skip this

The OAuth client ID and secret belong to the **old** project and die with it.

1. Go to the new project → **APIs & Services → OAuth consent screen** (Google Auth Platform).
   - App name: Fuse. User type: External. Scopes: email and profile only.
   - Under **Audience**, click **Publish app**. Otherwise only the test users you add can sign in.
2. Go to **Credentials → Create credentials → OAuth client ID → Web application**.
   - Authorised JavaScript origin: `https://fuse.pavitar.dev`
   - Authorised redirect URI: `https://fuse.pavitar.dev/api/auth/callback/google`
   - Add `http://localhost:3000/api/auth/callback/google` too, for local dev.
3. Put the new `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` into `apps/frontend/.env`, both on the server and on your Mac.
4. Restart: `ssh fuse 'pm2 restart fuse-frontend'`.

Users are matched by email, so existing accounts and their API keys keep working.

> You can do this step **now**, before the move. Create the new OAuth client in the
> new account and swap the env on the current server. Then the login can't break on
> expiry day.

### Step 5: Smoke test

```bash
K=fc_...   # your API key
A=https://firecracker.pavitar.dev/api/firecracker
curl -s https://firecracker.pavitar.dev/api/health
curl -s -X POST $A/create -H "Authorization: Bearer $K" -H 'content-type: application/json' -d '{}'
# then exec `ls` (run), get-host for a port, pause, resume, delete; same as the README
```

Then sign in on https://fuse.pavitar.dev in an incognito window.

### Step 6: Shut the old one down

Only after the smoke test passes. Make sure no VMs are still on the old box,
because paused snapshots live on its disk. Then delete the old instance and release its IP.

## Alternative shortcut: share a disk image across accounts

This works while the old account is still alive, and it copies the *entire* disk (packages,
pm2 setup, everything), so there's no restore script.

```bash
# OLD account
gcloud compute instances stop fuse --zone asia-south2-b
gcloud compute images create fuse-host-img --source-disk fuse --source-disk-zone asia-south2-b
gcloud compute images add-iam-policy-binding fuse-host-img \
  --member user:<NEW_ACCOUNT_EMAIL> --role roles/compute.imageUser

# NEW account
gcloud compute instances create fuse --image fuse-host-img --image-project <OLD_PROJECT_ID> \
  --machine-type n2-standard-4 --enable-nested-virtualization \
  --address fuse-ip --tags fuse,http-server,https-server --boot-disk-size 100GB
```

After that you still need to:
- Create the firewall rules (step 1).
- Edit `ADDR_PREFIX` and `HOSTADDR` in `apps/backend/.env` and `packages/db/.env` to the new IP. The interface name stays `ens4`.
- Run `pm2 restart all`.
- Do steps 3–5.

The catch: it dies with the old account. If the image hasn't been made by expiry day,
you're back to the tarball, which is why the tarball exists.

## Last resort: rebuild the images from scratch

Use this only if both the backup and the old server are lost. This is the Firecracker getting-started flow:

```bash
ARCH=x86_64; CI=v1.16
# kernel
latest=$(curl -s "http://spec.ccfc.min.s3.amazonaws.com/?prefix=firecracker-ci/$CI/$ARCH/vmlinux-&list-type=2" \
  | grep -oP "(?<=<Key>)(firecracker-ci/$CI/$ARCH/vmlinux-[0-9]+\.[0-9]+\.[0-9]{1,3})(?=</Key>)" | sort -V | tail -1)
wget -O vmlinux "https://s3.amazonaws.com/spec.ccfc.min/$latest"
# ubuntu rootfs
ub=$(curl -s "http://spec.ccfc.min.s3.amazonaws.com/?prefix=firecracker-ci/$CI/$ARCH/ubuntu-&list-type=2" \
  | grep -oP "(?<=<Key>)(firecracker-ci/$CI/$ARCH/ubuntu-[0-9]+\.[0-9]+\.squashfs)(?=</Key>)" | sort -V | tail -1)
wget -O ubuntu.squashfs "https://s3.amazonaws.com/spec.ccfc.min/$ub"
sudo apt install -y squashfs-tools
unsquashfs ubuntu.squashfs
ssh-keygen -f vm_ssh_key -N ""
mkdir -p squashfs-root/root/.ssh && cp vm_ssh_key.pub squashfs-root/root/.ssh/authorized_keys
truncate -s 6G ubuntu.ext4 && sudo mkfs.ext4 -d squashfs-root -F ubuntu.ext4
```

Then boot one VM by hand and install what the backend expects inside the guest:
- nvm at `/root/.nvm` with node 24 (exec sources `/root/.nvm/nvm.sh`).
- python3.
- Then shut it down and use that file as `ubuntu.ext4`.

Because the guest key changed, put the new `vm_ssh_key` in `/opt/fuse-keys/`.

## Checklist before 2026-11-30

- [x] Backup downloaded (`notes/setup/backup/`, 2026-11-22)
- [ ] Copy the backup somewhere private as a second copy
- [ ] New GCP account: project, billing, Compute API
- [ ] New OAuth client, published, env swapped (can be done now)
- [ ] New server, restore, DNS, smoke test
- [ ] Old server deleted
