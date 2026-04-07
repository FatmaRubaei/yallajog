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
import { requireAuth } from "../middleware/auth";

const router = Router();

router.use(healthRouter);
router.use(downloadRouter);
router.use("/auth", authRouter);

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

export default router;
