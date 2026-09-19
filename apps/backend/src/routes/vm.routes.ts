import { Router } from "express";
import {
    createFireCrackerController,
    deleteFireCrackerController,
    getVmUrlController,
} from "../controller/createVM.controller.ts";

const router = Router();

router.post("/create", createFireCrackerController);
router.post("/delete", deleteFireCrackerController);
router.post("/get-host", getVmUrlController);

export default router;
