import { delay } from "../lib/delayHelper.ts";
import { connectSSH } from "../helpers/ssh/index.ts";

export const attemptSSHConnection = async ({
  maxRetries = 10,
  vmIP,
  baseDelay = 1000,
}: {
  maxRetries?: number;
  vmIP: string;
  baseDelay?: number;
}) => {
  let lastErr: unknown = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await connectSSH(vmIP);
      if (attempt > 1) console.log(`SSH to ${vmIP} connected on attempt ${attempt}`);
      return;
    } catch (err) {
      lastErr = err;
      const backoff = baseDelay * Math.min(attempt, 5);
      console.log(
        `[${attempt}/${maxRetries}] SSH to ${vmIP} failed: ${err instanceof Error ? err.message : String(err)}; retrying in ${backoff}ms`,
      );
      if (attempt < maxRetries) await delay(backoff);
    }
  }

  throw new Error(
    `Failed to connect to SSH after ${maxRetries} attempts. Last error: ${String(lastErr)}`,
  );
};
