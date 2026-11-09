import type { RequestHandler } from "express";
import { createVm, deleteVm, getVmUrl, pauseVm, resumeVm } from "../services/vm.service.ts";

// Express 5 forwards rejected promises to the error middleware, so handlers
// don't need their own try/catch.
const createFireCrackerController: RequestHandler = async (req, res) => {
  res.status(201).json(await createVm(req.userId, req.body?.config));
};

const deleteFireCrackerController: RequestHandler = async (req, res) => {
  res.status(200).json(await deleteVm(req.userId, req.body?.id));
};

const pauseVmController: RequestHandler = async (req, res) => {
  res.status(200).json(await pauseVm(req.userId, req.body?.id));
};

const resumeVmController: RequestHandler = async (req, res) => {
  res.status(200).json(await resumeVm(req.userId, req.body?.id));
};

const getVmUrlController: RequestHandler = async (req, res) => {
  const { id, port } = req.body ?? {};
  res.status(200).json(await getVmUrl(req.userId, { id, port }));
};

export {
  createFireCrackerController,
  deleteFireCrackerController,
  getVmUrlController,
  pauseVmController,
  resumeVmController,
};
