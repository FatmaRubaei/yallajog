import { Router } from "express";
import { db } from "@workspace/db";
import {
  traineesTable,
  transactionsTable,
  weekPlansTable,
  runsTable,
} from "@workspace/db/schema";
import { eq, like, and, sql, isNull, or } from "drizzle-orm";
import {
  CreateTraineeBody,
  UpdateTraineeBody,
  GetTraineeParams,
  UpdateTraineeParams,
  DeleteTraineeParams,
  ListTraineesQueryParams,
} from "@workspace/api-zod";

const router = Router();

function buildTraineeWithComputed(trainee: typeof traineesTable.$inferSelect, balanceDue: number, hasActivity: boolean, isPlanned: boolean) {
  return {
    ...trainee,
    monthlyFee: trainee.monthlyFee ? Number(trainee.monthlyFee) : null,
    balanceDue,
    hasActivityThisWeek: hasActivity,
    isPlannedThisWeek: isPlanned,
  };
}

async function getBalanceDue(traineeId: number): Promise<number> {
  const transactions = await db.select().from(transactionsTable).where(eq(transactionsTable.traineeId, traineeId));
  return transactions.reduce((sum, t) => sum + Number(t.amount), 0) * -1;
}

async function computeBalanceDue(traineeId: number, monthlyFee: number | null): Promise<number> {
  const transactions = await db.select().from(transactionsTable).where(eq(transactionsTable.traineeId, traineeId));
  const paid = transactions.filter(t => Number(t.amount) > 0).reduce((s, t) => s + Number(t.amount), 0);
  const charged = transactions.filter(t => Number(t.amount) < 0).reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
  return charged - paid;
}

async function hasActivityThisWeek(traineeId: number): Promise<boolean> {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  const mondayStr = monday.toISOString().split("T")[0];
  const plans = await db.select().from(weekPlansTable).where(
    and(eq(weekPlansTable.traineeId, traineeId), sql`${weekPlansTable.weekStart} >= ${mondayStr}`)
  );
  return plans.length > 0;
}

async function isPlannedThisWeek(traineeId: number): Promise<boolean> {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  const mondayStr = monday.toISOString().split("T")[0];
  const plans = await db.select().from(weekPlansTable).where(
    and(eq(weekPlansTable.traineeId, traineeId), sql`${weekPlansTable.weekStart} = ${mondayStr}`)
  );
  if (plans.length === 0) return false;
  const runs = await db.select().from(runsTable).where(eq(runsTable.weekPlanId, plans[0].id));
  return runs.length > 0;
}

router.get("/", async (req, res) => {
  const parsed = ListTraineesQueryParams.safeParse(req.query);
  const params = parsed.success ? parsed.data : {};

  let conditions: ReturnType<typeof eq>[] = [];
  if (params.planType) conditions.push(eq(traineesTable.planType, params.planType));

  const trainerId = (req as any).trainerId as number;
  const traineesList = await db.select().from(traineesTable).where(eq(traineesTable.trainerId, trainerId));

  const results = await Promise.all(
    traineesList.map(async (t) => {
      const balance = await computeBalanceDue(t.id, t.monthlyFee ? Number(t.monthlyFee) : null);
      const hasAct = await hasActivityThisWeek(t.id);
      const planned = await isPlannedThisWeek(t.id);
      return buildTraineeWithComputed(t, balance, hasAct, planned);
    })
  );

  let filtered = results;
  if (params.search) {
    const q = params.search.toLowerCase();
    filtered = filtered.filter(t => t.name.toLowerCase().includes(q));
  }
  if (params.planType) {
    filtered = filtered.filter(t => t.planType === params.planType);
  }
  if (params.hasBalance === true) {
    filtered = filtered.filter(t => t.balanceDue > 0);
  }
  if (params.planned === true) {
    filtered = filtered.filter(t => t.isPlannedThisWeek);
  }
  if (params.planned === false) {
    filtered = filtered.filter(t => !t.isPlannedThisWeek);
  }

  res.json(filtered);
});

router.post("/", async (req, res) => {
  const body = CreateTraineeBody.parse(req.body);
  const trainerId = (req as any).trainerId as number;
  const [trainee] = await db.insert(traineesTable).values({ ...body as any, trainerId }).returning();
  const balance = await computeBalanceDue(trainee.id, trainee.monthlyFee ? Number(trainee.monthlyFee) : null);
  res.status(201).json(buildTraineeWithComputed(trainee, balance, false, false));
});

router.get("/:id", async (req, res) => {
  const { id } = GetTraineeParams.parse({ id: Number(req.params.id) });
  const [trainee] = await db.select().from(traineesTable).where(eq(traineesTable.id, id));
  if (!trainee) return res.status(404).json({ error: "Not found" });
  const balance = await computeBalanceDue(trainee.id, trainee.monthlyFee ? Number(trainee.monthlyFee) : null);
  const hasAct = await hasActivityThisWeek(trainee.id);
  const planned = await isPlannedThisWeek(trainee.id);
  res.json(buildTraineeWithComputed(trainee, balance, hasAct, planned));
});

router.put("/:id", async (req, res) => {
  const { id } = UpdateTraineeParams.parse({ id: Number(req.params.id) });
  const body = UpdateTraineeBody.parse(req.body);
  const [trainee] = await db.update(traineesTable).set(body as any).where(eq(traineesTable.id, id)).returning();
  if (!trainee) return res.status(404).json({ error: "Not found" });
  const balance = await computeBalanceDue(trainee.id, trainee.monthlyFee ? Number(trainee.monthlyFee) : null);
  const hasAct = await hasActivityThisWeek(trainee.id);
  const planned = await isPlannedThisWeek(trainee.id);
  res.json(buildTraineeWithComputed(trainee, balance, hasAct, planned));
});

router.delete("/:id", async (req, res) => {
  const { id } = DeleteTraineeParams.parse({ id: Number(req.params.id) });
  await db.delete(traineesTable).where(eq(traineesTable.id, id));
  res.status(204).end();
});

export default router;
