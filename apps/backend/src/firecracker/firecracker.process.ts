import { spawn } from "child_process";
import fs from "fs";
import { delay } from "../lib/delayHelper.ts";
import { env } from "../config/env.ts";
import { run, sudo, trySudo } from "../lib/sh.ts";

// Starts Firecracker in its own process group and waits for the API socket.
// Returns the process group id. The caller stores it on the VM row so delete
// can kill the group later.
export const startFirecracker = async (
  api_socket: string,
  onSpawn: (pgid: number) => Promise<unknown>,
) => {
  const fc = spawn("sudo", [env.firecrackerBin, "--api-sock", api_socket], {
    stdio: ["ignore", "inherit", "inherit"],
    detached: true,
  });
  fc.unref();

  if (!fc.pid) throw new Error("Failed to spawn firecracker");
  // detached: true makes the child a group leader, so pgid === pid.
  const pgid = fc.pid;
  await onSpawn(pgid);

  const maxWait = 5000;
  const start = Date.now();
  while (!fs.existsSync(api_socket) && Date.now() - start < maxWait) {
    await delay(100);
  }
  if (!fs.existsSync(api_socket)) {
    throw new Error(`Firecracker API socket not created at ${api_socket}`);
  }

  await sudo("chmod", ["666", api_socket]);
  return pgid;
};

// Firecracker runs as root (via sudo), so a non-root Node process can't
// signal it directly: everything goes through sudo.
export const killFirecracker = async (pgid: number | null | undefined, api_socket: string) => {
  if (pgid) {
    try {
      await sudo("kill", ["-KILL", "--", `-${pgid}`]);
    } catch (err: any) {
      // "No such process" means it's already gone, which is what we want.
      if (!String(err?.stderr ?? err?.message).includes("No such process")) {
        throw err;
      }
    }
  }
  // With sudo's use_pty (default on some distros) firecracker gets its own
  // session, so the group kill above can miss it. Also covers rows with no pid.
  await trySudo("pkill", ["-KILL", "-f", "--", `--api-sock ${api_socket}$`]);
};

// Is a Firecracker process serving this API socket? (pgrep needs no sudo.)
export const isFirecrackerAlive = async (api_socket: string) => {
  try {
    await run("pgrep", ["-f", "--", `--api-sock ${api_socket}$`]);
    return true;
  } catch {
    return false;
  }
};

export const removeFile = (path: string) => trySudo("rm", ["-f", path]);
