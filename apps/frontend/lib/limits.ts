import { prisma } from "@fuse/db";

// Human-readable summary of the Config table, for marketing/sign-in copy.
export const getLimitsText = async () => {
  const c = await prisma.config.findUnique({ where: { id: "default" } }).catch(() => null);
  if (!c) return "Early access";
  const vms = `${c.maxVmsPerUser} VM${c.maxVmsPerUser === 1 ? "" : "s"} per user`;
  const run = c.maxRunMinutes > 0 ? `, auto-paused after ${c.maxRunMinutes} min` : "";
  return `Early access: ${vms}${run}`;
};
