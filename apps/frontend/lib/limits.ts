import { prisma } from "@fuse/db";

export type Limits = {
  maxVmsPerUser: number;
  maxRunMinutes: number;
  defaultMemMb: number;
  defaultVcpu: number;
};

// The public parts of the Config table (null if the DB is unreachable).
export const getLimits = async (): Promise<Limits | null> => {
  const c = await prisma.config
    .findUnique({
      where: { id: "default" },
      select: { maxVmsPerUser: true, maxRunMinutes: true, defaultMemMb: true, defaultVcpu: true },
    })
    .catch(() => null);
  return c ?? null;
};

// Human-readable summary for marketing/sign-in copy.
export const describeLimits = (c: Limits | null) => {
  if (!c) return "Early access";
  const vms = `${c.maxVmsPerUser} sandbox${c.maxVmsPerUser === 1 ? "" : "es"} per account`;
  const run = c.maxRunMinutes > 0 ? `, auto-paused after ${c.maxRunMinutes} min` : "";
  return `Free during early access: ${vms}${run}`;
};

export const getLimitsText = async () => describeLimits(await getLimits());
