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
} as const;
