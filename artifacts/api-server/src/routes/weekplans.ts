import { Router } from "express";
import { db } from "@workspace/db";
import { weekPlansTable, runsTable, runSegmentsTable, traineesTable, segmentsTable, segmentTypesTable } from "@workspace/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { buildFitWorkout, planToFitSteps } from "../lib/fit-workout";
import { sendWhatsAppTextMessage, normalizePhone } from "../lib/whatsapp";
import { saveFitFile } from "../lib/fit-store";
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
  const results = await Promise.all(plans.map(buildWeekPlanDetail));
  res.json(results);
});

router.post("/", async (req, res) => {
  const body = CreateWeekPlanBody.parse(req.body);
  const { runs: runsInput, ...planData } = body as any;
  const [plan] = await db.insert(weekPlansTable).values(planData).returning();
  if (runsInput && runsInput.length > 0) {
    for (const r of runsInput) {
      const { segmentIds, segments: inlineSegments, ...runData } = r;
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
      } else if (inlineSegments && inlineSegments.length > 0) {
        const segRows = await Promise.all(
          inlineSegments.map(async (s: any, idx: number) => {
            if (s.segmentId) {
              const [seg] = await db.select().from(segmentsTable).where(eq(segmentsTable.id, s.segmentId));
              let typeName: string | null = null;
              if (seg?.typeId) {
                const [st] = await db.select().from(segmentTypesTable).where(eq(segmentTypesTable.id, seg.typeId));
                typeName = st?.name ?? null;
              }
              return {
                runId: run.id,
                segmentId: s.segmentId,
                resolvedText: s.resolvedText || seg?.name || "",
                segmentType: s.segmentType ?? typeName,
                durationMinutes: s.durationMinutes != null ? s.durationMinutes : (seg?.defaultDurationMinutes ?? null),
                distanceKm: s.distanceKm != null ? s.distanceKm : (seg?.defaultDistanceKm ?? null),
                pace: s.pace !== undefined ? s.pace : ((seg as any)?.defaultPace ?? null),
                completed: false,
                order: s.order ?? idx + 1,
              };
            }
            return {
              runId: run.id,
              segmentId: null,
              resolvedText: s.resolvedText ?? "",
              segmentType: s.segmentType ?? null,
              durationMinutes: s.durationMinutes ?? null,
              distanceKm: s.distanceKm ?? null,
              pace: s.pace ?? null,
              completed: false,
              order: s.order ?? idx + 1,
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

// ── GPX export ────────────────────────────────────────────────────────────────

function buildGpxWorkout(plan: {
  weekStart: string;
  runs?: Array<{
    runType: string;
    name?: string | null;
    segments?: Array<{
      resolvedText: string;
      segmentType?: string | null;
      durationMinutes?: number | null;
      distanceKm?: number | null;
      pace?: string | null;
    }>;
  }>;
}): string {
  const xmlEsc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const steps: string[] = [];
  for (const run of plan.runs ?? []) {
    for (const seg of run.segments ?? []) {
      const parts: string[] = [seg.resolvedText];
      if (seg.distanceKm != null)    parts.push(`${seg.distanceKm} km`);
      if (seg.durationMinutes != null) parts.push(`${seg.durationMinutes} min`);
      if (seg.pace)                  parts.push(`Pace: ${seg.pace} min/km`);
      steps.push(
        `    <wpt lat="0.0" lon="0.0">\n` +
        `      <name>${xmlEsc(seg.resolvedText.slice(0, 60))}</name>\n` +
        `      <desc>${xmlEsc(parts.join(" | "))}</desc>\n` +
        `    </wpt>`
      );
    }
  }

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<gpx version="1.1" creator="YallaJog Trainer"`,
    `  xmlns="http://www.topografix.com/GPX/1/1"`,
    `  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"`,
    `  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">`,
    `  <metadata>`,
    `    <name>${xmlEsc(`Week Plan ${plan.weekStart}`)}</name>`,
    `    <desc>${xmlEsc(`Training plan for the week of ${plan.weekStart} — exported from YallaJog`)}</desc>`,
    `    <time>${new Date().toISOString()}</time>`,
    `  </metadata>`,
    ...steps,
    `  <rte>`,
    `    <name>${xmlEsc(`Week Plan ${plan.weekStart}`)}</name>`,
    ...steps.map(s => s.replace("<wpt ", "<rtept ").replace("</wpt>", "</rtept>")),
    `  </rte>`,
    `</gpx>`,
  ].join("\n");
}

router.get("/:id/export-gpx", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid plan id" });
  const [plan] = await db.select().from(weekPlansTable).where(eq(weekPlansTable.id, id));
  if (!plan) return res.status(404).json({ error: "Not found" });
  const detail = await buildWeekPlanDetail(plan);
  const gpxStr = buildGpxWorkout(detail);
  const filename = `workout-${detail.weekStart}.gpx`;
  res.setHeader("Content-Type", "application/gpx+xml");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  return res.send(gpxStr);
});

router.get("/:id/export-fit", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid plan id" });
  const [plan] = await db.select().from(weekPlansTable).where(eq(weekPlansTable.id, id));
  if (!plan) return res.status(404).json({ error: "Not found" });
  const detail = await buildWeekPlanDetail(plan);
  const steps = planToFitSteps(detail);
  if (steps.length === 0) return res.status(400).json({ error: "This plan has no segments to export" });
  const workoutName = `Week ${detail.weekStart}`;
  const fitBuffer = buildFitWorkout(workoutName, steps);
  const filename = `workout-${detail.weekStart}.fit`;
  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Length", fitBuffer.length);
  return res.send(fitBuffer);
});

router.post("/:id/send-fit", async (req, res) => {
  const trainerId = (req as any).trainerId as number;
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid plan id" });

  const [plan] = await db.select().from(weekPlansTable).where(eq(weekPlansTable.id, id));
  if (!plan) return res.status(404).json({ error: "Plan not found" });

  const detail = await buildWeekPlanDetail(plan);
  const steps = planToFitSteps(detail);
  if (steps.length === 0) return res.status(400).json({ error: "This plan has no segments to export" });

  const [trainee] = await db
    .select()
    .from(traineesTable)
    .where(and(eq(traineesTable.id, plan.traineeId), eq(traineesTable.trainerId, trainerId)));
  if (!trainee) return res.status(404).json({ error: "Trainee not found" });

  const toPhone = normalizePhone(trainee.phone);
  if (!toPhone) return res.status(400).json({ error: "Trainee has no phone number" });

  const [trainer] = await db
    .select()
    .from(traineesTable)
    .where(eq(traineesTable.trainerId, trainerId))
    .limit(1);

  // Get trainer WhatsApp credentials
  const { trainersTable } = await import("@workspace/db/schema");
  const [trainerRow] = await db.select().from(trainersTable).where(eq(trainersTable.id, trainerId));
  if (!trainerRow?.whatsappAccessToken || !trainerRow?.whatsappPhoneNumberId) {
    return res.status(400).json({ error: "Connect WhatsApp with Meta before sending files" });
  }
  const status = trainerRow.whatsappConnectionStatus;
  if (status !== "connected" && status !== "pending_review") {
    return res.status(400).json({ error: "Connect WhatsApp with Meta before sending files" });
  }

  const fitBuffer = buildFitWorkout(`Week ${detail.weekStart}`, steps);
  const filename = `workout-${detail.weekStart}.fit`;

  // Save to temp store and build a public link (valid 48 h)
  const token = saveFitFile(fitBuffer, filename);
  const baseUrl = process.env.PUBLIC_BASE_URL ?? "https://yallajog.com";
  const downloadUrl = `${baseUrl}/api/fit/${token}`;

  try {
    await sendWhatsAppTextMessage({
      accessToken: trainerRow.whatsappAccessToken,
      phoneNumberId: trainerRow.whatsappPhoneNumberId,
      to: toPhone,
      text: `Your workout plan for the week of ${detail.weekStart} is ready.\n\nTo import it into Garmin Connect:\n1. Install Garmin Connect from the Play Store / App Store if you have not already\n2. Tap the link below to download the file\n3. Open the file — it will import automatically into Garmin Connect\n\n${downloadUrl}\n\n(Link expires in 48 hours)`,
    });

    return res.json({ ok: true, filename, downloadUrl });
  } catch (err: any) {
    return res.status(502).json({ error: err?.message ?? "Failed to send link via WhatsApp" });
  }
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
