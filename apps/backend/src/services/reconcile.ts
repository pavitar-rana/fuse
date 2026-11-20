import fs from "fs";
import type { VmStatus } from "@fuse/db/client";
import { getCurrentHost } from "../config/host.ts";
import * as vmRepository from "../repositories/vm.repository.ts";
import { teardownVm } from "../firecracker/firecracker.delete.ts";
import { createFirecrackerClient } from "../firecracker/firecracker.client.ts";
import { deleteTapInterface, setupHostPort, tapName } from "../firecracker/firecracker.network.ts";
import { isFirecrackerAlive, killFirecracker, removeFile } from "../firecracker/firecracker.process.ts";
import { removeSnapshot, snapshotPaths } from "../firecracker/firecracker.snapshot.ts";

type Vm = Awaited<ReturnType<typeof vmRepository.findByStatus>>[number];

// Puts every VM on this host back into a consistent state after the backend
// restarted mid-operation, or after the whole server rebooted (which kills
// every Firecracker process and wipes the iptables rules).
const reconcileVm = async (vm: Vm): Promise<string> => {
  const alive = await isFirecrackerAlive(vm.socket);
  const fail = async (why: string) => {
    await teardownVm(vm);
    await vmRepository.updateVm(vm.id, { status: "FAILED", pid: null, startedAt: null });
    return `FAILED (${why})`;
  };

  switch (vm.status as VmStatus) {
    case "CREATING":
      return fail("create interrupted");

    case "TERMINATING":
      await teardownVm(vm);
      await vmRepository.deleteVmRow(vm.id);
      return "deleted (delete interrupted)";

    case "RESUMING":
      // The snapshot is only removed after a successful resume, so it's intact.
      await killFirecracker(vm.pid, vm.socket);
      await removeFile(vm.socket);
      await deleteTapInterface(tapName(vm.id));
      await vmRepository.updateVm(vm.id, { status: "PAUSED", pid: null, startedAt: null });
      return "PAUSED (resume interrupted)";

    case "PAUSING": {
      if (alive) {
        // Snapshot may be partial: unfreeze the guest and drop it.
        await createFirecrackerClient(vm.socket).patch("/vm", { state: "Resumed" }).catch(() => {});
        await removeSnapshot(vm.id);
        await vmRepository.updateVm(vm.id, { status: "RUNNING", startedAt: new Date() });
        return "RUNNING (pause interrupted, guest resumed)";
      }
      const { snapshot, mem } = snapshotPaths(vm.id);
      if (fs.existsSync(snapshot) && fs.existsSync(mem)) {
        await removeFile(vm.socket);
        await deleteTapInterface(tapName(vm.id));
        await vmRepository.updateVm(vm.id, { status: "PAUSED", pid: null, startedAt: null });
        return "PAUSED (process already stopped)";
      }
      return fail("pause interrupted, no snapshot");
    }

    case "RUNNING":
      if (!alive) return fail("process gone, server probably rebooted");
      break;

    case "PAUSED":
      break;

    default:
      return "skipped";
  }

  // Live and paused VMs keep their exposed ports; re-add the DNAT rules in
  // case they were lost (idempotent).
  for (const pm of vm.portMappings) {
    await setupHostPort(vm.vmIp, pm.hostPort, pm.vmPort);
  }
  return `${vm.status} ok`;
};

export const reconcileOnStartup = async () => {
  const host = await getCurrentHost();
  const vms = await vmRepository.findByStatus(host.id, [
    "CREATING",
    "RUNNING",
    "PAUSING",
    "PAUSED",
    "RESUMING",
    "TERMINATING",
  ]);

  for (const vm of vms) {
    try {
      console.log(`Reconcile ${vm.id}: ${vm.status} → ${await reconcileVm(vm)}`);
    } catch (err) {
      console.error(`Reconcile ${vm.id} (${vm.status}) failed:`, err);
    }
  }
};
