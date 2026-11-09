import type { Virtualmachine } from "@fuse/db/client";
import { env } from "../config/env.ts";
import { disconnectSSH } from "../helpers/ssh/index.ts";
import { createFirecrackerClient } from "./firecracker.client.ts";
import { deleteTapInterface, setupTapInterface, tapName } from "./firecracker.network.ts";
import { killFirecracker, removeFile, startFirecracker } from "./firecracker.process.ts";
import { attemptSSHConnection } from "./firecracker.ssh.ts";

type SnapshotTarget = Pick<Virtualmachine, "id" | "vmIp" | "socket" | "pid">;

// Snapshot = guest memory (mem file, size of the VM's RAM) + device/vCPU state
// (snap file). The rootfs stays where it is: the snapshot references it by path.
export const snapshotPaths = (vmId: string) => ({
  snapshot: `${env.vmDir}/vm-${vmId}.snap`,
  mem: `${env.vmDir}/vm-${vmId}.mem`,
});

export const removeSnapshot = async (vmId: string) => {
  const { snapshot, mem } = snapshotPaths(vmId);
  await removeFile(snapshot);
  await removeFile(mem);
};

// Freeze the guest, write it to disk, then stop the Firecracker process so its
// RAM and CPU go back to the host. The IP, port maps and rootfs are kept: the
// guest's network config lives in the snapshot, so it must come back with the
// same IP and TAP name.
export const pauseToSnapshot = async (vm: SnapshotTarget) => {
  const client = createFirecrackerClient(vm.socket);
  const { snapshot, mem } = snapshotPaths(vm.id);

  await client.patch("/vm", { state: "Paused" });
  try {
    await client.put("/snapshot/create", {
      snapshot_type: "Full",
      snapshot_path: snapshot,
      mem_file_path: mem,
    });
  } catch (err) {
    await removeSnapshot(vm.id);
    await client.patch("/vm", { state: "Resumed" }).catch(() => {});
    throw err;
  }

  disconnectSSH(vm.vmIp);
  try {
    await killFirecracker(vm.pid, vm.socket);
  } catch (err) {
    // Process is still alive: unfreeze it and drop the snapshot, so the
    // caller can honestly put the VM back to RUNNING.
    await client.patch("/vm", { state: "Resumed" }).catch(() => {});
    await removeSnapshot(vm.id);
    throw err;
  }

  // The process is gone: from here on the snapshot is the VM.
  await removeFile(vm.socket);
  await deleteTapInterface(tapName(vm.id));
};

// Start a fresh Firecracker process and load the snapshot into it. The guest
// continues from the exact instruction it was paused at.
export const resumeFromSnapshot = async (
  vm: SnapshotTarget,
  onSpawn: (pgid: number) => Promise<unknown>,
) => {
  const { snapshot, mem } = snapshotPaths(vm.id);
  let pid: number | null = null;

  try {
    await setupTapInterface(tapName(vm.id));
    await startFirecracker(vm.socket, (pgid) => {
      pid = pgid;
      return onSpawn(pgid);
    });

    await createFirecrackerClient(vm.socket).put("/snapshot/load", {
      snapshot_path: snapshot,
      mem_backend: { backend_type: "File", backend_path: mem },
      resume_vm: true,
    });

    await attemptSSHConnection({ vmIP: vm.vmIp, maxRetries: 5, baseDelay: 500 });
  } catch (err) {
    // Undo the new process/TAP but keep the snapshot so resume can be retried.
    await killFirecracker(pid, vm.socket).catch(() => {});
    await removeFile(vm.socket);
    await deleteTapInterface(tapName(vm.id));
    throw err;
  }

  // Firecracker mmaps the mem file privately, so unlinking it now is safe:
  // the data stays reachable until the process exits.
  await removeSnapshot(vm.id);
  return pid;
};
