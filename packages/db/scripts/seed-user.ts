import "dotenv/config";
import crypto from "crypto";
import { prisma } from "../lib/prisma.ts";

// Dev-only: creates a user with an API key without going through the
// Resend email sign-in flow. Usage: SEED_USER_EMAIL=me@x.com pnpm seed:user
const email = process.env.SEED_USER_EMAIL ?? "dev@fuse.local";

const main = async () => {
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: "Dev User",
      apiKey: `fc_${crypto.randomBytes(32).toString("hex")}`,
    },
  });
  console.log(`User ready: id=${user.id} email=${user.email}`);
  console.log(`apiKey=${user.apiKey}`);
};

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
