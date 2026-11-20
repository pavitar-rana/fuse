import { prisma } from "@fuse/db";

// Mirrors the column defaults in schema.prisma; used only if the row is missing.
const FALLBACK = {
  minMemMb: 128,
  maxMemMb: 3072,
  defaultMemMb: 512,
  maxVcpu: 2,
  defaultVcpu: 1,
  maxVmsPerUser: 2,
  maxRunMinutes: 60,
  maxHostMemMb: 6000,
};

export type Limits = typeof FALLBACK;

// Read fresh on every call so edits in the DB apply immediately.
export const getLimits = async (): Promise<Limits> => {
  const row = await prisma.config.findUnique({ where: { id: "default" } });
  if (!row) return FALLBACK;
  const { id: _id, updatedAt: _u, ...limits } = row;
  return limits;
};
