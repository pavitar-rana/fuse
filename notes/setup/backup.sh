#!/usr/bin/env bash
# Run on your Mac. Pulls everything the Fuse host needs that is NOT in git
# into notes/setup/backup/ (gitignored). Contains secrets: keep it private.
#
#   bash notes/setup/backup.sh            # uses ssh alias "fuse"
#   HOST=other-alias bash notes/setup/backup.sh
set -euo pipefail

HOST="${HOST:-fuse}"
OUT="$(cd "$(dirname "$0")" && pwd)/backup"
mkdir -p "$OUT"

echo "==> checking no VMs are on disk (paused snapshots would be lost)"
ssh "$HOST" 'ls /mnt/vm-images/vms'

echo "==> packing on the server"
ssh "$HOST" 'set -e
  rm -rf /tmp/fuse-backup && mkdir -p /tmp/fuse-backup/env
  cd /tmp/fuse-backup
  # -S keeps the 6 GiB rootfs sparse (about 2 GiB of real data)
  sudo tar -S -czf images.tar.gz -C /mnt/vm-images vmlinux ubuntu.ext4
  sudo cp /opt/fuse-keys/vm_ssh_key env/vm_ssh_key
  cp ~/firecracker/vm_ssh_key.pub env/vm_ssh_key.pub 2>/dev/null || true
  cp ~/fuse/apps/backend/.env   env/backend.env
  cp ~/fuse/apps/frontend/.env  env/frontend.env
  cp ~/fuse/packages/db/.env    env/db.env
  cp ~/fuse/ecosystem.config.cjs env/ecosystem.config.cjs
  cp /etc/caddy/Caddyfile env/Caddyfile
  cp /usr/local/bin/firecracker env/firecracker
  sudo chown -R "$USER" /tmp/fuse-backup
  ls -lh /tmp/fuse-backup /tmp/fuse-backup/env'

echo "==> downloading"
scp -r "$HOST:/tmp/fuse-backup/." "$OUT/"
ssh "$HOST" 'rm -rf /tmp/fuse-backup'

( cd "$OUT" && shasum -a 256 images.tar.gz env/* > SHA256SUMS )
echo "==> done: $OUT"
ls -lh "$OUT" "$OUT/env"
