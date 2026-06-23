import { Router } from "express";
import { GarminConnect } from "garmin-connect";
import { db } from "@workspace/db";
import { weekPlansTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { buildWeekPlanDetail } from "./weekplans";

const router = Router();

// ── Login helper ───────────────────────────────────────────────────────────────
async function gcLogin(username: string, password: string): Promise<GarminConnect> {
  const gc = new GarminConnect({ username, password });
  await gc.login();
  return gc;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const sportType = { sportTypeId: 1, sportTypeKey: "running", displayOrder: 1 };
// NOTE: subSportType is NOT sent in POST body — Garmin's API rejects it (MismatchedInputException).
// Garmin always stores it as null server-side regardless of what we send.
const noTarget  = { workoutTargetTypeId: 1, workoutTargetTypeKey: "no.target", displayOrder: 1 };
const STROKE_NONE  = { strokeTypeId: 0, strokeTypeKey: null, displayOrder: 0 };
const EQUIP_NONE   = { equipmentTypeId: 0, equipmentTypeKey: null, displayOrder: 0 };

// ── Full step (all fields Garmin's Java API requires) ─────────────────────────
function makeStep(fields: {
  stepOrder:                 number;
  description:               string | null;
  stepType:                  { stepTypeId: number; stepTypeKey: string; displayOrder: number };
  endCondition:              object;
  endConditionValue:         number | null;
  preferredEndConditionUnit: object;
  targetType:                { workoutTargetTypeId: number; workoutTargetTypeKey: string; displayOrder: number };
  targetValueOne:            number | null;
  targetValueTwo:            number | null;
}) {
  return {
    type:                     "ExecutableStepDTO",
    stepId:                   null,
    stepOrder:                fields.stepOrder,
    childStepId:              null,
    description:              fields.description,
    stepType:                 fields.stepType,
    endCondition:             fields.endCondition,
    endConditionValue:        fields.endConditionValue,
    preferredEndConditionUnit: fields.preferredEndConditionUnit,
    endConditionCompare:      null,
    endConditionZone:         null,
    targetType:               fields.targetType,
    targetValueOne:           fields.targetValueOne,
    targetValueTwo:           fields.targetValueTwo,
    targetValueUnit:          null,
    zoneNumber:               null,
    secondaryTargetType:      null,
    secondaryTargetValueOne:  null,
    secondaryTargetValueTwo:  null,
    secondaryTargetValueUnit: null,
    secondaryZoneNumber:      null,
    strokeType:               STROKE_NONE,
    equipmentType:            EQUIP_NONE,
    category:                 null,
    exerciseName:             null,
    workoutProvider:          null,
    providerExerciseSourceId: null,
    weightValue:              null,
    weightUnit:               null,
  };
}

// ── Condition helpers ─────────────────────────────────────────────────────────
function timeCondition(durationMinutes: number) {
  return {
    endCondition:              { conditionTypeKey: "time", conditionTypeId: 2, displayOrder: 2, displayable: true },
    endConditionValue:         Math.round(durationMinutes * 60),
    preferredEndConditionUnit: { unitId: 40, unitKey: "second", factor: 1000 },
  };
}

function distanceCondition(distanceKm: number) {
  return {
    endCondition:              { conditionTypeKey: "distance", conditionTypeId: 3, displayOrder: 3, displayable: true },
    endConditionValue:         Math.round(distanceKm * 1000),
    preferredEndConditionUnit: { unitId: 2, unitKey: "kilometer", factor: 100000 },
  };
}

// Garmin stores pace zone targets in mm/s (millimeters per second) as integers
function paceTarget(paceMinPerKm: string) {
  const [m, s] = paceMinPerKm.split(":").map(Number);
  const totalSec = m * 60 + (s || 0);
  const speedMms = Math.round(1_000_000 / totalSec);
  const range    = Math.round(speedMms * 0.05);
  return {
    targetType:     { workoutTargetTypeId: 6, workoutTargetTypeKey: "pace.zone", displayOrder: 6 },
    targetValueOne: speedMms - range,
    targetValueTwo: speedMms + range,
  };
}

// ── Estimate workout duration/distance/speed from steps ───────────────────────
interface StepEstimate {
  durationSecs:  number;
  distanceM:     number;
  avgSpeedMps:   number;   // m/s
}

function estimateSteps(steps: ReturnType<typeof makeStep>[]): StepEstimate {
  let totalDurationSecs = 0;
  let totalDistanceM    = 0;

  for (const s of steps as any[]) {
    const cond  = s.endCondition?.conditionTypeKey;
    const value = s.endConditionValue ?? 0;
    const tgt1  = s.targetValueOne;
    const tgt2  = s.targetValueTwo;

    if (cond === "time") {
      // value is seconds
      totalDurationSecs += value;
      // if there's a pace zone, estimate distance = speed × time
      if (tgt1 && tgt2) {
        const avgSpeedMms = (tgt1 + tgt2) / 2;   // mm/s
        const avgSpeedMps = avgSpeedMms / 1000;
        totalDistanceM   += avgSpeedMps * value;
      }
    } else if (cond === "distance") {
      // value is meters
      totalDistanceM    += value;
      // if there's a pace zone, estimate duration = distance / speed
      if (tgt1 && tgt2) {
        const avgSpeedMms = (tgt1 + tgt2) / 2;
        const avgSpeedMps = avgSpeedMms / 1000;
        if (avgSpeedMps > 0) totalDurationSecs += value / avgSpeedMps;
      } else {
        // default 5:00/km = 3.33 m/s
        totalDurationSecs += value / 3.33;
      }
    }
  }

  const avgSpeedMps = totalDurationSecs > 0 && totalDistanceM > 0
    ? totalDistanceM / totalDurationSecs
    : 3.0;  // default ~5:33/km

  return {
    durationSecs:  Math.round(totalDurationSecs),
    distanceM:     Math.round(totalDistanceM),
    avgSpeedMps:   Math.round(avgSpeedMps * 100) / 100,
  };
}

// ── Build Garmin workout from week plan ───────────────────────────────────────
function buildGarminWorkout(plan: Awaited<ReturnType<typeof buildWeekPlanDetail>>) {
  const stepTypeMap: Record<string, { stepTypeId: number; stepTypeKey: string; displayOrder: number }> = {
    warmup:   { stepTypeId: 1, stepTypeKey: "warmup",    displayOrder: 1 },
    cooldown: { stepTypeId: 2, stepTypeKey: "cool_down", displayOrder: 2 },
    interval: { stepTypeId: 3, stepTypeKey: "interval",  displayOrder: 3 },
    recovery: { stepTypeId: 4, stepTypeKey: "recovery",  displayOrder: 4 },
    rest:     { stepTypeId: 5, stepTypeKey: "rest",       displayOrder: 5 },
  };

  function resolveStepType(text: string) {
    const t = text.toLowerCase();
    if (t.includes("warm"))    return stepTypeMap.warmup;
    if (t.includes("cool"))    return stepTypeMap.cooldown;
    if (t.includes("rest"))    return stepTypeMap.rest;
    if (t.includes("recover")) return stepTypeMap.recovery;
    return stepTypeMap.interval;
  }

  let stepOrder = 1;
  const workoutSteps: object[] = [];

  for (const run of plan.runs ?? []) {
    for (const seg of run.segments ?? []) {
      let cond: ReturnType<typeof timeCondition> | ReturnType<typeof distanceCondition>;
      if (seg.distanceKm != null && seg.distanceKm > 0) {
        cond = distanceCondition(seg.distanceKm);
      } else if (seg.durationMinutes != null && seg.durationMinutes > 0) {
        cond = timeCondition(seg.durationMinutes);
      } else {
        cond = {
          endCondition:              { conditionTypeKey: "lap.button", conditionTypeId: 1, displayOrder: 1, displayable: true },
          endConditionValue:         null,
          preferredEndConditionUnit: { unitId: 2, unitKey: "kilometer", factor: 100000 },
        };
      }

      let target = { targetType: noTarget, targetValueOne: null as number | null, targetValueTwo: null as number | null };
      if (seg.pace) {
        const [m, s] = seg.pace.split(":").map(Number);
        if (!isNaN(m) && (m > 0 || (s ?? 0) > 0)) {
          const pt = paceTarget(seg.pace);
          target = { targetType: pt.targetType, targetValueOne: pt.targetValueOne, targetValueTwo: pt.targetValueTwo };
        }
      }

      workoutSteps.push(makeStep({
        stepOrder:                 stepOrder++,
        description:               seg.resolvedText.slice(0, 200),
        stepType:                  resolveStepType(seg.resolvedText),
        endCondition:              cond.endCondition,
        endConditionValue:         cond.endConditionValue,
        preferredEndConditionUnit: cond.preferredEndConditionUnit,
        targetType:                target.targetType,
        targetValueOne:            target.targetValueOne,
        targetValueTwo:            target.targetValueTwo,
      }));
    }
  }

  const est = estimateSteps(workoutSteps as any);

  return {
    description:              `YallaJog training plan for week of ${plan.weekStart}`,
    sportType,
    workoutName:              `YallaJog – Week of ${plan.weekStart}`,
    estimatedDurationInSecs:  est.durationSecs  || null,
    estimatedDistanceInMeters: est.distanceM    || null,
    workoutSegments: [{
      segmentOrder:              1,
      sportType,
      avgTrainingSpeed:          est.avgSpeedMps,
      estimatedDurationInSecs:   est.durationSecs  || null,
      estimatedDistanceInMeters: est.distanceM     || null,
      workoutSteps,
    }],
  };
}

// ── Hardcoded 5-step test workout (with pace) ─────────────────────────────────
function buildFadiTestWorkout() {
  const today = new Date().toISOString().slice(0, 10);
  const steps = [
    makeStep({ stepOrder: 1, description: "Easy warm up jog",
      stepType: { stepTypeId: 1, stepTypeKey: "warmup", displayOrder: 1 },
      ...timeCondition(10), targetType: noTarget, targetValueOne: null, targetValueTwo: null }),
    makeStep({ stepOrder: 2, description: "Interval at target pace",
      stepType: { stepTypeId: 3, stepTypeKey: "interval", displayOrder: 3 },
      ...distanceCondition(1), ...paceTarget("4:30") }),
    makeStep({ stepOrder: 3, description: "Recovery",
      stepType: { stepTypeId: 4, stepTypeKey: "recovery", displayOrder: 4 },
      ...timeCondition(2), targetType: noTarget, targetValueOne: null, targetValueTwo: null }),
    makeStep({ stepOrder: 4, description: "Interval at target pace",
      stepType: { stepTypeId: 3, stepTypeKey: "interval", displayOrder: 3 },
      ...distanceCondition(1), ...paceTarget("4:30") }),
    makeStep({ stepOrder: 5, description: "Easy cool down jog",
      stepType: { stepTypeId: 2, stepTypeKey: "cool_down", displayOrder: 2 },
      ...timeCondition(10), targetType: noTarget, targetValueOne: null, targetValueTwo: null }),
  ];
  const est = estimateSteps(steps as any);
  return {
    description:               "YallaJog test workout",
    sportType,
    workoutName:               `YallaJog Test – ${today}`,
    estimatedDurationInSecs:   est.durationSecs  || null,
    estimatedDistanceInMeters: est.distanceM     || null,
    workoutSegments: [{
      segmentOrder:              1,
      sportType,
      avgTrainingSpeed:          est.avgSpeedMps,
      estimatedDurationInSecs:   est.durationSecs  || null,
      estimatedDistanceInMeters: est.distanceM     || null,
      workoutSteps:              steps,
    }],
  };
}

// ── Ultra-minimal 3-step test (no pace, time only) ────────────────────────────
function buildMinimalTestWorkout() {
  const today = new Date().toISOString().slice(0, 10);
  const steps = [
    makeStep({ stepOrder: 1, description: "Warm up",
      stepType: { stepTypeId: 1, stepTypeKey: "warmup", displayOrder: 1 },
      ...timeCondition(10), targetType: noTarget, targetValueOne: null, targetValueTwo: null }),
    makeStep({ stepOrder: 2, description: "Run",
      stepType: { stepTypeId: 3, stepTypeKey: "interval", displayOrder: 3 },
      ...timeCondition(20), targetType: noTarget, targetValueOne: null, targetValueTwo: null }),
    makeStep({ stepOrder: 3, description: "Cool down",
      stepType: { stepTypeId: 2, stepTypeKey: "cool_down", displayOrder: 2 },
      ...timeCondition(10), targetType: noTarget, targetValueOne: null, targetValueTwo: null }),
  ];
  const est = estimateSteps(steps as any);
  return {
    description:               "YallaJog minimal test",
    sportType,
    workoutName:               `YallaJog Minimal – ${today}`,
    estimatedDurationInSecs:   est.durationSecs  || null,
    estimatedDistanceInMeters: est.distanceM     || null,
    workoutSegments: [{
      segmentOrder:              1,
      sportType,
      avgTrainingSpeed:          est.avgSpeedMps,
      estimatedDurationInSecs:   est.durationSecs  || null,
      estimatedDistanceInMeters: est.distanceM     || null,
      workoutSteps:              steps,
    }],
  };
}

// ── Shared push helper (logs exact payload) ───────────────────────────────────
async function pushWorkout(gc: GarminConnect, workout: object, log: any) {
  log.info({ payload: JSON.stringify(workout) }, "Garmin push payload");
  const result = await (gc as any).addWorkout(workout);
  log.info({ garminResult: result }, "Garmin addWorkout result");
  const workoutId = result?.workoutId ?? result?.workout?.workoutId ?? result?.data?.workoutId ?? result?.id ?? null;
  return { workoutId, workoutName: (result as any)?.workoutName ?? (workout as any).workoutName };
}

// ── Schedule workout to a calendar date (fixes mobile app loading screen) ─────
// Garmin Connect mobile opens library workouts unreliably but opens scheduled
// workouts correctly from the Calendar / Training Plan view.
async function scheduleWorkout(gc: GarminConnect, workoutId: number, date: string, log: any) {
  const url = `https://connectapi.garmin.com/workout-service/schedule/${workoutId}`;
  try {
    const result = await (gc as any).client.post(url, { date });
    log.info({ scheduleResult: result }, "Garmin schedule result");
    return { scheduled: true, scheduleId: result?.scheduleId ?? result?.id ?? null };
  } catch (err: any) {
    log.warn({ err: err?.message }, "Garmin schedule failed (non-fatal)");
    return { scheduled: false, error: err?.message ?? String(err) };
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────

router.post("/week-plans/:id/push-to-garmin", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid plan id" });
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) return res.status(400).json({ error: "Garmin username and password are required" });

  const [plan] = await db.select().from(weekPlansTable).where(eq(weekPlansTable.id, id));
  if (!plan) return res.status(404).json({ error: "Plan not found" });

  const detail  = await buildWeekPlanDetail(plan);
  const workout = buildGarminWorkout(detail);
  if ((workout.workoutSegments[0].workoutSteps as any[]).length === 0)
    return res.status(400).json({ error: "Plan has no segments to push" });

  let gc: GarminConnect;
  try { gc = await gcLogin(username, password); }
  catch (err: any) { return res.status(401).json({ error: "Garmin login failed: " + (err?.message ?? String(err)) }); }

  try {
    const { workoutId, workoutName } = await pushWorkout(gc, workout, req.log);
    // Schedule the workout to the week's Monday so mobile opens it from Calendar view
    const schedule = workoutId ? await scheduleWorkout(gc, workoutId, plan.weekStart, req.log) : { scheduled: false };
    return res.json({
      success: true, workoutId, workoutName,
      stepCount: (workout.workoutSegments[0].workoutSteps as any[]).length,
      scheduled: schedule.scheduled,
      scheduleNote: schedule.scheduled
        ? `Workout scheduled to ${plan.weekStart} — open Garmin Connect mobile → Calendar to see it`
        : `Scheduled to library only (${(schedule as any).error ?? "schedule step skipped"})`,
    });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to push workout: " + (err?.message ?? String(err)) });
  }
});

router.post("/garmin-test/push-fadi-test", async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) return res.status(400).json({ error: "Garmin username and password are required" });

  let gc: GarminConnect;
  try { gc = await gcLogin(username, password); }
  catch (err: any) { return res.status(401).json({ error: "Garmin login failed: " + (err?.message ?? String(err)) }); }

  try {
    const workout = buildFadiTestWorkout();
    const { workoutId, workoutName } = await pushWorkout(gc, workout, req.log);
    return res.json({ success: true, workoutId, workoutName, stepCount: (workout.workoutSegments[0].workoutSteps as any[]).length });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to push test workout: " + (err?.message ?? String(err)) });
  }
});

