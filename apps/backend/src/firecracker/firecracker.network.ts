import os from "os";
import { env } from "../config/env.ts";
import { sudo, trySudo } from "../lib/sh.ts";
import { HOST_GATEWAY_IP } from "./firecracker.utils.ts";

const BRIDGE = "br0";

export const tapName = (vmId: string) => `tap_${vmId.slice(0, 8)}`;

// Adds an iptables rule only if it isn't already there (`-C` checks).
const ensureRule = async (table: string, chain: string, rule: string[], insert = false) => {
  if (await trySudo("iptables", ["-t", table, "-C", chain, ...rule])) return;
  const op = insert ? ["-I", chain, "1"] : ["-A", chain];
  await sudo("iptables", ["-t", table, ...op, ...rule]);
};

const dnatRule = (vmIP: string, hostPort: number, vmPort: number) => [
  "-p", "tcp", "--dport", String(hostPort),
  "-j", "DNAT", "--to-destination", `${vmIP}:${vmPort}`,
];

const forwardRule = (vmIP: string, vmPort: number) => [
  "-p", "tcp", "-d", vmIP, "--dport", String(vmPort), "-j", "ACCEPT",
];

export const setupHostPort = async (vmIP: string, hostPort: number, vmPort: number) => {
  await ensureRule("nat", "PREROUTING", dnatRule(vmIP, hostPort, vmPort));
  await ensureRule("filter", "FORWARD", forwardRule(vmIP, vmPort));
};

// Best-effort: a rule that's already gone is not an error.
export const deleteHostPort = async (vmIP: string, hostPort: number, vmPort: number) => {
  await trySudo("iptables", ["-t", "nat", "-D", "PREROUTING", ...dnatRule(vmIP, hostPort, vmPort)]);
  await trySudo("iptables", ["-D", "FORWARD", ...forwardRule(vmIP, vmPort)]);
};

// Host-wide setup. Idempotent, so it is safe to run on every create.
const setupBridge = async () => {
  if (!(await trySudo("ip", ["link", "show", BRIDGE]))) {
    await sudo("ip", ["link", "add", "name", BRIDGE, "type", "bridge"]);
  }
  await trySudo("ip", ["addr", "add", `${HOST_GATEWAY_IP}/24`, "dev", BRIDGE]);
  await sudo("ip", ["link", "set", BRIDGE, "up"]);
  await sudo("sysctl", ["-w", "net.ipv4.ip_forward=1"]);

  await ensureRule("nat", "POSTROUTING", ["-o", env.uplinkIface, "-j", "MASQUERADE"]);
  await ensureRule("filter", "FORWARD", ["-i", BRIDGE, "-j", "ACCEPT"]);
  await ensureRule("filter", "FORWARD", ["-o", BRIDGE, "-j", "ACCEPT"]);

  // Guests may not open connections to the host itself (only replies to
  // connections the host started, e.g. SSH). DROP goes in first, then the
  // ESTABLISHED rule is inserted above it.
  await ensureRule("filter", "INPUT", ["-i", BRIDGE, "-j", "DROP"], true);
  await ensureRule(
    "filter",
    "INPUT",
    ["-i", BRIDGE, "-m", "conntrack", "--ctstate", "ESTABLISHED,RELATED", "-j", "ACCEPT"],
    true,
  );
};

export const setupTapInterface = async (tap: string) => {
  await setupBridge();

  await trySudo("ip", ["link", "del", tap]);
  await sudo("ip", ["tuntap", "add", "dev", tap, "mode", "tap", "user", os.userInfo().username]);
  await sudo("ip", ["link", "set", tap, "master", BRIDGE]);
  // Isolated bridge ports can't talk to each other, only to the bridge
  // itself, so tenants can't reach each other's VMs.
  await sudo("ip", ["link", "set", "dev", tap, "type", "bridge_slave", "isolated", "on"]);
  await sudo("ip", ["link", "set", tap, "up"]);
};

export const deleteTapInterface = (tap: string) => trySudo("ip", ["link", "del", tap]);
