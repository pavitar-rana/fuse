import { prisma } from "@fuse/db";
import type { createFireCracker } from "../firecracker/firecracker.create.ts";
import { Virtualmachine } from "../../../../packages/db/src/generated/prisma/client.ts";

type FireCrackerSandbox = Awaited<ReturnType<typeof createFireCracker>>;

export const createPortMap = async (
  vmId: string,
  vmPort: number,
  hostPort: number,
) => {
  return prisma.portMapping.create({
    data: {
      vmId: vmId,
      vmPort: vmPort,
      hostPort: hostPort,
    },
  });
};

export const createVm = async (userId: string, sbx: FireCrackerSandbox) => {
  return prisma.virtualmachine.create({
    data: {
      id: sbx.id,
      vcpuCount: sbx.vcpuCount,
      memSize: sbx.memSize,
      userId,
      vmMac: sbx.vmMac,
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
