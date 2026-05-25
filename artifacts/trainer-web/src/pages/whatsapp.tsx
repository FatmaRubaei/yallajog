import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { loadFacebookSdk } from "@/lib/meta-sdk";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type WaAccount = {
  connectionStatus: string;
  businessAccountId: string | null;
  phoneNumberId: string | null;
  displayPhoneNumber: string | null;
  businessName: string | null;
  webhookSubscribed: boolean;
  connectedAt: string | null;
  notes: string | null;
};

type WaStatus = {
  app: {
    appId: string | null;
    embeddedSignupConfigId: string | null;
    onboardingReady: boolean;
  };
  account: WaAccount;
};

type WaMessage = {
  id: number;
  whatsappMessageId: string | null;
  direction: string;
  status: string | null;
  fromPhone: string | null;
  toPhone: string | null;
  textBody: string | null;
  sentAt: string | null;
  receivedAt: string | null;
  createdAt: string;
  traineeId: number | null;
  traineeName: string | null;
};

type Trainee = {
  id: number;
  name: string;
  phone: string | null;
};

function statusLabel(status: string) {
  switch (status) {
    case "connected": return "Connected";
    case "pending_review": return "Pending Review";
    case "not_connected": return "Not Connected";
    case "draft": return "Draft";
    case "disabled": return "Disabled";
    default: return status;
  }
}

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "connected": return "default";
    case "pending_review": return "secondary";
    case "disabled": return "destructive";
    default: return "outline";
  }
}

function formatTime(ts: string | null) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleString();
}

