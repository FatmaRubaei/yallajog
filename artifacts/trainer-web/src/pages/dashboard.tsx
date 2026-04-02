import { useGetDashboardSummary, useGetTraineesNeedingAttention, getGetDashboardSummaryQueryKey, getGetTraineesNeedingAttentionQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, DollarSign, Activity, AlertCircle, Calendar } from "lucide-react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";

export default function Dashboard() {
  const { t } = useTranslation();
  const { data: summary, isLoading: isSummaryLoading } = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey() } });
  const { data: attention, isLoading: isAttentionLoading } = useGetTraineesNeedingAttention({ query: { queryKey: getGetTraineesNeedingAttentionQueryKey() } });

  if (isSummaryLoading || isAttentionLoading) {
    return <div className="space-y-4">
      <div className="h-8 w-64 bg-muted rounded animate-pulse"></div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <div key={i} className="h-32 bg-muted rounded-xl animate-pulse"></div>)}
      </div>
    </div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("dashboard.title")}</h1>
        <p className="text-muted-foreground mt-2">{t("dashboard.subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-s-4 border-s-amber-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">{t("dashboard.totalTrainees")}</CardTitle>
            <Users className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.totalTrainees || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {t("dashboard.activeAndPaid", { active: summary?.activeTrainees || 0, paid: summary?.paidTrainees || 0 })}
            </p>
          </CardContent>
        </Card>

        <Card className="border-s-4 border-s-blue-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">{t("dashboard.balanceDue")}</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${summary?.totalBalanceDue?.toLocaleString() || "0"}</div>
            <p className="text-xs text-muted-foreground mt-1">{t("dashboard.totalOutstanding")}</p>
          </CardContent>
        </Card>

        <Card className="border-s-4 border-s-red-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">{t("dashboard.weeklyActivity")}</CardTitle>
            <Activity className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.traineesWithActivity || 0} / {summary?.activeTrainees || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">{t("dashboard.traineesWithActivity")}</p>
          </CardContent>
        </Card>

        <Card className="border-s-4 border-s-slate-400">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">{t("dashboard.plannedThisWeek")}</CardTitle>
            <Calendar className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.traineesPlannedThisWeek || 0} / {summary?.activeTrainees || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">{t("dashboard.traineesWithPlans")}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="col-span-1 border-s-4 border-s-destructive">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center text-destructive">
              <AlertCircle className="w-5 h-5 me-2" />
              {t("dashboard.needingFeedback")}
            </CardTitle>
            <CardDescription>{t("dashboard.traineesRequiringAttention")}</CardDescription>
          </CardHeader>
          <CardContent>
            {attention?.needingFeedback?.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("dashboard.allCaughtUp")}</p>
            ) : (
              <ul className="space-y-3">
                {attention?.needingFeedback?.map(trainee => (
                  <li key={trainee.id} className="flex justify-between items-center text-sm">
                    <span className="font-medium">{trainee.name}</span>
                    <Link href={`/trainees/${trainee.id}`} className="text-primary hover:underline">{t("dashboard.view")}</Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{t("dashboard.inactiveThisWeek")}</CardTitle>
            <CardDescription>{t("dashboard.noRecentActivity")}</CardDescription>
          </CardHeader>
          <CardContent>
            {attention?.inactiveThisWeek?.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("dashboard.everyoneActive")}</p>
            ) : (
              <ul className="space-y-3">
                {attention?.inactiveThisWeek?.map(trainee => (
                  <li key={trainee.id} className="flex justify-between items-center text-sm">
                    <span className="font-medium">{trainee.name}</span>
                    <Link href={`/trainees/${trainee.id}`} className="text-primary hover:underline">{t("dashboard.view")}</Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{t("dashboard.outstandingBalances")}</CardTitle>
            <CardDescription>{t("dashboard.traineesWithBalance")}</CardDescription>
          </CardHeader>
          <CardContent>
            {attention?.withDueBalance?.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("dashboard.noOutstandingBalances")}</p>
            ) : (
              <ul className="space-y-3">
                {attention?.withDueBalance?.map(trainee => (
                  <li key={trainee.id} className="flex justify-between items-center text-sm">
                    <span className="font-medium">{trainee.name}</span>
                    <span className="text-destructive font-semibold">${trainee.balanceDue?.toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
