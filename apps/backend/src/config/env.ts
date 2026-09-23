import "dotenv/config";
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const env = {
  hostId: requireEnv("HOST_ID"),
  addrPrefix: requireEnv("ADDR_PREFIX"),
  hostAddr: requireEnv("HOSTADDR"),
  firecrackerBin: requireEnv("FIRECRACKER_BIN"),
  kernelImage: requireEnv("KERNEL_IMAGE"),
  rootfsGolden: requireEnv("ROOTFS_GOLDEN"),
  vmDir: requireEnv("VM_DIR"),
  vmSshKey: requireEnv("VM_SSH_KEY"),
  uplinkIface: requireEnv("UPLINK_IFACE"),
} as const;
