import fs from "fs/promises";
import type { Virtualmachine } from "@fuse/db/client";
import { disconnectSSH } from "../helpers/ssh/index.ts";
import { getCurrentHost } from "../config/host.ts";
import * as vmRepository from "../repositories/vm.repository.ts";
import { deleteHostPort, deleteTapInterface, tapName } from "./firecracker.network.ts";
import { killFirecracker, removeFile } from "./firecracker.process.ts";
import { removeSnapshot } from "./firecracker.snapshot.ts";

type TeardownTarget = Pick<Virtualmachine, "id" | "vmIp" | "socket" | "rootfsPath" | "pid">;

// Releases everything a VM holds. Every step is idempotent, so this is safe to
// run on a half-created VM (create rollback) or to retry after a failure.
// The IP goes back to the pool last, only once the process and TAP are gone,
// so a still-running guest can never share an IP with a new one.
export const teardownVm = async (vm: TeardownTarget) => {
  const host = await getCurrentHost();

  disconnectSSH(vm.vmIp);

  // Port maps must be read before the VM row is deleted (cascade).
  const portMaps = await vmRepository.getPortMap(vm.id);
  for (const pm of portMaps) {
    await deleteHostPort(vm.vmIp, pm.hostPort, pm.vmPort);
    await vmRepository.releasePortMapping(host.id, pm);
  }

  // If this throws the guest may still be running: stop here and keep the IP.
  await killFirecracker(vm.pid, vm.socket);

  await removeFile(vm.socket);
  await fs.rm(vm.rootfsPath, { force: true });
  await removeSnapshot(vm.id);
  await deleteTapInterface(tapName(vm.id));

  await vmRepository.releaseVmIP(vm.id);
  console.log(`VM ${vm.id} torn down`);
};
