/**
 * Minimal FIT file generator for Garmin workout export.
 * Produces a valid .fit file containing a single workout with steps.
 *
 * FIT spec references:
 *   - Global message numbers: file_id=0, workout=26, workout_step=27
 *   - All values little-endian
 *   - CRC: FIT CRC-16 (polynomial 0xb2b4)
 *
 * workout_step field numbers (from Garmin FIT Profile):
 *   254 message_index     uint16
 *     0 wkt_step_name     string(16)
 *     1 duration_type     uint8
 *     2 duration_value    uint32
 *     3 target_type       uint8
 *     4 target_value      uint32   (single value; 0xFFFFFFFF when range is used)
 *     5 custom_target_value_low   uint32
 *     6 custom_target_value_high  uint32
 *     7 intensity         uint8
 */

// ── CRC ──────────────────────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const table: number[] = [];
  for (let i = 0; i < 16; i++) {
    let crc = i;
    for (let j = 0; j < 4; j++) {
      if (crc & 1) crc = (crc >> 1) ^ 0xb2b4;
      else crc >>= 1;
    }
    table[i] = crc;
  }
  return table;
})();

function fitCrc(data: Uint8Array, start = 0, end = data.length): number {
  let crc = 0;
  for (let i = start; i < end; i++) {
    const b = data[i];
    crc = (CRC_TABLE[(crc & 0xf) ^ (b & 0xf)] ^ (crc >> 4)) & 0xffff;
    crc = (CRC_TABLE[(crc & 0xf) ^ (b >> 4)] ^ (crc >> 4)) & 0xffff;
  }
  return crc;
}

// ── Buffer writer ─────────────────────────────────────────────────────────────

class Writer {
  private buf: number[] = [];

  u8(v: number)  { this.buf.push(v & 0xff); }
  u16le(v: number) { this.u8(v); this.u8(v >> 8); }
  u32le(v: number) { this.u16le(v); this.u16le(v >> 16); }

  string(s: string, len: number) {
    for (let i = 0; i < len; i++) {
      this.u8(i < s.length ? s.charCodeAt(i) : 0);
    }
  }

  bytes(): Uint8Array { return new Uint8Array(this.buf); }
  length(): number { return this.buf.length; }
}

// ── FIT base types ────────────────────────────────────────────────────────────

const UINT8  = 0x02;
const UINT16 = 0x84;
const UINT32 = 0x86;
const STRING = 0x07;
const UINT32_INVALID = 0xffffffff;

// ── Field definition ──────────────────────────────────────────────────────────

type FieldDef = [number, number, number]; // [field_def_num, size, base_type]

function definitionMessage(localMsgNum: number, globalMsgNum: number, fields: FieldDef[]): Uint8Array {
  const w = new Writer();
  w.u8(0x40 | (localMsgNum & 0x0f)); // definition record header
  w.u8(0);                            // reserved
  w.u8(0);                            // architecture: little-endian
  w.u16le(globalMsgNum);
  w.u8(fields.length);
  for (const [fnum, size, btype] of fields) {
    w.u8(fnum);
    w.u8(size);
    w.u8(btype);
  }
  return w.bytes();
}

// ── file_id (global msg 0) ────────────────────────────────────────────────────
// Fields: type(0), manufacturer(1), product(2), time_created(4)

function fileIdDefinition(): Uint8Array {
  return definitionMessage(0, 0, [
    [0, 1, UINT8],   // type
    [1, 2, UINT16],  // manufacturer
    [2, 2, UINT16],  // product
    [4, 4, UINT32],  // time_created
  ]);
}

function fileIdData(timestamp: number): Uint8Array {
  const w = new Writer();
  w.u8(0x00);      // data record, local msg 0
  w.u8(5);         // file type 5 = workout
  w.u16le(255);    // manufacturer: development (255)
  w.u16le(0);      // product
  w.u32le(timestamp);
  return w.bytes();
}

