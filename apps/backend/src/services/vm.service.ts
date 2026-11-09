import { createFireCracker } from "../firecracker/firecracker.create.ts";
import { teardownVm } from "../firecracker/firecracker.delete.ts";
import { setupHostPort, deleteHostPort } from "../firecracker/firecracker.network.ts";
import { serviceError } from "./index.ts";
import * as vmRepository from "../repositories/vm.repository.ts";
import { getCurrentHost } from "../config/host.ts";
import { env } from "../config/env.ts";
import { pauseToSnapshot, resumeFromSnapshot } from "../firecracker/firecracker.snapshot.ts";
import type { VmStatus } from "@fuse/db/client";

const LIMITS = {
  vcpu: { min: 1, max: 2, default: 1 },
  memMb: { min: 128, max: 3072, default: 512 },
};

const intInRange = (
  value: unknown,
  name: string,
  { min, max, default: def }: { min: number; max: number; default: number },
) => {
  if (value === undefined || value === null) return def;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw serviceError(`${name} must be an integer between ${min} and ${max}`, 400);
  }
  return n;
};

const requireVm = async (id: unknown, userId: string) => {
  if (!id || typeof id !== "string") throw serviceError("id is required", 400);
  const vm = await vmRepository.findVmById(id, userId);
  if (!vm) throw serviceError("VM not found", 404);
  return vm;
};

const toDto = (vm: Awaited<ReturnType<typeof vmRepository.findVmById>> & {}) => ({
  id: vm.id,
  status: vm.status,
  vmIp: vm.vmIp,
  mac: vm.vmMac,
  vCpu: vm.vcpuCount,
  memSize: vm.memSize,
});

export const createVm = async (
  userId: string,
  config: { memSize?: unknown; vcpuCount?: unknown } = {},
) => {
  const vcpuCount = intInRange(config.vcpuCount, "vcpuCount", LIMITS.vcpu);
  const memSize = intInRange(config.memSize, "memSize", LIMITS.memMb);

  const vm = await createFireCracker({ userId, vcpuCount, memSize });

  return { message: "VM created", data: toDto(vm) };
};

export const deleteVm = async (userId: string, vmId: unknown) => {
  const vm = await requireVm(vmId, userId);
  if (vm.status === "PAUSING" || vm.status === "RESUMING") {
    throw serviceError(`VM is ${vm.status}, try again in a moment`, 409);
  }

  // Mark first so a crash mid-teardown leaves a record of what was happening.
  await vmRepository.updateVm(vm.id, { status: "TERMINATING" });
  await teardownVm(vm);
  await vmRepository.deleteVmRow(vm.id);

  return { message: "VM deleted", data: { id: vm.id } };
};

// Pause snapshots the VM to disk and stops its process (frees RAM + CPU);
// resume restores it exactly where it left off. Like E2B/Daytona pause.
// While PAUSED the VM keeps its IP, port maps, rootfs and snapshot files.
const beginTransition = async (
  userId: string,
  vmId: unknown,
  from: VmStatus,
  via: VmStatus,
  to: VmStatus,
) => {
  const vm = await requireVm(vmId, userId);
  if (vm.status === to) return { vm, already: true };
  if (!(await vmRepository.transitionVm(vm.id, from, via))) {
    throw serviceError(`VM is ${vm.status}, expected ${from}`, 409);
  }
  return { vm, already: false };
};

export const pauseVm = async (userId: string, vmId: unknown) => {
  const { vm, already } = await beginTransition(userId, vmId, "RUNNING", "PAUSING", "PAUSED");
  if (already) return { message: "VM already PAUSED", data: toDto(vm) };

  try {
    await pauseToSnapshot(vm);
  } catch (err) {
    // pauseToSnapshot resumes the guest if the snapshot itself failed.
    await vmRepository.updateVm(vm.id, { status: "RUNNING" });
    throw err;
  }

  const paused = await vmRepository.updateVm(vm.id, { status: "PAUSED", pid: null });
  return { message: "VM paused", data: toDto(paused) };
};

export const resumeVm = async (userId: string, vmId: unknown) => {
  const { vm, already } = await beginTransition(userId, vmId, "PAUSED", "RESUMING", "RUNNING");
  if (already) return { message: "VM already RUNNING", data: toDto(vm) };

  try {
    await resumeFromSnapshot(vm, (pgid) => vmRepository.updateVm(vm.id, { pid: pgid }));
  } catch (err) {
    await vmRepository.updateVm(vm.id, { status: "PAUSED", pid: null });
    throw err;
  }

  const running = await vmRepository.updateVm(vm.id, { status: "RUNNING" });
  return { message: "VM resumed", data: toDto(running) };
};

export const getVmUrl = async (userId: string, vmm: { id?: unknown; port?: unknown }) => {
  const vm = await requireVm(vmm.id, userId);
  if (vm.status !== "RUNNING") throw serviceError(`VM is ${vm.status}`, 409);

  if (vmm.port === undefined || vmm.port === null) throw serviceError("port is required", 400);
  const port = intInRange(vmm.port, "port", { min: 1, max: 65535, default: 0 });

  const urlFor = (hostPort: number) => ({
    message: "Got url",
    data: { url: `${env.addrPrefix}:${hostPort}` },
  });

  const existing = await vmRepository.findPortMapping(vm.id, port);
  if (existing) return urlFor(existing.hostPort);

  const host = await getCurrentHost();
  let mapping;
  try {
    mapping = await vmRepository.allocatePortMapping(vm.id, port, host.id);
  } catch (err: any) {
    // Lost a race with a concurrent request for the same port: use theirs.
    if (err?.code === "P2002") {
      const winner = await vmRepository.findPortMapping(vm.id, port);
      if (winner) return urlFor(winner.hostPort);
    }
    throw err;
  }

  try {
    await setupHostPort(vm.vmIp, mapping.hostPort, mapping.vmPort);
  } catch (err) {
    await deleteHostPort(vm.vmIp, mapping.hostPort, mapping.vmPort);
    await vmRepository.releasePortMapping(host.id, mapping);
    throw err;
  }

  return urlFor(mapping.hostPort);
};
