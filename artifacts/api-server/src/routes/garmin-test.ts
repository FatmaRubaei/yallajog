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

// ── Full Garmin step structure (all fields mobile app requires) ────────────────
const STROKE_TYPE_NONE    = { strokeTypeId: 0, strokeTypeKey: null, displayOrder: 0 };
const EQUIPMENT_TYPE_NONE = { equipmentTypeId: 0, equipmentTypeKey: null, displayOrder: 0 };

function makeStep(fields: {
  stepOrder:                 number;
  description:               string;
  stepType:                  { stepTypeId: number; stepTypeKey: string };
  endCondition:              object;
  endConditionValue:         number | null;
  preferredEndConditionUnit: object;
  targetType:                { workoutTargetTypeId: number; workoutTargetTypeKey: string };
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
    strokeType:               STROKE_TYPE_NONE,
    equipmentType:            EQUIPMENT_TYPE_NONE,
    category:                 null,
    exerciseName:             null,
    workoutProvider:          null,
    providerExerciseSourceId: null,
    weightValue:              null,
    weightUnit:               null,
  };
}

const sportType = { sportTypeId: 1, sportTypeKey: "running", displayOrder: 1 };
const noTarget  = { workoutTargetTypeId: 1, workoutTargetTypeKey: "no.target" };

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

function paceTarget(paceMinPerKm: string) {
  const [m, s] = paceMinPerKm.split(":").map(Number);
  const totalSec = m * 60 + (s || 0);
  // Garmin stores pace targets in mm/s (millimeters per second) as integers
  const speedMms = Math.round(1_000_000 / totalSec);
  const range    = Math.round(speedMms * 0.05);
  return {
    targetType:     { workoutTargetTypeId: 6, workoutTargetTypeKey: "pace.zone" },
    targetValueOne: speedMms - range,
    targetValueTwo: speedMms + range,
  };
}

// ── Build full workout from week plan ─────────────────────────────────────────
function buildGarminWorkout(plan: Awaited<ReturnType<typeof buildWeekPlanDetail>>) {
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

  let stepOrder = 1;
  const workoutSteps: object[] = [];

  for (const run of plan.runs ?? []) {
    for (const seg of run.segments ?? []) {
      let endCond: ReturnType<typeof timeCondition>;
      if (seg.distanceKm != null && seg.distanceKm > 0) {
        endCond = distanceCondition(seg.distanceKm);
      } else if (seg.durationMinutes != null && seg.durationMinutes > 0) {
        endCond = timeCondition(seg.durationMinutes);
      } else {
        endCond = {
          endCondition:              { conditionTypeKey: "lap.button", conditionTypeId: 1, displayOrder: 1, displayable: true },
          endConditionValue:         null,
          preferredEndConditionUnit: { unitId: 2, unitKey: "kilometer", factor: 100000 },
        };
      }

      let target = { targetType: noTarget, targetValueOne: null as number | null, targetValueTwo: null as number | null };
      if (seg.pace) {
        const [m, s] = seg.pace.split(":").map(Number);
        if (!isNaN(m) && (m > 0 || s > 0)) {
          const pt = paceTarget(seg.pace);
          target = { targetType: pt.targetType, targetValueOne: pt.targetValueOne, targetValueTwo: pt.targetValueTwo };
        }
      }

      workoutSteps.push(makeStep({
        stepOrder:                 stepOrder++,
        description:               seg.resolvedText.slice(0, 200),
        stepType:                  resolveStepType(seg.resolvedText),
        endCondition:              endCond.endCondition,
        endConditionValue:         endCond.endConditionValue,
        preferredEndConditionUnit: endCond.preferredEndConditionUnit,
        targetType:                target.targetType,
        targetValueOne:            target.targetValueOne,
        targetValueTwo:            target.targetValueTwo,
      }));
    }
  }

  return {
    workoutId: undefined,
    description: `YallaJog training plan for week of ${plan.weekStart}`,
    sportType,
    workoutName: `YallaJog – Week of ${plan.weekStart}`,
    workoutSegments: [{ segmentOrder: 1, sportType, workoutSteps }],
  };
}

