import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Activity, Heart, Footprints, User, Watch } from "lucide-react";

interface GarminActivity {
  activityId: number;
  activityName: string;
  activityType?: { typeKey: string };
  startTimeLocal: string;
  distance?: number;
  duration?: number;
  averageHR?: number;
  averageSpeed?: number;
  calories?: number;
}

interface GarminData {
  profile: {
    displayName?: string;
    fullName?: string;
    location?: string;
    profileImageUrlLarge?: string;
  } | null;
  settings: {
    userData?: {
      weight?: number;
      height?: number;
      gender?: string;
      birthDate?: string;
    };
    userInfo?: { email?: string };
  } | null;
  activities: GarminActivity[];
  steps: number | null;
  heartRate: {
    restingHeartRate?: number;
    maxHeartRate?: number;
    minHeartRate?: number;
    heartRateValues?: [number, number | null][];
  } | null;
}

interface PushResult {
  workoutId: string;
  workoutName: string;
  stepCount: number;
}

interface WorkoutSummary {
  workoutId: number;
  workoutName: string;
  sportType: string;
  stepCount: number | null;
  createdDate: string | null;
  updatedDate: string | null;
}

interface StepDiffEntry {
  key: string;
  yallajog: unknown;
  library: unknown;
}

interface CompareResult {
  yallajog: { workoutId: number | null; workoutName: string | null; detail: object | null };
  library:  { workoutId: number | null; workoutName: string | null; detail: object | null };
  stepDiff: StepDiffEntry[];
  note: string;
}

interface DateDiffEntry { key: string; working: unknown; yallajog: unknown; }
interface DateStepDiff  { stepIndex: number; diff: DateDiffEntry[]; note?: string; }
interface DateCompareSummary {
  topLevelDiffCount: number;
  stepCount: { working: number; yallajog: number };
  stepTypes: { working: string[]; yallajog: string[] };
  endConditions: { working: string[]; yallajog: string[] };
}
interface DateCompareResult {
  working:      { workoutId: number; workoutName: string; createdDate: string; detail: object | null };
  yallajog:     { workoutId: number | null; workoutName: string | null; detail: object | null };
  topLevelDiff: DateDiffEntry[];
  stepDiffs:    DateStepDiff[];
  summary:      DateCompareSummary;
}

function fmtDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
}

function fmtDistance(meters: number) {
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
  return `${Math.round(meters)} m`;
}

function fmtPace(metersPerSec: number) {
  const minPerKm = 1000 / 60 / metersPerSec;
  const m = Math.floor(minPerKm);
  const s = Math.round((minPerKm - m) * 60);
  return `${m}:${s.toString().padStart(2, "0")} /km`;
}

