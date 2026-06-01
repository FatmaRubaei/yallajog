/**
 * FIT workout file generator using the official @garmin/fitsdk Encoder.
 *
 * Duration raw values (encoder ignores subfields, needs raw field values):
 *   durationType=0 (time)     → durationValue in milliseconds
 *   durationType=1 (distance) → durationValue in centimetres
 *   durationType=5 (open)     → durationValue = 0
 *
 * Speed target raw values:
 *   targetType=0 (speed) → customTargetValueLow / customTargetValueHigh in mm/s
 *   targetType=2 (open)  → no range fields needed
 */

import { Encoder, Profile } from "@garmin/fitsdk";

export type FitWorkoutStep = {
  name: string;
  durationMinutes?: number | null;
  distanceKm?: number | null;
  pace?: string | null;        // "M:SS" min/km
  segmentType?: string | null;
};

// ── helpers ───────────────────────────────────────────────────────────────────

/** Parse "M:SS" pace (min/km) → speed in mm/s */
function paceToSpeedMmS(pace: string): number {
  const [mPart, sPart] = pace.split(":");
  const totalSec = Number(mPart ?? 0) * 60 + Number(sPart ?? 0);
  if (totalSec <= 0) return 0;
  return Math.round((1000 / totalSec) * 1000); // m/s → mm/s
}

/** Map segment type label → FIT intensity numeric value */
function intensityValue(segmentType: string | null | undefined): number {
  if (!segmentType) return 0; // active
  const t = segmentType.toLowerCase();
  if (t.includes("warm"))                              return 2; // warmup
  if (t.includes("cool"))                              return 3; // cooldown
  if (t.includes("recovery") || t.includes("rest"))   return 1; // rest
  return 0; // active
}

// ── public API ────────────────────────────────────────────────────────────────

export function buildFitWorkout(workoutName: string, steps: FitWorkoutStep[]): Buffer {
  const encoder = new Encoder();

  // file_id — type 5 = workout
  encoder.onMesg(Profile.MesgNum.FILE_ID, {
    type: "workout",
    manufacturer: 1,     // Garmin
    product: 0,
    timeCreated: new Date(),
  });

  // workout message
  encoder.onMesg(Profile.MesgNum.WORKOUT, {
    sport: 1,                            // running
    numValidSteps: steps.length,
    wktName: workoutName.slice(0, 15),
  });

  // one workout_step per segment
  steps.forEach((step, i) => {
    // ── duration ──────────────────────────────────────────────────────────
    let durationType: number;
    let durationValue: number;

    if (step.durationMinutes != null && step.durationMinutes > 0) {
      durationType  = 0;                                              // time
      durationValue = Math.round(step.durationMinutes * 60 * 1000);  // ms
    } else if (step.distanceKm != null && step.distanceKm > 0) {
      durationType  = 1;                                              // distance
      durationValue = Math.round(step.distanceKm * 1000 * 100);      // cm
    } else {
      durationType  = 5;                                              // open
      durationValue = 0;
    }

    // ── target ────────────────────────────────────────────────────────────
    let targetType: number;
    const extra: Record<string, number> = {};

    if (step.pace) {
      const speedMmS = paceToSpeedMmS(step.pace);
      targetType = 0;                                                 // speed
      extra.customTargetValueLow  = Math.round(speedMmS * 0.95);    // −5 %
      extra.customTargetValueHigh = Math.round(speedMmS * 1.05);    // +5 %
    } else {
      targetType = 2;                                                 // open
    }

    encoder.onMesg(Profile.MesgNum.WORKOUT_STEP, {
      messageIndex:   i,
      wktStepName:    step.name.slice(0, 15),
      durationType,
      durationValue,
      targetType,
      intensity:      intensityValue(step.segmentType),
      ...extra,
    });
  });

  const uint8 = encoder.close();
  return Buffer.from(uint8);
}

/** Convert a week plan (with runs + segments) to a flat list of FIT workout steps. */
export function planToFitSteps(plan: {
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
}): FitWorkoutStep[] {
  const steps: FitWorkoutStep[] = [];
  for (const run of plan.runs ?? []) {
    for (const seg of run.segments ?? []) {
      steps.push({
        name:            seg.resolvedText.slice(0, 15),
        durationMinutes: seg.durationMinutes ?? null,
        distanceKm:      seg.distanceKm      ?? null,
        pace:            seg.pace             ?? null,
        segmentType:     seg.segmentType      ?? null,
      });
    }
  }
  return steps;
}
