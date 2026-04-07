import { useState } from "react";
import { Link, useParams } from "wouter";
import {
  useListTrainees,
  useGetTraineeCurrentWeekPlan,
  useListWeekPlans,
  useListSegments,
  useCreateWeekPlan,
  useUpdateRun,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarDays, Users, ArrowLeft, Plus, Pencil, Clock, Gauge, Ruler, CheckCircle2, Circle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

const RUN_TYPES = ["Tempo", "Interval", "Recovery", "Up Hill", "Long Run"] as const;

const SEGMENT_TYPES = ["Warm-up", "Main Set", "Interval", "Recovery", "Cool-down", "Stride", "Strength"] as const;
type SegmentType = typeof SEGMENT_TYPES[number];

const SEGMENT_TYPE_STYLES: Record<SegmentType, string> = {
  "Warm-up":   "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800",
  "Main Set":  "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  "Interval":  "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800",
  "Recovery":  "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800",
  "Cool-down": "bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800",
  "Stride":    "bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-800",
  "Strength":  "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800",
};

function formatDistance(km: number | null | undefined) {
  if (km == null) return null;
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${km}km`;
}

function SegmentDetails({ seg, completed }: { seg: any; completed: boolean }) {
  const hasDuration = seg.durationMinutes != null;
  const hasDistance = seg.distanceKm != null;
  const hasPace = seg.pace != null && seg.pace !== "";
  const segType = seg.segmentType as SegmentType | null | undefined;
  const typeStyle = segType ? SEGMENT_TYPE_STYLES[segType] : null;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 flex-wrap">
        {typeStyle && (
          <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full border font-medium transition-opacity ${completed ? "opacity-30" : typeStyle}`}>
            {segType}
          </span>
        )}
        <span className={`text-sm font-medium transition-all ${completed ? "line-through text-muted-foreground" : ""}`}>
          {seg.resolvedText}
        </span>
      </div>
      {(hasDuration || hasDistance || hasPace) && (
        <div className="flex flex-wrap gap-1.5">
          {hasDuration && (
            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full transition-opacity ${completed ? "opacity-40" : "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"}`}>
              <Clock className="h-3 w-3" />
              {seg.durationMinutes} min
            </span>
          )}
          {hasDistance && (
            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full transition-opacity ${completed ? "opacity-40" : "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300"}`}>
              <Ruler className="h-3 w-3" />
              {formatDistance(seg.distanceKm)}
            </span>
          )}
          {hasPace && (
            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full transition-opacity ${completed ? "opacity-40" : "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"}`}>
              <Gauge className="h-3 w-3" />
              {seg.pace} /km
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function SegmentRow({
  seg,
  weekPlanId,
  runId,
}: {
  seg: any;
  weekPlanId: number;
  runId: number;
}) {
  const [completed, setCompleted] = useState<boolean>(seg.completed ?? false);
  const [busy, setBusy] = useState(false);

  async function handleToggle() {
    if (busy) return;
    const next = !completed;
    setBusy(true);
    setCompleted(next);
    try {
      await fetch(`/api/week-plans/${weekPlanId}/runs/${runId}/segments/${seg.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: next }),
      });
    } catch {
      setCompleted(!next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`px-4 py-2.5 flex items-start gap-3 transition-colors ${completed ? "bg-muted/20" : ""}`}>
      <button
        onClick={handleToggle}
        disabled={busy}
        className="mt-0.5 shrink-0 transition-colors disabled:opacity-50"
        aria-label={completed ? "Mark incomplete" : "Mark complete"}
      >
        {completed
          ? <CheckCircle2 className="h-5 w-5 text-green-500" />
          : <Circle className="h-5 w-5 text-muted-foreground hover:text-primary" />}
      </button>
      <SegmentDetails seg={seg} completed={completed} />
    </div>
  );
}

type EditableSegment = {
  id?: number;
  resolvedText: string;
  segmentType: string;
  durationMinutes: string;
  distanceKm: string;
  pace: string;
  order: number;
};

