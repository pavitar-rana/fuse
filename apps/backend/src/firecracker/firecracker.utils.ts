import { prisma } from "@fuse/db";
import { PortMapping } from "@fuse/db/client";
import crypto from "crypto";
import { deleteHostPort } from "./firecracker.network.ts";

export const HOST_GATEWAY_IP = "172.16.0.1";

export const macFromCuid = (cuid: string) => {
  const hash = crypto.createHash("sha1").update(cuid).digest();
  const mac = Buffer.alloc(6);
  hash.copy(mac, 0, 0, 6);
  mac[0] = (mac[0] & 0xfe) | 0x02;

  return [...mac].map((b) => b.toString(16).padStart(2, "0")).join(":");
};

export const deleteVmPortMap = async (
  portMap: PortMapping[],
  hostId: string,
  vmIp: string,
) => {
  for (const port of portMap) {
    await deleteHostPort(vmIp, port.hostPort, port.vmPort);
    await prisma.$transaction(async (tx) => {
      await tx.portMapping.delete({
        where: {
          vmId_vmPort: { vmId: port.vmId, vmPort: port.vmPort },
        },
      });
      await tx.portPool.update({
        where: {
          hostId_hostPort: { hostId: hostId, hostPort: port.hostPort },
        },
        data: {
          vmId: null,
          status: "AVAILABLE",
        },
      });
    });
  }
};
