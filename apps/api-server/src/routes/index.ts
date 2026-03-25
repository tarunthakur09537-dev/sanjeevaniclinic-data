import { Router } from "express";
import healthRouter from "./health.js";
import patientsRouter from "./patients.js";

const router: any = Router();

router.use(healthRouter);
router.use(patientsRouter);

export default router;
