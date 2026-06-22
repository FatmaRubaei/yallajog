import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Activity, Heart, Footprints, User } from "lucide-react";

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<GarminData | null>(null);

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

  const profile = data?.profile;
  const settings = data?.settings;
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
                disabled={loading}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Password</Label>
              <Input
                type="password"
                placeholder="........"
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={loading}
                onKeyDown={e => e.key === "Enter" && handleFetch()}
              />
            </div>
          </div>
          <Button onClick={handleFetch} disabled={loading || !username || !password}>
            {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Connecting...</> : "Fetch Data"}
          </Button>
        </CardContent>
      </Card>

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
                      {settings.userData.gender && <span>{settings.userData.gender}</span>}
                      {settings.userData.weight && <span>{(settings.userData.weight / 1000).toFixed(1)} kg</span>}
                      {settings.userData.height && <span>{settings.userData.height} cm</span>}
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
                      {data.heartRate.minHeartRate}-{data.heartRate.maxHeartRate} bpm range
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
                        {act.distance != null && act.distance > 0 && (
                          <p>{fmtDistance(act.distance)}</p>
                        )}
                        {act.duration != null && <p>{fmtDuration(act.duration)}</p>}
                        {act.averageSpeed != null && act.averageSpeed > 0 && (
                          <p>{fmtPace(act.averageSpeed)}</p>
                        )}
                        {act.averageHR != null && <p>{act.averageHR} bpm avg</p>}
                        {act.calories != null && <p>{act.calories} kcal</p>}
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
