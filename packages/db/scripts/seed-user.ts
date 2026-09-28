import "dotenv/config";
import { prisma } from "../lib/prisma.ts";
import { generateApiKey } from "../lib/api-key.ts";

// Dev-only: creates a user and issues a fresh API key without going through
// Google sign-in. Usage: SEED_USER_EMAIL=me@x.com pnpm seed:user
// Re-running rotates the key (the old one stops working).
const email = process.env.SEED_USER_EMAIL ?? "dev@fuse.local";

const main = async () => {
  const { key, hash, prefix } = generateApiKey();
  const user = await prisma.user.upsert({
    where: { email },
    update: { apiKeyHash: hash, apiKeyPrefix: prefix },
    create: { email, name: "Dev User", apiKeyHash: hash, apiKeyPrefix: prefix },
  });
  console.log(`User ready: id=${user.id} email=${user.email}`);
  console.log(`apiKey=${key}  (shown once, only the hash is stored)`);
};

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
