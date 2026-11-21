#!/usr/bin/env bash
# Run ON THE NEW SERVER (Debian 13, nested virtualization on), from the
# directory you uploaded the backup into:
#
#   scp -r notes/setup/backup newfuse:~/fuse-backup
#   scp notes/setup/restore.sh newfuse:~/
#   ssh newfuse 'bash ~/restore.sh ~/fuse-backup NEW_PUBLIC_IP'
#
# Safe to re-run: every step checks before it acts.
set -euo pipefail

B="${1:?usage: restore.sh <backup-dir> <new-public-ip>}"
IP="${2:?usage: restore.sh <backup-dir> <new-public-ip>}"
B="$(cd "$B" && pwd)"
REPO="$HOME/fuse"

echo "==> 1. KVM"
[ -e /dev/kvm ] || { echo "/dev/kvm missing: create the VM with --enable-nested-virtualization"; exit 1; }
sudo usermod -aG kvm "$USER"

echo "==> 2. packages"
sudo apt-get update -qq
sudo apt-get install -y -qq git curl iptables iproute2 xfsprogs caddy build-essential

echo "==> 3. firecracker"
sudo install -m 0755 "$B/env/firecracker" /usr/local/bin/firecracker
firecracker --version | head -1

echo "==> 4. XFS image disk (reflink makes VM rootfs copies instant)"
if ! findmnt /mnt/vm-images >/dev/null; then
  [ -f /var/lib/fuse-images.img ] || {
    sudo truncate -s 50G /var/lib/fuse-images.img
    sudo mkfs.xfs -q -m reflink=1 /var/lib/fuse-images.img
  }
  sudo mkdir -p /mnt/vm-images
  grep -q fuse-images.img /etc/fstab || \
    echo '/var/lib/fuse-images.img /mnt/vm-images xfs loop,defaults 0 0' | sudo tee -a /etc/fstab
  sudo mount /mnt/vm-images
fi
sudo chown "$USER:$USER" /mnt/vm-images
[ -f /mnt/vm-images/ubuntu.ext4 ] || tar -S -xzf "$B/images.tar.gz" -C /mnt/vm-images
mkdir -p /mnt/vm-images/vms

echo "==> 5. guest ssh key"
sudo mkdir -p /opt/fuse-keys
sudo install -m 0600 -o "$USER" -g "$USER" "$B/env/vm_ssh_key" /opt/fuse-keys/vm_ssh_key
sudo chown "$USER:$USER" /opt/fuse-keys

echo "==> 6. ip forwarding (persistent)"
echo 'net.ipv4.ip_forward=1' | sudo tee /etc/sysctl.d/99-fuse.conf >/dev/null
sudo sysctl -q -p /etc/sysctl.d/99-fuse.conf

echo "==> 7. node 24 + pnpm + pm2"
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] || curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
. "$NVM_DIR/nvm.sh"
nvm install 24 >/dev/null && nvm alias default 24 >/dev/null
npm i -g pnpm@11 pm2 >/dev/null

echo "==> 8. code"
[ -d "$REPO/.git" ] || git clone https://github.com/pavitar-rana/fuse.git "$REPO"
git -C "$REPO" pull -q --ff-only
cp "$B/env/backend.env"  "$REPO/apps/backend/.env"
cp "$B/env/frontend.env" "$REPO/apps/frontend/.env"
cp "$B/env/db.env"       "$REPO/packages/db/.env"
cp "$B/env/ecosystem.config.cjs" "$REPO/ecosystem.config.cjs"

echo "==> 9. point env at the new IP and interface"
IFACE="$(ip route show default | awk '{print $5; exit}')"
for f in "$REPO/apps/backend/.env" "$REPO/packages/db/.env"; do
  sed -i -E \
    -e "s|^ADDR_PREFIX=.*|ADDR_PREFIX=\"http://$IP\"|" \
    -e "s|^HOSTADDR=.*|HOSTADDR=\"$IP\"|" \
    -e "s|^UPLINK_IFACE=.*|UPLINK_IFACE=\"$IFACE\"|" "$f"
done
grep -E '^(ADDR_PREFIX|HOSTADDR|UPLINK_IFACE|HOST_ID)=' "$REPO/apps/backend/.env"

echo "==> 10. install + build"
cd "$REPO"
pnpm install --frozen-lockfile
( cd packages/db && npx prisma generate )
( cd apps/frontend && pnpm build )

echo "==> 11. caddy (TLS certs come once DNS points here)"
sudo cp "$B/env/Caddyfile" /etc/caddy/Caddyfile
sudo systemctl enable --now caddy
sudo systemctl reload caddy

echo "==> 12. start + start on boot"
pm2 start ecosystem.config.cjs
pm2 save
sudo env PATH="$PATH" "$(command -v pm2)" startup systemd -u "$USER" --hp "$HOME" >/dev/null
sleep 3
pm2 ls
curl -s http://127.0.0.1:4000/health; echo

echo
echo "Done. Remaining manual steps: Cloudflare DNS -> $IP, Google OAuth client, smoke test (see notes/setup/README.md)."
echo "Log out and back in once so the kvm group applies to your shell."
