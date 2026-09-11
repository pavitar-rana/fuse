import { createFireCracker } from "../firecracker/firecracker.create.ts";
import { VmConfigType } from "../lib/types.ts";
import { deleteFireCracker } from "../firecracker/firecracker.delete.ts";
import { serviceError } from "./index.ts";

import * as vmRepository from "../repositories/vm.repository.ts";
import { generateHostPort } from "../firecracker/firecracker.utils.ts";

export const createVm = async (userId: string, config: VmConfigType) => {
  try {
    if (!userId) throw serviceError("userId is required", 400);

    const sbx = await createFireCracker({
      kernelImage: "/home/pavitar/vmlinux-6.1.141",
      rootfsPath: "/home/pavitar/ubuntu-1.5G.ext4",
      memSize: 512,
      vcpuCount: 1,
    });

    if (!sbx.vmIP) throw serviceError("Failed to Create VM", 500);

    const vm = await vmRepository.createVm(userId, sbx);

    if (!vm) throw serviceError("Failed to Create VM", 500);

    return {
      message: "Success Creating sbx",
      data: {
        vmIp: sbx.vmIP,
        mac: sbx.vmMac,
        id: sbx.id,
        socker: sbx.socket,
      },
    };
  } catch (e) {
    throw serviceError("Internal server error", 500);
  }
};

export const deleteVm = async (vmId: string, userId: string) => {
  try {
    if (!vmId || !userId) throw serviceError("Id and userId is required", 400);

    const vm = await vmRepository.deleteVmById(vmId, userId);

    await deleteFireCracker(vmId, vm.vmIp, vm.rootfsPath);

    return {
      message: "Deleted Vm",
      data: {},
    };
  } catch (e) {
    throw serviceError("Error deleing Vm", 500);
  }
};

export const getVmUrl = async (
  userId: string,
  vmm: { id: string; ip: string },
) => {
  try {
    if (!vmm.id || !vmm.ip || !userId)
      throw serviceError("Id is required", 400);

    const vm = await vmRepository.findVmById(vmm.id, userId);

    if (!vm) throw serviceError("Vm not found", 500);

    const port = vm.hostPort;
    const hostAddr = process.env.HOSTADDR;

    const url = `${hostAddr}:${port}`;

    return {
      messgae: "Got url",
      data: {
        url,
      },
    };
  } catch (e) {
    throw serviceError("Internal Server Error", 500);
  }
};
