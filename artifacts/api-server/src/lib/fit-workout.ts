/**
 * Minimal FIT file generator for Garmin workout export.
 * Produces a valid .fit file containing a single workout with steps.
 *
 * FIT spec references used:
 *   - Global message numbers: file_id=0, workout=26, workout_step=27
 *   - All values little-endian
 *   - CRC: FIT CRC-16 (x^16 + x^12 + x^5 + 1)
 */

// ── CRC ──────────────────────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const table: number[] = [];
  for (let i = 0; i < 16; i++) {
    let crc = i;
    if (crc & 1) crc = (crc >> 1) ^ 0xb2b4;
    else crc >>= 1;
    if (crc & 1) crc = (crc >> 1) ^ 0xb2b4;
    else crc >>= 1;
    if (crc & 1) crc = (crc >> 1) ^ 0xb2b4;
    else crc >>= 1;
    if (crc & 1) crc = (crc >> 1) ^ 0xb2b4;
    else crc >>= 1;
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

  u8(v: number) { this.buf.push(v & 0xff); }
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

// ── FIT message helpers ───────────────────────────────────────────────────────

// Field definition: [field_def_num, size, base_type]
type FieldDef = [number, number, number];

// base types
const UINT8  = 0x02;
const UINT16 = 0x84;
const UINT32 = 0x86;
const STRING = 0x07;

function definitionMessage(localMsgNum: number, globalMsgNum: number, fields: FieldDef[]): Uint8Array {
  const w = new Writer();
  // definition record header: normal header | definition bit
  w.u8(0x40 | (localMsgNum & 0x0f));
  w.u8(0);         // reserved
  w.u8(0);         // architecture: little-endian
  w.u16le(globalMsgNum);
  w.u8(fields.length);
  for (const [fnum, size, btype] of fields) {
    w.u8(fnum);
    w.u8(size);
    w.u8(btype);
  }
  return w.bytes();
}

// ── Message types ─────────────────────────────────────────────────────────────

// Global msg 0: file_id
// Fields: type(0,1,uint8), manufacturer(1,2,uint16), product(2,2,uint16),
//         serial(3,4,uint32), time_created(4,4,uint32), number(5,2,uint16)
function fileIdDefinition(): Uint8Array {
  return definitionMessage(0, 0, [
    [0, 1, UINT8],
    [1, 2, UINT16],
    [2, 2, UINT16],
    [4, 4, UINT32],
  ]);
}

// type=5 (workout), manufacturer=255 (development), product=0, time_created=now
function fileIdData(timestamp: number): Uint8Array {
  const w = new Writer();
  w.u8(0x00); // data record header local msg 0
  w.u8(5);    // file type: workout
  w.u16le(255); // manufacturer: development
  w.u16le(0);   // product
  w.u32le(timestamp);
  return w.bytes();
}

// Global msg 26: workout
// Fields: sport(4,1,uint8), capabilities(5,4,uint32), num_valid_steps(6,2,uint16),
//         wkt_name(8,16,string)
function workoutDefinition(): Uint8Array {
  return definitionMessage(1, 26, [
    [4, 1, UINT8],   // sport
    [5, 4, UINT32],  // capabilities
    [6, 2, UINT16],  // num_valid_steps
    [8, 16, STRING], // wkt_name
  ]);
}

function workoutData(name: string, numSteps: number): Uint8Array {
  const w = new Writer();
  w.u8(0x01); // data record header local msg 1
  w.u8(1);    // sport: running
  w.u32le(0); // capabilities
  w.u16le(numSteps);
  w.string(name.slice(0, 15), 16);
  return w.bytes();
}

// Global msg 27: workout_step
// Fields: wkt_step_name(0,16,string), duration_type(1,1,uint8), duration_value(2,4,uint32),
//         target_type(3,1,uint8), target_value(4,4,uint32),
//         intensity(6,1,uint8), message_index(254,2,uint16)
function workoutStepDefinition(): Uint8Array {
  return definitionMessage(2, 27, [
    [254, 2, UINT16], // message_index
    [0, 16, STRING],  // wkt_step_name
    [1, 1, UINT8],    // duration_type
    [2, 4, UINT32],   // duration_value
    [3, 1, UINT8],    // target_type
    [4, 4, UINT32],   // target_value
    [5, 4, UINT32],   // target_value_low (custom_target_value_low)
    [6, 1, UINT8],    // intensity
  ]);
}

// duration_type: 0=time(ms), 1=distance(cm), 2=hr_less_than, 3=hr_greater_than,
//                4=calories, 5=open, 6=repeat_until_steps_cmplt
// target_type:  0=speed, 1=heart_rate, 2=open, 3=cadence, 4=power, 5=grade, 6=resistance, 7=power_3s, 8=power_10s, 9=power_30s, 10=power_lap, 11=swim_stroke, 12=speed_lap, 13=heart_rate_lap
// intensity:    0=active, 1=rest, 2=warmup, 3=cooldown

const DURATION_TIME = 0;
const DURATION_DISTANCE = 1;
const DURATION_OPEN = 5;
const TARGET_OPEN = 2;
const TARGET_SPEED = 0; // speed in mm/s, range stored as low/high
const INTENSITY_ACTIVE = 0;
const INTENSITY_REST = 1;
const INTENSITY_WARMUP = 2;
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
  if (t.includes("warm")) return INTENSITY_WARMUP;
  if (t.includes("cool")) return INTENSITY_COOLDOWN;
  if (t.includes("recovery") || t.includes("rest")) return INTENSITY_REST;
  return INTENSITY_ACTIVE;
}

