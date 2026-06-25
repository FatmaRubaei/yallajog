---
name: Garmin lap.button end condition fix
description: Garmin Connect mobile cannot open workouts with time or distance end conditions — only lap.button works.
---

## Rule
All workout steps pushed to Garmin Connect via API MUST use `lap.button` end conditions (`conditionTypeId: 1, conditionTypeKey: "lap.button"`). Never use `time` (id 2) or `distance` (id 3) — they cause an infinite loading screen on Garmin Connect mobile regardless of step structure, top-level fields, or whether the workout is scheduled or in the library.

**Why:** Discovered after exhaustive testing: subSportType, consumer, workoutProvider, strokeType, equipmentType, POST vs PUT, library vs calendar — none of these were the issue. The `endCondition` type is what the mobile app renderer checks first. `time` and `distance` conditions silently break mobile rendering.

**How to apply:** In `buildGarminWorkout` (artifacts/api-server/src/routes/garmin-test.ts), always use:
```js
endCondition: { conditionTypeKey: "lap.button", conditionTypeId: 1, displayOrder: 1, displayable: true }
endConditionValue: null
```
Embed the duration/distance target in the step `description` string (e.g. `"Warm up (10 min)"`) so it appears on the watch display. Calculate `estimatedDurationInSecs` / `estimatedDistanceInMeters` for the top-level workout metadata manually from segment data — do not rely on `estimateSteps()` since steps no longer carry the values.
