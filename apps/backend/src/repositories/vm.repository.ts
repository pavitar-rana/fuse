import { prisma } from "@fuse/db";
import type { VmStatus } from "@fuse/db/client";

export const getPortMap = async (vmId: string) => {
  return prisma.portMapping.findMany({
    where: { vmId },
  });
};

export const findPortMapping = async (vmId: string, vmPort: number) => {
  return prisma.portMapping.findUnique({
    where: { vmId_vmPort: { vmId, vmPort } },
  });
};

// Reserves a host port and records the mapping in one transaction, so a
// failure (including a concurrent call for the same vmPort hitting the
// unique constraint) rolls the PortPool row back to AVAILABLE.
export const allocatePortMapping = async (
  vmId: string,
  vmPort: number,
  hostId: string,
) => {
  return prisma.$transaction(async (tx) => {
    const [row] = await tx.$queryRaw<{ id: string; hostPort: number }[]>`
      SELECT id, "hostPort" FROM "PortPool"
      WHERE "hostId" = ${hostId} AND status = 'AVAILABLE'
      LIMIT 1 FOR UPDATE SKIP LOCKED`;

    if (!row) throw new Error("No ports AVAILABLE");

    await tx.portPool.update({
      where: { id: row.id },
      data: { vmId, status: "ALLOCATED" },
    });

    return tx.portMapping.create({
      data: { vmId, vmPort, hostPort: row.hostPort },
    });
  });
};

export const releasePortMapping = async (
  hostId: string,
  mapping: { vmId: string; vmPort: number; hostPort: number },
) => {
  await prisma.$transaction([
    prisma.portMapping.deleteMany({
      where: { vmId: mapping.vmId, vmPort: mapping.vmPort },
    }),
    prisma.portPool.updateMany({
      where: { hostId, hostPort: mapping.hostPort, vmId: mapping.vmId },
      data: { vmId: null, status: "AVAILABLE" },
    }),
  ]);
};

export const allocateVmIP = async (vmId: string, hostId: string) => {
  return prisma.$transaction(async (tx) => {
    const [row] = await tx.$queryRaw<{ id: string; ip: string }[]>`
      SELECT id, ip FROM "IpPool"
      WHERE "hostId" = ${hostId} AND status = 'AVAILABLE'
      LIMIT 1 FOR UPDATE SKIP LOCKED`;

    if (!row) throw new Error("No ip AVAILABLE");
    await tx.ipPool.update({
      where: { id: row.id },
      data: { vmId, status: "ALLOCATED" },
    });

    return row.ip;
  });
};

// Keyed by vmId so calling it twice (or after a failed create) is harmless.
export const releaseVmIP = async (vmId: string) => {
  await prisma.ipPool.updateMany({
    where: { vmId },
    data: { vmId: null, status: "AVAILABLE" },
  });
};

export const insertVm = async (data: {
  id: string;
  userId: string;
  hostId: string;
  vmIp: string;
  vmMac: string;
  socket: string;
  rootfsPath: string;
  vcpuCount: number;
  memSize: number;
}) => {
  return prisma.virtualmachine.create({
    data: { ...data, status: "CREATING" },
  });
};

export const updateVm = async (
  id: string,
  data: { status?: VmStatus; pid?: number | null },
) => {
  return prisma.virtualmachine.update({ where: { id }, data });
};

// Compare-and-set on status, so two concurrent pause/resume/delete calls
// can't both win. Returns false if the VM wasn't in `from`.
export const transitionVm = async (id: string, from: VmStatus, to: VmStatus) => {
  const { count } = await prisma.virtualmachine.updateMany({
    where: { id, status: from },
    data: { status: to },
  });
  return count === 1;
};

export const findVmById = async (id: string, userId: string) => {
  return prisma.virtualmachine.findUnique({
    where: { id, userId },
  });
};

export const deleteVmRow = async (id: string) => {
  await prisma.virtualmachine.deleteMany({ where: { id } });
};
