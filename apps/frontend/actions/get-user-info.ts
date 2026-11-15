"use server";

import { prisma } from "@fuse/db";
import { auth } from "@/auth";

// Server actions are public HTTP endpoints: the user id must come from the
// session, never from an argument, and secrets must never be selected.
export const getUserInfo = async () => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return { vms: [], user: null, message: "Not signed in" };

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, image: true, apiKeyPrefix: true },
  });
  if (!user) return { vms: [], user: null, message: "User not found" };

  const vms = await prisma.virtualmachine.findMany({
    where: { userId: id },
    select: {
      id: true,
      status: true,
      vmIp: true,
      vmMac: true,
      vcpuCount: true,
      memSize: true,
      createdAt: true,
      portMappings: { select: { id: true, vmPort: true, hostPort: true } },
      host: { select: { hostname: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return { vms, user, message: vms.length ? "Vm and user info" : "No active vms" };
};
