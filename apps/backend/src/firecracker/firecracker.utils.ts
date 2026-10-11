import crypto from "crypto";

export const HOST_GATEWAY_IP = "172.16.0.1";

export const macFromCuid = (cuid: string) => {
  const hash = crypto.createHash("sha1").update(cuid).digest();
  const mac = Buffer.alloc(6);
  hash.copy(mac, 0, 0, 6);
  mac[0] = (mac[0] & 0xfe) | 0x02;

  return [...mac].map((b) => b.toString(16).padStart(2, "0")).join(":");
};

export const socketPath = (vmId: string) => `/tmp/firecracker-${vmId}.socket`;
