import type { RequestHandler } from "express";
import { createDir, runCommand, writeFile } from "../services/vmExec.service.ts";

const runCommandController: RequestHandler = async (req, res) => {
  res.status(200).json(await runCommand(req.userId, req.body ?? {}));
};

const createDirController: RequestHandler = async (req, res) => {
  res.status(200).json(await createDir(req.userId, req.body ?? {}));
};

const writeFileController: RequestHandler = async (req, res) => {
  res.status(200).json(await writeFile(req.userId, req.body ?? {}));
};

export { runCommandController, createDirController, writeFileController };
