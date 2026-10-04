import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

// Runs a binary with an argv array: no shell, so arguments can't inject
// commands, and it doesn't block the event loop the way execSync does.
export const run = async (cmd: string, args: string[]) => {
  const { stdout } = await execFileAsync(cmd, args);
  return stdout.trim();
};

export const sudo = (cmd: string, args: string[]) => run("sudo", [cmd, ...args]);

// Like sudo(), but returns false instead of throwing. Use it for idempotency
// checks (`iptables -C`, `ip link show`) and best-effort teardown steps.
export const trySudo = async (cmd: string, args: string[]) => {
  try {
    await sudo(cmd, args);
    return true;
  } catch {
    return false;
  }
};
