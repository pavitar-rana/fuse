import type { RequestHandler } from "express";
import {
  createDir,
  runCommand,
  writeFile,
} from "../services/vmExec.service.ts";

const runCommandController: RequestHandler = async (req, res) => {
  try {
    const { id, command, projectId, path, userId } = req.body;
    const response = await runCommand(id, command, projectId, path, userId);
    return res.status(201).json(response);
  } catch (e) {
    res.status(e.status ?? 500).json({
      message: e.message ?? "Internal server error",
    });
  }
};

const createDirController: RequestHandler = async (req, res) => {
  try {
    const { path, userId, id } = req.body;
    const response = await createDir(path, userId, id);
    return res.status(201).json(response);
  } catch (e) {
    res.status(e.status ?? 500).json({
      message: e.message ?? "Internal server error",
    });
  }
};

const writeFileController: RequestHandler = async (req, res) => {
  try {
    const { id, path, content, projectId, userId } = req.body;

    const response = await writeFile(id, path, content, projectId, userId);
    return res.status(201).json(response);
  } catch (e) {
    res.status(e.status ?? 500).json({
      message: e.message ?? "Internal server error",
    });
  }
};

export { runCommandController, createDirController, writeFileController };
