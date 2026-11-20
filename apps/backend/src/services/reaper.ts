import { getLimits } from "../repositories/config.repository.ts";
import * as vmRepository from "../repositories/vm.repository.ts";
import { pauseVm } from "./vm.service.ts";

// Every minute, auto-pause VMs that have been RUNNING longer than
// Config.maxRunMinutes. Pausing keeps their data (snapshot); the user can
// resume, which restarts the clock.
const INTERVAL_MS = 60_000;
let busy = false;

const sweep = async () => {
  if (busy) return;
  busy = true;
  try {
    const { maxRunMinutes } = await getLimits();
    if (maxRunMinutes <= 0) return;

    const cutoff = new Date(Date.now() - maxRunMinutes * 60_000);
    const expired = await vmRepository.findRunningSince(cutoff);
    for (const vm of expired) {
      try {
        await pauseVm(vm.userId, vm.id);
        console.log(`Run-time limit (${maxRunMinutes}m): paused VM ${vm.id}`);
      } catch (err) {
        console.error(`Run-time limit: failed to pause VM ${vm.id}:`, err);
      }
    }
  } catch (err) {
    console.error("Run-time reaper sweep failed:", err);
  } finally {
    busy = false;
  }
};

export const startReaper = () => {
  setInterval(sweep, INTERVAL_MS).unref();
  void sweep();
};