router.post("/garmin-test/push-minimal", async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) return res.status(400).json({ error: "Garmin username and password are required" });

  let gc: GarminConnect;
  try { gc = await gcLogin(username, password); }
  catch (err: any) { return res.status(401).json({ error: "Garmin login failed: " + (err?.message ?? String(err)) }); }

  try {
    const workout = buildMinimalTestWorkout();
    const { workoutId, workoutName } = await pushWorkout(gc, workout, req.log);
    return res.json({ success: true, workoutId, workoutName, stepCount: (workout.workoutSegments[0].workoutSteps as any[]).length });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to push minimal workout: " + (err?.message ?? String(err)) });
  }
});

router.post("/garmin-test/delete-all-workouts", async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) return res.status(400).json({ error: "username and password are required" });

  let gc: GarminConnect;
  try { gc = await gcLogin(username, password); }
  catch (err: any) { return res.status(401).json({ error: "Garmin login failed: " + (err?.message ?? String(err)) }); }

  try {
    const workouts: any[] = await (gc as any).getWorkouts(0, 200);
    const toDelete = workouts.filter((w: any) =>
      typeof w.workoutName === "string" &&
      (w.workoutName.toLowerCase().includes("yallajog") || w.workoutName.toLowerCase().includes("yalla jog"))
    );
    let deleted = 0, failed = 0;
    for (const w of toDelete) {
      try { await (gc as any).deleteWorkout(w); deleted++; } catch { failed++; }
    }
    req.log.info({ total: toDelete.length, deleted, failed }, "Garmin cleanup done");
    return res.json({ success: true, total: toDelete.length, deleted, failed });
  } catch (err: any) {
    return res.status(500).json({ error: "Cleanup failed: " + (err?.message ?? String(err)) });
  }
});

