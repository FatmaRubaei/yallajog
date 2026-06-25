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
// NOTE: subSportType MUST be sent as a plain string "GENERIC" (not as an object).
// Garmin's API rejects it with MismatchedInputException if sent as an object, but
// accepts it as a string. Manually-created workouts always store "GENERIC" and the
// mobile app uses this field to select the workout renderer — null = loading screen.
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
    subSportType:             "GENERIC",
    workoutProvider:          "null",
    workoutSourceId:          "null",
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
    subSportType:              "GENERIC",
    workoutProvider:           "null",
    workoutSourceId:           "null",
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
    subSportType:              "GENERIC",
    workoutProvider:           "null",
    workoutSourceId:           "null",
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

// ── List all workouts in the account ──────────────────────────────────────────
router.post("/garmin-test/list-workouts", async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) return res.status(400).json({ error: "username and password required" });

  let gc: GarminConnect;
  try { gc = await gcLogin(username, password); }
  catch (err: any) { return res.status(401).json({ error: "Login failed: " + (err?.message ?? String(err)) }); }

  try {
    const workouts = await (gc as any).getWorkouts(0, 100);
    const list = (Array.isArray(workouts) ? workouts : []).map((w: any) => ({
      workoutId:   w.workoutId,
      workoutName: w.workoutName,
      sportType:   w.sportType?.sportTypeKey,
      stepCount:   w.workoutSegments?.[0]?.workoutSteps?.length ?? null,
      createdDate: w.createdDate,
      updatedDate: w.updatedDate,
    }));
    return res.json(list);
  } catch (err: any) {
    return res.status(500).json({ error: "Failed: " + (err?.message ?? String(err)) });
  }
});

// ── Auto-compare: push a library workout, fetch its detail + recent YallaJog detail ───
router.post("/garmin-test/auto-compare", async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) return res.status(400).json({ error: "username and password required" });

  let gc: GarminConnect;
  try { gc = await gcLogin(username, password); }
  catch (err: any) { return res.status(401).json({ error: "Login failed: " + (err?.message ?? String(err)) }); }

  try {
    // 1. Get all workouts to find the most recent YallaJog one
    const allWorkouts: any[] = await (gc as any).getWorkouts(0, 100);
    const yallaJogWorkout = Array.isArray(allWorkouts)
      ? allWorkouts.find((w: any) => typeof w.workoutName === "string" && w.workoutName.startsWith("YallaJog"))
      : null;

    // 2. Push a simple library workout
    const today = new Date().toISOString().slice(0, 10);
    const libWorkout = await (gc as any).addRunningWorkout(`LibraryTest – ${today}`, 5000, "auto-compare diagnostic");
    req.log.info({ libWorkout }, "auto-compare: library workout pushed");
    const libWorkoutId = libWorkout?.workoutId ?? null;

    // 3. Fetch details for both in parallel
    const [yallaDetail, libDetail] = await Promise.allSettled([
      yallaJogWorkout ? (gc as any).getWorkoutDetail({ workoutId: yallaJogWorkout.workoutId }) : Promise.resolve(null),
      libWorkoutId    ? (gc as any).getWorkoutDetail({ workoutId: libWorkoutId })               : Promise.resolve(null),
    ]);

    // 4. Compute a flat diff of top-level and step-level keys
    const yallaData = yallaDetail.status === "fulfilled" ? yallaDetail.value : null;
    const libData   = libDetail.status   === "fulfilled" ? libDetail.value   : null;

    function flatKeys(obj: any, prefix = ""): Record<string, any> {
      const result: Record<string, any> = {};
      for (const [k, v] of Object.entries(obj ?? {})) {
        const fullKey = prefix ? `${prefix}.${k}` : k;
        if (v !== null && typeof v === "object" && !Array.isArray(v)) {
          Object.assign(result, flatKeys(v, fullKey));
        } else {
          result[fullKey] = v;
        }
      }
      return result;
    }

    const yallaStep  = yallaData?.workoutSegments?.[0]?.workoutSteps?.[0] ?? {};
    const libStep    = libData?.workoutSegments?.[0]?.workoutSteps?.[0]   ?? {};
    const yallaFlat  = flatKeys(yallaStep);
    const libFlat    = flatKeys(libStep);
    const allKeys    = Array.from(new Set([...Object.keys(yallaFlat), ...Object.keys(libFlat)])).sort();
    const stepDiff   = allKeys
      .filter(k => JSON.stringify(yallaFlat[k]) !== JSON.stringify(libFlat[k]))
      .map(k => ({ key: k, yallajog: yallaFlat[k] ?? "(missing)", library: libFlat[k] ?? "(missing)" }));

    return res.json({
      yallajog: {
        workoutId:   yallaJogWorkout?.workoutId ?? null,
        workoutName: yallaJogWorkout?.workoutName ?? null,
        detail:      yallaData,
      },
      library: {
        workoutId:   libWorkoutId,
        workoutName: libWorkout?.workoutName ?? `LibraryTest – ${today}`,
        detail:      libData,
      },
      stepDiff,
      note: stepDiff.length === 0
        ? "First step structures are identical — the issue is NOT in individual step fields."
        : `${stepDiff.length} field(s) differ in the first step between YallaJog and library workouts.`,
    });
  } catch (err: any) {
    req.log.error({ err }, "auto-compare failed");
    return res.status(500).json({ error: "Failed: " + (err?.message ?? String(err)) });
  }
});

