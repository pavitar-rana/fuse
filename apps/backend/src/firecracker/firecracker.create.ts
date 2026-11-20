import { createId } from "@paralleldrive/cuid2";
import type { IPConfig } from "../lib/types.ts";
import { createFirecrackerClient } from "./firecracker.client.ts";
import { bootSetup, startInstance } from "./firecracker.boot.ts";
import { configSetup } from "./firecracker.config.ts";
import { setupTapInterface, tapName } from "./firecracker.network.ts";
import { startFirecracker } from "./firecracker.process.ts";
import { attemptSSHConnection } from "./firecracker.ssh.ts";
import { HOST_GATEWAY_IP, macFromCuid, socketPath } from "./firecracker.utils.ts";
import { teardownVm } from "./firecracker.delete.ts";
import * as vmRepository from "../repositories/vm.repository.ts";
import { getCurrentHost } from "../config/host.ts";
import { env } from "../config/env.ts";
import { run } from "../lib/sh.ts";
import { runCommandfn, shellQuote } from "../helpers/ssh/index.ts";

// The kernel `ip=` boot arg sets the address and route but not DNS, so point
// the guest at public resolvers once SSH is up. Uses a systemd-resolved
// drop-in when resolved is running, a static resolv.conf otherwise.
const configureGuestDns = async (vmIP: string, nameservers: string[]) => {
  const resolvedConf = shellQuote(`[Resolve]\nDNS=${nameservers.join(" ")}\n`);
  const resolvConf = shellQuote(nameservers.map((n) => `nameserver ${n}\n`).join(""));
  await runCommandfn(
    `if systemctl is-active -q systemd-resolved 2>/dev/null; then ` +
      `mkdir -p /etc/systemd/resolved.conf.d && ` +
      `printf ${resolvedConf} > /etc/systemd/resolved.conf.d/fuse-dns.conf && ` +
      `systemctl restart systemd-resolved; ` +
      `else rm -f /etc/resolv.conf && printf ${resolvConf} > /etc/resolv.conf; fi`,
    vmIP,
  );
};

type CreateInput = {
  userId: string;
  memSize: number;
  vcpuCount: number;
  sshMaxRetries?: number;
  sshBaseDelayMs?: number;
  maxVmsPerUser: number;
};

// State machine: row inserted as CREATING → RUNNING on success. On any
// failure everything acquired so far is torn down and the row is marked FAILED.
export const createFireCracker = async (input: CreateInput) => {
  const vmId = createId();
  const host = await getCurrentHost();
  const api_socket = socketPath(vmId);
  const vmRootfs = `${env.vmDir}/vm-${vmId}.ext4`;
  const tap = tapName(vmId);
  const mac = macFromCuid(vmId);

  const vm = await vmRepository.reserveVm(
    {
      id: vmId,
      userId: input.userId,
      hostId: host.id,
      vmMac: mac,
      socket: api_socket,
      rootfsPath: vmRootfs,
      vcpuCount: input.vcpuCount,
      memSize: input.memSize,
    },
    input.maxVmsPerUser,
  );
  const vmIP = vm.vmIp;

  let pid: number | null = null;
  try {
    await run("cp", ["--reflink=auto", env.rootfsGolden, vmRootfs]);
    await setupTapInterface(tap);

    await startFirecracker(api_socket, (pgid) => {
      pid = pgid; // set before the DB write so rollback can still kill it
      return vmRepository.updateVm(vmId, { pid: pgid });
    });

    const client = createFirecrackerClient(api_socket);
    const ipConfig: IPConfig = {
      vmIP,
      hostIP: HOST_GATEWAY_IP,
      gateway: HOST_GATEWAY_IP,
      netmask: "255.255.255.0",
      nameservers: ["8.8.8.8", "8.8.4.4"],
    };

    await bootSetup({
      ipConfig,
      client,
      config: { kernelImage: env.kernelImage, rootfsPath: vmRootfs },
      mac,
      tap,
    });
    await configSetup(client, input);
    await startInstance(client);

    await attemptSSHConnection({
      maxRetries: input.sshMaxRetries ?? 10,
      baseDelay: input.sshBaseDelayMs ?? 1000,
      vmIP,
    });
    await configureGuestDns(vmIP, ipConfig.nameservers);

    return await vmRepository.updateVm(vmId, { status: "RUNNING", startedAt: new Date() });
  } catch (err) {
    console.error(`Create ${vmId} failed, rolling back:`, err);
    try {
      await teardownVm({ ...vm, pid: pid ?? vm.pid });
      await vmRepository.updateVm(vmId, { status: "FAILED", pid: null });
    } catch (cleanupErr) {
      console.error(`Rollback of ${vmId} incomplete:`, cleanupErr);
    }
    throw err;
  }
};