function EditRunDialog({
  run,
  weekPlanId,
  onSuccess,
}: {
  run: any;
  weekPlanId: number;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(run.name ?? "");
  const [runType, setRunType] = useState(run.runType);
  const [segments, setSegments] = useState<EditableSegment[]>(
    (run.segments ?? []).map((s: any) => ({
      id: s.id,
      resolvedText: s.resolvedText,
      segmentType: s.segmentType ?? "",
      durationMinutes: s.durationMinutes != null ? String(s.durationMinutes) : "",
      distanceKm: s.distanceKm != null ? String(s.distanceKm) : "",
      pace: s.pace ?? "",
      order: s.order,
    }))
  );

  const mutation = useUpdateRun();

  function addSegment() {
    setSegments([
      ...segments,
      { resolvedText: "", segmentType: "", durationMinutes: "", distanceKm: "", pace: "", order: segments.length + 1 },
    ]);
  }

  function removeSegment(idx: number) {
    setSegments(segments.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i + 1 })));
  }

  function updateSeg(idx: number, field: keyof EditableSegment, value: string) {
    setSegments(segments.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await mutation.mutateAsync({
        id: weekPlanId,
        runId: run.id,
        data: {
          name: name || undefined,
          runType,
          order: run.order,
          segments: segments.map((s, i) => ({
            segmentId: undefined,
            resolvedText: s.resolvedText,
            segmentType: s.segmentType !== "" ? s.segmentType : null,
            durationMinutes: s.durationMinutes !== "" ? Number(s.durationMinutes) : null,
            distanceKm: s.distanceKm !== "" ? Number(s.distanceKm) : null,
            pace: s.pace !== "" ? s.pace : null,
            order: i + 1,
          })),
        },
      });
      toast({ title: "Run updated" });
      setOpen(false);
      onSuccess();
    } catch {
      toast({ title: "Failed to update run", variant: "destructive" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-2">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Run</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Run Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Optional name"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Type</Label>
              <Select value={runType} onValueChange={setRunType}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RUN_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm">Segments</Label>
              <Button type="button" variant="outline" size="sm" onClick={addSegment}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Segment
              </Button>
            </div>
            <div className="space-y-2">
              {segments.map((seg, idx) => (
                <div key={idx} className="border rounded-lg p-3 space-y-2 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Segment {idx + 1}</span>
                    {segments.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                        onClick={() => removeSegment(idx)}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Segment Type</Label>
                      <Select
                        value={seg.segmentType || "__none__"}
                        onValueChange={(v) => updateSeg(idx, "segmentType", v === "__none__" ? null : v)}
                      >
                        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="No type" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">No type</SelectItem>
                          {SEGMENT_TYPES.map((st) => <SelectItem key={st} value={st}>{st}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Description *</Label>
                      <Input
                        required
                        value={seg.resolvedText}
                        onChange={(e) => updateSeg(idx, "resolvedText", e.target.value)}
                        placeholder="e.g. 800m at 4:40 pace"
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Duration (min)
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        step={0.5}
                        value={seg.durationMinutes}
                        onChange={(e) => updateSeg(idx, "durationMinutes", e.target.value)}
                        placeholder="e.g. 8"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs flex items-center gap-1">
                        <Ruler className="h-3 w-3" /> Distance (km)
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        step={0.001}
                        value={seg.distanceKm}
                        onChange={(e) => updateSeg(idx, "distanceKm", e.target.value)}
                        placeholder="e.g. 0.8"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs flex items-center gap-1">
                        <Gauge className="h-3 w-3" /> Pace (min/km)
                      </Label>
                      <Input
                        value={seg.pace}
                        onChange={(e) => updateSeg(idx, "pace", e.target.value)}
                        placeholder="e.g. 4:40"
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TraineeCard({ trainee }: { trainee: any }) {
  return (
    <Link href={`/week-planner/${trainee.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
            {trainee.name?.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{trainee.name}</p>
            <p className="text-xs text-muted-foreground">{trainee.city ?? "No city"} · {trainee.runsPerWeek ?? 0} runs/wk</p>
          </div>
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
        </CardContent>
      </Card>
    </Link>
  );
}

export function WeekPlannerList() {
  const { t } = useTranslation();
  const { data: trainees, isLoading } = useListTrainees({});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("weekPlanner.title")}</h1>
        <p className="text-muted-foreground mt-1">{t("weekPlanner.subtitle")}</p>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : (trainees ?? []).length === 0 ? (
        <div className="flex flex-col items-center py-16 gap-2 text-muted-foreground">
          <Users className="h-10 w-10" />
          <p>{t("weekPlanner.noTrainees")}</p>
          <Link href="/trainees">
            <Button variant="outline" size="sm" className="mt-1">{t("weekPlanner.addTrainee")}</Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(trainees ?? []).map((trainee) => (
            <TraineeCard key={trainee.id} trainee={trainee} />
          ))}
        </div>
      )}
    </div>
  );
}

function CreateWeekPlanDialog({ traineeId, onSuccess }: { traineeId: number; onSuccess: () => void }) {
  const { toast } = useToast();
  const { data: segments } = useListSegments({});
  const [open, setOpen] = useState(false);
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date();
    const day = d.getDay();
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((day + 6) % 7));
    return monday.toISOString().slice(0, 10);
  });
  const [notes, setNotes] = useState("");
  const [runs, setRuns] = useState([
    { name: "", runType: "Tempo" as string, order: 1, segmentIds: [] as number[] },
  ]);

  const mutation = useCreateWeekPlan();

  function addRun() {
    setRuns([...runs, { name: "", runType: "Recovery", order: runs.length + 1, segmentIds: [] }]);
  }

  function removeRun(idx: number) {
    setRuns(runs.filter((_, i) => i !== idx).map((r, i) => ({ ...r, order: i + 1 })));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await mutation.mutateAsync({
        data: {
          traineeId,
          weekStart,
          notes: notes || undefined,
          runs: runs.map((r) => ({
            name: r.name || undefined,
            runType: r.runType,
            order: r.order,
            segmentIds: r.segmentIds,
          })),
        } as any,
      });
      toast({ title: "Week plan created" });
      setOpen(false);
      onSuccess();
    } catch {
      toast({ title: "Failed to create plan", variant: "destructive" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4 mr-2" /> Create Plan</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>New Week Plan</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Week Start (Monday) *</Label>
              <Input type="date" required value={weekStart} onChange={(e) => setWeekStart(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="General notes for this week..." rows={2} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <Label className="text-base">Runs ({runs.length})</Label>
              <Button type="button" variant="outline" size="sm" onClick={addRun}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Run
              </Button>
            </div>
            <div className="space-y-3">
              {runs.map((run, idx) => (
                <div key={idx} className="border rounded-lg p-3 space-y-2 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Run {run.order}</span>
                    {runs.length > 1 && (
                      <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-destructive hover:text-destructive" onClick={() => removeRun(idx)}>Remove</Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Run Name</Label>
                      <Input
                        value={run.name}
                        onChange={(e) => setRuns(runs.map((r, i) => i === idx ? { ...r, name: e.target.value } : r))}
                        placeholder="Optional name"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Type *</Label>
                      <Select value={run.runType} onValueChange={(v) => setRuns(runs.map((r, i) => i === idx ? { ...r, runType: v } : r))}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {RUN_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {segments && segments.length > 0 && (
                    <div className="space-y-1">
                      <Label className="text-xs">Segments</Label>
                      <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto border rounded p-2 bg-background">
                        {segments.map((seg) => (
                          <button
                            type="button"
                            key={seg.id}
                            onClick={() => {
                              const already = run.segmentIds.includes(seg.id);
                              setRuns(runs.map((r, i) => i === idx ? {
                                ...r,
                                segmentIds: already
                                  ? r.segmentIds.filter((id) => id !== seg.id)
                                  : [...r.segmentIds, seg.id]
                              } : r));
                            }}
                            className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                              run.segmentIds.includes(seg.id)
                                ? "bg-primary text-primary-foreground border-primary"
                                : "border-border hover:border-primary"
                            }`}
                          >
                            {seg.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Creating..." : "Create Plan"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TraineeWeekPlanner() {
  const { t } = useTranslation();
  const { traineeId: traineeIdStr } = useParams<{ traineeId: string }>();
  const traineeId = Number(traineeIdStr);
  const { toast } = useToast();

  const { data: trainee } = useListTrainees({}, { query: { select: (d) => d.find((tr) => tr.id === traineeId) } });
  const { data: currentPlan, refetch } = useGetTraineeCurrentWeekPlan(traineeId);
  const { data: allPlans } = useListWeekPlans({ traineeId });

  const sortedPlans = [...(allPlans ?? [])].sort((a, b) => b.weekStart.localeCompare(a.weekStart));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/week-planner">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
        </Link>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">{(trainee as any)?.name ?? `Trainee #${traineeId}`}</h1>
          <p className="text-muted-foreground mt-0.5">Training plans</p>
        </div>
        <CreateWeekPlanDialog traineeId={traineeId} onSuccess={refetch} />
      </div>

      {currentPlan && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Current Week</h2>
          <Card className="border-primary/30">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Week of {currentPlan.weekStart}</CardTitle>
                <Badge>{currentPlan.runs?.length ?? 0} runs</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {(currentPlan.runs?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">No runs in this plan.</p>
              ) : (
                <div className="space-y-3">
                  {currentPlan.runs?.map((run) => (
                    <div key={run.id} className="rounded-lg border bg-muted/30 overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-muted-foreground w-6">R{run.order}</span>
                          <span className="font-semibold text-sm">{run.name ?? run.runType}</span>
                          <Badge variant="outline" className="text-xs">{run.runType}</Badge>
                        </div>
                        <EditRunDialog run={run} weekPlanId={currentPlan.id} onSuccess={refetch} />
                      </div>
                      {(run.segments ?? []).length > 0 && (
                        <div className="divide-y">
                          {(run.segments ?? []).map((seg, si) => (
                            <SegmentRow
                              key={seg.id ?? si}
                              seg={seg}
                              weekPlanId={currentPlan.id}
                              runId={run.id}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {currentPlan.notes && (
                <p className="text-sm text-muted-foreground mt-3 italic">{currentPlan.notes}</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {sortedPlans.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">{t("weekPlanner.allPlans")}</h2>
          <div className="space-y-2">
            {sortedPlans.map((plan) => (
              <Card key={plan.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <p className="font-medium text-sm">Week of {plan.weekStart}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {plan.runs?.length ?? 0} runs planned
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {(plan.runs ?? []).map((r) => (
                        <Badge key={r.id} variant="outline" className="text-xs">{r.runType}</Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {sortedPlans.length === 0 && !currentPlan && (
        <div className="flex flex-col items-center py-16 gap-2 text-muted-foreground">
          <CalendarDays className="h-10 w-10" />
          <p>No plans yet for this trainee</p>
        </div>
      )}
    </div>
  );
}
