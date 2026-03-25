import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import patientsRouter from "./patients.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(patientsRouter);

export default router;
