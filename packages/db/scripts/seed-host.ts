import "dotenv/config";
import { prisma } from "../lib/prisma.ts";

// Config via env, with defaults matching the backend's network layout
// (gateway 172.16.0.1, VMs start at 172.16.0.2).
const hostname = process.env.SEED_HOSTNAME ?? "host-1";
const ipPrefix = process.env.SEED_IP_PREFIX ?? "172.16.0"; // /24
const ipStart = Number(process.env.SEED_IP_START ?? 2);
const ipEnd = Number(process.env.SEED_IP_END ?? 254);
const portStart = Number(process.env.SEED_PORT_START ?? 8000);
const portEnd = Number(process.env.SEED_PORT_END ?? 8999);

const main = async () => {
  if (ipStart < 2 || ipEnd > 254 || ipStart > ipEnd) {
    throw new Error("IP range must be within .2-.254 (.1 is the gateway)");
  }
  if (portStart > portEnd) throw new Error("Invalid port range");

  const host = await prisma.host.upsert({
    where: { hostname },
    update: { ipRange: `${ipPrefix}.0/24` },
    create: { hostname, ipRange: `${ipPrefix}.0/24` },
  });

  const ips = Array.from({ length: ipEnd - ipStart + 1 }, (_, i) => ({
    hostId: host.id,
    ip: `${ipPrefix}.${ipStart + i}`,
  }));
  const ports = Array.from({ length: portEnd - portStart + 1 }, (_, i) => ({
    hostId: host.id,
    hostPort: portStart + i,
  }));

  // skipDuplicates makes this idempotent (@@unique on hostId+ip / hostId+hostPort)
  const ipRes = await prisma.ipPool.createMany({
    data: ips,
    skipDuplicates: true,
  });
  const portRes = await prisma.portPool.createMany({
    data: ports,
    skipDuplicates: true,
  });

  console.log(`Host "${host.hostname}" ready`);
  console.log(`  ipPool:   +${ipRes.count} new (${ips.length} in range)`);
  console.log(`  portPool: +${portRes.count} new (${ports.length} in range)`);
  console.log(`\nSet in apps/backend/.env (and other .env files):`);
  console.log(`  HOST_ID=${host.id}`);
};

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
