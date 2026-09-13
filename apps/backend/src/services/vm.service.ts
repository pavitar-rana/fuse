import { createFireCracker } from "../firecracker/firecracker.create.ts";
import { VmConfigType } from "../lib/types.ts";
import { deleteFireCracker } from "../firecracker/firecracker.delete.ts";
import { serviceError } from "./index.ts";
import * as vmRepository from "../repositories/vm.repository.ts";
import { getCurrentHost } from "../config/host.ts";
import { setupHostPort } from "../firecracker/firecracker.network.ts";

export const createVm = async (userId: string, config: VmConfigType) => {
  try {
    if (!userId) throw serviceError("userId is required", 400);

    const sbx = await createFireCracker({
      kernelImage: "/home/pavitar/vmlinux-6.1.141",
      rootfsPath: "/home/pavitar/ubuntu-1.5G.ext4",
      memSize: config.memSize,
      vcpuCount: config.vcpuCount,
    });

    if (!sbx.vmIP) throw serviceError("Failed to Create VM", 500);
    const vm = await vmRepository.createVm(userId, sbx);
    if (!vm) throw serviceError("Failed to Create VM", 500);

    return {
      message: "Success Creating sbx",
      data: {
        vmIp: vm.vmIp,
        mac: vm.vmMac,
        id: vm.id,
        socket: vm.socket,
        rootfsPath: vm.rootfsPath,
        vCpu: vm.vcpuCount,
        memSize: vm.memSize,
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
    const portMap = await vmRepository.getPortMap(vmId);

    await deleteFireCracker(vm, portMap);

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
  vmm: { id: string; port: number },
) => {
  try {
    if (!vmm.id || !userId) throw serviceError("Id is required", 400);

    const vm = await vmRepository.findVmById(vmm.id, userId);

    if (!vm) throw serviceError("Vm not found", 500);

    const host = await getCurrentHost();
    const addrPrefix = process.env.ADDR_PREFIX;

    const portMap = await vmRepository.findPortMapping(vm.id, vmm.port);

    if (portMap) {
      return {
        messgae: "Got url",
        data: {
          url: `${addrPrefix}:${portMap.hostPort}`,
        },
      };
    }

    const hostPort = await vmRepository.getHostPort(vm.id, host.id);
    const portMapping = await vmRepository.createPortMap(
      vm.id,
      vmm.port,
      hostPort,
    );

    await setupHostPort(vm.vmIp, portMapping.hostPort, portMapping.vmPort);

    return {
      messgae: "Got url",
      data: {
        url: `${addrPrefix}:${hostPort}`,
      },
    };
  } catch (e) {
    throw serviceError("Internal Server Error", 500);
  }
};
