import { useListTrainees } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, TrendingUp, Calendar, Shield } from "lucide-react";
import { type TrainerInfo } from "@/hooks/use-auth";

interface ControlPanelProps {
  trainer: TrainerInfo;
}

export default function ControlPanel({ trainer }: ControlPanelProps) {
  const { data: trainees } = useListTrainees({});

  const total = trainees?.length ?? 0;
  const paid = trainees?.filter((t) => t.planType === "paid").length ?? 0;
  const free = trainees?.filter((t) => t.planType === "free").length ?? 0;
  const planned = trainees?.filter((t) => (t as any).isPlannedThisWeek).length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Control Panel</h1>
        <p className="text-muted-foreground mt-1">Your account and training overview</p>
      </div>

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xl">
            {trainer.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <p className="font-semibold text-lg">{trainer.name}</p>
            <p className="text-sm text-muted-foreground">{trainer.email}</p>
          </div>
          <Badge className="bg-primary/10 text-primary border-primary/20">Trainer</Badge>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{total}</p>
                <p className="text-xs text-muted-foreground">Total Trainees</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{paid}</p>
                <p className="text-xs text-muted-foreground">Paid Plan</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <Shield className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{free}</p>
                <p className="text-xs text-muted-foreground">Free Plan</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{planned}</p>
                <p className="text-xs text-muted-foreground">Planned This Week</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {trainees && trainees.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your Trainees</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {trainees.map((t) => (
                <div key={t.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold">
                      {t.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.city ?? "No city"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={t.planType === "paid" ? "default" : "outline"} className="text-xs">
                      {t.planType}
                    </Badge>
                    {(t as any).isPlannedThisWeek && (
                      <Badge variant="outline" className="text-xs text-green-600 border-green-300">
                        Active
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
