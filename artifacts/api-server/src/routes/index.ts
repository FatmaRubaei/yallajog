import { Router } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import traineesRouter from "./trainees";
import contractsRouter from "./contracts";
import transactionsRouter, { balanceRouter } from "./transactions";
import segmentsRouter, { segmentTypesRouter } from "./segments";
import weekPlansRouter, { currentWeekPlanRouter } from "./weekplans";
import announcementsRouter from "./announcements";
import eventsRouter from "./events";
import dashboardRouter from "./dashboard";
import downloadRouter from "./download";
import trainerWhatsAppRouter from "./trainer-whatsapp";
import whatsAppWebhookRouter from "./whatsapp-webhook";
import { requireAuth } from "../middleware/auth";
import { getFitFile } from "../lib/fit-store";

const router = Router();

router.use(healthRouter);
router.use(downloadRouter);
router.use("/auth", authRouter);
router.use(whatsAppWebhookRouter);

// Public — no auth — short-lived FIT file download links
router.get("/fit/:token", (req, res) => {
  const result = getFitFile(req.params.token);
  if (!result) return res.status(404).json({ error: "File not found or link expired" });
  res.setHeader("Content-Type", "application/vnd.ant.fit");
  res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
  res.setHeader("Content-Length", result.buffer.length);
  return res.send(result.buffer);
});

router.use(requireAuth);

router.use("/trainees", traineesRouter);
router.use("/trainees/:id/contract", contractsRouter);
router.use("/trainees/:id/transactions", transactionsRouter);
router.use("/trainees/:id/balance", balanceRouter);
router.use("/trainees/:id/current-week-plan", currentWeekPlanRouter);
router.use("/segments", segmentsRouter);
router.use("/segment-types", segmentTypesRouter);
router.use("/week-plans", weekPlansRouter);
router.use("/announcements", announcementsRouter);
router.use("/events", eventsRouter);
router.use("/dashboard", dashboardRouter);
router.use(trainerWhatsAppRouter);

export default router;