export default function GarminTestPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [data, setData]         = useState<GarminData | null>(null);

  const [pushLoading, setPushLoading]       = useState(false);
  const [pushError, setPushError]           = useState<string | null>(null);
  const [pushResult, setPushResult]         = useState<PushResult | null>(null);

  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupError, setCleanupError]     = useState<string | null>(null);
  const [cleanupResult, setCleanupResult]   = useState<{ total: number; deleted: number; failed: number } | null>(null);

  const [minimalLoading, setMinimalLoading] = useState(false);
  const [minimalError, setMinimalError]     = useState<string | null>(null);
  const [minimalResult, setMinimalResult]   = useState<PushResult | null>(null);

  const [simpleLoading, setSimpleLoading] = useState(false);
  const [simpleError, setSimpleError]     = useState<string | null>(null);
  const [simpleResult, setSimpleResult]   = useState<{ workoutId: string; workoutName: string } | null>(null);

  const [detailId, setDetailId]           = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError]     = useState<string | null>(null);
  const [detailJson, setDetailJson]       = useState<object | null>(null);

  const [listLoading, setListLoading]     = useState(false);
  const [listError, setListError]         = useState<string | null>(null);
  const [workoutList, setWorkoutList]     = useState<WorkoutSummary[] | null>(null);

  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError]     = useState<string | null>(null);
  const [compareResult, setCompareResult]   = useState<CompareResult | null>(null);

  const [cloneLoading, setCloneLoading] = useState(false);
  const [cloneError, setCloneError]     = useState<string | null>(null);
  const [cloneResult, setCloneResult]   = useState<object | null>(null);

  const [pafLoading, setPafLoading] = useState(false);
  const [pafError, setPafError]     = useState<string | null>(null);
  const [pafResult, setPafResult]   = useState<object | null>(null);

  const [dateCompareDate, setDateCompareDate]     = useState("2026-06-18");
  const [dateCompareLoading, setDateCompareLoading] = useState(false);
  const [dateCompareError, setDateCompareError]   = useState<string | null>(null);
  const [dateCompareResult, setDateCompareResult] = useState<DateCompareResult | null>(null);

  async function handlePushSimple() {
    if (!username || !password) return;
    setSimpleLoading(true); setSimpleError(null); setSimpleResult(null);
    try {
      const res  = await fetch("/api/garmin-test/push-running-simple", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Unknown error");
      setSimpleResult(json);
    } catch (err) {
      setSimpleError(err instanceof Error ? err.message : String(err));
    } finally { setSimpleLoading(false); }
  }

  async function handleFetchDetail() {
    if (!username || !password || !detailId.trim()) return;
    setDetailLoading(true); setDetailError(null); setDetailJson(null);
    try {
      const res  = await fetch("/api/garmin-test/workout-detail", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, workoutId: Number(detailId.trim()) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Unknown error");
      setDetailJson(json);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : String(err));
    } finally { setDetailLoading(false); }
  }

  async function handleListWorkouts() {
    if (!username || !password) return;
    setListLoading(true); setListError(null); setWorkoutList(null);
    try {
      const res  = await fetch("/api/garmin-test/list-workouts", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Unknown error");
      setWorkoutList(json as WorkoutSummary[]);
    } catch (err) {
      setListError(err instanceof Error ? err.message : String(err));
    } finally { setListLoading(false); }
  }

  const [strippedLoading, setStrippedLoading] = useState(false);
  const [strippedError, setStrippedError]     = useState<string | null>(null);
  const [strippedResult, setStrippedResult]   = useState<object | null>(null);

  async function handlePushStripped() {
    if (!username || !password) return;
    setStrippedLoading(true); setStrippedError(null); setStrippedResult(null);
    try {
      const res = await fetch("/api/garmin-test/push-stripped", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Unknown error");
      setStrippedResult(json);
    } catch (err) {
      setStrippedError(err instanceof Error ? err.message : String(err));
    } finally { setStrippedLoading(false); }
  }

  async function handlePushClonedTemplate() {
    if (!username || !password) return;
    setCloneLoading(true); setCloneError(null); setCloneResult(null);
    try {
      const res = await fetch("/api/garmin-test/push-cloned-template", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Unknown error");
      setCloneResult(json);
    } catch (err) {
      setCloneError(err instanceof Error ? err.message : String(err));
    } finally { setCloneLoading(false); }
  }

  async function handlePushAndFetch() {
    if (!username || !password) return;
    setPafLoading(true); setPafError(null); setPafResult(null);
    try {
      const res = await fetch("/api/garmin-test/push-and-fetch", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Unknown error");
      setPafResult(json);
    } catch (err) {
      setPafError(err instanceof Error ? err.message : String(err));
    } finally { setPafLoading(false); }
  }

  async function handleAutoCompare() {
    if (!username || !password) return;
    setCompareLoading(true); setCompareError(null); setCompareResult(null);
    try {
      const res  = await fetch("/api/garmin-test/auto-compare", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Unknown error");
      setCompareResult(json as CompareResult);
    } catch (err) {
      setCompareError(err instanceof Error ? err.message : String(err));
    } finally { setCompareLoading(false); }
  }

  async function handleDateCompare() {
    if (!username || !password || !dateCompareDate.trim()) return;
    setDateCompareLoading(true); setDateCompareError(null); setDateCompareResult(null);
    try {
      const res  = await fetch("/api/garmin-test/compare-with-date", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, targetDate: dateCompareDate.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? String(json));
      setDateCompareResult(json as DateCompareResult);
    } catch (err) {
      setDateCompareError(err instanceof Error ? err.message : String(err));
    } finally { setDateCompareLoading(false); }
  }

  async function handlePushMinimal() {
    if (!username || !password) return;
    setMinimalLoading(true);
    setMinimalError(null);
    setMinimalResult(null);
    try {
      const res = await fetch("/api/garmin-test/push-minimal", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Unknown error");
      setMinimalResult(json as PushResult);
    } catch (err) {
      setMinimalError(err instanceof Error ? err.message : String(err));
    } finally {
      setMinimalLoading(false);
    }
  }

  async function handleCleanup() {
    if (!username || !password) return;
    setCleanupLoading(true);
    setCleanupError(null);
    setCleanupResult(null);
    try {
      const res = await fetch("/api/garmin-test/delete-all-workouts", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Unknown error");
      setCleanupResult(json);
    } catch (err) {
      setCleanupError(err instanceof Error ? err.message : String(err));
    } finally {
      setCleanupLoading(false);
    }
  }

  async function handleFetch() {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch("/api/garmin-test/fetch", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Unknown error");
      setData(json as GarminData);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handlePushFadiTest() {
    if (!username || !password) return;
    setPushLoading(true);
    setPushError(null);
    setPushResult(null);
    try {
      const res = await fetch("/api/garmin-test/push-fadi-test", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Unknown error");
      setPushResult(json as PushResult);
    } catch (err) {
      setPushError(err instanceof Error ? err.message : String(err));
    } finally {
      setPushLoading(false);
    }
  }

  const profile    = data?.profile;
  const settings   = data?.settings;
  const activities = data?.activities ?? [];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Garmin Connect - Test</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Unofficial login via reverse-engineered API. For testing only.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Garmin Connect Credentials</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="garmin@email.com"
                value={username}
                onChange={e => setUsername(e.target.value)}
                disabled={loading || pushLoading}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Password</Label>
              <Input
                type="password"
                placeholder="........"
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={loading || pushLoading}
                onKeyDown={e => e.key === "Enter" && handleFetch()}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleFetch} disabled={loading || !username || !password}>
              {loading
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Connecting...</>
                : "Fetch Data"}
            </Button>
            <Button
              variant="outline"
              onClick={handlePushFadiTest}
              disabled={pushLoading || !username || !password}
              className="gap-2"
            >
              {pushLoading
                ? <><Loader2 className="h-4 w-4 animate-spin" />Pushing...</>
                : <><Watch className="h-4 w-4" />Push Test Plan (Fadi Karkaby)</>}
            </Button>
            <Button
              variant="secondary"
              onClick={handlePushMinimal}
              disabled={minimalLoading || !username || !password}
              className="gap-2"
            >
              {minimalLoading
                ? <><Loader2 className="h-4 w-4 animate-spin" />Pushing...</>
                : "Push Minimal Test (3 steps, no pace)"}
            </Button>
            <Button
              variant="destructive"
              onClick={handleCleanup}
              disabled={cleanupLoading || !username || !password}
              className="gap-2"
            >
              {cleanupLoading
                ? <><Loader2 className="h-4 w-4 animate-spin" />Deleting...</>
                : "Delete All YallaJog Workouts from Garmin"}
            </Button>
            <Button
              variant="outline"
              onClick={handlePushSimple}
              disabled={simpleLoading || !username || !password}
              className="gap-2 border-orange-300 text-orange-700 hover:bg-orange-50"
            >
              {simpleLoading
                ? <><Loader2 className="h-4 w-4 animate-spin" />Pushing...</>
                : "Push Library Simple Run (diagnostic)"}
            </Button>
            <Button
              variant="outline"
              onClick={handleListWorkouts}
              disabled={listLoading || !username || !password}
              className="gap-2 border-blue-300 text-blue-700 hover:bg-blue-50"
            >
              {listLoading
                ? <><Loader2 className="h-4 w-4 animate-spin" />Loading...</>
                : "List All Garmin Workouts"}
            </Button>
            <Button
              variant="outline"
              onClick={handleAutoCompare}
              disabled={compareLoading || !username || !password}
              className="gap-2 border-purple-300 text-purple-700 hover:bg-purple-50"
            >
              {compareLoading
                ? <><Loader2 className="h-4 w-4 animate-spin" />Comparing...</>
                : "Auto-Compare Structures"}
            </Button>
            <Button
              variant="outline"
              onClick={handlePushStripped}
              disabled={strippedLoading || !username || !password}
              className="gap-2 border-yellow-500 text-yellow-700 hover:bg-yellow-50 font-semibold"
            >
              {strippedLoading
                ? <><Loader2 className="h-4 w-4 animate-spin" />Pushing...</>
                : "Push Stripped (no strokeType/equipmentType — mobile test)"}
            </Button>
            <Button
              variant="outline"
              onClick={handlePushClonedTemplate}
              disabled={cloneLoading || !username || !password}
              className="gap-2 border-green-500 text-green-700 hover:bg-green-50 font-semibold"
            >
              {cloneLoading
                ? <><Loader2 className="h-4 w-4 animate-spin" />Cloning...</>
                : "Push Cloned Template (copy manually-created workout fields)"}
            </Button>
            <Button
              variant="outline"
              onClick={handlePushAndFetch}
              disabled={pafLoading || !username || !password}
              className="gap-2 border-teal-400 text-teal-700 hover:bg-teal-50"
            >
              {pafLoading
                ? <><Loader2 className="h-4 w-4 animate-spin" />Pushing...</>
                : "Push + Fetch (see what Garmin actually stored)"}
            </Button>
          </div>

          <div className="border-t pt-4 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Deep compare: find workout by creation date and diff every field vs latest YallaJog</p>
            <div className="flex gap-2 items-center">
              <Input
                type="date"
                value={dateCompareDate}
                onChange={e => setDateCompareDate(e.target.value)}
                className="max-w-44"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleDateCompare}
                disabled={dateCompareLoading || !username || !password || !dateCompareDate.trim()}
                className="border-red-300 text-red-700 hover:bg-red-50"
              >
                {dateCompareLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Compare with this date"}
              </Button>
            </div>
          </div>

          <div className="border-t pt-4 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Fetch workout detail by ID (paste any workoutId from a push result)</p>
            <div className="flex gap-2">
              <Input
                placeholder="Workout ID (e.g. 1609993835)"
                value={detailId}
                onChange={e => setDetailId(e.target.value)}
                className="max-w-64 font-mono text-sm"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleFetchDetail}
                disabled={detailLoading || !username || !password || !detailId.trim()}
              >
                {detailLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Fetch Detail"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {simpleError && (
        <Alert variant="destructive">
          <AlertDescription>{simpleError}</AlertDescription>
        </Alert>
      )}

      {simpleResult && (
        <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-950/30">
          <AlertDescription>
            <p className="font-medium">Library simple run pushed — <strong>{simpleResult.workoutName}</strong></p>
            {simpleResult.workoutId && (
              <p className="text-xs mt-1 font-mono">Workout ID: {simpleResult.workoutId}</p>
            )}
            <p className="text-xs mt-1 text-muted-foreground">
              Open Garmin Connect mobile → Training → Workouts.
              If THIS one loads but our workouts don't, the issue is in our step structure.
              If this also shows a loading screen, it's a Garmin app/account limitation.
            </p>
          </AlertDescription>
        </Alert>
      )}

      {strippedError && (
        <Alert variant="destructive"><AlertDescription>{strippedError}</AlertDescription></Alert>
      )}
      {strippedResult && (
        <Alert className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/30">
          <AlertDescription>
            <p className="font-medium text-yellow-800">Stripped workout pushed (no strokeType/equipmentType)!</p>
            <pre className="text-xs mt-2 whitespace-pre-wrap font-mono overflow-auto max-h-40">{JSON.stringify(strippedResult, null, 2)}</pre>
            <p className="text-xs mt-2 text-muted-foreground font-semibold text-yellow-700">This workout was SCHEDULED to today. Open Garmin Connect mobile → Calendar → tap today → tap the workout. Do NOT open from Training → Workouts (library view has a known Garmin bug for API-pushed workouts).</p>
          </AlertDescription>
        </Alert>
      )}

      {cloneError && (
        <Alert variant="destructive"><AlertDescription>{cloneError}</AlertDescription></Alert>
      )}
      {cloneResult && (
        <Alert className="border-green-200 bg-green-50 dark:bg-green-950/30">
          <AlertDescription>
            <p className="font-medium text-green-800">Cloned template pushed!</p>
            <pre className="text-xs mt-2 whitespace-pre-wrap font-mono overflow-auto max-h-40">{JSON.stringify(cloneResult, null, 2)}</pre>
            <p className="text-xs mt-2 text-muted-foreground">Open Garmin Connect mobile → Training → Workouts and tap this workout. If it opens — the fix is copying the template's top-level fields. If it also fails — the issue is in the step structure.</p>
          </AlertDescription>
        </Alert>
      )}

      {pafError && (
        <Alert variant="destructive"><AlertDescription>{pafError}</AlertDescription></Alert>
      )}
      {pafResult && (
        <Alert className="border-teal-200 bg-teal-50 dark:bg-teal-950/30">
          <AlertDescription>
            <p className="font-medium text-teal-800">Push + Fetch result — what Garmin actually stored:</p>
            <pre className="text-xs mt-2 whitespace-pre-wrap font-mono overflow-auto max-h-64">{JSON.stringify(pafResult, null, 2)}</pre>
          </AlertDescription>
        </Alert>
      )}

      {dateCompareError && (
        <Alert variant="destructive"><AlertDescription>{dateCompareError}</AlertDescription></Alert>
      )}

      {dateCompareResult && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              Deep Compare: <span className="text-muted-foreground font-normal">{dateCompareResult.working.workoutName}</span> vs <span className="text-muted-foreground font-normal">{dateCompareResult.yallajog.workoutName ?? "YallaJog"}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded border p-2 space-y-1">
                <p className="font-semibold">Working workout</p>
                <p className="text-muted-foreground font-mono">{dateCompareResult.working.workoutId}</p>
                <p>Steps: {dateCompareResult.summary.stepCount.working} — {dateCompareResult.summary.stepTypes.working.join(", ")}</p>
                <p>Conditions: {dateCompareResult.summary.endConditions.working.join(", ")}</p>
              </div>
              <div className="rounded border p-2 space-y-1">
                <p className="font-semibold">YallaJog workout</p>
                <p className="text-muted-foreground font-mono">{dateCompareResult.yallajog.workoutId}</p>
                <p>Steps: {dateCompareResult.summary.stepCount.yallajog} — {dateCompareResult.summary.stepTypes.yallajog.join(", ")}</p>
                <p>Conditions: {dateCompareResult.summary.endConditions.yallajog.join(", ")}</p>
              </div>
            </div>

            {/* Top-level diff */}
            {dateCompareResult.topLevelDiff.length > 0 && (
              <div>
                <p className="text-xs font-semibold mb-1">Top-level field differences ({dateCompareResult.topLevelDiff.length})</p>
                <div className="rounded border overflow-hidden">
                  <table className="w-full text-[10px]">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-2 py-1 text-left">Field</th>
                        <th className="px-2 py-1 text-left">Working</th>
                        <th className="px-2 py-1 text-left">YallaJog</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y font-mono">
                      {dateCompareResult.topLevelDiff.map(d => (
                        <tr key={d.key} className="hover:bg-muted/50">
                          <td className="px-2 py-1 font-sans font-medium">{d.key}</td>
                          <td className="px-2 py-1">{JSON.stringify(d.working)}</td>
                          <td className="px-2 py-1">{JSON.stringify(d.yallajog)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {dateCompareResult.topLevelDiff.length === 0 && (
              <p className="text-xs text-green-700">Top-level fields identical</p>
            )}

            {/* Step diffs */}
            {dateCompareResult.stepDiffs.map(sd => (
              <div key={sd.stepIndex}>
                <p className="text-xs font-semibold mb-1">
                  Step {sd.stepIndex} {sd.note ? `— ${sd.note}` : `— ${sd.diff.length} field(s) differ`}
                </p>
                {sd.diff.length > 0 && (
                  <div className="rounded border overflow-hidden">
                    <table className="w-full text-[10px]">
                      <thead className="bg-muted">
                        <tr>
                          <th className="px-2 py-1 text-left">Field</th>
                          <th className="px-2 py-1 text-left">Working</th>
                          <th className="px-2 py-1 text-left">YallaJog</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y font-mono">
                        {sd.diff.map(d => (
                          <tr key={d.key} className="hover:bg-muted/50">
                            <td className="px-2 py-1 font-sans font-medium">{d.key}</td>
                            <td className="px-2 py-1">{JSON.stringify(d.working)}</td>
                            <td className="px-2 py-1">{JSON.stringify(d.yallajog)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {sd.diff.length === 0 && !sd.note && <p className="text-xs text-green-700">Identical</p>}
              </div>
            ))}

            {/* Full JSON side by side */}
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Full JSON comparison</summary>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div>
                  <p className="font-semibold mb-1">Working workout</p>
                  <pre className="bg-muted p-2 rounded overflow-auto max-h-64 text-[9px]">{JSON.stringify(dateCompareResult.working.detail, null, 2)}</pre>
                </div>
                <div>
                  <p className="font-semibold mb-1">YallaJog workout</p>
                  <pre className="bg-muted p-2 rounded overflow-auto max-h-64 text-[9px]">{JSON.stringify(dateCompareResult.yallajog.detail, null, 2)}</pre>
                </div>
              </div>
            </details>
          </CardContent>
        </Card>
      )}

      {listError && (
        <Alert variant="destructive"><AlertDescription>{listError}</AlertDescription></Alert>
      )}

      {workoutList && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">All Garmin Workouts ({workoutList.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y text-xs max-h-72 overflow-y-auto">
              {workoutList.length === 0 ? (
                <p className="text-muted-foreground py-2">No workouts found.</p>
              ) : workoutList.map(w => (
                <div key={w.workoutId} className="py-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{w.workoutName}</p>
                    <p className="text-muted-foreground font-mono">{w.workoutId} · {w.sportType} · {w.stepCount ?? "?"} steps</p>
                  </div>
                  <Button size="sm" variant="ghost" className="text-xs shrink-0"
                    onClick={() => { setDetailId(String(w.workoutId)); }}>
                    Copy ID
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {compareError && (
        <Alert variant="destructive"><AlertDescription>{compareError}</AlertDescription></Alert>
      )}

      {compareResult && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Auto-Compare Result</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className={compareResult.stepDiff.length === 0 ? "border-green-300 bg-green-50" : "border-yellow-300 bg-yellow-50"}>
              <AlertDescription className="font-medium">{compareResult.note}</AlertDescription>
            </Alert>

            {compareResult.stepDiff.length > 0 && (
              <div>
                <p className="text-xs font-semibold mb-2">First-step field differences (YallaJog vs Library):</p>
                <div className="rounded border overflow-hidden">
                  <table className="w-full text-[10px]">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-2 py-1 text-left font-medium">Field</th>
                        <th className="px-2 py-1 text-left font-medium">YallaJog</th>
                        <th className="px-2 py-1 text-left font-medium">Library</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y font-mono">
                      {compareResult.stepDiff.map(d => (
                        <tr key={d.key} className="hover:bg-muted/50">
                          <td className="px-2 py-1 font-sans font-medium">{d.key}</td>
                          <td className="px-2 py-1">{JSON.stringify(d.yallajog)}</td>
                          <td className="px-2 py-1">{JSON.stringify(d.library)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-semibold mb-1">YallaJog workout full JSON</p>
                <pre className="bg-muted p-2 rounded overflow-auto max-h-64 text-[9px]">
                  {JSON.stringify(compareResult.yallajog.detail, null, 2)}
                </pre>
              </div>
              <div>
                <p className="text-xs font-semibold mb-1">Library workout full JSON</p>
                <pre className="bg-muted p-2 rounded overflow-auto max-h-64 text-[9px]">
                  {JSON.stringify(compareResult.library.detail, null, 2)}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {detailError && (
        <Alert variant="destructive">
          <AlertDescription>{detailError}</AlertDescription>
        </Alert>
      )}

      {detailJson && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Workout Detail JSON (what Garmin stores)</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-3 rounded overflow-auto max-h-[500px] text-[10px] leading-relaxed">
              {JSON.stringify(detailJson, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      {minimalError && (
        <Alert variant="destructive">
          <AlertDescription>{minimalError}</AlertDescription>
        </Alert>
      )}

      {minimalResult && (
        <Alert>
          <AlertDescription>
            Minimal workout pushed — <strong>{minimalResult.workoutName}</strong> ({minimalResult.stepCount} steps, no pace targets).
            Check Garmin Connect mobile → Training → Workouts. If this opens, the issue is with pace zone values.
          </AlertDescription>
        </Alert>
      )}

      {cleanupError && (
        <Alert variant="destructive">
          <AlertDescription>{cleanupError}</AlertDescription>
        </Alert>
      )}

      {cleanupResult && (
        <Alert>
          <AlertDescription>
            Cleanup done — found {cleanupResult.total} YallaJog workout{cleanupResult.total !== 1 ? "s" : ""},{" "}
            deleted {cleanupResult.deleted}{cleanupResult.failed > 0 ? `, ${cleanupResult.failed} failed` : ""}.
            {cleanupResult.deleted > 0 && " Now push a fresh workout."}
          </AlertDescription>
        </Alert>
      )}

      {pushError && (
        <Alert variant="destructive">
          <AlertDescription>{pushError}</AlertDescription>
        </Alert>
      )}

      {pushResult && (
        <Card className="border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-900">
          <CardContent className="pt-4 space-y-3">
            <p className="text-sm font-medium text-green-800 dark:text-green-300">
              Test workout pushed successfully
            </p>
            <p className="text-sm text-green-700 dark:text-green-400">
              <strong>{pushResult.workoutName}</strong> — {pushResult.stepCount} steps
            </p>
            {pushResult.workoutId && (
              <p className="text-xs text-green-600 dark:text-green-500">
                Workout ID: {pushResult.workoutId}
              </p>
            )}
            <div className="rounded-md border bg-white/60 dark:bg-black/20 p-3 space-y-1">
              <p className="text-xs font-medium">Steps in this test plan:</p>
              <ol className="text-xs text-muted-foreground space-y-0.5 list-decimal list-inside">
                <li>Warmup — 10 min easy jog</li>
                <li>Interval — 1 km @ 4:30 /km pace zone</li>
                <li>Rest — 2 min</li>
                <li>Interval — 1 km @ 4:30 /km pace zone</li>
                <li>Cool down — 10 min easy jog</li>
              </ol>
            </div>
            <p className="text-xs text-muted-foreground">
              Open Garmin Connect app on mobile → Training → Workouts to verify it loads correctly.
            </p>
          </CardContent>
        </Card>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {data && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4" /> Profile
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                {profile?.profileImageUrlLarge && (
                  <img
                    src={profile.profileImageUrlLarge}
                    alt="avatar"
                    className="h-14 w-14 rounded-full object-cover border"
                  />
                )}
                <div className="space-y-1">
                  <p className="font-medium">{profile?.fullName ?? profile?.displayName ?? "-"}</p>
                  {profile?.location && <p className="text-sm text-muted-foreground">{profile.location}</p>}
                  {settings?.userInfo?.email && (
                    <p className="text-sm text-muted-foreground">{settings.userInfo.email}</p>
                  )}
                  {settings?.userData && (
                    <div className="flex gap-3 text-xs text-muted-foreground pt-1">
                      {settings.userData.gender    && <span>{settings.userData.gender}</span>}
                      {settings.userData.weight    && <span>{(settings.userData.weight / 1000).toFixed(1)} kg</span>}
                      {settings.userData.height    && <span>{settings.userData.height} cm</span>}
                      {settings.userData.birthDate && <span>Born {settings.userData.birthDate}</span>}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="pt-4 flex items-center gap-3">
                <Footprints className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{data.steps?.toLocaleString() ?? "-"}</p>
                  <p className="text-xs text-muted-foreground">Steps today</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 flex items-center gap-3">
                <Heart className="h-8 w-8 text-red-500" />
                <div>
                  <p className="text-2xl font-bold">{data.heartRate?.restingHeartRate ?? "-"}</p>
                  <p className="text-xs text-muted-foreground">Resting HR (bpm)</p>
                  {data.heartRate?.minHeartRate != null && data.heartRate?.maxHeartRate != null && (
                    <p className="text-xs text-muted-foreground">
                      {data.heartRate.minHeartRate}–{data.heartRate.maxHeartRate} bpm range
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4" /> Recent Activities
                <Badge variant="secondary">{activities.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activities.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activities found.</p>
              ) : (
                <div className="divide-y">
                  {activities.map(act => (
                    <div key={act.activityId} className="py-3 flex items-start justify-between gap-4">
                      <div className="space-y-0.5 min-w-0">
                        <p className="font-medium text-sm truncate">{act.activityName}</p>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span>{new Date(act.startTimeLocal).toLocaleDateString()}</span>
                          {act.activityType?.typeKey && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {act.activityType.typeKey}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-right text-xs text-muted-foreground shrink-0 space-y-0.5">
                        {act.distance != null && act.distance > 0 && <p>{fmtDistance(act.distance)}</p>}
                        {act.duration != null && <p>{fmtDuration(act.duration)}</p>}
                        {act.averageSpeed != null && act.averageSpeed > 0 && <p>{fmtPace(act.averageSpeed)}</p>}
                        {act.averageHR != null && <p>{act.averageHR} bpm avg</p>}
                        {act.calories != null  && <p>{act.calories} kcal</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              View raw JSON response
            </summary>
            <pre className="mt-2 bg-muted p-3 rounded overflow-auto max-h-96 text-[10px]">
              {JSON.stringify(data, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
