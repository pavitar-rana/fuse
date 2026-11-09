import { Router } from "express";
import {
    createFireCrackerController,
    deleteFireCrackerController,
    getVmUrlController,
    pauseVmController,
    resumeVmController,
} from "../controller/createVM.controller.ts";

const router = Router();

router.post("/create", createFireCrackerController);
router.post("/delete", deleteFireCrackerController);
router.post("/get-host", getVmUrlController);
router.post("/pause", pauseVmController);
router.post("/resume", resumeVmController);

export default router;