// ── Hardcoded test workout for Fadi Karkaby ───────────────────────────────────
function buildFadiTestWorkout() {
  const today = new Date().toISOString().slice(0, 10);
  const steps = [
    makeStep({
      stepOrder: 1,
      description: "Easy warm up jog",
      stepType: { stepTypeId: 1, stepTypeKey: "warmup" },
      ...timeCondition(10),
      targetType: noTarget, targetValueOne: null, targetValueTwo: null,
    }),
    makeStep({
      stepOrder: 2,
      description: "Interval run at target pace",
      stepType: { stepTypeId: 3, stepTypeKey: "interval" },
      ...distanceCondition(1),
      ...paceTarget("4:30"),
    }),
    makeStep({
      stepOrder: 3,
      description: "Recovery rest",
      stepType: { stepTypeId: 5, stepTypeKey: "rest" },
      ...timeCondition(2),
      targetType: noTarget, targetValueOne: null, targetValueTwo: null,
    }),
    makeStep({
      stepOrder: 4,
      description: "Interval run at target pace",
      stepType: { stepTypeId: 3, stepTypeKey: "interval" },
      ...distanceCondition(1),
      ...paceTarget("4:30"),
    }),
    makeStep({
      stepOrder: 5,
      description: "Easy cool down jog",
      stepType: { stepTypeId: 2, stepTypeKey: "cool_down" },
      ...timeCondition(10),
      targetType: noTarget, targetValueOne: null, targetValueTwo: null,
    }),
  ];

  return {
    workoutId: undefined,
    description: "YallaJog test workout for Fadi Karkaby",
    sportType,
    workoutName: `YallaJog Test – Fadi – ${today}`,
    workoutSegments: [{ segmentOrder: 1, sportType, workoutSteps: steps }],
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

  const detail  = await buildWeekPlanDetail(plan);
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
    const workoutId =
      result?.workoutId ?? result?.workout?.workoutId ?? result?.data?.workoutId ?? result?.id ?? null;
    return res.json({
      success: true,
      workoutId,
      workoutName: result?.workoutName ?? workout.workoutName,
      stepCount: (workout.workoutSegments[0].workoutSteps as any[]).length,
    });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to push workout: " + (err?.message ?? String(err)) });
  }
});

// ── Push test workout for Fadi Karkaby ────────────────────────────────────────
router.post("/garmin-test/push-fadi-test", async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) {
    return res.status(400).json({ error: "Garmin username and password are required" });
  }

  const workout = buildFadiTestWorkout();

  let gc: GarminConnect;
  try {
    gc = await gcLogin(username, password);
  } catch (err: any) {
    return res.status(401).json({ error: "Garmin login failed: " + (err?.message ?? String(err)) });
  }

  try {
    const result = await (gc as any).addWorkout(workout);
    req.log.info({ garminResult: result }, "Garmin Fadi test workout result");
    const workoutId =
      result?.workoutId ?? result?.workout?.workoutId ?? result?.data?.workoutId ?? result?.id ?? null;
    return res.json({
      success: true,
      workoutId,
      workoutName: result?.workoutName ?? workout.workoutName,
      stepCount: (workout.workoutSegments[0].workoutSteps as any[]).length,
    });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to push test workout: " + (err?.message ?? String(err)) });
  }
});

// ── Delete all YallaJog workouts from Garmin (cleanup broken pushes) ──────────
router.post("/garmin-test/delete-all-workouts", async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) {
    return res.status(400).json({ error: "username and password are required" });
  }

  let gc: GarminConnect;
  try {
    gc = await gcLogin(username, password);
  } catch (err: any) {
    return res.status(401).json({ error: "Garmin login failed: " + (err?.message ?? String(err)) });
  }

  try {
    const workouts: any[] = await (gc as any).getWorkouts(0, 200);
    const toDelete = workouts.filter((w: any) =>
      typeof w.workoutName === "string" &&
      (w.workoutName.toLowerCase().includes("yallajog") || w.workoutName.toLowerCase().includes("yalla jog"))
    );

    let deleted = 0;
    let failed  = 0;
    for (const w of toDelete) {
      try {
        await (gc as any).deleteWorkout(w);
        deleted++;
      } catch {
        failed++;
      }
    }

    req.log.info({ total: toDelete.length, deleted, failed }, "Garmin cleanup done");
    return res.json({ success: true, total: toDelete.length, deleted, failed });
  } catch (err: any) {
    return res.status(500).json({ error: "Cleanup failed: " + (err?.message ?? String(err)) });
  }
});

// ── Garmin data fetch ──────────────────────────────────────────────────────────
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
