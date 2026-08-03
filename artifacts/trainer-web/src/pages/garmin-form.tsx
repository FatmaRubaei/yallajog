import { useState, useEffect } from "react";
import { Watch, Eye, EyeOff, ShieldCheck, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Status = "loading" | "ready" | "submitting" | "success" | "error" | "invalid";

export default function GarminFormPage() {
  const token = new URLSearchParams(window.location.search).get("token") ?? "";

  const [status, setStatus] = useState<Status>("loading");
  const [traineeName, setTraineeName] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [permission, setPermission] = useState(false);

  useEffect(() => {
    if (!token) { setStatus("invalid"); return; }
    fetch(`${BASE}/api/garmin-form/${token}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? "Invalid link");
        return r.json();
      })
      .then((d) => { setTraineeName(d.name ?? ""); setStatus("ready"); })
      .catch((e) => { setErrorMsg(e.message); setStatus("invalid"); });
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    try {
      const r = await fetch(`${BASE}/api/garmin-form/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ garminEmail: email, garminPassword: password, garminPermission: permission }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "Failed to save");
      setStatus("success");
    } catch (e: any) {
      setErrorMsg(e.message);
      setStatus("error");
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Watch className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Garmin Connect</h1>
            <p className="text-sm text-muted-foreground">YallaJog Training</p>
          </div>
        </div>

        {/* Loading */}
        {status === "loading" && (
          <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-sm">Verifying your link…</p>
          </div>
        )}

        {/* Invalid / expired */}
        {status === "invalid" && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center space-y-2">
            <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
            <p className="font-medium text-destructive">Link invalid or expired</p>
            <p className="text-sm text-muted-foreground">{errorMsg || "Please ask your trainer to send you a new link."}</p>
          </div>
        )}

        {/* Form */}
        {(status === "ready" || status === "submitting" || status === "error") && (
          <form onSubmit={handleSubmit} className="rounded-2xl border bg-card p-6 space-y-5 shadow-sm">
            <div>
              <p className="text-sm text-muted-foreground">
                Hi <span className="font-medium text-foreground">{traineeName.split(" ")[0]}</span>! Your trainer needs your Garmin Connect credentials to push workouts to your watch.
              </p>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Garmin Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Garmin Password</label>
              <div className="flex gap-2">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your Garmin password"
                  className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="rounded-lg border px-3 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Permission */}
            <label className="flex items-start gap-3 rounded-xl border bg-muted/30 p-4 cursor-pointer">
              <input
                type="checkbox"
                checked={permission}
                onChange={(e) => setPermission(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-primary cursor-pointer"
              />
              <div>
                <p className="text-sm font-medium leading-none">I grant permission</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  I allow my trainer to push and schedule workouts to my Garmin Connect account on my behalf.
                </p>
              </div>
            </label>

            {status === "error" && (
              <p className="text-sm text-destructive">{errorMsg}</p>
            )}

            <button
              type="submit"
              disabled={status === "submitting"}
              className="w-full rounded-lg bg-primary text-primary-foreground py-2.5 text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
            >
              {status === "submitting" ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
              ) : "Save credentials"}
            </button>
          </form>
        )}

        {/* Success */}
        {status === "success" && (
          <div className="rounded-2xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 p-8 text-center space-y-3">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
            <p className="font-semibold text-green-700 dark:text-green-400">Credentials saved!</p>
            <p className="text-sm text-muted-foreground">Your trainer can now sync workouts to your Garmin watch. You can close this page.</p>
          </div>
        )}
      </div>
    </div>
  );
}
