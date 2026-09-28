import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  // Only the Prisma CLI (migrate, studio, ...) reads this. Migrations need a
  // direct, non-pooled connection. The apps connect via DATABASE_URL (pooled)
  // in lib/prisma.ts.
  datasource: {
    url: env("DIRECT_URL"),
  },
});
