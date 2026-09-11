import { PrismaClient } from "../src/generated/prisma/client.ts";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
