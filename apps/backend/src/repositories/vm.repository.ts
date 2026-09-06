import { prisma } from "../lib/prisma.ts";
import type { createFireCracker } from "../firecracker/firecracker.create.ts";

type FireCrackerSandbox = Awaited<ReturnType<typeof createFireCracker>>;

export const createVm = async (userId: string, sbx: FireCrackerSandbox) => {
  return prisma.virtualmachine.create({
    data: {
      id: sbx.id,
      vcpuCount: sbx.vcpuCount,
      memSize: sbx.memSize,
      userId,
      vmMac: sbx.vmMac,
      hostPort: sbx.hostPort,
      vmIp: sbx.vmIP,
      status: "RUNNING",
      socket: sbx.socket,
      rootfsPath: sbx.rootfsPath,
    },
  });
};

export const findVmById = async (id: string, userId: string) => {
  return prisma.virtualmachine.findUnique({
    where: { id, userId },
  });
};

export const deleteVmById = async (id: string, userId: string) => {
  return prisma.virtualmachine.delete({
    where: { id, userId },
  });
};
