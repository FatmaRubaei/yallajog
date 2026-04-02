import { useGetDashboardSummary, useGetTraineesNeedingAttention, getGetDashboardSummaryQueryKey, getGetTraineesNeedingAttentionQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, DollarSign, Activity, AlertCircle, Calendar } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
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
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-2">Overview of your training business.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Total Trainees</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.totalTrainees || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {summary?.activeTrainees || 0} active, {summary?.paidTrainees || 0} paid
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Balance Due</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${summary?.totalBalanceDue?.toLocaleString() || "0"}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Total outstanding balance
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Weekly Activity</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.traineesWithActivity || 0} / {summary?.activeTrainees || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Trainees with logged activity
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Planned This Week</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.traineesPlannedThisWeek || 0} / {summary?.activeTrainees || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Trainees with plans ready
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="col-span-1 border-destructive/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center text-destructive">
              <AlertCircle className="w-5 h-5 mr-2" />
              Needing Feedback
            </CardTitle>
            <CardDescription>Trainees requiring attention</CardDescription>
          </CardHeader>
          <CardContent>
            {attention?.needingFeedback?.length === 0 ? (
              <p className="text-sm text-muted-foreground">All caught up.</p>
            ) : (
              <ul className="space-y-3">
                {attention?.needingFeedback?.map(t => (
                  <li key={t.id} className="flex justify-between items-center text-sm">
                    <span className="font-medium">{t.name}</span>
                    <Link href={`/trainees/${t.id}`} className="text-primary hover:underline">View</Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Inactive This Week</CardTitle>
            <CardDescription>Trainees with no recent activity</CardDescription>
          </CardHeader>
          <CardContent>
            {attention?.inactiveThisWeek?.length === 0 ? (
              <p className="text-sm text-muted-foreground">Everyone is active.</p>
            ) : (
              <ul className="space-y-3">
                {attention?.inactiveThisWeek?.map(t => (
                  <li key={t.id} className="flex justify-between items-center text-sm">
                    <span className="font-medium">{t.name}</span>
                    <Link href={`/trainees/${t.id}`} className="text-primary hover:underline">View</Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Outstanding Balances</CardTitle>
            <CardDescription>Trainees with balance due</CardDescription>
          </CardHeader>
          <CardContent>
            {attention?.withDueBalance?.length === 0 ? (
              <p className="text-sm text-muted-foreground">No outstanding balances.</p>
            ) : (
              <ul className="space-y-3">
                {attention?.withDueBalance?.map(t => (
                  <li key={t.id} className="flex justify-between items-center text-sm">
                    <span className="font-medium">{t.name}</span>
                    <span className="text-destructive font-semibold">${t.balanceDue?.toLocaleString()}</span>
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
