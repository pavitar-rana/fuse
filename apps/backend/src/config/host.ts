import { prisma } from "@fuse/db";
import { env } from "./env.ts";

let currentHost: { id: string; ipRange: string } | null = null;

export const getCurrentHost = async () => {
  if (currentHost) return currentHost;
  const res = await prisma.host.findUniqueOrThrow({
    where: {
      id: env.hostId,
    },
  });

  currentHost = res;
  return currentHost;
};
