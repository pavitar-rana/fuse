import { connections } from "./ssh.client.ts";
import pathModule from "path";

// POSIX single-quote escaping: 'it'\''s' → it's
export const shellQuote = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

const NVM_INIT = `export NVM_DIR="/root/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"`;

// Long enough for `npm install`; stops a command that never closes its
// output (e.g. it left a background process attached) from hanging forever.
const EXEC_TIMEOUT_MS = 5 * 60_000;

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
      const timer = setTimeout(() => {
        stream.close();
        reject(
          Object.assign(
            new Error(
              `Command timed out after ${EXEC_TIMEOUT_MS / 1000}s. Background processes must redirect their output, e.g. \`cmd > log 2>&1 &\``,
            ),
            { status: 504 },
          ),
        );
      }, EXEC_TIMEOUT_MS);

      stream
        .on("close", (code: number) => {
          clearTimeout(timer);
          if (code === 0) resolve(output.trim());
          // The user's command failing is a normal outcome, not a server
          // error: 422 with its output so the caller can see what went wrong.
          else
            reject(
              Object.assign(new Error(`Command failed (exit ${code}): ${error || output}`), {
                status: 422,
              }),
            );
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
  // Separate lines, not `a && b && command`: otherwise a trailing `&` in the
  // user's command backgrounds the whole chain, which keeps the SSH channel
  // open and hangs the request. Also: a missing nvm no longer skips the command.
  const setup = path ? `mkdir -p ${shellQuote(path)} && cd ${shellQuote(path)} || exit 1\n` : "";
  const finalCommand = `${NVM_INIT}\n${setup}${command}`;
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
