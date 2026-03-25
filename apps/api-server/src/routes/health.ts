import { Router } from "express";

const router: any = Router();

router.get("/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

export default router;
