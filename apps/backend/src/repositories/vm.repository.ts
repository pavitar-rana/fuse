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

export class QuotaExceededError extends Error {}
export class HostFullError extends Error {}

// States in which a VM has a Firecracker process holding its RAM.
const MEM_HOLDING: VmStatus[] = ["CREATING", "RUNNING", "PAUSING", "RESUMING"];

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

// One lock per host serialises everything that takes RAM (create, resume),
// so the capacity check and the claim happen atomically.
const lockHost = (tx: Tx, hostId: string) =>
  tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"fuse-host:" + hostId}))`;

const assertHostCapacity = async (tx: Tx, hostId: string, memSize: number, maxHostMemMb: number) => {
  const { _sum } = await tx.virtualmachine.aggregate({
    where: { hostId, status: { in: MEM_HOLDING } },
    _sum: { memSize: true },
  });
  const used = _sum.memSize ?? 0;
  if (used + memSize > maxHostMemMb) {
    throw new HostFullError(
      `Server is at capacity (${used}/${maxHostMemMb} MiB in use). Try again later.`,
    );
  }
};

// Quota check + IP reservation + row insert in one transaction. The per-user
// advisory lock serialises concurrent creates by the same user, so two
// parallel requests can't both slip under maxVmsPerUser.
export const reserveVm = async (
  data: {
    id: string;
    userId: string;
    hostId: string;
    vmMac: string;
    socket: string;
    rootfsPath: string;
    vcpuCount: number;
    memSize: number;
  },
  limits: { maxVmsPerUser: number; maxHostMemMb: number },
) => {
  const { maxVmsPerUser, maxHostMemMb } = limits;
  return prisma.$transaction(async (tx) => {
    await lockHost(tx, data.hostId);

    const active = await tx.virtualmachine.count({
      where: { userId: data.userId, status: { notIn: ["FAILED", "TERMINATED"] } },
    });
    if (active >= maxVmsPerUser) {
      throw new QuotaExceededError(
        `VM limit reached (${active}/${maxVmsPerUser}). Delete a VM first.`,
      );
    }

    await assertHostCapacity(tx, data.hostId, data.memSize, maxHostMemMb);

    const [row] = await tx.$queryRaw<{ id: string; ip: string }[]>`
      SELECT id, ip FROM "IpPool"
      WHERE "hostId" = ${data.hostId} AND status = 'AVAILABLE'
      LIMIT 1 FOR UPDATE SKIP LOCKED`;
    if (!row) throw new Error("No ip AVAILABLE");

    await tx.ipPool.update({
      where: { id: row.id },
      data: { vmId: data.id, status: "ALLOCATED" },
    });

    return tx.virtualmachine.create({
      data: { ...data, vmIp: row.ip, status: "CREATING" },
    });
  });
};

// Keyed by vmId so calling it twice (or after a failed create) is harmless.
export const releaseVmIP = async (vmId: string) => {
  await prisma.ipPool.updateMany({
    where: { vmId },
    data: { vmId: null, status: "AVAILABLE" },
  });
};

export const updateVm = async (
  id: string,
  data: { status?: VmStatus; pid?: number | null; startedAt?: Date | null },
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

// PAUSED → RESUMING, but only if the host has room for the VM's RAM.
export const beginResume = async (
  vm: { id: string; hostId: string; memSize: number },
  maxHostMemMb: number,
) => {
  return prisma.$transaction(async (tx) => {
    await lockHost(tx, vm.hostId);
    await assertHostCapacity(tx, vm.hostId, vm.memSize, maxHostMemMb);
    const { count } = await tx.virtualmachine.updateMany({
      where: { id: vm.id, status: "PAUSED" },
      data: { status: "RESUMING" },
    });
    return count === 1;
  });
};

export const findByStatus = async (hostId: string, statuses: VmStatus[]) => {
  return prisma.virtualmachine.findMany({
    where: { hostId, status: { in: statuses } },
    include: { portMappings: true },
  });
};

export const findVmById = async (id: string, userId: string) => {
  return prisma.virtualmachine.findUnique({
    where: { id, userId },
  });
};

export const findRunningSince = async (before: Date) => {
  return prisma.virtualmachine.findMany({
    where: { status: "RUNNING", startedAt: { lt: before } },
    select: { id: true, userId: true },
  });
};

export const deleteVmRow = async (id: string) => {
  await prisma.virtualmachine.deleteMany({ where: { id } });
};
