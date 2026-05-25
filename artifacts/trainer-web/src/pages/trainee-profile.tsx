import { Link, useParams } from "wouter";
import {
  useGetTrainee,
  useGetTraineeBalance,
  useListTraineeTransactions,
  useCreateTransaction,
  useListWeekPlans,
  useGetTraineeCurrentWeekPlan,
  useUpdateTrainee,
} from "@workspace/api-client-react";
import { EditPlanDialog, CreateWeekPlanDialog, DeletePlanButton } from "@/pages/week-planner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  MapPin,
  Phone,
  Mail,
  CreditCard,
  Plus,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Clock,
  Ruler,
  Gauge,
  CheckCircle2,
  Circle,
  Pencil,
  MessageSquare,
  Send,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

function EditTraineeDialog({ trainee, onSuccess }: { trainee: any; onSuccess: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const mutation = useUpdateTrainee();

  function handleOpenChange(val: boolean) {
    if (val) {
      setForm({
        name: trainee.name ?? "",
        phone: trainee.phone ?? "",
        email: trainee.email ?? "",
        city: trainee.city ?? "",
        birthdate: trainee.birthdate ? String(trainee.birthdate).slice(0, 10) : "",
        planType: trainee.planType ?? "free",
        runsPerWeek: trainee.runsPerWeek != null ? String(trainee.runsPerWeek) : "",
        maxHr: trainee.maxHr != null ? String(trainee.maxHr) : "",
        targetHr: trainee.targetHr != null ? String(trainee.targetHr) : "",
        hrZone4: trainee.hrZone4 != null ? String(trainee.hrZone4) : "",
        hrZone5a: trainee.hrZone5a != null ? String(trainee.hrZone5a) : "",
        hrZone5c: trainee.hrZone5c != null ? String(trainee.hrZone5c) : "",
        lactateThresholdHr: trainee.lactateThresholdHr != null ? String(trainee.lactateThresholdHr) : "",
        targetSpeedFrom: trainee.targetSpeedFrom ?? "",
        targetSpeedTo: trainee.targetSpeedTo ?? "",
        testDate: trainee.testDate ? String(trainee.testDate).slice(0, 10) : "",
        monthlyFee: trainee.monthlyFee != null ? String(trainee.monthlyFee) : "",
        planFinishDate: trainee.planFinishDate ? String(trainee.planFinishDate).slice(0, 10) : "",
        preferredPayment: trainee.preferredPayment ?? "",
        heartCondition: trainee.heartCondition ?? "",
        medicalConditions: trainee.medicalConditions ?? "",
        medications: trainee.medications ?? "",
        allergies: trainee.allergies ?? "",
        healthNotes: trainee.healthNotes ?? "",
      });
    }
    setOpen(val);
  }

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await mutation.mutateAsync({
        id: trainee.id,
        data: {
          name: form.name,
          planType: form.planType as "free" | "paid",
          city: form.city || undefined,
          phone: form.phone || undefined,
          email: form.email || undefined,
          birthdate: form.birthdate ? (form.birthdate as unknown as Date) : undefined,
          runsPerWeek: form.runsPerWeek ? Number(form.runsPerWeek) : undefined,
          maxHr: form.maxHr ? Number(form.maxHr) : undefined,
          targetHr: form.targetHr ? Number(form.targetHr) : undefined,
          hrZone4: form.hrZone4 ? Number(form.hrZone4) : undefined,
          hrZone5a: form.hrZone5a ? Number(form.hrZone5a) : undefined,
          hrZone5c: form.hrZone5c ? Number(form.hrZone5c) : undefined,
          lactateThresholdHr: form.lactateThresholdHr ? Number(form.lactateThresholdHr) : undefined,
          targetSpeedFrom: form.targetSpeedFrom || undefined,
          targetSpeedTo: form.targetSpeedTo || undefined,
          testDate: form.testDate ? (form.testDate as unknown as Date) : undefined,
          monthlyFee: form.monthlyFee ? Number(form.monthlyFee) : undefined,
          planFinishDate: form.planFinishDate ? (form.planFinishDate as unknown as Date) : undefined,
          preferredPayment: (form.preferredPayment as "cash" | "credit_card") || undefined,
          heartCondition: form.heartCondition || undefined,
          medicalConditions: form.medicalConditions || undefined,
          medications: form.medications || undefined,
          allergies: form.allergies || undefined,
          healthNotes: form.healthNotes || undefined,
        },
      });
      toast({ title: "Profile updated" });
      setOpen(false);
      onSuccess();
    } catch {
      toast({ title: "Failed to update profile", variant: "destructive" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Pencil className="h-3.5 w-3.5" /> Edit Profile
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5 mt-1">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Basic Info</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 col-span-2">
                <Label className="text-xs">Name *</Label>
                <Input required value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Phone</Label>
                <Input value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Email</Label>
                <Input type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">City</Label>
                <Input value={form.city ?? ""} onChange={(e) => set("city", e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Birthdate</Label>
                <Input type="date" value={form.birthdate ?? ""} onChange={(e) => set("birthdate", e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Plan Type *</Label>
                <Select value={form.planType ?? "free"} onValueChange={(v) => set("planType", v)}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Running Metrics</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Runs / week</Label>
                <Input type="number" min="0" value={form.runsPerWeek ?? ""} onChange={(e) => set("runsPerWeek", e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Max HR / Heartbeats Factor (bpm)</Label>
                <Input type="number" min="0" value={form.maxHr ?? ""} onChange={(e) => set("maxHr", e.target.value)} className="h-8 text-sm" placeholder="e.g. 185" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Target HR (bpm)</Label>
                <Input type="number" min="0" value={form.targetHr ?? ""} onChange={(e) => set("targetHr", e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">HR Zone 4 (bpm)</Label>
                <Input type="number" min="0" value={form.hrZone4 ?? ""} onChange={(e) => set("hrZone4", e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">HR Zone 5a (bpm)</Label>
                <Input type="number" min="0" value={form.hrZone5a ?? ""} onChange={(e) => set("hrZone5a", e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">HR Zone 5c (bpm)</Label>
                <Input type="number" min="0" value={form.hrZone5c ?? ""} onChange={(e) => set("hrZone5c", e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Lactate Threshold HR (bpm)</Label>
                <Input type="number" min="0" value={form.lactateThresholdHr ?? ""} onChange={(e) => set("lactateThresholdHr", e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Target Speed From (min/km)</Label>
                <Input value={form.targetSpeedFrom ?? ""} onChange={(e) => set("targetSpeedFrom", e.target.value)} placeholder="e.g. 5:30" className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Target Speed To (min/km)</Label>
                <Input value={form.targetSpeedTo ?? ""} onChange={(e) => set("targetSpeedTo", e.target.value)} placeholder="e.g. 6:00" className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Test Date</Label>
                <Input type="date" value={form.testDate ?? ""} onChange={(e) => set("testDate", e.target.value)} className="h-8 text-sm" />
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Billing</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Monthly Fee ($)</Label>
                <Input type="number" step="0.01" min="0" value={form.monthlyFee ?? ""} onChange={(e) => set("monthlyFee", e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Plan Finish Date</Label>
                <Input type="date" value={form.planFinishDate ?? ""} onChange={(e) => set("planFinishDate", e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Preferred Payment</Label>
                <Select value={form.preferredPayment || "__none__"} onValueChange={(v) => set("preferredPayment", v === "__none__" ? "" : v)}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="credit_card">Credit Card</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-3">Health</p>
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Heart Condition</Label>
                <Textarea
                  value={form.heartCondition ?? ""}
                  onChange={(e) => set("heartCondition", e.target.value)}
                  placeholder="Any known heart conditions or cardiac history..."
                  className="text-sm resize-none"
                  rows={2}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Medical Conditions / Diseases</Label>
                <Textarea
                  value={form.medicalConditions ?? ""}
                  onChange={(e) => set("medicalConditions", e.target.value)}
                  placeholder="Diabetes, asthma, hypertension, etc..."
                  className="text-sm resize-none"
                  rows={2}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Medications</Label>
                <Textarea
                  value={form.medications ?? ""}
                  onChange={(e) => set("medications", e.target.value)}
                  placeholder="Current medications and dosages..."
                  className="text-sm resize-none"
                  rows={2}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Allergies</Label>
                <Input
                  value={form.allergies ?? ""}
                  onChange={(e) => set("allergies", e.target.value)}
                  placeholder="Food, medication, environmental allergies..."
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Additional Health Notes</Label>
                <Textarea
                  value={form.healthNotes ?? ""}
                  onChange={(e) => set("healthNotes", e.target.value)}
                  placeholder="Any other relevant health information..."
                  className="text-sm resize-none"
                  rows={2}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" size="sm" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddTransactionDialog({ traineeId, onSuccess }: { traineeId: number; onSuccess: () => void }) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    amount: "",
    activityMonth: "",
    date: new Date().toISOString().slice(0, 10),
    notes: "",
  });
  const mutation = useCreateTransaction();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await mutation.mutateAsync({
        data: {
          traineeId,
          amount: Number(form.amount),
          activityMonth: form.activityMonth,
          date: form.date,
          notes: form.notes || undefined,
        },
      });
      toast({ title: t("profile.transactionSuccess") });
      setOpen(false);
      onSuccess();
    } catch {
      toast({ title: t("profile.transactionFailed"), variant: "destructive" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="h-4 w-4 me-1.5" /> {t("profile.addTransaction")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("profile.addTransaction")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 mt-2">
          <p className="text-xs text-muted-foreground">{t("profile.paymentNote")}</p>
          <div className="space-y-1">
            <Label>{t("profile.amount")}</Label>
            <Input
              type="number"
              step="0.01"
              required
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder={t("profile.amountPlaceholder")}
            />
          </div>
          <div className="space-y-1">
            <Label>{t("profile.activityMonth")}</Label>
            <Input
              required
              value={form.activityMonth}
              onChange={(e) => setForm({ ...form, activityMonth: e.target.value })}
              placeholder="e.g. Jan 2026"
            />
          </div>
          <div className="space-y-1">
            <Label>{t("profile.date")}</Label>
            <Input
              type="date"
              required
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label>{t("profile.notes")}</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder={t("profile.notesPlaceholder")}
              rows={2}
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "..." : t("profile.submit")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function InfoRow({ label, value, always }: { label: string; value?: string | number | null; always?: boolean }) {
  const hasValue = value != null && value !== "";
  if (!hasValue && !always) return null;
  return (
    <div className="flex items-start justify-between py-2.5 border-b last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm text-right max-w-[65%] ${hasValue ? "font-medium" : "text-muted-foreground/40 italic"}`}>
        {hasValue ? String(value) : "—"}
      </span>
    </div>
  );
}

const RUN_TYPE_COLORS: Record<string, string> = {
  Tempo: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  Interval: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  Recovery: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  "Up Hill": "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  "Long Run": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

function SegmentRow({ seg }: { seg: any }) {
  const isDone = seg.completed;
  return (
    <div className={`flex items-start gap-2 py-1.5 text-sm ${isDone ? "opacity-60" : ""}`}>
      {isDone ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
      ) : (
        <Circle className="h-3.5 w-3.5 text-muted-foreground/40 mt-0.5 shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-snug ${isDone ? "line-through text-muted-foreground" : ""}`}>
          {seg.resolvedText}
        </p>
        <div className="flex flex-wrap gap-3 mt-0.5">
          {seg.distance && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Ruler className="h-3 w-3" /> {seg.distance} km
            </span>
          )}
          {seg.duration && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" /> {seg.duration} min
            </span>
          )}
          {seg.pace && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Gauge className="h-3 w-3" /> {seg.pace} /km
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function RunBlock({ run }: { run: any }) {
  const colorClass = RUN_TYPE_COLORS[run.runType] ?? "bg-muted text-muted-foreground";
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/30">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colorClass}`}>
          {run.runType}
        </span>
        {run.name && <span className="text-sm font-medium">{run.name}</span>}
        <span className="ms-auto text-xs text-muted-foreground">
          {(run.segments ?? []).length} segment{(run.segments ?? []).length !== 1 ? "s" : ""}
        </span>
      </div>
      {(run.segments ?? []).length > 0 && (
        <div className="px-3 divide-y">
          {(run.segments as any[]).map((seg: any) => (
            <SegmentRow key={seg.id} seg={seg} />
          ))}
        </div>
      )}
    </div>
  );
}

function PlanCard({
  plan,
  isCurrentWeek,
  traineeId,
  onSuccess,
}: {
  plan: any;
  isCurrentWeek: boolean;
  traineeId: number;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(isCurrentWeek);
  const runs: any[] = plan.runs ?? [];
  const totalSegments = runs.reduce((acc: number, r: any) => acc + (r.segments?.length ?? 0), 0);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className={`rounded-lg border overflow-hidden ${isCurrentWeek ? "border-primary/40" : ""}`}>
        {/* Header row */}
        <div className={`flex items-center ${isCurrentWeek ? "bg-primary/5" : "bg-card"}`}>
          <CollapsibleTrigger className="flex-1 text-left hover:bg-muted/40 transition-colors">
            <div className="flex items-center gap-2 px-4 py-3">
              {open ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
              <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="font-bold text-base">Week of {plan.weekStart}</span>
              {isCurrentWeek && <Badge className="text-xs h-5">Current</Badge>}
              <div className="ms-auto flex items-center gap-2 text-xs text-muted-foreground">
                <span>{runs.length} run{runs.length !== 1 ? "s" : ""}</span>
                <span>·</span>
                <span>{totalSegments} segment{totalSegments !== 1 ? "s" : ""}</span>
              </div>
            </div>
          </CollapsibleTrigger>
          <div className="pe-2 shrink-0 flex items-center gap-1">
            <EditPlanDialog plan={plan} traineeId={traineeId} onSuccess={onSuccess} />
            <DeletePlanButton planId={plan.id} weekStart={plan.weekStart} onSuccess={onSuccess} />
          </div>
        </div>

        {/* Expanded content — inside the same box */}
        <CollapsibleContent>
          <div className="border-t px-4 py-3 space-y-3 bg-muted/20">
            {plan.notes && (
              <p className="text-xs text-muted-foreground italic"><span className="font-semibold not-italic">Notes:</span> {plan.notes}</p>
            )}
            {runs.length === 0 ? (
              <p className="text-xs text-muted-foreground py-1">No runs in this plan yet.</p>
            ) : (
              <div className="space-y-2">
                {runs.map((run: any) => (
                  <RunBlock key={run.id} run={run} />
                ))}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type WaMessage = {
  id: number;
  direction: string;
  status: string | null;
  fromPhone: string | null;
  toPhone: string | null;
  textBody: string | null;
  sentAt: string | null;
  receivedAt: string | null;
  createdAt: string;
};

function formatMsgTime(ts: string | null) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function statusTick(status: string | null) {
  switch (status) {
    case "delivered": return "delivered";
    case "read": return "read";
    case "sent": return "sent";
    case "accepted": return "sent";
    default: return status ?? "";
  }
}

function TraineeWhatsAppChat({ traineeId, traineePhone }: { traineeId: number; traineePhone: string | null }) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<WaMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [canSend, setCanSend] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchMessages() {
    try {
      const res = await fetch(`${BASE}/api/trainer/whatsapp/messages?traineeId=${traineeId}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        const sorted = (data.messages ?? []).slice().sort(
          (a: WaMessage, b: WaMessage) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        setMessages(sorted);
      }
    } finally {
      setLoading(false);
    }
  }

  async function fetchStatus() {
    const res = await fetch(`${BASE}/api/trainer/whatsapp`, { credentials: "include" });
    if (res.ok) {
      const data = await res.json();
      const s = data?.account?.connectionStatus;
      setCanSend(s === "connected" || s === "pending_review");
    }
  }

  useEffect(() => {
    fetchStatus();
    fetchMessages();
    pollRef.current = setInterval(fetchMessages, 10000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [traineeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const text = messageText.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const res = await fetch(`${BASE}/api/trainer/whatsapp/messages`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ traineeId, text }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessageText("");
        await fetchMessages();
      } else {
        toast({ title: data.error ?? "Failed to send message", variant: "destructive" });
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center gap-2">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <CardTitle className="text-base">WhatsApp Chat</CardTitle>
        {traineePhone && (
          <span className="text-xs text-muted-foreground ms-auto">{traineePhone}</span>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {!traineePhone && (
          <p className="text-sm text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
            Add a phone number to this trainee to enable WhatsApp messaging.
          </p>
        )}
        <div className="border rounded-lg bg-muted/20 min-h-[260px] max-h-[360px] overflow-y-auto p-3 flex flex-col gap-2">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center mt-10">Loading...</p>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
              <MessageSquare className="h-8 w-8 opacity-20" />
              <p className="text-sm">No messages yet</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isOut = msg.direction === "outgoing";
              return (
                <div key={msg.id} className={`flex ${isOut ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${isOut ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-background border rounded-tl-sm"}`}>
                    <p className="whitespace-pre-wrap break-words leading-snug">{msg.textBody ?? ""}</p>
                    <p className={`text-xs mt-1 opacity-60 flex items-center gap-1 ${isOut ? "justify-end" : "justify-start"}`}>
                      {formatMsgTime(isOut ? msg.sentAt : msg.receivedAt) || formatMsgTime(msg.createdAt)}
                      {isOut && msg.status && (
                        <span className="capitalize">{statusTick(msg.status)}</span>
                      )}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {!canSend ? (
          <p className="text-xs text-muted-foreground">
            Connect WhatsApp in the Control Panel to send messages.
          </p>
        ) : !traineePhone ? (
          <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
            Add a phone number to this trainee's profile to send messages.
          </p>
        ) : (
          <div className="flex gap-2 items-end">
            <Textarea
              className="flex-1 min-h-[52px] max-h-[120px] resize-none text-sm"
              placeholder={`Message ${traineePhone}...`}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <Button size="sm" className="h-9 px-3" onClick={handleSend} disabled={sending || !messageText.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function TraineeProfile() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const traineeId = Number(id);
  const { toast } = useToast();

  const { data: trainee, isLoading, refetch: refetchTrainee } = useGetTrainee(traineeId);
  const { data: balance, refetch: refetchBalance } = useGetTraineeBalance(traineeId);
  const { data: transactions, refetch: refetchTx } = useListTraineeTransactions(traineeId);
  const { data: allPlans, refetch: refetchPlans } = useListWeekPlans({ traineeId });
  const { data: currentPlan, refetch: refetchCurrent } = useGetTraineeCurrentWeekPlan(traineeId);

  function refetchAllPlans() {
    refetchPlans();
    refetchCurrent();
  }

  const sortedPlans = [...(allPlans ?? [])].sort((a, b) => b.weekStart.localeCompare(a.weekStart));

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-48 bg-muted rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (!trainee) {
    return (
      <div className="text-center py-16 text-muted-foreground">{t("common.notFound")}</div>
    );
  }

  const sortedTx = [...(transactions ?? [])].sort((a, b) => b.date.localeCompare(a.date));
  const isOverdue = (balance?.balance ?? 0) > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/trainees">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl shrink-0">
          {trainee.name?.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold">{trainee.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant={trainee.planType === "paid" ? "default" : "secondary"}>
              {trainee.planType === "paid" ? "Paid" : "Free"}
            </Badge>
            {trainee.city && (
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> {trainee.city}
              </span>
            )}
          </div>
        </div>
        <div className="shrink-0">
          <EditTraineeDialog trainee={trainee} onSuccess={() => refetchTrainee()} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Contact */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Contact</CardTitle>
          </CardHeader>
          <CardContent>
            <InfoRow always label="Phone" value={trainee.phone} />
            <InfoRow always label="Email" value={trainee.email} />
            <InfoRow always label="City" value={trainee.city} />
            <InfoRow always label="Birthdate" value={trainee.birthdate} />
            <InfoRow always label="Plan Type" value={trainee.planType === "paid" ? "Paid" : "Free"} />
          </CardContent>
        </Card>

        {/* Running Metrics */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Running Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <InfoRow always label="Runs / week" value={trainee.runsPerWeek} />
            <InfoRow always label="Max HR / Heartbeats Factor" value={trainee.maxHr != null ? `${trainee.maxHr} bpm` : null} />
            <InfoRow always label="Target HR" value={trainee.targetHr != null ? `${trainee.targetHr} bpm` : null} />
            <InfoRow always label="HR Zone 4" value={trainee.hrZone4 != null ? `${trainee.hrZone4} bpm` : null} />
            <InfoRow always label="HR Zone 5a" value={trainee.hrZone5a != null ? `${trainee.hrZone5a} bpm` : null} />
            <InfoRow always label="HR Zone 5c" value={trainee.hrZone5c != null ? `${trainee.hrZone5c} bpm` : null} />
            <InfoRow always label="Lactate Threshold" value={trainee.lactateThresholdHr != null ? `${trainee.lactateThresholdHr} bpm` : null} />
            <InfoRow always label="Target Speed" value={
              trainee.targetSpeedFrom || trainee.targetSpeedTo
                ? `${trainee.targetSpeedFrom ?? "?"} – ${trainee.targetSpeedTo ?? "?"} min/km`
                : null
            } />
            <InfoRow always label="Test Date" value={trainee.testDate} />
          </CardContent>
        </Card>

        {/* Health */}
        <Card className="border-amber-200 dark:border-amber-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">Health</CardTitle>
          </CardHeader>
          <CardContent>
            <InfoRow always label="Heart Condition" value={trainee.heartCondition} />
            <InfoRow always label="Medical Conditions" value={trainee.medicalConditions} />
            <InfoRow always label="Medications" value={trainee.medications} />
            <InfoRow always label="Allergies" value={trainee.allergies} />
            <InfoRow always label="Health Notes" value={trainee.healthNotes} />
          </CardContent>
        </Card>

      </div>

      {/* Training Plans */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base">Training Plans</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {sortedPlans.length} plan{sortedPlans.length !== 1 ? "s" : ""} total
            </p>
          </div>
          <div className="flex items-center gap-2">
            <CreateWeekPlanDialog traineeId={traineeId} onSuccess={refetchAllPlans} />
            <Link href={`/week-planner/${traineeId}`}>
              <Button variant="ghost" size="sm" className="gap-1.5">
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {sortedPlans.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CalendarDays className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No training plans yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedPlans.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  isCurrentWeek={currentPlan?.id === plan.id}
                  traineeId={traineeId}
                  onSuccess={refetchAllPlans}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* WhatsApp Chat */}
      <TraineeWhatsAppChat traineeId={traineeId} traineePhone={trainee.phone ?? null} />

      {/* Billing + Transactions side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base">Billing</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {balance && (
              <div className={`rounded-lg p-3 mb-3 text-sm ${isOverdue ? "bg-destructive/10" : "bg-green-50 dark:bg-green-900/20"}`}>
                <div className={`text-2xl font-bold ${isOverdue ? "text-destructive" : "text-green-700 dark:text-green-400"}`}>
                  ${Math.abs(balance.balance).toFixed(2)}
                </div>
                <div className={`text-xs mt-0.5 ${isOverdue ? "text-destructive/80" : "text-green-600 dark:text-green-500"}`}>
                  {isOverdue ? "Outstanding balance" : "All paid up"}
                </div>
              </div>
            )}
            <InfoRow always label="Monthly Fee" value={trainee.monthlyFee != null ? `$${Number(trainee.monthlyFee).toFixed(2)}` : null} />
            <InfoRow always label="Plan Finish Date" value={trainee.planFinishDate} />
            <InfoRow always label="Preferred Payment" value={trainee.preferredPayment?.replace("_", " ")} />
            <InfoRow label="Total Charged" value={balance ? `$${balance.totalCharged.toFixed(2)}` : null} />
            <InfoRow label="Total Paid" value={balance ? `$${balance.totalPaid.toFixed(2)}` : null} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Transaction History</CardTitle>
            <AddTransactionDialog traineeId={traineeId} onSuccess={() => { refetchBalance(); refetchTx(); }} />
          </CardHeader>
          <CardContent>
            {sortedTx.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No transactions yet.</p>
            ) : (
              <div className="divide-y">
                {sortedTx.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium">{tx.activityMonth}</p>
                      {tx.notes && <p className="text-xs text-muted-foreground">{tx.notes}</p>}
                      <p className="text-xs text-muted-foreground">{tx.date}</p>
                    </div>
                    <span className={`font-semibold text-sm ${tx.amount > 0 ? "text-green-600" : "text-destructive"}`}>
                      {tx.amount > 0 ? "+" : ""}${tx.amount.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
