import { Router } from "express";
import { db } from "@workspace/db";
import { traineesTable, transactionsTable, weekPlansTable, runsTable, eventsTable, announcementsTable } from "@workspace/db/schema";
import { eq, sql, gt, gte } from "drizzle-orm";

const router = Router();

function getMondayStr() {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().split("T")[0];
}

router.get("/summary", async (req, res) => {
  const trainerId = (req as any).trainerId as number;
  const trainees = await db.select().from(traineesTable).where(eq(traineesTable.trainerId, trainerId));
  const mondayStr = getMondayStr();

  const weekPlans = await db.select().from(weekPlansTable).where(
    sql`${weekPlansTable.weekStart} = ${mondayStr}`
  );
  const plansWithRuns = await Promise.all(weekPlans.map(async (p) => {
    const runs = await db.select().from(runsTable).where(eq(runsTable.weekPlanId, p.id));
    return { ...p, hasRuns: runs.length > 0 };
  }));
  const plannedTraineeIds = new Set(plansWithRuns.filter(p => p.hasRuns).map(p => p.traineeId));

  const activeWeekPlans = await db.select().from(weekPlansTable).where(
    sql`${weekPlansTable.weekStart} >= ${mondayStr}`
  );
  const activeTraineeIds = new Set(activeWeekPlans.map(p => p.traineeId));

  const allTransactions = await db.select().from(transactionsTable);
  const balanceByTrainee = new Map<number, number>();
  for (const t of trainees) {
    const txs = allTransactions.filter(tx => tx.traineeId === t.id);
    const paid = txs.filter(tx => Number(tx.amount) > 0).reduce((s, tx) => s + Number(tx.amount), 0);
    const charged = txs.filter(tx => Number(tx.amount) < 0).reduce((s, tx) => s + Math.abs(Number(tx.amount)), 0);
    balanceByTrainee.set(t.id, charged - paid);
  }

  const totalBalanceDue = [...balanceByTrainee.values()].filter(b => b > 0).reduce((s, b) => s + b, 0);

  const upcomingEvents = await db.select().from(eventsTable).where(
    sql`${eventsTable.isActive} = true AND ${eventsTable.date} >= ${new Date().toISOString().split("T")[0]}`
  );
  const recentAnnouncements = await db.select().from(announcementsTable);

  res.json({
    totalTrainees: trainees.length,
    activeTrainees: activeTraineeIds.size,
    paidTrainees: trainees.filter(t => t.planType === "paid").length,
    totalBalanceDue,
    traineesWithActivity: activeTraineeIds.size,
    traineesPlannedThisWeek: plannedTraineeIds.size,
    upcomingEvents: upcomingEvents.length,
    recentAnnouncements: recentAnnouncements.length,
  });
});

router.get("/trainees-needing-attention", async (req, res) => {
  const trainerId = (req as any).trainerId as number;
  const trainees = await db.select().from(traineesTable).where(eq(traineesTable.trainerId, trainerId));
  const mondayStr = getMondayStr();

  const allTransactions = await db.select().from(transactionsTable);
  const weekPlans = await db.select().from(weekPlansTable).where(
    sql`${weekPlansTable.weekStart} >= ${mondayStr}`
  );
  const activeTraineeIds = new Set(weekPlans.map(p => p.traineeId));

  const result = trainees.map(t => {
    const txs = allTransactions.filter(tx => tx.traineeId === t.id);
    const paid = txs.filter(tx => Number(tx.amount) > 0).reduce((s, tx) => s + Number(tx.amount), 0);
    const charged = txs.filter(tx => Number(tx.amount) < 0).reduce((s, tx) => s + Math.abs(Number(tx.amount)), 0);
    const balance = charged - paid;
    return {
      ...t,
      monthlyFee: t.monthlyFee ? Number(t.monthlyFee) : null,
      balanceDue: balance,
      hasActivityThisWeek: activeTraineeIds.has(t.id),
      isPlannedThisWeek: activeTraineeIds.has(t.id),
    };
  });

  res.json({
    needingFeedback: result.filter(t => !t.hasActivityThisWeek),
    inactiveThisWeek: result.filter(t => !t.hasActivityThisWeek),
    withDueBalance: result.filter(t => t.balanceDue > 0),
  });
});

export default router;
