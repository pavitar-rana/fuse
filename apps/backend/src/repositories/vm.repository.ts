import { prisma } from "@fuse/db";
import type { createFireCracker } from "../firecracker/firecracker.create.ts";
import { error } from "console";

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

export const getPortMap = async (vmId: string) => {
  return prisma.portMapping.findMany({
    where: {
      vmId: vmId,
    },
  });
};

export const findPortMapping = async (vmId: string, vmPort: number) => {
  return prisma.portMapping.findUnique({
    where: {
      vmId_vmPort: { vmId, vmPort },
    },
  });
};

export const getHostPort = async (vmId: string, hostId: string) => {
  return prisma.$transaction(async (tx) => {
    const [row] = await tx.$queryRaw<
      {
        id: string;
        hostPort: number;
      }[]
    >`SELECT id, "hostPort" from "PortPool" WHERE "hostId" = ${hostId} AND status = 'AVAILABLE' LIMIT 1 FOR UPDATE SKIP LOCKED`;

    if (!row) throw new Error("No ports AVAILABLE");

    await tx.portPool.update({
      where: {
        id: row.id,
      },
      data: {
        vmId: vmId,
        status: "ALLOCATED",
      },
    });

    return row.hostPort;
  });
};

export const getVmIP = async (vmId: string, hostId: string) => {
  return prisma.$transaction(async (tx) => {
    const [row] = await tx.$queryRaw<
      { id: string; ip: string }[]
    >`SELECT id, ip FROM "IpPool" WHERE "hostId" = ${hostId} AND status = 'AVAILABLE' LIMIT 1 FOR UPDATE SKIP LOCKED`;

    if (!row) throw new Error("No ip AVAILABLE");
    await tx.ipPool.update({
      where: { id: row.id },
      data: { vmId, hostId, status: "ALLOCATED" },
    });

    return row.ip;
  });
};

export const createVm = async (userId: string, sbx: FireCrackerSandbox) => {
  return prisma.virtualmachine.create({
    data: {
      id: sbx.vmId,
      vcpuCount: sbx.vcpuCount,
      memSize: sbx.memSize,
      userId,
      vmMac: sbx.vmMac,
      vmIp: sbx.vmIP,
      status: "RUNNING",
      socket: sbx.socket,
      rootfsPath: sbx.rootfsPath,
      hostId: sbx.hostId,
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
