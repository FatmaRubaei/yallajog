import { Link, useParams } from "wouter";
import {
  useGetTrainee,
  useGetTraineeBalance,
  useListTraineeTransactions,
  useCreateTransaction,
} from "@workspace/api-client-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, MapPin, Phone, Mail, CreditCard, Plus } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

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

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-start justify-between py-2.5 border-b last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right max-w-[60%]">{String(value)}</span>
    </div>
  );
}

export default function TraineeProfile() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const traineeId = Number(id);
  const { toast } = useToast();

  const { data: trainee, isLoading } = useGetTrainee(traineeId);
  const { data: balance, refetch: refetchBalance } = useGetTraineeBalance(traineeId);
  const { data: transactions, refetch: refetchTx } = useListTraineeTransactions(traineeId);

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
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl">
          {trainee.name?.charAt(0)}
        </div>
        <div>
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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {trainee.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{trainee.phone}</span>
              </div>
            )}
            {trainee.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{trainee.email}</span>
              </div>
            )}
            {trainee.birthdate && <InfoRow label="Birthdate" value={trainee.birthdate} />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Running Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <InfoRow label="Runs / week" value={trainee.runsPerWeek} />
            <InfoRow label="Target HR" value={trainee.targetHr ? `${trainee.targetHr} bpm` : null} />
            <InfoRow label="HR Zone 4" value={trainee.hrZone4 ? `${trainee.hrZone4} bpm` : null} />
            <InfoRow label="HR Zone 5a" value={trainee.hrZone5a ? `${trainee.hrZone5a} bpm` : null} />
            <InfoRow label="HR Zone 5c" value={trainee.hrZone5c ? `${trainee.hrZone5c} bpm` : null} />
            <InfoRow label="Lactate Threshold" value={trainee.lactateThresholdHr ? `${trainee.lactateThresholdHr} bpm` : null} />
            <InfoRow label="Target Speed" value={
              trainee.targetSpeedFrom && trainee.targetSpeedTo
                ? `${trainee.targetSpeedFrom} – ${trainee.targetSpeedTo} min/km`
                : null
            } />
            <InfoRow label="Test Date" value={trainee.testDate} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Billing</CardTitle>
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
            <InfoRow label="Total Charged" value={balance ? `$${balance.totalCharged.toFixed(2)}` : null} />
            <InfoRow label="Total Paid" value={balance ? `$${balance.totalPaid.toFixed(2)}` : null} />
            <InfoRow label="Monthly Fee" value={balance?.monthlyFee ? `$${balance.monthlyFee.toFixed(2)}` : null} />
            <InfoRow label="Preferred Payment" value={trainee.preferredPayment?.replace("_", " ")} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Transaction History</CardTitle>
          <AddTransactionDialog traineeId={traineeId} onSuccess={() => { refetchBalance(); refetchTx(); }} />
        </CardHeader>
        <CardContent>
          {sortedTx.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No transactions yet.</p>
          ) : (
            <div className="space-y-0 divide-y">
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
  );
}
