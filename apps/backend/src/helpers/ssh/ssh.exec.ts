import { connections } from "./ssh.client.ts";
import pathModule from "path";

// POSIX single-quote escaping: 'it'\''s' → it's
export const shellQuote = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

const NVM_INIT = `export NVM_DIR="/root/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"`;

const execOnHost = (host: string, command: string, stdin?: string) => {
  const entry = connections.get(host);
  if (!entry?.isReady) {
    return Promise.reject(new Error(`Not connected to SSH for host ${host}`));
  }

  return new Promise<string>((resolve, reject) => {
    entry.conn.exec(command, (err, stream) => {
      if (err) return reject(err);

      let output = "";
      let error = "";

      stream
        .on("close", (code: number) => {
          if (code === 0) resolve(output.trim());
          else reject(new Error(`Command failed (exit ${code}): ${error || output}`));
        })
        .on("data", (data: Buffer) => (output += data.toString()))
        .stderr.on("data", (data: Buffer) => (error += data.toString()));

      if (stdin !== undefined) stream.end(stdin);
    });
  });
};

// `command` is user-supplied shell on purpose (it's their sandbox); only the
// path we wrap it with is quoted.
export const runCommandfn = async (command: string, host: string, path?: string) => {
  const finalCommand = path
    ? `${NVM_INIT} && mkdir -p ${shellQuote(path)} && cd ${shellQuote(path)} && ${command}`
    : `${NVM_INIT} && ${command}`;
  return execOnHost(host, finalCommand);
};

export const createDirfn = async (path: string, host: string) => {
  await execOnHost(host, `mkdir -p ${shellQuote(path)}`);
  return "Directory created";
};

// Content goes over stdin, not argv, so file size isn't capped by ARG_MAX.
export const writeFilefn = async (path: string, content: string, host: string) => {
  const parentDir = pathModule.posix.dirname(path);
  await execOnHost(
    host,
    `mkdir -p ${shellQuote(parentDir)} && cat > ${shellQuote(path)}`,
    content,
  );
  return execOnHost(host, `ls -la ${shellQuote(parentDir)}`);
};