// ── Deep compare: find workout by date and diff every field vs latest YallaJog ─
router.post("/garmin-test/compare-with-date", async (req, res) => {
  const { username, password, targetDate } = req.body as {
    username?: string; password?: string; targetDate?: string;
  };
  if (!username || !password || !targetDate)
    return res.status(400).json({ error: "username, password, targetDate (YYYY-MM-DD) required" });

  let gc: GarminConnect;
  try { gc = await gcLogin(username, password); }
  catch (err: any) { return res.status(401).json({ error: "Login failed: " + (err?.message ?? String(err)) }); }

  try {
    const allWorkouts: any[] = await (gc as any).getWorkouts(0, 200);
    req.log.info({ count: allWorkouts.length }, "compare-with-date: all workouts fetched");

    // Find a workout created on or near the target date (check createdDate prefix)
    const datePrefix = targetDate.slice(0, 10);
    const targetWorkout = allWorkouts.find((w: any) =>
      typeof w.createdDate === "string" && w.createdDate.startsWith(datePrefix)
    );
    // Fallback: try updatedDate
    const targetWorkout2 = targetWorkout ?? allWorkouts.find((w: any) =>
      typeof w.updatedDate === "string" && w.updatedDate.startsWith(datePrefix)
    );
    // Find most recent YallaJog workout
    const yallaJogWorkout = allWorkouts.find((w: any) =>
      typeof w.workoutName === "string" && w.workoutName.toLowerCase().startsWith("yallajog")
    );

    if (!targetWorkout2) {
      return res.status(404).json({
        error: `No workout found with createdDate/updatedDate starting with ${datePrefix}`,
        allWorkouts: allWorkouts.map((w: any) => ({
          workoutId: w.workoutId,
          workoutName: w.workoutName,
          createdDate: w.createdDate,
          updatedDate: w.updatedDate,
        })),
      });
    }

    // Fetch both details in parallel
    const [targetDetail, yallaDetail] = await Promise.allSettled([
      (gc as any).getWorkoutDetail({ workoutId: targetWorkout2.workoutId }),
      yallaJogWorkout ? (gc as any).getWorkoutDetail({ workoutId: yallaJogWorkout.workoutId }) : Promise.resolve(null),
    ]);

    const targetData = targetDetail.status === "fulfilled" ? targetDetail.value : null;
    const yallaData  = yallaDetail.status  === "fulfilled" ? yallaDetail.value  : null;

    // ── Recursive flat diff ───────────────────────────────────────────────────
    function flatKeys(obj: any, prefix = ""): Record<string, any> {
      const result: Record<string, any> = {};
      if (obj === null || obj === undefined) return result;
      for (const [k, v] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${k}` : k;
        if (v !== null && typeof v === "object" && !Array.isArray(v)) {
          Object.assign(result, flatKeys(v, fullKey));
        } else {
          result[fullKey] = v;
        }
      }
      return result;
    }

    // Compare top-level (excluding deep nested, timestamps, IDs)
    const ignoreTopLevel = new Set(["workoutId", "ownerId", "createdDate", "updatedDate", "author", "workoutSegments"]);
    const tFlat  = flatKeys(targetData);
    const yFlat  = flatKeys(yallaData);
    const allTopKeys = Array.from(new Set([...Object.keys(tFlat), ...Object.keys(yFlat)]))
      .filter(k => !ignoreTopLevel.has(k.split(".")[0]) && !k.startsWith("workoutSegments"))
      .sort();
    const topDiff = allTopKeys
      .filter(k => JSON.stringify(tFlat[k]) !== JSON.stringify(yFlat[k]))
      .map(k => ({ key: k, working: tFlat[k] ?? "(missing)", yallajog: yFlat[k] ?? "(missing)" }));

    // Compare steps per segment
    const tSteps: any[] = targetData?.workoutSegments?.[0]?.workoutSteps ?? [];
    const ySteps: any[] = yallaData?.workoutSegments?.[0]?.workoutSteps ?? [];
    const stepComparisons: any[] = [];
    const maxSteps = Math.max(tSteps.length, ySteps.length);
    for (let i = 0; i < maxSteps; i++) {
      const tStep = tSteps[i] ?? null;
      const yStep = ySteps[i] ?? null;
      if (!tStep || !yStep) {
        stepComparisons.push({ stepIndex: i + 1, note: !tStep ? "only in YallaJog" : "only in working workout", diff: [] });
        continue;
      }
      const tF = flatKeys(tStep);
      const yF = flatKeys(yStep);
      const keys = Array.from(new Set([...Object.keys(tF), ...Object.keys(yF)])).filter(k => k !== "stepId").sort();
      const diff = keys
        .filter(k => JSON.stringify(tF[k]) !== JSON.stringify(yF[k]))
        .map(k => ({ key: k, working: tF[k] ?? "(missing)", yallajog: yF[k] ?? "(missing)" }));
      stepComparisons.push({ stepIndex: i + 1, diff });
    }

    return res.json({
      working: {
        workoutId:   targetWorkout2.workoutId,
        workoutName: targetWorkout2.workoutName,
        createdDate: targetWorkout2.createdDate,
        detail:      targetData,
      },
      yallajog: {
        workoutId:   yallaJogWorkout?.workoutId ?? null,
        workoutName: yallaJogWorkout?.workoutName ?? null,
        detail:      yallaData,
      },
      topLevelDiff: topDiff,
      stepDiffs:    stepComparisons,
      summary: {
        topLevelDiffCount: topDiff.length,
        stepCount: { working: tSteps.length, yallajog: ySteps.length },
        stepTypes: {
          working:  tSteps.map((s: any) => s.stepType?.stepTypeKey ?? s.type),
          yallajog: ySteps.map((s: any) => s.stepType?.stepTypeKey ?? s.type),
        },
        endConditions: {
          working:  tSteps.map((s: any) => s.endCondition?.conditionTypeKey),
          yallajog: ySteps.map((s: any) => s.endCondition?.conditionTypeKey),
        },
      },
    });
  } catch (err: any) {
    req.log.error({ err }, "compare-with-date failed");
    return res.status(500).json({ error: "Failed: " + (err?.message ?? String(err)) });
  }
});

// ── STRIPPED step builder — matches RunningTemplate exactly (no swimming fields, minimal objects) ──
// RunningTemplate (addRunningWorkout) does NOT send strokeType, equipmentType,
// secondaryTarget*, targetValueUnit, weightValue, etc.  Our makeStep sends all of
// these with null values. If the mobile app does an enum lookup on strokeTypeKey:null
// or equipmentTypeKey:null it will crash silently (loading screen forever).
function makeStrippedStep(fields: {
  stepOrder:    number;
  description:  string | null;
  stepType:     { stepTypeId: number; stepTypeKey: string };
  endCondition: object;
  endConditionValue: number | null;
  preferredEndConditionUnit: object;
  targetType:     { workoutTargetTypeId: number; workoutTargetTypeKey: string };
  targetValueOne: number | null;
  targetValueTwo: number | null;
}) {
  return {
    type:                      "ExecutableStepDTO",
    stepId:                    null,
    stepOrder:                 fields.stepOrder,
    childStepId:               null,
    description:               fields.description,
    stepType:                  fields.stepType,
    endCondition:              fields.endCondition,
    preferredEndConditionUnit: fields.preferredEndConditionUnit,
    endConditionValue:         fields.endConditionValue,
    endConditionCompare:       null,
    endConditionZone:          null,
    targetType:                fields.targetType,
    targetValueOne:            fields.targetValueOne,
    targetValueTwo:            fields.targetValueTwo,
    zoneNumber:                null,
    // Deliberately omit: strokeType, equipmentType, secondaryTarget*,
    // targetValueUnit, category, exerciseName, weightValue, weightUnit
  };
}

function buildStrippedWorkout() {
  const today = new Date().toISOString().slice(0, 10);
  const stripped = (fields: Parameters<typeof makeStrippedStep>[0]) => makeStrippedStep(fields);
  const noT = { workoutTargetTypeId: 1, workoutTargetTypeKey: "no.target" };
  const steps = [
    stripped({ stepOrder: 1, description: "Warm up",
      stepType: { stepTypeId: 1, stepTypeKey: "warmup" },
      endCondition: { conditionTypeKey: "time", conditionTypeId: 2 },
      endConditionValue: 600,
      preferredEndConditionUnit: { unitKey: "second" },
      targetType: noT, targetValueOne: null, targetValueTwo: null }),
    stripped({ stepOrder: 2, description: "Run",
      stepType: { stepTypeId: 3, stepTypeKey: "interval" },
      endCondition: { conditionTypeKey: "time", conditionTypeId: 2 },
      endConditionValue: 1200,
      preferredEndConditionUnit: { unitKey: "second" },
      targetType: noT, targetValueOne: null, targetValueTwo: null }),
    stripped({ stepOrder: 3, description: "Cool down",
      stepType: { stepTypeId: 2, stepTypeKey: "cool_down" },
      endCondition: { conditionTypeKey: "time", conditionTypeId: 2 },
      endConditionValue: 600,
      preferredEndConditionUnit: { unitKey: "second" },
      targetType: noT, targetValueOne: null, targetValueTwo: null }),
  ];
  return {
    description:               "YallaJog stripped test",
    sportType,
    subSportType:              "GENERIC",
    workoutProvider:           "null",
    workoutSourceId:           "null",
    workoutName:               `YallaJog Stripped – ${today}`,
    estimatedDurationInSecs:   2400,
    estimatedDistanceInMeters: null,
    workoutSegments: [{
      segmentOrder: 1,
      sportType,
      workoutSteps: steps,
    }],
  };
}

// lap.button workout: the working manually-created workout uses this end condition
// instead of "time". Tests whether "time" end condition is what breaks mobile.
function buildLapButtonWorkout() {
  const today = new Date().toISOString().slice(0, 10);
  const sportType = { sportTypeId: 1, sportTypeKey: "running" };
  const noT = { workoutTargetTypeId: 1, workoutTargetTypeKey: "no.target" };
  const lapBtn = { conditionTypeId: 1, conditionTypeKey: "lap.button" };

  const step = (stepOrder: number, description: string, stepTypeId: number, stepTypeKey: string) => ({
    type:                      "ExecutableStepDTO",
    stepId:                    null,
    stepOrder,
    childStepId:               null,
    description,
    stepType:                  { stepTypeId, stepTypeKey },
    endCondition:              lapBtn,
    preferredEndConditionUnit: null,
    endConditionValue:         null,
    endConditionCompare:       null,
    endConditionZone:          null,
    targetType:                noT,
    targetValueOne:            null,
    targetValueTwo:            null,
    zoneNumber:                null,
  });

  return {
    description:               "YallaJog lap-button test",
    sportType,
    subSportType:              "GENERIC",
    workoutProvider:           "null",
    workoutSourceId:           "null",
    workoutName:               `YallaJog LapBtn – ${today}`,
    estimatedDurationInSecs:   2400,
    estimatedDistanceInMeters: null,
    workoutSegments: [{
      segmentOrder: 1,
      sportType,
      workoutSteps: [
        step(1, "Warm up", 1, "warmup"),
        step(2, "Run", 3, "interval"),
        step(3, "Cool down", 2, "cool_down"),
      ],
    }],
  };
}

router.post("/garmin-test/push-lap-button", async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) return res.status(400).json({ error: "username and password required" });

  let gc: GarminConnect;
  try { gc = await gcLogin(username, password); }
  catch (err: any) { return res.status(401).json({ error: "Garmin login failed: " + (err?.message ?? String(err)) }); }

  try {
    const workout = buildLapButtonWorkout();
    req.log.info({ payload: JSON.stringify(workout) }, "push-lap-button payload");
    const result = await (gc as any).addWorkout(workout);
    const workoutId = result?.workoutId ?? result?.workout?.workoutId ?? result?.data?.workoutId ?? null;
    const today = new Date().toISOString().slice(0, 10);
    const schedule = workoutId ? await scheduleWorkout(gc, workoutId, today, req.log) : { scheduled: false };
    return res.json({
      success: true,
      workoutId,
      workoutName: result?.workoutName ?? workout.workoutName,
      scheduled: (schedule as any).scheduled,
      scheduledDate: today,
      note: "lap.button workout: no time/distance — runner taps lap to advance each step. Open Garmin Connect mobile → Calendar → today. If THIS opens but stripped (time) does not, the fix is to switch all workouts from time conditions to lap.button.",
    });
  } catch (err: any) {
    req.log.error({ err: err?.message }, "push-lap-button failed");
    return res.status(500).json({ error: "Failed: " + (err?.message ?? String(err)) });
  }
});

router.post("/garmin-test/push-stripped", async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) return res.status(400).json({ error: "username and password required" });

  let gc: GarminConnect;
  try { gc = await gcLogin(username, password); }
  catch (err: any) { return res.status(401).json({ error: "Garmin login failed: " + (err?.message ?? String(err)) }); }

  try {
    const workout = buildStrippedWorkout();
    req.log.info({ payload: JSON.stringify(workout) }, "push-stripped payload");
    const result = await (gc as any).addWorkout(workout);
    const workoutId = result?.workoutId ?? result?.workout?.workoutId ?? result?.data?.workoutId ?? null;
    // Schedule to today so it appears in Calendar view (library view has known issues with API-pushed workouts)
    const today = new Date().toISOString().slice(0, 10);
    const schedule = workoutId ? await scheduleWorkout(gc, workoutId, today, req.log) : { scheduled: false };
    return res.json({
      success: true,
      workoutId,
      workoutName: result?.workoutName ?? workout.workoutName,
      scheduled: (schedule as any).scheduled,
      scheduledDate: today,
      note: "Workout scheduled to TODAY. Open Garmin Connect mobile → Calendar → tap today's date → tap the workout. Library view may have a Garmin bug for API-pushed workouts; Calendar view should work.",
    });
  } catch (err: any) {
    req.log.error({ err: err?.message }, "push-stripped failed");
    return res.status(500).json({ error: "Failed: " + (err?.message ?? String(err)) });
  }
});

// ── Push a workout cloned from a manually-created one (top-level fields preserved) ──
// Strategy: fetch an existing non-YallaJog running workout, keep ALL its top-level
// fields (subSportType, consumer, shared, etc.), replace only name/steps with ours.
// If this opens on mobile → the issue is in our top-level fields.
// If this also fails    → the issue is in our step structure.
router.post("/garmin-test/push-cloned-template", async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) return res.status(400).json({ error: "username and password required" });

  let gc: GarminConnect;
  try { gc = await gcLogin(username, password); }
  catch (err: any) { return res.status(401).json({ error: "Garmin login failed: " + (err?.message ?? String(err)) }); }

  try {
    // 1. Find a non-YallaJog running workout to use as template
    const allWorkouts: any[] = await (gc as any).getWorkouts(0, 100);
    const template = allWorkouts.find((w: any) =>
      w.sportType?.sportTypeKey === "running" &&
      typeof w.workoutName === "string" &&
      !w.workoutName.toLowerCase().startsWith("yallajog") &&
      !w.workoutName.toLowerCase().startsWith("libratest") &&
      !w.workoutName.toLowerCase().startsWith("libratest")
    );
    if (!template) {
      return res.status(404).json({ error: "No non-YallaJog running workout found to use as template. Create one manually in Garmin Connect first." });
    }

    // 2. Fetch its full detail
    const templateDetail = await (gc as any).getWorkoutDetail({ workoutId: template.workoutId });
    req.log.info({ templateWorkoutId: template.workoutId, templateName: template.workoutName }, "push-cloned-template: using template");

    // 3. Build our minimal 3-step workout
    const today = new Date().toISOString().slice(0, 10);
    const ourSteps = [
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

    // 4. Clone the template but replace name, description, and steps
    const cloned = {
      ...templateDetail,
      workoutName: `YallaJog Cloned – ${today}`,
      description: "YallaJog template-cloned test",
      workoutSegments: [{
        ...(templateDetail.workoutSegments?.[0] ?? {}),
        workoutSteps: ourSteps,
        estimatedDurationInSecs:   1800,
        estimatedDistanceInMeters: null,
      }],
      estimatedDurationInSecs:   1800,
      estimatedDistanceInMeters: null,
    };

    // 5. Push (addWorkout strips workoutId/ownerId/createdDate/updatedDate/author)
    req.log.info({ payload: JSON.stringify(cloned) }, "push-cloned-template payload");
    const result = await (gc as any).addWorkout(cloned);
    const workoutId = result?.workoutId ?? result?.workout?.workoutId ?? result?.data?.workoutId ?? null;

    return res.json({
      success: true,
      workoutId,
      workoutName: result?.workoutName ?? cloned.workoutName,
      templateUsed: { workoutId: template.workoutId, workoutName: template.workoutName },
      templateTopLevelFields: Object.keys(templateDetail).filter(k => !["workoutSegments","workoutId","ownerId","createdDate","updatedDate","author"].includes(k)),
      note: "Check Garmin Connect mobile → Training → Workouts. If this opens, the fix is to copy top-level fields from the template. If it also fails, the issue is in the step structure.",
    });
  } catch (err: any) {
    req.log.error({ err }, "push-cloned-template failed");
    return res.status(500).json({ error: "Failed: " + (err?.message ?? String(err)) });
  }
});

// ── Push our minimal workout then immediately fetch what Garmin stored ─────────
// Reveals exactly which fields Garmin accepts/ignores/transforms.
router.post("/garmin-test/push-and-fetch", async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) return res.status(400).json({ error: "username and password required" });

  let gc: GarminConnect;
  try { gc = await gcLogin(username, password); }
  catch (err: any) { return res.status(401).json({ error: "Garmin login failed: " + (err?.message ?? String(err)) }); }

  try {
    const submitted = buildMinimalTestWorkout();
    req.log.info({ payload: JSON.stringify(submitted) }, "push-and-fetch: submitting");
    const createResult = await (gc as any).addWorkout(submitted);
    const workoutId = createResult?.workoutId ?? createResult?.workout?.workoutId ?? createResult?.data?.workoutId ?? null;

    const stored = workoutId ? await (gc as any).getWorkoutDetail({ workoutId }) : null;

    // Flat diff between what we submitted (top-level) and what Garmin stored
    const submittedKeys = Object.keys(submitted).filter(k => k !== "workoutSegments");
    const diffFields: Record<string, { submitted: any; stored: any }> = {};
    for (const k of submittedKeys) {
      const s = (submitted as any)[k];
      const g = stored?.[k];
      if (JSON.stringify(s) !== JSON.stringify(g)) {
        diffFields[k] = { submitted: s, stored: g };
      }
    }
    // Also show fields Garmin added that we didn't send
    const garminExtra: Record<string, any> = {};
    for (const k of Object.keys(stored ?? {})) {
      if (!submittedKeys.includes(k) && !["workoutSegments","workoutId","ownerId","createdDate","updatedDate"].includes(k)) {
        garminExtra[k] = stored[k];
      }
    }

    return res.json({
      workoutId,
      submitted: { ...submitted, workoutSegments: "(omitted for brevity)" },
      storedTopLevel: Object.fromEntries(Object.entries(stored ?? {}).filter(([k]) => k !== "workoutSegments")),
      fieldsGarminChanged: diffFields,
      fieldsGarminAdded: garminExtra,
      note: "fieldsGarminChanged shows where Garmin ignored/transformed what we sent. fieldsGarminAdded shows what Garmin adds that we don't control.",
    });
  } catch (err: any) {
    req.log.error({ err }, "push-and-fetch failed");
    return res.status(500).json({ error: "Failed: " + (err?.message ?? String(err)) });
  }
});

// ── Update an EXISTING manually-created workout in-place via PUT ──────────────
// Key test: POST creates new workouts with consumer:null (API auth).
// PUT on an existing manually-created workout preserves the consumer field
// that Garmin stamped at creation time (e.g. "GARMIN_CONNECT").
// If this opens on mobile, the fix is to always overwrite a placeholder workout
// that the user created manually, rather than creating new ones.
router.post("/garmin-test/update-existing", async (req, res) => {
  const { username, password, workoutId } = req.body as { username?: string; password?: string; workoutId?: number };
  if (!username || !password || !workoutId) return res.status(400).json({ error: "username, password, and workoutId required" });

  let gc: GarminConnect;
  try { gc = await gcLogin(username, password); }
  catch (err: any) { return res.status(401).json({ error: "Garmin login failed: " + (err?.message ?? String(err)) }); }

  try {
    // 1. Fetch the existing workout (preserves consumer/source/etc. from original creation)
    const existing = await (gc as any).getWorkoutDetail({ workoutId });
    req.log.info({
      workoutId,
      consumer: existing.consumer,
      workoutProvider: existing.workoutProvider,
      workoutName: existing.workoutName,
    }, "update-existing: fetched original workout");

    // 2. Build stripped steps (minimal, matching RunningTemplate format)
    const stripped = buildStrippedWorkout();

    // 3. Overwrite name and steps, keep ALL other top-level fields exactly as Garmin stored them
    const today = new Date().toISOString().slice(0, 10);
    const updated = {
      ...existing,
      workoutName: `YallaJog Updated – ${today}`,
      description: "YallaJog update-existing test (PUT on manually-created workout)",
      workoutSegments: [{
        ...(existing.workoutSegments?.[0] ?? {}),
        workoutSteps: stripped.workoutSegments[0].workoutSteps,
        estimatedDurationInSecs: 2400,
        estimatedDistanceInMeters: null,
      }],
      estimatedDurationInSecs: 2400,
      estimatedDistanceInMeters: null,
    };

    // 4. PUT to existing workout URL (preserves consumer, ownerId, etc.)
    const putUrl = (gc as any).url.WORKOUT(workoutId);
    req.log.info({ putUrl, payload: JSON.stringify(updated) }, "update-existing: sending PUT");
    const result = await (gc as any).client.put(putUrl, updated);

    // 5. Schedule to today
    const schedule = await scheduleWorkout(gc, workoutId, today, req.log);

    return res.json({
      success: true,
      workoutId,
      consumer: existing.consumer,
      workoutProvider: existing.workoutProvider,
      originalName: existing.workoutName,
      updatedName: updated.workoutName,
      scheduled: (schedule as any).scheduled,
      scheduledDate: today,
      putStatus: result?.status ?? "ok",
      note: `PUT preserved consumer="${existing.consumer}" from original workout. Open Garmin Connect mobile → Calendar → today → tap "YallaJog Updated". If it opens, consumer field is the fix.`,
    });
  } catch (err: any) {
    req.log.error({ err }, "update-existing failed");
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
