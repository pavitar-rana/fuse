import { createId } from "@paralleldrive/cuid2";
import { execSync } from "child_process";
import {
  macFromCuid,
  HOST_GATEWAY_IP,
  setupTapInterface,
  setupSocket,
  attemptSSHConnection,
  bootSetup,
  configSetup,
  startInstance,
  setupHostPort,
} from "../firecracker/index.ts";
import type { VmConfigType, clientType, IPConfig } from "../lib/types.ts";
import { createFirecrackerClient } from "./index.ts";
import { getVmIP } from "../repositories/vm.repository.ts";
import { getCurrentHost } from "../config/host.ts";

export const createFireCracker = async (config: VmConfigType) => {
  if (!config.kernelImage || !config.rootfsPath) {
    throw new Error("Missing kernelImage or rootfsPath in config");
  }
  const vmId = createId();
  const host = await getCurrentHost();
  const vmRootfs = `/tmp/vm-${vmId}.ext4`;

  try {
    execSync(`cp "${config.rootfsPath}" "${vmRootfs}"`);
  } catch (err) {
    console.error("Failed to create rootfs copy:", err);
    throw new Error("Failed to create VM rootfs");
  }

  const api_socket = `/tmp/firecracker-${vmId}.socket`;
  const client: clientType = createFirecrackerClient(api_socket);

  const vmIP = await getVmIP(vmId, host.id);
  const tap = `tap_${vmId.slice(0, 8)}`;
  const mac = macFromCuid(vmId);

  if (!mac || !vmIP) {
    throw new Error("Cant generate mac address or VM IP");
  }

  const ipConfig: IPConfig = {
    vmIP: vmIP,
    hostIP: HOST_GATEWAY_IP,
    gateway: HOST_GATEWAY_IP,
    netmask: "255.255.255.0",
    nameservers: ["8.8.8.8", "8.8.4.4"],
  };

  await setupTapInterface(tap);
  await setupSocket(api_socket, vmId);

  await bootSetup({
    ipConfig,
    client,
    config: { ...config, rootfsPath: vmRootfs },
    mac,
    tap,
  });

  await configSetup(client, config);
  await startInstance(client);

  const maxRetries = config.sshMaxRetries ?? 10;
  const baseDelay = config.sshBaseDelayMs ?? 1000;
  await attemptSSHConnection({
    maxRetries,
    baseDelay,
    vmIP,
  });

  return {
    vmId,
    vmIP,
    vmMac: mac,
    hostId: host.id,
    socket: api_socket,
    vcpuCount: config.vcpuCount,
    memSize: config.memSize,
    rootfsPath: vmRootfs,
  };
};
