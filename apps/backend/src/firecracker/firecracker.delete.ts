import dotenv from "dotenv";
import { execSync } from "child_process";
import type { clientType } from "../lib/types.ts";
import { createFirecrackerClient, deleteVmPortMap } from "./index.ts";
import { getRedisClient } from "../helpers/redis/index.ts";
import { disconnectSSH } from "../helpers/ssh/index.ts";
import { PortMapping, Virtualmachine } from "@fuse/db/client";
import { getCurrentHost } from "../config/host.ts";

dotenv.config();

export const deleteFireCracker = async (
  vm: Virtualmachine,
  portMap: PortMapping[],
) => {
  const redisClient = await getRedisClient();
  const api_socket = `/tmp/firecracker-${vm.id}.socket`;
  const client: clientType = createFirecrackerClient(api_socket);

  const host = await getCurrentHost();

  disconnectSSH(vm.vmIp);

  await deleteVmPortMap(portMap, host.id, vm.vmIp);

  try {
    await client.put("/actions", { action_type: "SendCtrlAltDel" });
    await new Promise((r) => setTimeout(r, 2000));
  } catch (err) {
    console.error("CtrlAltDel failed:", err);
  }

  try {
    const key = "firecracker:list";
    let arr = JSON.parse(String(await redisClient.get(key)) || "[]");

    const idx = arr.findIndex((x) => x.api_socket === api_socket);
    if (idx !== -1) {
      const { pid } = arr[idx];

      try {
        process.kill(pid, "SIGKILL");
      } catch (err: any) {
        if (err.code !== "ESRCH") {
          console.error("Error killing Firecracker PGID:", err);
        }
      }

      arr.splice(idx, 1);
      await redisClient.set(key, JSON.stringify(arr));
    }
  } catch (err) {
    console.error("Error removing Firecracker process:", err);
  }

  try {
    console.log(`Cleaning up socket: ${api_socket}`);
    execSync(`sudo rm -f ${api_socket}`);
  } catch (err: any) {
    console.error("Error removing socket:", err?.message || err);
  }

  if (vm.rootfsPath) {
    try {
      console.log(`Deleting VM rootfs: ${vm.rootfsPath}`);
      execSync(`rm -f ${vm.rootfsPath}`);
      console.log(`Rootfs deleted successfully`);
    } catch (err: any) {
      console.error("Error removing VM rootfs:", err?.message || err);
    }
  }

  const tap = `tap_${vm.id.slice(0, 8)}`;
  try {
    console.log(`Cleaning up TAP interface: ${tap}`);
    execSync(`sudo ip link del ${tap} 2>/dev/null || true`);
  } catch (err: any) {
    console.error("Error removing TAP interface:", err?.message || err);
  }

  console.log(`VM ${vm.id} cleanup completed`);
};