export default function WhatsAppPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [status, setStatus] = useState<WaStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [messages, setMessages] = useState<WaMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [trainees, setTrainees] = useState<Trainee[]>([]);
  const [selectedTrainee, setSelectedTrainee] = useState<string>("__all__");
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchStatus();
    fetchTrainees();
  }, []);

  useEffect(() => {
    fetchMessages();
  }, [selectedTrainee]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function fetchStatus() {
    setLoadingStatus(true);
    try {
      const res = await fetch(`${BASE}/api/trainer/whatsapp`, { credentials: "include" });
      if (res.ok) setStatus(await res.json());
    } finally {
      setLoadingStatus(false);
    }
  }

  async function fetchTrainees() {
    const res = await fetch(`${BASE}/api/trainees`, { credentials: "include" });
    if (res.ok) {
      const data = await res.json();
      setTrainees(data.trainees ?? data ?? []);
    }
  }

  async function fetchMessages() {
    setLoadingMessages(true);
    try {
      const params = selectedTrainee !== "__all__" ? `?traineeId=${selectedTrainee}` : "";
      const res = await fetch(`${BASE}/api/trainer/whatsapp/messages${params}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        const sorted = (data.messages ?? []).slice().sort(
          (a: WaMessage, b: WaMessage) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        setMessages(sorted);
      }
    } finally {
      setLoadingMessages(false);
    }
  }

  async function handleConnect() {
    if (!status?.app.appId || !status?.app.embeddedSignupConfigId) {
      toast({ title: "Meta app not configured on server", variant: "destructive" });
      return;
    }

    setConnecting(true);
    try {
      const fb = await loadFacebookSdk(status.app.appId);

      fb.login(
        async (response) => {
          if (response.authResponse?.code) {
            const code = response.authResponse.code;
            const res = await fetch(`${BASE}/api/trainer/whatsapp/embedded-signup/complete`, {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ code }),
            });
            const data = await res.json();
            if (res.ok) {
              toast({ title: "WhatsApp connected successfully" });
              await fetchStatus();
            } else {
              toast({ title: data.error ?? "Failed to complete signup", variant: "destructive" });
            }
          } else {
            toast({ title: "Meta login was cancelled or failed", variant: "destructive" });
          }
          setConnecting(false);
        },
        {
          config_id: status.app.embeddedSignupConfigId,
          response_type: "code",
          override_default_response_type: true,
        },
      );
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed to load Facebook SDK", variant: "destructive" });
      setConnecting(false);
    }
  }

  async function handleSend() {
    if (!messageText.trim()) return;
    if (selectedTrainee === "__all__") {
      toast({ title: "Select a trainee to send a message", variant: "destructive" });
      return;
    }

    setSending(true);
    try {
      const res = await fetch(`${BASE}/api/trainer/whatsapp/messages`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ traineeId: selectedTrainee, text: messageText.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessageText("");
        await fetchMessages();
        await fetchStatus();
      } else {
        toast({ title: data.error ?? "Failed to send message", variant: "destructive" });
      }
    } finally {
      setSending(false);
    }
  }

  const canSend =
    status?.account.connectionStatus === "connected" ||
    status?.account.connectionStatus === "pending_review";

  const selectedTraineeObj = trainees.find((t) => String(t.id) === selectedTrainee);

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold">WhatsApp</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connection Status</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingStatus ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : status ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <Badge variant={statusVariant(status.account.connectionStatus)}>
                  {statusLabel(status.account.connectionStatus)}
                </Badge>
                {status.account.displayPhoneNumber && (
                  <span className="text-sm font-medium">{status.account.displayPhoneNumber}</span>
                )}
                {status.account.businessName && (
                  <span className="text-sm text-muted-foreground">{status.account.businessName}</span>
                )}
              </div>
              {status.account.connectedAt && (
                <p className="text-xs text-muted-foreground">
                  Connected {formatTime(status.account.connectedAt)}
                </p>
              )}
              {status.account.connectionStatus === "not_connected" && (
                <div className="mt-2">
                  {status.app.onboardingReady ? (
                    <Button onClick={handleConnect} disabled={connecting}>
                      {connecting ? "Connecting..." : "Connect WhatsApp with Meta"}
                    </Button>
                  ) : (
                    <p className="text-sm text-destructive">
                      Meta app is not fully configured on the server. Set META_APP_ID, META_APP_SECRET, and WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID.
                    </p>
                  )}
                </div>
              )}
              {status.account.connectionStatus === "pending_review" && (
                <p className="text-sm text-muted-foreground">
                  WhatsApp number linked. Waiting for Meta to complete verification. You can try sending messages — if approved it will switch to Connected automatically.
                </p>
              )}
              {(status.account.connectionStatus === "connected" || status.account.connectionStatus === "pending_review") && (
                <Button variant="outline" size="sm" className="w-fit" onClick={handleConnect} disabled={connecting}>
                  {connecting ? "Connecting..." : "Reconnect"}
                </Button>
              )}
            </div>
          ) : (
            <p className="text-sm text-destructive">Could not load WhatsApp status.</p>
          )}
        </CardContent>
      </Card>

      <Card className="flex-1">
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle className="text-base">Messages</CardTitle>
            <div className="flex items-center gap-2">
              <Select value={selectedTrainee} onValueChange={setSelectedTrainee}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All trainees" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All trainees</SelectItem>
                  {trainees.map((tr) => (
                    <SelectItem key={tr.id} value={String(tr.id)}>
                      {tr.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={fetchMessages} disabled={loadingMessages}>
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="border rounded-lg bg-muted/20 min-h-[320px] max-h-[420px] overflow-y-auto p-4 flex flex-col gap-2">
            {loadingMessages ? (
              <p className="text-sm text-muted-foreground text-center mt-8">Loading messages...</p>
            ) : messages.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center mt-8">No messages yet.</p>
            ) : (
              messages.map((msg) => {
                const isOut = msg.direction === "outgoing";
                return (
                  <div key={msg.id} className={`flex ${isOut ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[72%] rounded-xl px-3 py-2 text-sm ${
                        isOut
                          ? "bg-primary text-primary-foreground"
                          : "bg-background border"
                      }`}
                    >
                      {!isOut && msg.traineeName && (
                        <p className="text-xs font-semibold mb-1 opacity-70">{msg.traineeName}</p>
                      )}
                      <p className="whitespace-pre-wrap break-words">{msg.textBody ?? ""}</p>
                      <p className={`text-xs mt-1 opacity-60 ${isOut ? "text-right" : "text-left"}`}>
                        {formatTime(isOut ? msg.sentAt : msg.receivedAt) || formatTime(msg.createdAt)}
                        {isOut && msg.status && (
                          <span className="ml-2">{msg.status}</span>
                        )}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {canSend ? (
            <div className="flex gap-2">
              <Textarea
                className="flex-1 min-h-[60px] resize-none"
                placeholder={
                  selectedTrainee === "__all__"
                    ? "Select a trainee above to send a message"
                    : `Message${selectedTraineeObj ? ` ${selectedTraineeObj.name}` : ""}...`
                }
                value={messageText}
                disabled={selectedTrainee === "__all__"}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
              <Button
                className="self-end"
                onClick={handleSend}
                disabled={sending || !messageText.trim() || selectedTrainee === "__all__"}
              >
                {sending ? "Sending..." : "Send"}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Connect WhatsApp above to send messages.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
