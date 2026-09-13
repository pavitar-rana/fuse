import { prisma } from "@fuse/db";

let currentHost: { id: string; ipRange: string } | null = null;

export const getCurrentHost = async () => {
  if (currentHost) return currentHost;
  const res = await prisma.host.findUniqueOrThrow({
    where: {
      id: process.env.HOST_ID,
    },
  });

  currentHost = res;
  return currentHost;
};