// ── workout (global msg 26) ───────────────────────────────────────────────────
// Fields: sport(4), capabilities(5), num_valid_steps(6), wkt_name(8)

function workoutDefinition(): Uint8Array {
  return definitionMessage(1, 26, [
    [4, 1, UINT8],    // sport
    [5, 4, UINT32],   // capabilities
    [6, 2, UINT16],   // num_valid_steps
    [8, 16, STRING],  // wkt_name
  ]);
}

function workoutData(name: string, numSteps: number): Uint8Array {
  const w = new Writer();
  w.u8(0x01);          // data record, local msg 1
  w.u8(1);             // sport: running
  w.u32le(0);          // capabilities
  w.u16le(numSteps);
  w.string(name.slice(0, 15), 16);
  return w.bytes();
}

// ── workout_step (global msg 27) ──────────────────────────────────────────────
// Fields per FIT profile:
//   254 message_index            uint16
//     0 wkt_step_name            string(16)
//     1 duration_type            uint8
//     2 duration_value           uint32
//     3 target_type              uint8
//     4 target_value             uint32  (0xFFFFFFFF when using custom range)
//     5 custom_target_value_low  uint32
//     6 custom_target_value_high uint32
//     7 intensity                uint8

function workoutStepDefinition(): Uint8Array {
  return definitionMessage(2, 27, [
    [254, 2, UINT16], // message_index
    [0,  16, STRING], // wkt_step_name
    [1,   1, UINT8],  // duration_type
    [2,   4, UINT32], // duration_value
    [3,   1, UINT8],  // target_type
    [4,   4, UINT32], // target_value
    [5,   4, UINT32], // custom_target_value_low
    [6,   4, UINT32], // custom_target_value_high
    [7,   1, UINT8],  // intensity
  ]);
}

// duration_type values
const DURATION_TIME     = 0; // value in milliseconds
const DURATION_DISTANCE = 1; // value in centimetres
const DURATION_OPEN     = 5;

// target_type values
const TARGET_SPEED = 0; // mm/s
const TARGET_OPEN  = 2;

// intensity values
const INTENSITY_ACTIVE   = 0;
const INTENSITY_REST     = 1;
const INTENSITY_WARMUP   = 2;
const INTENSITY_COOLDOWN = 3;

export type FitWorkoutStep = {
  name: string;
  durationMinutes?: number | null;
  distanceKm?: number | null;
  pace?: string | null;         // "M:SS" min/km
  segmentType?: string | null;
};

function intensityForType(segmentType: string | null | undefined): number {
  if (!segmentType) return INTENSITY_ACTIVE;
  const t = segmentType.toLowerCase();
  if (t.includes("warm"))                          return INTENSITY_WARMUP;
  if (t.includes("cool"))                          return INTENSITY_COOLDOWN;
  if (t.includes("recovery") || t.includes("rest")) return INTENSITY_REST;
  return INTENSITY_ACTIVE;
}

/** Parse "M:SS" pace → speed in mm/s */
function paceToSpeedMmS(pace: string): number {
  const [mPart, sPart] = pace.split(":");
  const totalSeconds = Number(mPart ?? 0) * 60 + Number(sPart ?? 0);
  if (totalSeconds <= 0) return 0;
  return Math.round((1000 / totalSeconds) * 1000); // 1 km / totalSeconds → m/s → mm/s
}