// Uses the library's own built-in addRunningWorkout (Running class) — the simplest guaranteed format
router.post("/garmin-test/push-running-simple", async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) return res.status(400).json({ error: "username and password required" });

  let gc: GarminConnect;
  try { gc = await gcLogin(username, password); }
  catch (err: any) { return res.status(401).json({ error: "Garmin login failed: " + (err?.message ?? String(err)) }); }

  try {
    const today = new Date().toISOString().slice(0, 10);
    const name  = `YallaJog Run – ${today}`;
    const result = await (gc as any).addRunningWorkout(name, 5000, "Simple 5km test run from YallaJog");
    req.log.info({ simpleRunResult: result }, "addRunningWorkout result");
    const workoutId = result?.workoutId ?? result?.workout?.workoutId ?? null;
    return res.json({ success: true, workoutId, workoutName: result?.workoutName ?? name });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed: " + (err?.message ?? String(err)) });
  }
});

router.post("/garmin-test/workout-detail", async (req, res) => {
  const { username, password, workoutId } = req.body as { username?: string; password?: string; workoutId?: number };
  if (!username || !password || !workoutId) return res.status(400).json({ error: "username, password, and workoutId required" });

  let gc: GarminConnect;
  try { gc = await gcLogin(username, password); }
  catch (err: any) { return res.status(401).json({ error: "Login failed: " + (err?.message ?? String(err)) }); }

  try {
    const detail = await (gc as any).getWorkoutDetail({ workoutId });
    return res.json(detail);
  } catch (err: any) {
    return res.status(500).json({ error: "Failed: " + (err?.message ?? String(err)) });
  }
});

router.post("/garmin-test/fetch", async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) return res.status(400).json({ error: "username and password are required" });

  const gc = new GarminConnect({ username, password });
  try { await gc.login(); }
  catch (err: any) { return res.status(401).json({ error: "Login failed: " + (err?.message ?? String(err)) }); }

  try {
    const [profile, settings, activities, steps, heartRate] = await Promise.allSettled([
      gc.getUserProfile(),
      gc.getUserSettings(),
      gc.getActivities(0, 10),
      gc.getSteps(new Date()),
      gc.getHeartRate(new Date()),
    ]);
    return res.json({
      profile:    profile.status    === "fulfilled" ? profile.value    : null,
      settings:   settings.status   === "fulfilled" ? settings.value   : null,
      activities: activities.status === "fulfilled" ? activities.value : [],
      steps:      steps.status      === "fulfilled" ? steps.value      : null,
      heartRate:  heartRate.status  === "fulfilled" ? heartRate.value  : null,
    });
  } catch (err: any) {
    return res.status(500).json({ error: "Data fetch failed: " + (err?.message ?? String(err)) });
  }
});

export default router;
