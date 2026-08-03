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
import garminTestRouter from "./garmin-test";
import { garminFormPublicRouter } from "./garmin-form";
import { generateGarminFormToken } from "./garmin-form";
import { requireAuth } from "../middleware/auth";
import { db } from "@workspace/db";
import { traineesTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const router = Router();

router.use(healthRouter);
router.use(downloadRouter);
router.use("/auth", authRouter);
router.use(whatsAppWebhookRouter);
router.use(garminFormPublicRouter);

router.use(requireAuth);

router.use(garminTestRouter);

/** POST /garmin-form/generate — generate a signed form link for a trainee */
router.post("/garmin-form/generate", async (req: any, res: any) => {
  const trainerId = req.trainerId as number;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const traineeId = Number(body.traineeId);
  if (!traineeId) return res.status(400).json({ error: "traineeId required" });
  const [trainee] = await db
    .select({ id: traineesTable.id })
    .from(traineesTable)
    .where(and(eq(traineesTable.id, traineeId), eq(traineesTable.trainerId, trainerId)));
  if (!trainee) return res.status(404).json({ error: "Trainee not found" });
  const token = generateGarminFormToken(trainee.id);
  return res.json({ token });
});

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
