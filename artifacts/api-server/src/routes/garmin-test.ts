import { Router } from "express";
import { GarminConnect } from "garmin-connect";
import { db } from "@workspace/db";
import { weekPlansTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { buildWeekPlanDetail } from "./weekplans";

const router = Router();

// ── Shared: login helper ───────────────────────────────────────────────────────
async function gcLogin(username: string, password: string): Promise<GarminConnect> {
  const gc = new GarminConnect({ username, password });
  await gc.login();
  return gc;
}

// ── Build IWorkoutDetail JSON from a week plan ─────────────────────────────────
function buildGarminWorkout(plan: Awaited<ReturnType<typeof buildWeekPlanDetail>>) {
  const sportType = { sportTypeId: 1, sportTypeKey: "running" };

  const stepTypeMap: Record<string, { stepTypeId: number; stepTypeKey: string }> = {
    warmup:   { stepTypeId: 1, stepTypeKey: "warmup" },
    cooldown: { stepTypeId: 2, stepTypeKey: "cool_down" },
    rest:     { stepTypeId: 5, stepTypeKey: "rest" },
    recovery: { stepTypeId: 4, stepTypeKey: "recovery" },
    interval: { stepTypeId: 3, stepTypeKey: "interval" },
  };

  function resolveStepType(text: string) {
    const t = text.toLowerCase();
    if (t.includes("warm"))    return stepTypeMap.warmup;
    if (t.includes("cool"))    return stepTypeMap.cooldown;
    if (t.includes("rest"))    return stepTypeMap.rest;
    if (t.includes("recover")) return stepTypeMap.recovery;
    return stepTypeMap.interval;
  }

  const noTarget = { workoutTargetTypeId: 1, workoutTargetTypeKey: "no.target" };

  let stepOrder = 1;
  const workoutSteps: object[] = [];

  for (const run of plan.runs ?? []) {
    for (const seg of run.segments ?? []) {
      // Determine end condition: distance > time > open
      let endCondition: object;
      let endConditionValue: number | null;
      let preferredUnit: object;

      if (seg.distanceKm != null && seg.distanceKm > 0) {
        endCondition = { conditionTypeKey: "distance", conditionTypeId: 3, displayOrder: 3, displayable: true };
        endConditionValue = Math.round(seg.distanceKm * 1000); // meters
        preferredUnit = { unitId: 2, unitKey: "kilometer", factor: 100000 };
      } else if (seg.durationMinutes != null && seg.durationMinutes > 0) {
        endCondition = { conditionTypeKey: "time", conditionTypeId: 2, displayOrder: 2, displayable: true };
        endConditionValue = Math.round(seg.durationMinutes * 60); // seconds
        preferredUnit = { unitId: 40, unitKey: "second", factor: 1000 };
      } else {
        endCondition = { conditionTypeKey: "lap.button", conditionTypeId: 1, displayOrder: 1, displayable: true };
        endConditionValue = null;
        preferredUnit = { unitId: 2, unitKey: "kilometer", factor: 100000 };
      }

      // Pace target if available
      let targetType = noTarget;
      let targetValueOne: number | null = null;
      let targetValueTwo: number | null = null;

      if (seg.pace) {
        const [m, s] = seg.pace.split(":").map(Number);
        if (!isNaN(m) && (m > 0 || s > 0)) {
          const totalSec = m * 60 + (s || 0);
          const speedMs = 1000 / totalSec; // m/s
          const range = speedMs * 0.05;    // ±5%
          targetType = { workoutTargetTypeId: 6, workoutTargetTypeKey: "pace.zone" };
          // Garmin expects m/s as a float (NOT mm/s)
          targetValueOne  = +((speedMs - range).toFixed(4)); // slower bound
          targetValueTwo  = +((speedMs + range).toFixed(4)); // faster bound
        }
      }

      workoutSteps.push({
        type: "ExecutableStepDTO",
        stepId: null,
        stepOrder: stepOrder++,
        childStepId: null,
        description: seg.resolvedText.slice(0, 200),
        stepType: resolveStepType(seg.resolvedText),
        endCondition,
        preferredEndConditionUnit: preferredUnit,
        endConditionValue,
        endConditionCompare: null,
        endConditionZone: null,
        targetType,
        targetValueOne,
        targetValueTwo,
        zoneNumber: null,
      });
    }
  }

  return {
    workoutId: undefined,
    description: `YallaJog training plan for week of ${plan.weekStart}`,
    sportType,
    workoutName: `YallaJog – Week of ${plan.weekStart}`,
    workoutSegments: [{
      segmentOrder: 1,
      sportType,
      workoutSteps,
    }],
  };
}

// ── Push week plan to Garmin Connect ──────────────────────────────────────────
router.post("/week-plans/:id/push-to-garmin", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid plan id" });

  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) {
    return res.status(400).json({ error: "Garmin username and password are required" });
  }

  const [plan] = await db.select().from(weekPlansTable).where(eq(weekPlansTable.id, id));
  if (!plan) return res.status(404).json({ error: "Plan not found" });

  const detail = await buildWeekPlanDetail(plan);
  const workout = buildGarminWorkout(detail);

  if ((workout.workoutSegments[0].workoutSteps as any[]).length === 0) {
    return res.status(400).json({ error: "Plan has no segments to push" });
  }

  let gc: GarminConnect;
  try {
    gc = await gcLogin(username, password);
  } catch (err: any) {
    return res.status(401).json({ error: "Garmin login failed: " + (err?.message ?? String(err)) });
  }

  try {
    const result = await (gc as any).addWorkout(workout);
    req.log.info({ garminResult: result }, "Garmin addWorkout raw result");
    // Garmin Connect returns workoutId at the top level; fallback to nested fields
    const workoutId =
      result?.workoutId ??
      result?.workout?.workoutId ??
      result?.data?.workoutId ??
      result?.id ??
      null;
    return res.json({
      success: true,
      workoutId,
      workoutName: result?.workoutName ?? workout.workoutName,
      stepCount: (workout.workoutSegments[0].workoutSteps as any[]).length,
      _debug: result, // remove after confirming correct field
    });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to push workout: " + (err?.message ?? String(err)) });
  }
});

// ── Garmin data fetch (test page) ─────────────────────────────────────────────
router.post("/garmin-test/fetch", async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) {
    return res.status(400).json({ error: "username and password are required" });
  }

  const gc = new GarminConnect({ username, password });

  try {
    await gc.login();
  } catch (err: any) {
    return res.status(401).json({ error: "Login failed: " + (err?.message ?? String(err)) });
  }

  try {
    const [profile, settings, activities, steps, heartRate] = await Promise.allSettled([
      gc.getUserProfile(),
      gc.getUserSettings(),
      gc.getActivities(0, 10),
      gc.getSteps(new Date()),
      gc.getHeartRate(new Date()),
    ]);

    return res.json({
      profile: profile.status === "fulfilled" ? profile.value : null,
      settings: settings.status === "fulfilled" ? settings.value : null,
      activities: activities.status === "fulfilled" ? activities.value : [],
      steps: steps.status === "fulfilled" ? steps.value : null,
      heartRate: heartRate.status === "fulfilled" ? heartRate.value : null,
    });
  } catch (err: any) {
    return res.status(500).json({ error: "Data fetch failed: " + (err?.message ?? String(err)) });
  }
});

export default router;
