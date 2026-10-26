import { readFileSync } from "fs";
import { Client } from "ssh2";
import { connections } from "./ssh.client.ts";
import { env } from "../../config/env.ts";

// Remove the map entry only if it still belongs to this connection, so the
// close/error handler of an old attempt can't evict a newer one.
const forget = (host: string, conn: Client) => {
  if (connections.get(host)?.conn === conn) connections.delete(host);
};

export const connectSSH = (host: string) => {
  return new Promise<Client>((resolve, reject) => {
    if (!host) return reject(new Error("Host not provided"));

    const existing = connections.get(host);
    if (existing?.isReady) return resolve(existing.conn);
    // A half-open attempt from earlier: drop it and start fresh.
    if (existing) existing.conn.end();

    const conn = new Client();
    connections.set(host, { conn, isReady: false });

    conn
      .on("ready", () => {
        const entry = connections.get(host);
        if (entry?.conn === conn) entry.isReady = true;
        resolve(conn);
      })
      .on("error", (err) => {
        forget(host, conn);
        reject(new Error(`Failed to connect to SSH: ${err.message}`));
      })
      .on("close", () => forget(host, conn))
      .connect({
        host,
        port: 22,
        username: "root",
        privateKey: readFileSync(env.vmSshKey),
        readyTimeout: 30000,
      });
  });
};

export const disconnectSSH = (host?: string) => {
  const hosts = host ? [host] : [...connections.keys()];
  for (const h of hosts) {
    connections.get(h)?.conn.end();
    connections.delete(h);
  }
};
