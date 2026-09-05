import type { RequestHandler } from "express";
import { createVm, deleteVm, getVmUrl } from "../services/vm.service.ts";

const createFireCrackerController: RequestHandler = async (req, res) => {
  try {
    const { userId, config } = req.body;
    const vm = await createVm(userId, config);
    return res.status(201).json(vm);
  } catch (e) {
    res.status(e.status ?? 500).json({
      message: e.message ?? "Internal Server error",
    });
  }
};

const deleteFireCrackerController: RequestHandler = async (req, res) => {
  try {
    const { id, userId } = req.body;
    const response = deleteVm(id, userId);
    return res.status(201).json(response);
  } catch (e) {
    res.status(e.status ?? 500).json({
      message: e.message ?? "Internal Server error",
    });
  }
};
const getVmUrlController: RequestHandler = async (req, res) => {
  try {
    const { userId, ip, id } = req.body;

    const response = await getVmUrl(userId, { ip, id });
    return res.status(201).json(response);
  } catch (c) {
    res.status(c.status ?? 500).json({
      message: c.message ?? "Internal service error",
    });
  }
};

export {
  createFireCrackerController,
  deleteFireCrackerController,
  getVmUrlController,
};
