import { Router } from "express";
import { db } from "@workspace/db";
import { weekPlansTable, runsTable, runSegmentsTable, traineesTable, segmentsTable, segmentTypesTable } from "@workspace/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import {
  ListWeekPlansQueryParams,
  CreateWeekPlanBody,
  GetWeekPlanParams,
  UpdateWeekPlanParams,
  UpdateWeekPlanBody,
  DeleteWeekPlanParams,
  AddRunToWeekPlanParams,
  AddRunToWeekPlanBody,
  UpdateRunParams,
  UpdateRunBody,
  DeleteRunParams,
  GetTraineeCurrentWeekPlanParams,
} from "@workspace/api-zod";

const router = Router();

async function buildRun(run: typeof runsTable.$inferSelect) {
  const segments = await db.select().from(runSegmentsTable).where(eq(runSegmentsTable.runId, run.id));
  const segsWithNames = await Promise.all(segments.map(async (rs) => {
    let segName: string | null = null;
    let segTemplate: string | null = null;
    if (rs.segmentId) {
      const [seg] = await db.select().from(segmentsTable).where(eq(segmentsTable.id, rs.segmentId));
      segName = seg?.name ?? null;
      segTemplate = seg?.template ?? null;
    }
    return { ...rs, segmentName: segName, segmentTemplate: segTemplate };
  }));
  return { ...run, segments: segsWithNames.sort((a, b) => a.order - b.order) };
}

async function buildWeekPlanDetail(plan: typeof weekPlansTable.$inferSelect) {
  const [trainee] = await db.select().from(traineesTable).where(eq(traineesTable.id, plan.traineeId));
  const runs = await db.select().from(runsTable).where(eq(runsTable.weekPlanId, plan.id));
  const runsWithSegments = await Promise.all(runs.sort((a, b) => a.order - b.order).map(buildRun));
  return {
    ...plan,
    traineeName: trainee?.name ?? "",
    runsPerWeek: trainee?.runsPerWeek ?? null,
    runs: runsWithSegments,
    runsCount: runs.length,
  };
}

router.get("/", async (req, res) => {
  const parsed = ListWeekPlansQueryParams.safeParse(req.query);
  const params = parsed.success ? parsed.data : {};
  let plans = await db.select().from(weekPlansTable);
  if (params.traineeId) {
    plans = plans.filter(p => p.traineeId === params.traineeId);
  }
  if (params.weekStart) {
    plans = plans.filter(p => p.weekStart === params.weekStart);
  }
  const results = await Promise.all(plans.map(async (p) => {
    const [trainee] = await db.select().from(traineesTable).where(eq(traineesTable.id, p.traineeId));
    const runs = await db.select().from(runsTable).where(eq(runsTable.weekPlanId, p.id));
    return { ...p, traineeName: trainee?.name ?? "", runsCount: runs.length };
  }));
  res.json(results);
});

router.post("/", async (req, res) => {
  const body = CreateWeekPlanBody.parse(req.body);
  const { runs: runsInput, ...planData } = body as any;
  const [plan] = await db.insert(weekPlansTable).values(planData).returning();
  if (runsInput && runsInput.length > 0) {
    for (const r of runsInput) {
      const { segmentIds, ...runData } = r;
      const [run] = await db.insert(runsTable).values({ weekPlanId: plan.id, ...runData }).returning();
      if (segmentIds && segmentIds.length > 0) {
        const segRows = await Promise.all(
          segmentIds.map(async (sid: number, idx: number) => {
            const [seg] = await db.select().from(segmentsTable).where(eq(segmentsTable.id, sid));
            let typeName: string | null = null;
            if (seg?.typeId) {
              const [st] = await db.select().from(segmentTypesTable).where(eq(segmentTypesTable.id, seg.typeId));
              typeName = st?.name ?? null;
            }
            return {
              runId: run.id,
              segmentId: sid,
              resolvedText: seg?.name ?? "",
              segmentType: typeName,
              order: idx + 1,
            };
          })
        );
        await db.insert(runSegmentsTable).values(segRows);
      }
    }
  }
  const detail = await buildWeekPlanDetail(plan);
  res.status(201).json(detail);
});

