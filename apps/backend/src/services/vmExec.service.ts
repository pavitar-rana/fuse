import { attemptSSHConnection } from "../firecracker/firecracker.ssh.ts";
import { prisma } from "../lib/prisma.ts";
import { serviceError } from "./index.ts";
import {
  createDirfn,
  runCommandfn,
  writeFilefn,
} from "../helpers/ssh/index.ts";

export const runCommand = async (
  id: string,
  command: string,
  projectId: string,
  path: string,
  userId: string,
) => {
  if (!id || !command || !projectId || !userId) {
    throw serviceError("Id is required", 400);
  }

  const vm = await prisma.virtualmachine.findUnique({
    where: {
      id,
      userId,
    },
  });

  if (!vm) {
    throw serviceError("VM not found", 500);
  }

  await attemptSSHConnection({
    vmIP: vm.vmIp,
    maxRetries: 10,
    baseDelay: 1000,
  });

  const finalPath =
    typeof path === "string" && path.trim() !== ""
      ? path
      : `/root/${projectId}/`;

  const result = await runCommandfn(command, vm.vmIp, finalPath);
  return {
    data: {
      result,
      id,
    },
    message: "Command run successful",
  };
};

export const createDir = async (path: string, userId: string, id: string) => {
  if (!path || !userId || !id) {
    throw serviceError("All params needed", 500);
  }

  const vm = await prisma.virtualmachine.findUnique({
    where: {
      id,
      userId,
    },
  });

  if (!vm) {
    throw serviceError("VM not found", 500);
  }

  await createDirfn(path, vm.vmIp);

  return {
    message: "Directory created",
    data: {},
  };
};

export const writeFile = async (
  id: string,
  path: string,
  content: string,
  projectId: string,
  userId: string,
) => {
  if (!id || !path || !content || !projectId || !userId) {
    throw serviceError("Id is required", 400);
  }

  const vm = await prisma.virtualmachine.findUnique({
    where: {
      id,
      userId,
    },
  });

  if (!vm) {
    throw serviceError("Vm not found", 500);
  }

  await attemptSSHConnection({
    vmIP: vm.vmIp,
    maxRetries: 10,
    baseDelay: 1000,
  });

  const fullPath = `/root/${projectId}/${path}`.replace(/\/+/g, "/");
  const result = await writeFilefn(fullPath, content, vm.vmIp);

  return {
    message: "Write file successful",
    data: {
      result,
      id,
    },
  };
};
