import crypto from "crypto";

// API keys are only ever stored as a SHA-256 hash. The plaintext is shown to
// the user once and can't be recovered. These are 256-bit random keys, so a
// fast hash is fine (no salt/bcrypt needed).
export const hashApiKey = (key: string) =>
  crypto.createHash("sha256").update(key).digest("hex");

export const generateApiKey = () => {
  const key = `fc_${crypto.randomBytes(32).toString("hex")}`;
  return { key, hash: hashApiKey(key), prefix: key.slice(0, 10) };
};