router.get("/:id", async (req, res) => {
  const { id } = GetWeekPlanParams.parse({ id: Number(req.params.id) });
  const [plan] = await db.select().from(weekPlansTable).where(eq(weekPlansTable.id, id));
  if (!plan) return res.status(404).json({ error: "Not found" });
  res.json(await buildWeekPlanDetail(plan));
});

router.put("/:id", async (req, res) => {
  const { id } = UpdateWeekPlanParams.parse({ id: Number(req.params.id) });
  const body = UpdateWeekPlanBody.parse(req.body);
  const [plan] = await db.update(weekPlansTable).set(body as any).where(eq(weekPlansTable.id, id)).returning();
  if (!plan) return res.status(404).json({ error: "Not found" });
  res.json(await buildWeekPlanDetail(plan));
});

router.delete("/:id", async (req, res) => {
  const { id } = DeleteWeekPlanParams.parse({ id: Number(req.params.id) });
  await db.delete(weekPlansTable).where(eq(weekPlansTable.id, id));
  res.status(204).end();
});

router.post("/:id/runs", async (req, res) => {
  const { id } = AddRunToWeekPlanParams.parse({ id: Number(req.params.id) });
  const body = AddRunToWeekPlanBody.parse(req.body);
  const { segments, ...runData } = body;
  const [run] = await db.insert(runsTable).values({ weekPlanId: id, ...runData } as any).returning();
  if (segments && segments.length > 0) {
    await db.insert(runSegmentsTable).values(
      segments.map((s: any) => ({
        runId: run.id,
        segmentId: s.segmentId ?? null,
        resolvedText: s.resolvedText,
        segmentType: s.segmentType ?? null,
        durationMinutes: s.durationMinutes ?? null,
        distanceKm: s.distanceKm ?? null,
        pace: s.pace ?? null,
        completed: s.completed ?? false,
        order: s.order,
      }))
    );
  }
  res.status(201).json(await buildRun(run));
});

router.put("/:id/runs/:runId", async (req, res) => {
  const runId = Number(req.params.runId);
  const body = UpdateRunBody.parse(req.body);
  const { segments, ...runData } = body;
  const [run] = await db.update(runsTable).set(runData as any).where(eq(runsTable.id, runId)).returning();
  if (!run) return res.status(404).json({ error: "Not found" });
  if (segments !== undefined) {
    await db.delete(runSegmentsTable).where(eq(runSegmentsTable.runId, runId));
    if (segments.length > 0) {
      await db.insert(runSegmentsTable).values(
        segments.map((s: any) => ({
          runId,
          segmentId: s.segmentId ?? null,
          resolvedText: s.resolvedText,
          segmentType: s.segmentType ?? null,
          durationMinutes: s.durationMinutes ?? null,
          distanceKm: s.distanceKm ?? null,
          pace: s.pace ?? null,
          completed: s.completed ?? false,
          order: s.order,
        }))
      );
    }
  }
  res.json(await buildRun(run));
});

router.delete("/:id/runs/:runId", async (req, res) => {
  const runId = Number(req.params.runId);
  await db.delete(runsTable).where(eq(runsTable.id, runId));
  res.status(204).end();
});

router.patch("/:id/runs/:runId/segments/:segId", async (req, res) => {
  const segId = Number(req.params.segId);
  const { completed } = req.body;
  const [seg] = await db
    .update(runSegmentsTable)
    .set({ completed: Boolean(completed) })
    .where(eq(runSegmentsTable.id, segId))
    .returning();
  if (!seg) return res.status(404).json({ error: "Not found" });
  res.json(seg);
});

export const currentWeekPlanRouter = Router({ mergeParams: true });

currentWeekPlanRouter.get("/", async (req, res) => {
  const { id } = GetTraineeCurrentWeekPlanParams.parse({ id: Number(req.params.id) });
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  const year = monday.getFullYear();
  const month = String(monday.getMonth() + 1).padStart(2, "0");
  const date = String(monday.getDate()).padStart(2, "0");
  const mondayStr = `${year}-${month}-${date}`;
  const plans = await db.select().from(weekPlansTable).where(
    and(eq(weekPlansTable.traineeId, id), sql`${weekPlansTable.weekStart} = ${mondayStr}`)
  ).orderBy(desc(weekPlansTable.id));
  if (plans.length === 0) return res.status(404).json({ error: "No plan for current week" });
  res.json(await buildWeekPlanDetail(plans[0]));
});

export default router;
