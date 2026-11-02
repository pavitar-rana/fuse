import { attemptSSHConnection } from "../firecracker/firecracker.ssh.ts";
import { serviceError } from "./index.ts";
import { createDirfn, runCommandfn, writeFilefn } from "../helpers/ssh/index.ts";
import * as vmRepository from "../repositories/vm.repository.ts";

const requireString = (value: unknown, name: string) => {
  if (typeof value !== "string" || value.trim() === "") {
    throw serviceError(`${name} is required`, 400);
  }
  return value;
};

// Look up a RUNNING VM owned by userId and make sure SSH is connected.
const connectToVm = async (id: unknown, userId: string) => {
  const vmId = requireString(id, "id");
  const vm = await vmRepository.findVmById(vmId, userId);
  if (!vm) throw serviceError("VM not found", 404);
  if (vm.status !== "RUNNING") throw serviceError(`VM is ${vm.status}`, 409);

  await attemptSSHConnection({ vmIP: vm.vmIp, maxRetries: 3, baseDelay: 500 });
  return vm;
};

export const runCommand = async (
  userId: string,
  body: { id?: unknown; command?: unknown; projectId?: unknown; path?: unknown },
) => {
  const command = requireString(body.command, "command");
  const projectId = requireString(body.projectId, "projectId");
  const vm = await connectToVm(body.id, userId);

  const finalPath =
    typeof body.path === "string" && body.path.trim() !== ""
      ? body.path
      : `/root/${projectId}/`;

  const result = await runCommandfn(command, vm.vmIp, finalPath);
  return { message: "Command run successful", data: { result, id: vm.id } };
};

export const createDir = async (userId: string, body: { id?: unknown; path?: unknown }) => {
  const path = requireString(body.path, "path");
  const vm = await connectToVm(body.id, userId);

  await createDirfn(path, vm.vmIp);
  return { message: "Directory created", data: {} };
};

export const writeFile = async (
  userId: string,
  body: { id?: unknown; path?: unknown; content?: unknown; projectId?: unknown },
) => {
  const path = requireString(body.path, "path");
  const projectId = requireString(body.projectId, "projectId");
  // Empty string is a valid file.
  if (typeof body.content !== "string") throw serviceError("content must be a string", 400);
  const vm = await connectToVm(body.id, userId);

  const fullPath = `/root/${projectId}/${path}`.replace(/\/+/g, "/");
  const result = await writeFilefn(fullPath, body.content, vm.vmIp);
  return { message: "Write file successful", data: { result, id: vm.id } };
};
