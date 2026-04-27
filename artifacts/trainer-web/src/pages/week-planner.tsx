import { useState, useRef, useEffect } from "react";
import { Link, useParams } from "wouter";
import {
  useListTrainees,
  useGetTraineeCurrentWeekPlan,
  useListWeekPlans,
  useListSegments,
  useCreateWeekPlan,
  useUpdateRun,
  useUpdateWeekPlan,
  useDeleteWeekPlan,
  useAddRunToWeekPlan,
  useDeleteRun,
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
import { CalendarDays, Users, ArrowLeft, Plus, Pencil, Clock, Gauge, Ruler, CheckCircle2, Circle, Trash2 } from "lucide-react";
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
  onEdit,
}: {
  seg: any;
  weekPlanId: number;
  runId: number;
  onEdit: () => void;
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
      <div className="flex-1 min-w-0">
        <SegmentDetails seg={seg} completed={completed} />
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Edit segment"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

type EditableSegment = {
  id?: number;
  mode: "library" | "custom";
  librarySegmentId: string;
  resolvedText: string;
  segmentType: string;
  measurement: "duration" | "distance";
  durationMinutes: string;
  distanceKm: string;
  intensityTarget: "none" | "pace";
  paceMin: string;
  paceSec: string;
  order: number;
};

function parsePace(pace: string | null | undefined): { min: string; sec: string } {
  if (!pace) return { min: "", sec: "" };
  const parts = pace.split(":");
  return { min: parts[0] ?? "", sec: parts[1] ?? "00" };
}

function formatPace(min: string, sec: string): string | null {
  if (!min && !sec) return null;
  return `${min || "0"}:${(sec || "0").padStart(2, "0")}`;
}

function segmentToEditable(s: any): EditableSegment {
  const pace = parsePace(s.pace);
  return {
    id: s.id,
    mode: s.segmentId ? "library" : "custom",
    librarySegmentId: s.segmentId ? String(s.segmentId) : "",
    resolvedText: s.resolvedText ?? "",
    segmentType: s.segmentType ?? "",
    measurement: s.distanceKm != null ? "distance" : "duration",
    durationMinutes: s.durationMinutes != null ? String(s.durationMinutes) : "",
    distanceKm: s.distanceKm != null ? String(s.distanceKm) : "",
    intensityTarget: s.pace ? "pace" : "none",
    paceMin: pace.min,
    paceSec: pace.sec,
    order: s.order ?? 1,
  };
}

function editableToSegment(s: EditableSegment, i: number) {
  return {
    segmentId: s.mode === "library" && s.librarySegmentId ? Number(s.librarySegmentId) : undefined,
    resolvedText: s.resolvedText || "",
    segmentType: s.segmentType !== "" ? s.segmentType : null,
    durationMinutes: s.measurement === "duration" && s.durationMinutes !== "" ? Number(s.durationMinutes) : null,
    distanceKm: s.measurement === "distance" && s.distanceKm !== "" ? Number(s.distanceKm) : null,
    pace: s.intensityTarget === "pace" ? formatPace(s.paceMin, s.paceSec) : null,
    order: i + 1,
  };
}

function emptySegment(order: number): EditableSegment {
  return { mode: "custom", librarySegmentId: "", resolvedText: "", segmentType: "", measurement: "duration", durationMinutes: "", distanceKm: "", intensityTarget: "none", paceMin: "", paceSec: "", order };
}

function SegmentForm({
  seg,
  idx,
  librarySegments,
  onUpdate,
  onBulkUpdate,
  onRemove,
  showRemove,
}: {
  seg: EditableSegment;
  idx: number;
  librarySegments: any[];
  onUpdate: (idx: number, field: keyof EditableSegment, value: string) => void;
  onBulkUpdate: (idx: number, updates: Partial<EditableSegment>) => void;
  onRemove: () => void;
  showRemove: boolean;
}) {
  const prevLibSegIdRef = useRef<string>(seg.librarySegmentId ?? "");
  const onBulkUpdateRef = useRef(onBulkUpdate);
  onBulkUpdateRef.current = onBulkUpdate;

  useEffect(() => {
    const v = seg.librarySegmentId ?? "";
    const prev = prevLibSegIdRef.current;
    prevLibSegIdRef.current = v;
    if (!v || v === prev) return;
    const ls = librarySegments.find((x: any) => String(x.id) === v);
    if (!ls) return;
    const pace = parsePace(ls.defaultPace);
    onBulkUpdateRef.current(idx, {
      resolvedText: ls.name || "",
      segmentType: "",
      measurement: ls.defaultDistanceKm != null ? "distance" : "duration",
      durationMinutes: ls.defaultDurationMinutes != null ? String(ls.defaultDurationMinutes) : "",
      distanceKm: ls.defaultDistanceKm != null ? String(ls.defaultDistanceKm) : "",
      intensityTarget: ls.defaultPace ? "pace" : "none",
      paceMin: pace.min,
      paceSec: pace.sec,
    });
  }, [seg.librarySegmentId, librarySegments, idx]);

  const hasLibrarySelection = seg.mode === "library" && !!seg.librarySegmentId;

  return (
    <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Segment {idx + 1}</span>
        {showRemove && (
          <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs text-destructive hover:text-destructive" onClick={onRemove}>
            Remove
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-0.5 p-0.5 bg-muted rounded-md">
        <button type="button" onClick={() => onUpdate(idx, "mode", "library")}
          className={`py-1 text-xs font-medium rounded transition-all ${seg.mode === "library" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
          From Library
        </button>
        <button type="button" onClick={() => onUpdate(idx, "mode", "custom")}
          className={`py-1 text-xs font-medium rounded transition-all ${seg.mode === "custom" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
          Custom
        </button>
      </div>

      {seg.mode === "library" ? (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Select Segment</Label>
            <Select value={seg.librarySegmentId || "__none__"} onValueChange={(v) => {
              if (v === "__none__") {
                onBulkUpdate(idx, { librarySegmentId: "", resolvedText: "", durationMinutes: "", distanceKm: "", paceMin: "", paceSec: "", intensityTarget: "none" });
              } else {
                onUpdate(idx, "librarySegmentId", v);
              }
            }}>
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Choose from library..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Choose from library...</SelectItem>
                {librarySegments.map((ls: any) => (
                  <SelectItem key={ls.id} value={String(ls.id)}>
                    {ls.name}
                    {ls.defaultDurationMinutes ? ` — ${ls.defaultDurationMinutes} min` : ls.defaultDistanceKm ? ` — ${ls.defaultDistanceKm} km` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {hasLibrarySelection && (
            <>
              <div className="border-t pt-2 space-y-2">
                <p className="text-xs text-muted-foreground">Edit details for this plan:</p>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Segment Type</Label>
                    <Select value={seg.segmentType || "__none__"} onValueChange={(v) => onUpdate(idx, "segmentType", v === "__none__" ? "" : v)}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="No type" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">No type</SelectItem>
                        {SEGMENT_TYPES.map((st) => <SelectItem key={st} value={st}>{st}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Description</Label>
                    <Input value={seg.resolvedText} onChange={(e) => onUpdate(idx, "resolvedText", e.target.value)} placeholder="e.g. 800m at tempo" className="h-8 text-sm" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Measurement</Label>
                  <div className="grid grid-cols-2 gap-0.5 p-0.5 bg-muted rounded-md">
                    <button type="button" onClick={() => onUpdate(idx, "measurement", "duration")}
                      className={`py-1 text-xs font-medium rounded transition-all ${seg.measurement === "duration" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                      Duration
                    </button>
                    <button type="button" onClick={() => onUpdate(idx, "measurement", "distance")}
                      className={`py-1 text-xs font-medium rounded transition-all ${seg.measurement === "distance" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                      Distance
                    </button>
                  </div>
                  <div className="flex items-center rounded-md border bg-background overflow-hidden h-8">
                    {seg.measurement === "duration" ? (
                      <>
                        <Input type="number" min={0} step={0.5} value={seg.durationMinutes} onChange={(e) => onUpdate(idx, "durationMinutes", e.target.value)} placeholder="0" className="border-0 shadow-none focus-visible:ring-0 text-center text-sm font-medium h-8" />
                        <span className="px-2 text-xs text-muted-foreground border-l bg-muted/40 h-full flex items-center">min</span>
                      </>
                    ) : (
                      <>
                        <Input type="number" min={0} step={0.001} value={seg.distanceKm} onChange={(e) => onUpdate(idx, "distanceKm", e.target.value)} placeholder="0" className="border-0 shadow-none focus-visible:ring-0 text-center text-sm font-medium h-8" />
                        <span className="px-2 text-xs text-muted-foreground border-l bg-muted/40 h-full flex items-center">km</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Intensity Target</Label>
                  <Select value={seg.intensityTarget} onValueChange={(v) => onUpdate(idx, "intensityTarget", v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No target</SelectItem>
                      <SelectItem value="pace">Pace (min/km)</SelectItem>
                    </SelectContent>
                  </Select>
                  {seg.intensityTarget === "pace" && (
                    <div className="flex items-center rounded-md border bg-background overflow-hidden h-8">
                      <Input type="number" min={0} max={59} value={seg.paceMin} onChange={(e) => onUpdate(idx, "paceMin", e.target.value)} placeholder="5" className="border-0 shadow-none focus-visible:ring-0 text-center text-sm font-medium h-8" />
                      <span className="px-1 text-xs text-muted-foreground">:</span>
                      <Input type="number" min={0} max={59} value={seg.paceSec} onChange={(e) => onUpdate(idx, "paceSec", e.target.value)} placeholder="30" className="border-0 shadow-none focus-visible:ring-0 text-center text-sm font-medium h-8" />
                      <span className="px-2 text-xs text-muted-foreground border-l bg-muted/40 h-full flex items-center">min/km</span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Segment Type</Label>
              <Select value={seg.segmentType || "__none__"} onValueChange={(v) => onUpdate(idx, "segmentType", v === "__none__" ? "" : v)}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="No type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No type</SelectItem>
                  {SEGMENT_TYPES.map((st) => <SelectItem key={st} value={st}>{st}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Description *</Label>
              <Input required={seg.mode === "custom"} value={seg.resolvedText} onChange={(e) => onUpdate(idx, "resolvedText", e.target.value)} placeholder="e.g. 800m at tempo" className="h-8 text-sm" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Measurement</Label>
            <div className="grid grid-cols-2 gap-0.5 p-0.5 bg-muted rounded-md">
              <button type="button" onClick={() => onUpdate(idx, "measurement", "duration")}
                className={`py-1 text-xs font-medium rounded transition-all ${seg.measurement === "duration" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                Duration
              </button>
              <button type="button" onClick={() => onUpdate(idx, "measurement", "distance")}
                className={`py-1 text-xs font-medium rounded transition-all ${seg.measurement === "distance" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                Distance
              </button>
            </div>
            <div className="flex items-center rounded-md border bg-background overflow-hidden h-8">
              {seg.measurement === "duration" ? (
                <>
                  <Input type="number" min={0} step={0.5} value={seg.durationMinutes} onChange={(e) => onUpdate(idx, "durationMinutes", e.target.value)} placeholder="0" className="border-0 shadow-none focus-visible:ring-0 text-center text-sm font-medium h-8" />
                  <span className="px-2 text-xs text-muted-foreground border-l bg-muted/40 h-full flex items-center">min</span>
                </>
              ) : (
                <>
                  <Input type="number" min={0} step={0.001} value={seg.distanceKm} onChange={(e) => onUpdate(idx, "distanceKm", e.target.value)} placeholder="0" className="border-0 shadow-none focus-visible:ring-0 text-center text-sm font-medium h-8" />
                  <span className="px-2 text-xs text-muted-foreground border-l bg-muted/40 h-full flex items-center">km</span>
                </>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Intensity Target</Label>
            <Select value={seg.intensityTarget} onValueChange={(v) => onUpdate(idx, "intensityTarget", v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No target</SelectItem>
                <SelectItem value="pace">Pace (min/km)</SelectItem>
              </SelectContent>
            </Select>
            {seg.intensityTarget === "pace" && (
              <div className="flex items-center rounded-md border bg-background overflow-hidden h-8">
                <Input type="number" min={0} max={59} value={seg.paceMin} onChange={(e) => onUpdate(idx, "paceMin", e.target.value)} placeholder="4" className="border-0 shadow-none focus-visible:ring-0 text-center text-sm font-medium h-8" />
                <span className="text-xs font-semibold text-muted-foreground px-0.5">:</span>
                <Input type="number" min={0} max={59} value={seg.paceSec} onChange={(e) => onUpdate(idx, "paceSec", e.target.value)} placeholder="30" className="border-0 shadow-none focus-visible:ring-0 text-center text-sm font-medium h-8" />
                <span className="px-2 text-xs text-muted-foreground border-l bg-muted/40 h-full flex items-center whitespace-nowrap">/km</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

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
    (run.segments ?? []).map(segmentToEditable)
  );

  const mutation = useUpdateRun();
  const { data: librarySegments = [] } = useListSegments({});

  function addSegment() {
    setSegments([...segments, emptySegment(segments.length + 1)]);
  }

  function removeSegment(idx: number) {
    setSegments(segments.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i + 1 })));
  }

  function updateSeg(idx: number, field: keyof EditableSegment, value: string) {
    setSegments((prev) => prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));
  }

  function updateSegBulk(idx: number, updates: Partial<EditableSegment>) {
    setSegments((prev) => prev.map((s, i) => (i === idx ? { ...s, ...updates } : s)));
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
          segments: segments.map(editableToSegment),
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
                <SegmentForm
                  key={idx}
                  seg={seg}
                  idx={idx}
                  librarySegments={librarySegments}
                  onUpdate={updateSeg}
                  onBulkUpdate={updateSegBulk}
                  onRemove={() => removeSegment(idx)}
                  showRemove={segments.length > 1}
                />
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

type CreateRun = {
  name: string;
  runType: string;
  order: number;
  segments: EditableSegment[];
};

export function CreateWeekPlanDialog({ traineeId, onSuccess }: { traineeId: number; onSuccess: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date();
    const day = d.getDay();
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((day + 6) % 7));
    const y = monday.getFullYear();
    const m = String(monday.getMonth() + 1).padStart(2, "0");
    const dd = String(monday.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  });
  const [notes, setNotes] = useState("");
  const [runs, setRuns] = useState<CreateRun[]>([
    { name: "", runType: "Tempo", order: 1, segments: [emptySegment(1)] },
  ]);

  const mutation = useCreateWeekPlan();
  const { data: librarySegments = [] } = useListSegments({});

  function addRun() {
    setRuns([...runs, { name: "", runType: "Recovery", order: runs.length + 1, segments: [emptySegment(1)] }]);
  }

  function removeRun(idx: number) {
    setRuns(runs.filter((_, i) => i !== idx).map((r, i) => ({ ...r, order: i + 1 })));
  }

  function updateRunField(runIdx: number, field: "name" | "runType", value: string) {
    setRuns(runs.map((r, i) => i === runIdx ? { ...r, [field]: value } : r));
  }

  function addSegmentToRun(runIdx: number) {
    setRuns(runs.map((r, i) => i === runIdx ? { ...r, segments: [...r.segments, emptySegment(r.segments.length + 1)] } : r));
  }

  function removeSegmentFromRun(runIdx: number, segIdx: number) {
    setRuns(runs.map((r, i) => i === runIdx
      ? { ...r, segments: r.segments.filter((_, si) => si !== segIdx).map((s, si) => ({ ...s, order: si + 1 })) }
      : r));
  }

  function updateSegInRun(runIdx: number, segIdx: number, field: keyof EditableSegment, value: string) {
    setRuns((prev) => prev.map((r, i) => i === runIdx
      ? { ...r, segments: r.segments.map((s, si) => si === segIdx ? { ...s, [field]: value } : s) }
      : r));
  }

  function updateSegInRunBulk(runIdx: number, segIdx: number, updates: Partial<EditableSegment>) {
    setRuns((prev) => prev.map((r, i) => i === runIdx
      ? { ...r, segments: r.segments.map((s, si) => si === segIdx ? { ...s, ...updates } : s) }
      : r));
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
            segments: r.segments.filter((s) => s.resolvedText.trim() !== "").map(editableToSegment),
          })),
        } as any,
      });
      toast({ title: "Week plan created" });
      setOpen(false);
      setRuns([{ name: "", runType: "Tempo", order: 1, segments: [emptySegment(1)] }]);
      setNotes("");
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
            <div className="space-y-4">
              {runs.map((run, runIdx) => (
                <div key={runIdx} className="border rounded-xl p-3 space-y-3 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">Run {run.order}</span>
                    {runs.length > 1 && (
                      <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-destructive hover:text-destructive" onClick={() => removeRun(runIdx)}>Remove Run</Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Run Name</Label>
                      <Input value={run.name} onChange={(e) => updateRunField(runIdx, "name", e.target.value)} placeholder="Optional name" className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Type *</Label>
                      <Select value={run.runType} onValueChange={(v) => updateRunField(runIdx, "runType", v)}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {RUN_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-xs text-muted-foreground">Segments ({run.segments.length})</Label>
                      <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => addSegmentToRun(runIdx)}>
                        <Plus className="h-3 w-3 mr-1" /> Add Segment
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {run.segments.map((seg, segIdx) => (
                        <SegmentForm
                          key={segIdx}
                          seg={seg}
                          idx={segIdx}
                          librarySegments={librarySegments}
                          onUpdate={(_, field, value) => updateSegInRun(runIdx, segIdx, field, value)}
                          onBulkUpdate={(_, updates) => updateSegInRunBulk(runIdx, segIdx, updates)}
                          onRemove={() => removeSegmentFromRun(runIdx, segIdx)}
                          showRemove={run.segments.length > 1}
                        />
                      ))}
                    </div>
                  </div>
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

function RunCard({
  run,
  weekPlanId,
  librarySegments,
  onSuccess,
}: {
  run: any;
  weekPlanId: number;
  librarySegments: any[];
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const mutation = useUpdateRun();
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editSeg, setEditSeg] = useState<EditableSegment | null>(null);

  function startEdit(seg: any, idx: number) {
    setEditingIdx(idx);
    setEditSeg(segmentToEditable(seg));
  }

  function cancelEdit() {
    setEditingIdx(null);
    setEditSeg(null);
  }

  async function saveEdit() {
    if (editSeg === null || editingIdx === null) return;
    const allSegs = (run.segments ?? []).map((s: any, i: number) =>
      i === editingIdx
        ? editableToSegment(editSeg, i)
        : {
            segmentId: s.segmentId ?? undefined,
            resolvedText: s.resolvedText,
            segmentType: s.segmentType ?? null,
            durationMinutes: s.durationMinutes ?? null,
            distanceKm: s.distanceKm ?? null,
            pace: s.pace ?? null,
            order: i + 1,
          }
    );
    try {
      await mutation.mutateAsync({
        id: weekPlanId,
        runId: run.id,
        data: { name: run.name || undefined, runType: run.runType, order: run.order, segments: allSegs },
      });
      toast({ title: "Segment updated" });
      cancelEdit();
      onSuccess();
    } catch {
      toast({ title: "Failed to update segment", variant: "destructive" });
    }
  }

  return (
    <div className="rounded-lg border bg-muted/30 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-muted-foreground w-6">R{run.order}</span>
          <span className="font-semibold text-sm">{run.name ?? run.runType}</span>
          <Badge variant="outline" className="text-xs">{run.runType}</Badge>
        </div>
        <EditRunDialog run={run} weekPlanId={weekPlanId} onSuccess={onSuccess} />
      </div>
      {(run.segments ?? []).length > 0 && (
        <div className="divide-y">
          {(run.segments ?? []).map((seg: any, si: number) => (
            <div key={seg.id ?? si}>
              {editingIdx === si ? (
                <div className="px-4 py-3 space-y-3 bg-background">
                  <SegmentForm
                    seg={editSeg!}
                    idx={0}
                    librarySegments={librarySegments}
                    onUpdate={(_, field, value) => setEditSeg((s) => s ? { ...s, [field]: value } : s)}
                    onBulkUpdate={(_, updates) => setEditSeg((s) => s ? { ...s, ...updates } : s)}
                    onRemove={() => {}}
                    showRemove={false}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveEdit} disabled={mutation.isPending}>
                      {mutation.isPending ? "Saving..." : "Save"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={cancelEdit}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <SegmentRow
                  seg={seg}
                  weekPlanId={weekPlanId}
                  runId={run.id}
                  onEdit={() => startEdit(seg, si)}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type EditRun = {
  id?: number;
  name: string;
  runType: string;
  order: number;
  segments: EditableSegment[];
};

export function EditPlanDialog({
  plan,
  traineeId,
  onSuccess,
}: {
  plan: any;
  traineeId: number;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [weekStart, setWeekStart] = useState(plan.weekStart ?? "");
  const [notes, setNotes] = useState(plan.notes ?? "");
  const [runs, setRuns] = useState<EditRun[]>([]);
  const [removedRunIds, setRemovedRunIds] = useState<number[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: librarySegments = [] } = useListSegments({});
  const updatePlanMutation = useUpdateWeekPlan();
  const deletePlanMutation = useDeleteWeekPlan();
  const updateRunMutation = useUpdateRun();
  const addRunMutation = useAddRunToWeekPlan();
  const deleteRunMutation = useDeleteRun();

  function planToRuns(p: any): EditRun[] {
    return (p.runs ?? []).map((r: any) => ({
      id: r.id,
      name: r.name ?? "",
      runType: r.runType ?? "Recovery",
      order: r.order,
      segments: (r.segments ?? []).map(segmentToEditable),
    }));
  }

  function handleOpen(val: boolean) {
    if (val) {
      setWeekStart(plan.weekStart ?? "");
      setNotes(plan.notes ?? "");
      setRuns(planToRuns(plan));
      setRemovedRunIds([]);
      setConfirmDelete(false);
    }
    setOpen(val);
  }

  function addRun() {
    setRuns((prev) => [
      ...prev,
      { name: "", runType: "Recovery", order: prev.length + 1, segments: [emptySegment(1)] },
    ]);
  }

  function removeRun(idx: number) {
    const run = runs[idx];
    if (run.id) setRemovedRunIds((prev) => [...prev, run.id!]);
    setRuns((prev) =>
      prev.filter((_, i) => i !== idx).map((r, i) => ({ ...r, order: i + 1 }))
    );
  }

  function updateRunField(runIdx: number, field: "name" | "runType", value: string) {
    setRuns((prev) => prev.map((r, i) => (i === runIdx ? { ...r, [field]: value } : r)));
  }

  function addSegmentToRun(runIdx: number) {
    setRuns((prev) =>
      prev.map((r, i) =>
        i === runIdx ? { ...r, segments: [...r.segments, emptySegment(r.segments.length + 1)] } : r
      )
    );
  }

  function removeSegmentFromRun(runIdx: number, segIdx: number) {
    setRuns((prev) =>
      prev.map((r, i) =>
        i === runIdx
          ? {
              ...r,
              segments: r.segments
                .filter((_, si) => si !== segIdx)
                .map((s, si) => ({ ...s, order: si + 1 })),
            }
          : r
      )
    );
  }

  function updateSegInRun(runIdx: number, segIdx: number, field: keyof EditableSegment, value: string) {
    setRuns((prev) =>
      prev.map((r, i) =>
        i === runIdx
          ? { ...r, segments: r.segments.map((s, si) => (si === segIdx ? { ...s, [field]: value } : s)) }
          : r
      )
    );
  }

  function updateSegInRunBulk(runIdx: number, segIdx: number, updates: Partial<EditableSegment>) {
    setRuns((prev) =>
      prev.map((r, i) =>
        i === runIdx
          ? { ...r, segments: r.segments.map((s, si) => (si === segIdx ? { ...s, ...updates } : s)) }
          : r
      )
    );
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    try {
      await updatePlanMutation.mutateAsync({
        id: plan.id,
        data: { traineeId, weekStart, notes: notes || undefined },
      });

      for (const runId of removedRunIds) {
        await deleteRunMutation.mutateAsync({ id: plan.id, runId });
      }

      for (const run of runs) {
        const segments = run.segments
          .filter((s) => s.resolvedText.trim() !== "")
          .map(editableToSegment);
        if (run.id) {
          await updateRunMutation.mutateAsync({
            id: plan.id,
            runId: run.id,
            data: { name: run.name || undefined, runType: run.runType, order: run.order, segments },
          });
        } else {
          await addRunMutation.mutateAsync({
            id: plan.id,
            data: { name: run.name || undefined, runType: run.runType, order: run.order, segments },
          });
        }
      }

      toast({ title: "Plan updated" });
      setOpen(false);
      onSuccess();
    } catch {
      toast({ title: "Failed to update plan", variant: "destructive" });
    }
  }

  async function handleDelete() {
    try {
      await deletePlanMutation.mutateAsync({ id: plan.id });
      toast({ title: "Plan deleted" });
      setOpen(false);
      onSuccess();
    } catch {
      toast({ title: "Failed to delete plan", variant: "destructive" });
    }
  }

  const isPending =
    updatePlanMutation.isPending ||
    updateRunMutation.isPending ||
    addRunMutation.isPending ||
    deleteRunMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-2">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Plan</DialogTitle>
        </DialogHeader>

        {confirmDelete ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Delete this plan? All runs and segments inside it will be permanently removed.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={deletePlanMutation.isPending}
              >
                {deletePlanMutation.isPending ? "Deleting..." : "Yes, delete"}
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-5 mt-1">
            {/* Plan metadata */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Week Start</Label>
                <Input
                  type="date"
                  required
                  value={weekStart}
                  onChange={(e) => setWeekStart(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Notes</Label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional notes..."
                  className="h-8 text-sm"
                />
              </div>
            </div>

            {/* Runs */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                  Runs ({runs.length})
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={addRun}
                >
                  <Plus className="h-3 w-3 mr-1" /> Add Run
                </Button>
              </div>

              {runs.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No runs yet — click Add Run to start.
                </p>
              )}

              <div className="space-y-4">
                {runs.map((run, runIdx) => (
                  <div key={runIdx} className="border rounded-lg p-3 space-y-3 bg-muted/20">
                    {/* Run header */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground">
                        Run {run.order}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => removeRun(runIdx)}
                      >
                        Remove
                      </Button>
                    </div>

                    {/* Run fields */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Run Name</Label>
                        <Input
                          value={run.name}
                          onChange={(e) => updateRunField(runIdx, "name", e.target.value)}
                          placeholder="Optional name"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Type</Label>
                        <Select
                          value={run.runType}
                          onValueChange={(v) => updateRunField(runIdx, "runType", v)}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {RUN_TYPES.map((t) => (
                              <SelectItem key={t} value={t}>
                                {t}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Segments */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-xs text-muted-foreground">
                          Segments ({run.segments.length})
                        </Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => addSegmentToRun(runIdx)}
                        >
                          <Plus className="h-3 w-3 mr-1" /> Add Segment
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {run.segments.map((seg, segIdx) => (
                          <SegmentForm
                            key={segIdx}
                            seg={seg}
                            idx={segIdx}
                            librarySegments={librarySegments}
                            onUpdate={(_, field, value) =>
                              updateSegInRun(runIdx, segIdx, field, value)
                            }
                            onBulkUpdate={(_, updates) =>
                              updateSegInRunBulk(runIdx, segIdx, updates)
                            }
                            onRemove={() => removeSegmentFromRun(runIdx, segIdx)}
                            showRemove={run.segments.length > 1}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer actions */}
            <div className="flex items-center justify-between pt-1 border-t">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete plan
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={isPending}>
                  {isPending ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function DeletePlanButton({
  planId,
  weekStart,
  onSuccess,
}: {
  planId: number;
  weekStart: string;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const deleteMutation = useDeleteWeekPlan();

  async function handleDelete() {
    try {
      await deleteMutation.mutateAsync({ id: planId });
      toast({ title: "Plan deleted" });
      setOpen(false);
      onSuccess();
    } catch {
      toast({ title: "Failed to delete plan", variant: "destructive" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete Plan</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Delete the plan for week of <strong>{weekStart}</strong>? All runs and segments inside it will be permanently removed.
        </p>
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? "Deleting..." : "Delete"}
          </Button>
        </div>
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
  const { data: librarySegments = [] } = useListSegments({});

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

      {sortedPlans.length === 0 ? (
        <p className="text-sm text-muted-foreground">No plans yet. Create the first one above.</p>
      ) : (
        <div className="space-y-6">
          {sortedPlans.map((plan) => {
            const isCurrent = currentPlan?.id === plan.id;
            return (
              <Card key={plan.id} className={isCurrent ? "border-primary/40" : ""}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">Week of {plan.weekStart}</CardTitle>
                      {isCurrent && <Badge className="text-xs">Current</Badge>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{plan.runs?.length ?? 0} runs</Badge>
                      <EditPlanDialog plan={plan} traineeId={traineeId} onSuccess={refetch} />
                      <DeletePlanButton planId={plan.id} weekStart={plan.weekStart} onSuccess={refetch} />
                    </div>
                  </div>
                  {plan.notes && (
                    <p className="text-xs text-muted-foreground italic mt-0.5">{plan.notes}</p>
                  )}
                </CardHeader>
                <CardContent className="pt-0">
                  {(plan.runs?.length ?? 0) === 0 ? (
                    <p className="text-sm text-muted-foreground">No runs in this plan.</p>
                  ) : (
                    <div className="space-y-3">
                      {plan.runs?.map((run) => (
                        <RunCard
                          key={run.id}
                          run={run}
                          weekPlanId={plan.id}
                          librarySegments={librarySegments}
                          onSuccess={refetch}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

    </div>
  );
}