/** Parse "M:SS" → speed in mm/s (FIT target_value for SPEED is speed in mm/s) */
function paceToSpeedMmS(pace: string): number {
  const parts = pace.split(":");
  const minutes = Number(parts[0] ?? 0);
  const seconds = Number(parts[1] ?? 0);
  const totalSeconds = minutes * 60 + seconds;
  if (totalSeconds <= 0) return 0;
  // pace is min/km → speed = 1000m / totalSeconds m/s → mm/s
  return Math.round((1000 / totalSeconds) * 1000);
}

function workoutStepData(step: FitWorkoutStep, index: number): Uint8Array {
  const w = new Writer();
  w.u8(0x02); // data record header local msg 2

  // message_index
  w.u16le(index);

  // name (max 15 chars + null)
  w.string(step.name.slice(0, 15), 16);

  // duration
  let durationType: number;
  let durationValue: number;
  if (step.durationMinutes != null && step.durationMinutes > 0) {
    durationType = DURATION_TIME;
    durationValue = Math.round(step.durationMinutes * 60 * 1000); // ms
  } else if (step.distanceKm != null && step.distanceKm > 0) {
    durationType = DURATION_DISTANCE;
    durationValue = Math.round(step.distanceKm * 100000); // cm
  } else {
    durationType = DURATION_OPEN;
    durationValue = 0;
  }
  w.u8(durationType);
  w.u32le(durationValue);

  // target
  let targetType: number;
  let targetValue: number;
  let targetValueLow: number;
  if (step.pace) {
    const speedMmS = paceToSpeedMmS(step.pace);
    // Garmin speed range: ±10% around target pace
    const low  = Math.round(speedMmS * 0.95);
    const high = Math.round(speedMmS * 1.05);
    targetType = TARGET_SPEED;
    targetValue = high;     // target_value_high
    targetValueLow = low;   // target_value_low
  } else {
    targetType = TARGET_OPEN;
    targetValue = 0;
    targetValueLow = 0;
  }
  w.u8(targetType);
  w.u32le(targetValue);
  w.u32le(targetValueLow);

  // intensity
  w.u8(intensityForType(step.segmentType));

  return w.bytes();
}

// ── FIT file header ───────────────────────────────────────────────────────────

function fitHeader(dataSize: number): Uint8Array {
  const w = new Writer();
  w.u8(14);           // header size
  w.u8(0x10);         // protocol version 1.0
  w.u16le(2132);      // profile version 21.32
  w.u32le(dataSize);  // data size (excludes header + header CRC)
  // data type ".FIT"
  w.u8(0x2e); w.u8(0x46); w.u8(0x49); w.u8(0x54);
  // header CRC (over first 12 bytes)
  const hdr = w.bytes();
  const crc = fitCrc(hdr);
  const out = new Writer();
  out.u8(14); out.u8(0x10); out.u16le(2132); out.u32le(dataSize);
  out.u8(0x2e); out.u8(0x46); out.u8(0x49); out.u8(0x54);
  out.u16le(crc);
  return out.bytes();
}

// ── FIT epoch ────────────────────────────────────────────────────────────────

// FIT timestamp = seconds since 1989-12-31 00:00:00 UTC
const FIT_EPOCH = Date.UTC(1989, 11, 31, 0, 0, 0) / 1000;

function fitTimestamp(): number {
  return Math.floor(Date.now() / 1000) - FIT_EPOCH;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function buildFitWorkout(workoutName: string, steps: FitWorkoutStep[]): Buffer {
  const ts = fitTimestamp();

  const parts: Uint8Array[] = [];

  // definitions
  parts.push(fileIdDefinition());
  parts.push(fileIdData(ts));
  parts.push(workoutDefinition());
  parts.push(workoutData(workoutName, steps.length));
  parts.push(workoutStepDefinition());

  // steps
  steps.forEach((step, i) => {
    parts.push(workoutStepData(step, i));
  });

  // combine data section
  const dataLen = parts.reduce((n, p) => n + p.length, 0);
  const data = new Uint8Array(dataLen);
  let offset = 0;
  for (const p of parts) {
    data.set(p, offset);
    offset += p.length;
  }

  // header
  const header = fitHeader(dataLen);

  // final file = header + data + file CRC
  const crc = fitCrc(data);
  const crcBytes = new Uint8Array(2);
  crcBytes[0] = crc & 0xff;
  crcBytes[1] = (crc >> 8) & 0xff;

  return Buffer.concat([header, data, crcBytes]);
}

/** Convert a week plan (with runs+segments) to a flat list of FIT workout steps. */
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
        distanceKm: seg.distanceKm ?? null,
        pace: seg.pace ?? null,
        segmentType: seg.segmentType ?? null,
      });
    }
  }
  return steps;
}
