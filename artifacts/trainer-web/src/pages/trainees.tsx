import { useState } from "react";
import { Link } from "wouter";
import {
  useListTrainees,
  useCreateTrainee,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users, Plus, Search, MapPin, Phone, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

function TraineeCard({ trainee }: { trainee: any }) {
  const { t } = useTranslation();
  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-base">
              {trainee.name?.charAt(0) ?? "?"}
            </div>
            <div>
              <Link href={`/trainees/${trainee.id}`}>
                <h3 className="font-semibold text-base hover:text-primary transition-colors">{trainee.name}</h3>
              </Link>
              <p className="text-xs text-muted-foreground">ID: {trainee.id}</p>
            </div>
          </div>
          <Badge variant={trainee.planType === "paid" ? "default" : "secondary"} className="text-xs">
            {trainee.planType === "paid" ? t("trainees.paid") : t("trainees.free")}
          </Badge>
        </div>
        <div className="space-y-1 text-sm text-muted-foreground">
          {trainee.city && (
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              <span>{trainee.city}</span>
            </div>
          )}
          {trainee.phone && (
            <div className="flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" />
              <span>{trainee.phone}</span>
            </div>
          )}
          {trainee.email && (
            <div className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              <span>{trainee.email}</span>
            </div>
          )}
        </div>
        <div className="mt-3 flex gap-2 text-xs text-muted-foreground border-t pt-3">
          <span>{t("trainees.runsPerWeek", { count: trainee.runsPerWeek ?? 0 })}</span>
          {trainee.targetHr && <span>· {t("trainees.targetHr", { hr: trainee.targetHr })}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function AddTraineeDialog({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    city: "",
    planType: "free" as "free" | "paid",
    runsPerWeek: "3",
  });

  const createMutation = useCreateTrainee();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createMutation.mutateAsync({
        data: {
          ...form,
          runsPerWeek: Number(form.runsPerWeek),
        },
      });
      toast({ title: t("trainees.createSuccess") });
      setOpen(false);
      onSuccess();
      setForm({ name: "", phone: "", email: "", city: "", planType: "free", runsPerWeek: "3" });
    } catch {
      toast({ title: t("trainees.createFailed"), variant: "destructive" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 me-2" /> {t("trainees.addTrainee")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("trainees.newTrainee")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1">
            <Label>{t("trainees.name")} *</Label>
            <Input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={t("trainees.namePlaceholder")}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>{t("trainees.phone")}</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+972..."
              />
            </div>
            <div className="space-y-1">
              <Label>{t("trainees.city")}</Label>
              <Input
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder={t("trainees.city")}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>{t("trainees.email")}</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="email@example.com"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>{t("trainees.planType")}</Label>
              <Select value={form.planType} onValueChange={(v: any) => setForm({ ...form, planType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">{t("trainees.freeOption")}</SelectItem>
                  <SelectItem value="paid">{t("trainees.paidOption")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{t("trainees.runsPerWeekLabel")}</Label>
              <Input
                type="number"
                min={1}
                max={7}
                value={form.runsPerWeek}
                onChange={(e) => setForm({ ...form, runsPerWeek: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "..." : t("trainees.create")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function TraineeList() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const { data: trainees, isLoading, refetch } = useListTrainees({});

  const filtered = (trainees ?? []).filter((trainee) =>
    trainee.name?.toLowerCase().includes(search.toLowerCase()) ||
    trainee.city?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("trainees.title")}</h1>
          <p className="text-muted-foreground mt-1">{trainees?.length ?? 0} total</p>
        </div>
        <AddTraineeDialog onSuccess={refetch} />
      </div>

      <div className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="ps-9"
          placeholder={t("trainees.search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-40 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
          <Users className="h-10 w-10" />
          <p className="text-base">{search ? t("trainees.noResults") : t("trainees.noTrainees")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((trainee) => (
            <TraineeCard key={trainee.id} trainee={trainee} />
          ))}
        </div>
      )}
    </div>
  );
}
