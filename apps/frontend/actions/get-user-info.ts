"use server";

import { prisma } from "@/lib/prisma";

export const getUserInfo = async (id: string) => {
  const user = await prisma.user.findUnique({
    where: {
      id: id,
    },
  });

  if (!user) {
    return {
      vms: [],
      user,
      message: "User not found",
    };
  }
  const vms = await prisma.virtualmachine.findMany({
    where: {
      userId: id,
    },
  });

  if (vms.length == 0) {
    return {
      vms,
      user,
      message: "No active vms",
    };
  }

  return {
    vms,
    user,
    message: "Vm and user info",
  };
};