function workoutStepData(step: FitWorkoutStep, index: number): Uint8Array {
  const w = new Writer();
  w.u8(0x02); // data record, local msg 2

  // message_index
  w.u16le(index);

  // name (max 15 chars + null terminator)
  w.string(step.name.slice(0, 15), 16);

  // ── duration ──────────────────────────────────────────────────────────────
  let durationType: number;
  let durationValue: number;
  if (step.durationMinutes != null && step.durationMinutes > 0) {
    durationType  = DURATION_TIME;
    durationValue = Math.round(step.durationMinutes * 60 * 1000); // ms
  } else if (step.distanceKm != null && step.distanceKm > 0) {
    durationType  = DURATION_DISTANCE;
    durationValue = Math.round(step.distanceKm * 100000);          // cm
  } else {
    durationType  = DURATION_OPEN;
    durationValue = 0;
  }
  w.u8(durationType);
  w.u32le(durationValue);

  // ── target ────────────────────────────────────────────────────────────────
  // When using a custom speed range:
  //   target_value (4)             = 0xFFFFFFFF (invalid — range fields are used)
  //   custom_target_value_low  (5) = low speed (slower) in mm/s
  //   custom_target_value_high (6) = high speed (faster) in mm/s
  //
  // When open target:
  //   target_value (4)             = 0
  //   custom_target_value_low  (5) = 0xFFFFFFFF (invalid)
  //   custom_target_value_high (6) = 0xFFFFFFFF (invalid)

  let targetType: number;
  let targetValue: number;
  let targetLow: number;
  let targetHigh: number;

  if (step.pace) {
    const speedMmS = paceToSpeedMmS(step.pace);
    targetType  = TARGET_SPEED;
    targetValue = UINT32_INVALID;                    // not used when range is specified
    targetLow   = Math.round(speedMmS * 0.95);       // ±5% band
    targetHigh  = Math.round(speedMmS * 1.05);
  } else {
    targetType  = TARGET_OPEN;
    targetValue = 0;
    targetLow   = UINT32_INVALID;
    targetHigh  = UINT32_INVALID;
  }

  w.u8(targetType);
  w.u32le(targetValue);
  w.u32le(targetLow);
  w.u32le(targetHigh);

  // intensity (field 7)
  w.u8(intensityForType(step.segmentType));

  return w.bytes();
}

// ── FIT file header ───────────────────────────────────────────────────────────

function fitHeader(dataSize: number): Uint8Array {
  const w = new Writer();
  w.u8(14);           // header length
  w.u8(0x10);         // protocol version 1.0
  w.u16le(2132);      // profile version 21.32
  w.u32le(dataSize);  // data size in bytes (excludes header and file CRC)
  w.u8(0x2e); w.u8(0x46); w.u8(0x49); w.u8(0x54); // ".FIT"
  // header CRC covers the first 12 bytes
  const crc = fitCrc(w.bytes());
  w.u16le(crc);
  return w.bytes();
}

// ── FIT epoch: seconds since 1989-12-31 00:00:00 UTC ─────────────────────────

const FIT_EPOCH_S = Date.UTC(1989, 11, 31, 0, 0, 0) / 1000;
function fitTimestamp(): number {
  return Math.floor(Date.now() / 1000) - FIT_EPOCH_S;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function buildFitWorkout(workoutName: string, steps: FitWorkoutStep[]): Buffer {
  const ts = fitTimestamp();

  const parts: Uint8Array[] = [];

  // definitions first
  parts.push(fileIdDefinition());
  parts.push(workoutDefinition());
  parts.push(workoutStepDefinition());

  // data records
  parts.push(fileIdData(ts));
  parts.push(workoutData(workoutName, steps.length));
  steps.forEach((step, i) => parts.push(workoutStepData(step, i)));

  // assemble data section
  const dataLen = parts.reduce((n, p) => n + p.length, 0);
  const data = new Uint8Array(dataLen);
  let offset = 0;
  for (const p of parts) { data.set(p, offset); offset += p.length; }

  // file CRC covers the data section only
  const fileCrc = fitCrc(data);
  const crcBytes = new Uint8Array([fileCrc & 0xff, (fileCrc >> 8) & 0xff]);

  return Buffer.concat([fitHeader(dataLen), data, crcBytes]);
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
        name: seg.resolvedText.slice(0, 15),
        durationMinutes: seg.durationMinutes ?? null,
        distanceKm:      seg.distanceKm      ?? null,
        pace:            seg.pace             ?? null,
        segmentType:     seg.segmentType      ?? null,
      });
    }
  }
  return steps;
}
