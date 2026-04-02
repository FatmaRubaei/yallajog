import { useState } from "react";
import { Link, useParams } from "wouter";
import {
  useListTrainees,
  useGetTraineeCurrentWeekPlan,
  useListWeekPlans,
  useListSegments,
  useListSegmentTypes,
  useCreateWeekPlan,
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
import { CalendarDays, Users, ArrowLeft, Plus, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

const RUN_TYPES = ["Tempo", "Interval", "Recovery", "Up Hill", "Long Run"] as const;

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
  const [runsPerWeek, setRunsPerWeek] = useState("3");
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
          runsPerWeek: Number(runsPerWeek),
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
    } catch (err) {
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
            <div className="space-y-1">
              <Label>Runs / week</Label>
              <Input type="number" min={1} max={7} value={runsPerWeek} onChange={(e) => setRunsPerWeek(e.target.value)} />
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
                <Badge>{currentPlan.runsPerWeek ?? 0} runs</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {currentPlan.runs?.length === 0 ? (
                <p className="text-sm text-muted-foreground">No runs in this plan.</p>
              ) : (
                <div className="space-y-2">
                  {currentPlan.runs?.map((run, idx) => (
                    <div key={run.id} className="flex items-start gap-2 text-sm p-2 rounded bg-muted/40">
                      <span className="font-medium text-muted-foreground w-6 shrink-0">R{run.order}</span>
                      <div className="flex-1">
                        <span className="font-medium">{run.name ?? run.runType}</span>
                        <span className="text-xs text-muted-foreground ml-2">{run.runType}</span>
                        {run.segments?.length ? (
                          <p className="text-xs text-muted-foreground mt-0.5">{run.segments.length} segment(s)</p>
                        ) : null}
                      </div>
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
                        {plan.runs?.length ?? 0} runs planned · {plan.runsPerWeek ?? 0} target/week
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
