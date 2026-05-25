import { useEffect, useRef, useState } from "react";
import { useListTrainees } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { loadFacebookSdk } from "@/lib/meta-sdk";
import { Users, TrendingUp, Calendar, Shield, MessageCircleMore } from "lucide-react";
import { type TrainerInfo } from "@/hooks/use-auth";

interface ControlPanelProps {
  trainer: TrainerInfo;
}

type WhatsAppConnectionStatus = "not_connected" | "draft" | "pending_review" | "connected" | "disabled";

function canUseWhatsAppMessaging(connectionStatus: WhatsAppConnectionStatus) {
  return connectionStatus === "connected" || connectionStatus === "pending_review";
}

interface WhatsAppSettingsResponse {
  app: {
    appId: string | null;
    embeddedSignupConfigId: string | null;
    onboardingReady: boolean;
  };
  account: {
    connectionStatus: WhatsAppConnectionStatus;
    businessAccountId: string | null;
    phoneNumberId: string | null;
    displayPhoneNumber: string | null;
    businessName: string | null;
    webhookSubscribed: boolean;
    connectedAt: string | null;
    notes: string | null;
  };
}

interface EmbeddedSignupMessage {
  type?: string;
  event?: string;
  data?: {
    phone_number_id?: string;
    waba_id?: string;
    business_account_id?: string;
    current_step?: string;
    error_message?: string;
    error?: string;
  };
}

interface CompleteEmbeddedSignupResponse {
  account: {
    connectionStatus: WhatsAppConnectionStatus;
    businessAccountId: string | null;
    phoneNumberId: string | null;
    displayPhoneNumber: string | null;
    businessName: string | null;
    webhookSubscribed: boolean;
    connectedAt: string | null;
    notes?: string | null;
  };
}

interface WhatsAppMessageItem {
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
}

const statusOptions: Array<{ value: WhatsAppConnectionStatus; label: string }> = [
  { value: "not_connected", label: "Not connected" },
  { value: "draft", label: "Draft" },
  { value: "pending_review", label: "Pending review" },
  { value: "connected", label: "Connected" },
  { value: "disabled", label: "Disabled" },
];

async function fetchWhatsAppSettings(): Promise<WhatsAppSettingsResponse> {
  const res = await fetch("/api/trainer/whatsapp", {
    credentials: "include",
  });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error ?? "Failed to load WhatsApp settings");
  }

  return res.json();
}

async function saveWhatsAppSettings(payload: Record<string, unknown>) {
  const res = await fetch("/api/trainer/whatsapp", {
    method: "PUT",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error ?? "Failed to save WhatsApp settings");
  }

  return res.json();
}

async function completeEmbeddedSignup(payload: {
  code: string;
  wabaId?: string;
  phoneNumberId?: string;
}): Promise<CompleteEmbeddedSignupResponse> {
  const res = await fetch("/api/trainer/whatsapp/embedded-signup/complete", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error ?? "Failed to complete WhatsApp embedded signup");
  }

  return res.json();
}

async function fetchWhatsAppMessages(traineeId?: string) {
  const query = traineeId ? `?traineeId=${encodeURIComponent(traineeId)}` : "";
  const res = await fetch(`/api/trainer/whatsapp/messages${query}`, {
    credentials: "include",
  });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error ?? "Failed to load WhatsApp messages");
  }

  return res.json() as Promise<{ messages: WhatsAppMessageItem[] }>;
}

async function sendWhatsAppMessage(payload: { traineeId?: string; text: string }) {
  const res = await fetch("/api/trainer/whatsapp/messages", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error ?? "Failed to send WhatsApp message");
  }

  return res.json();
}

export default function ControlPanel({ trainer }: ControlPanelProps) {
  const { data: trainees } = useListTrainees({});
  const { toast } = useToast();
  const [whatsAppLoading, setWhatsAppLoading] = useState(true);
  const [whatsAppSaving, setWhatsAppSaving] = useState(false);
  const [embeddedSignupLoading, setEmbeddedSignupLoading] = useState(false);
  const [facebookSdkReady, setFacebookSdkReady] = useState(false);
  const [metaAppId, setMetaAppId] = useState<string | null>(null);
  const [embeddedSignupConfigId, setEmbeddedSignupConfigId] = useState<string | null>(null);
  const [onboardingReady, setOnboardingReady] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<WhatsAppConnectionStatus>("not_connected");
  const [businessAccountId, setBusinessAccountId] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [displayPhoneNumber, setDisplayPhoneNumber] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [webhookSubscribed, setWebhookSubscribed] = useState(false);
  const [notes, setNotes] = useState("");
  const [connectedAt, setConnectedAt] = useState<string | null>(null);
  const [messages, setMessages] = useState<WhatsAppMessageItem[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messageDraft, setMessageDraft] = useState("");
  const [messageSending, setMessageSending] = useState(false);
  const [selectedMessageTraineeId, setSelectedMessageTraineeId] = useState<string>("");
  const facebookSdkLoadedRef = useRef(false);
  const embeddedSignupCodeRef = useRef<string | null>(null);
  const embeddedSignupFallbackTimerRef = useRef<number | null>(null);
  const embeddedSignupCompletingRef = useRef(false);

  const total = trainees?.length ?? 0;
  const paid = trainees?.filter((t) => t.planType === "paid").length ?? 0;
  const free = trainees?.filter((t) => t.planType === "free").length ?? 0;
  const planned = trainees?.filter((t) => (t as any).isPlannedThisWeek).length ?? 0;

  const clearEmbeddedSignupFallbackTimer = () => {
    if (embeddedSignupFallbackTimerRef.current !== null) {
      window.clearTimeout(embeddedSignupFallbackTimerRef.current);
      embeddedSignupFallbackTimerRef.current = null;
    }
  };

  const applyEmbeddedSignupResult = (result: CompleteEmbeddedSignupResponse, description: string) => {
    setConnectionStatus(result.account.connectionStatus);
    setBusinessAccountId(result.account.businessAccountId ?? "");
    setPhoneNumberId(result.account.phoneNumberId ?? "");
    setDisplayPhoneNumber(result.account.displayPhoneNumber ?? "");
    setBusinessName(result.account.businessName ?? "");
    setWebhookSubscribed(result.account.webhookSubscribed);
    setConnectedAt(result.account.connectedAt ? String(result.account.connectedAt) : null);
    toast({
      title: result.account.connectionStatus === "connected" ? "WhatsApp connected" : "WhatsApp linked",
      description,
    });
  };

  const finishEmbeddedSignup = async (options?: { wabaId?: string; phoneNumberId?: string; description?: string }) => {
    if (!embeddedSignupCodeRef.current || embeddedSignupCompletingRef.current) {
      return;
    }

    embeddedSignupCompletingRef.current = true;
    clearEmbeddedSignupFallbackTimer();
    setWhatsAppSaving(true);

    try {
      const result = await completeEmbeddedSignup({
        code: embeddedSignupCodeRef.current,
        wabaId: options?.wabaId,
        phoneNumberId: options?.phoneNumberId,
      });

      applyEmbeddedSignupResult(
        result,
        options?.description ?? "Embedded signup finished and Meta account details were fetched automatically.",
      );
    } catch (error) {
      toast({
        title: "Embedded signup completion failed",
        description: error instanceof Error ? error.message : "Could not finish Meta WhatsApp account setup.",
        variant: "destructive",
      });
    } finally {
      embeddedSignupCodeRef.current = null;
      embeddedSignupCompletingRef.current = false;
      setWhatsAppSaving(false);
      setEmbeddedSignupLoading(false);
    }
  };

  useEffect(() => {
    fetchWhatsAppSettings()
      .then((data) => {
        setMetaAppId(data.app.appId);
        setEmbeddedSignupConfigId(data.app.embeddedSignupConfigId);
        setOnboardingReady(data.app.onboardingReady);
        setConnectionStatus(data.account.connectionStatus);
        setBusinessAccountId(data.account.businessAccountId ?? "");
        setPhoneNumberId(data.account.phoneNumberId ?? "");
        setDisplayPhoneNumber(data.account.displayPhoneNumber ?? "");
        setBusinessName(data.account.businessName ?? "");
        setWebhookSubscribed(data.account.webhookSubscribed);
        setNotes(data.account.notes ?? "");
        setConnectedAt(data.account.connectedAt);
      })
      .catch((error: unknown) => {
        toast({
          title: "WhatsApp setup unavailable",
          description: error instanceof Error ? error.message : "Failed to load WhatsApp settings",
          variant: "destructive",
        });
      })
      .finally(() => {
        setWhatsAppLoading(false);
      });
  }, [toast]);

  useEffect(() => {
    if (!metaAppId || !onboardingReady || facebookSdkLoadedRef.current) {
      return;
    }

    loadFacebookSdk(metaAppId)
      .then(() => {
        facebookSdkLoadedRef.current = true;
        setFacebookSdkReady(true);
      })
      .catch((error) => {
        setFacebookSdkReady(false);
        toast({
          title: "Facebook SDK failed",
          description: error instanceof Error ? error.message : "Could not load the Facebook SDK.",
          variant: "destructive",
        });
      });
  }, [metaAppId, onboardingReady, toast]);

  useEffect(() => {
    if (!onboardingReady) {
      setFacebookSdkReady(false);
    }
  }, [onboardingReady]);

  useEffect(() => {
    if (!canUseWhatsAppMessaging(connectionStatus)) {
      setMessages([]);
      return;
    }

    setMessagesLoading(true);
    fetchWhatsAppMessages(selectedMessageTraineeId || undefined)
      .then((data) => setMessages(data.messages))
      .catch((error) => {
        toast({
          title: "Could not load WhatsApp messages",
          description: error instanceof Error ? error.message : "Failed to load recent WhatsApp messages.",
          variant: "destructive",
        });
      })
      .finally(() => setMessagesLoading(false));
  }, [connectionStatus, selectedMessageTraineeId, toast]);

  useEffect(() => {
    const handleEmbeddedSignupMessage = async (event: MessageEvent<string>) => {
      if (event.origin !== "https://www.facebook.com" && event.origin !== "https://web.facebook.com") {
        return;
      }

      if (typeof event.data !== "string") {
        return;
      }

      let message: EmbeddedSignupMessage;

      try {
        message = JSON.parse(event.data) as EmbeddedSignupMessage;
      } catch {
        return;
      }

      if (message.type !== "WA_EMBEDDED_SIGNUP") {
        return;
      }

      if (message.event === "FINISH") {
        const nextBusinessAccountId = message.data?.waba_id ?? message.data?.business_account_id ?? "";
        const nextPhoneNumberId = message.data?.phone_number_id ?? "";
        clearEmbeddedSignupFallbackTimer();

        if (!embeddedSignupCodeRef.current) {
          setEmbeddedSignupLoading(false);
          toast({
            title: "Authorization code missing",
            description: "Meta finished signup but did not provide a usable authorization code to complete account setup.",
            variant: "destructive",
          });
          return;
        }

        await finishEmbeddedSignup({
          wabaId: nextBusinessAccountId,
          phoneNumberId: nextPhoneNumberId,
          description: "Meta account details were saved. The phone number may need a few minutes to finish registering before messages can be sent.",
        });

        return;
      }

      if (message.event === "CANCEL") {
        clearEmbeddedSignupFallbackTimer();
        embeddedSignupCodeRef.current = null;
        setEmbeddedSignupLoading(false);
        toast({
          title: "Embedded signup cancelled",
          description: message.data?.current_step
            ? `Meta signup was cancelled at step ${message.data.current_step}.`
            : "Meta signup was cancelled before completion.",
        });
        return;
      }

      if (message.event === "ERROR") {
        clearEmbeddedSignupFallbackTimer();
        embeddedSignupCodeRef.current = null;
        setEmbeddedSignupLoading(false);
        toast({
          title: "Embedded signup failed",
          description: message.data?.error_message ?? message.data?.error ?? "Meta returned an unknown signup error.",
          variant: "destructive",
        });
      }
    };

    window.addEventListener("message", handleEmbeddedSignupMessage);
    return () => {
      clearEmbeddedSignupFallbackTimer();
      window.removeEventListener("message", handleEmbeddedSignupMessage);
    };
  }, [toast]);

  const handleSaveWhatsApp = async () => {
    setWhatsAppSaving(true);

    try {
      const result = await saveWhatsAppSettings({
        connectionStatus,
        businessAccountId,
        phoneNumberId,
        displayPhoneNumber,
        businessName,
        webhookSubscribed,
        notes,
      });

      setConnectedAt(result.connectedAt ? String(result.connectedAt) : null);
      toast({
        title: "WhatsApp settings saved",
        description: "Trainer-specific WhatsApp Business account details were updated.",
      });
    } catch (error) {
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Could not save WhatsApp settings",
        variant: "destructive",
      });
    } finally {
      setWhatsAppSaving(false);
    }
  };

  const handleLaunchEmbeddedSignup = async () => {
    if (!metaAppId || !embeddedSignupConfigId) {
      toast({
        title: "Meta configuration missing",
        description: "Set META_APP_ID and WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID before starting signup.",
        variant: "destructive",
      });
      return;
    }

    if (!window.FB || !facebookSdkReady) {
      toast({
        title: "Facebook SDK still loading",
        description: "Wait a second and try again. If it never becomes ready, refresh the page.",
      });
      return;
    }

    setEmbeddedSignupLoading(true);

    try {
      window.FB.login(
        (response) => {
          if (response.authResponse?.code) {
            embeddedSignupCodeRef.current = response.authResponse.code;
            clearEmbeddedSignupFallbackTimer();
            embeddedSignupFallbackTimerRef.current = window.setTimeout(() => {
              void finishEmbeddedSignup({
                description: "Meta account details were saved using the server-side fallback lookup. The phone number may need a few minutes to finish registering before messages can be sent.",
              });
            }, 4000);
            toast({
              title: "Authorization granted",
              description: "Meta returned an authorization code. Waiting for embedded signup completion details.",
            });
            return;
          }

          if (response.status !== "connected") {
            clearEmbeddedSignupFallbackTimer();
            embeddedSignupCodeRef.current = null;
            setEmbeddedSignupLoading(false);
            toast({
              title: "Login was not completed",
              description: "Meta login closed before completing WhatsApp embedded signup.",
            });
          }
        },
        {
          config_id: embeddedSignupConfigId,
          response_type: "code",
          override_default_response_type: true,
          extras: {
            sessionInfoVersion: 3,
          },
        },
      );
    } catch (error) {
      clearEmbeddedSignupFallbackTimer();
      embeddedSignupCodeRef.current = null;
      setEmbeddedSignupLoading(false);
      toast({
        title: "Embedded signup unavailable",
        description: error instanceof Error ? error.message : "Could not launch Meta embedded signup.",
        variant: "destructive",
      });
    }
  };

  const handleSendMessage = async () => {
    if (!selectedMessageTraineeId) {
      toast({
        title: "Choose a trainee",
        description: "Select a trainee with a phone number before sending a WhatsApp message.",
        variant: "destructive",
      });
      return;
    }

    if (!messageDraft.trim()) {
      toast({
        title: "Message is empty",
        description: "Type a message before sending.",
        variant: "destructive",
      });
      return;
    }

    setMessageSending(true);
    try {
      await sendWhatsAppMessage({
        traineeId: selectedMessageTraineeId,
        text: messageDraft.trim(),
      });
      setMessageDraft("");
      const data = await fetchWhatsAppMessages(selectedMessageTraineeId);
      setMessages(data.messages);
      toast({
        title: "WhatsApp message sent",
        description: "The message was accepted by Meta and stored in the trainer inbox.",
      });
    } catch (error) {
      toast({
        title: "Send failed",
        description: error instanceof Error ? error.message : "Could not send the WhatsApp message.",
        variant: "destructive",
      });
    } finally {
      setMessageSending(false);
    }
  };

  const traineesWithPhone = (trainees ?? []).filter((trainee) => Boolean(trainee.phone?.trim()));
  const selectedTrainee = traineesWithPhone.find((trainee) => String(trainee.id) === selectedMessageTraineeId);

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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageCircleMore className="h-4 w-4" />
            WhatsApp Business
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={connectionStatus === "connected" ? "default" : "outline"}>
              {statusOptions.find((option) => option.value === connectionStatus)?.label ?? connectionStatus}
            </Badge>
            <Badge variant={onboardingReady ? "default" : "outline"}>
              {onboardingReady ? "Meta app ready" : "Meta app setup incomplete"}
            </Badge>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-medium">Meta App ID</p>
              <Input value={metaAppId ?? "Not configured"} disabled />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Embedded Signup Config ID</p>
              <Input value={embeddedSignupConfigId ?? "Not configured"} disabled />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm font-medium">
              Connection status
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={connectionStatus}
                onChange={(event) => setConnectionStatus(event.target.value as WhatsAppConnectionStatus)}
                disabled={whatsAppLoading || whatsAppSaving}
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm font-medium">
              Display phone number
              <Input
                value={displayPhoneNumber}
                onChange={(event) => setDisplayPhoneNumber(event.target.value)}
                placeholder="e.g. +971 50 123 4567"
                disabled={whatsAppLoading || whatsAppSaving}
              />
            </label>

            <label className="space-y-2 text-sm font-medium">
              WhatsApp Business Account ID (WABA ID)
              <Input
                value={businessAccountId}
                onChange={(event) => setBusinessAccountId(event.target.value)}
                placeholder="Meta WhatsApp Business account ID"
                disabled={whatsAppLoading || whatsAppSaving}
              />
              <p className="text-xs font-normal text-muted-foreground">
                This should be the WhatsApp Business Account ID from Meta, not the Business Portfolio ID.
              </p>
            </label>

            <label className="space-y-2 text-sm font-medium">
              Phone number ID
              <Input
                value={phoneNumberId}
                onChange={(event) => setPhoneNumberId(event.target.value)}
                placeholder="WhatsApp phone number ID"
                disabled={whatsAppLoading || whatsAppSaving}
              />
            </label>

            <label className="space-y-2 text-sm font-medium md:col-span-2">
              Business name
              <Input
                value={businessName}
                onChange={(event) => setBusinessName(event.target.value)}
                placeholder="Trainer business name shown in WhatsApp"
                disabled={whatsAppLoading || whatsAppSaving}
              />
            </label>
          </div>

          <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm font-medium">Launch Meta Embedded Signup</p>
                <p className="text-sm text-muted-foreground">
                  This opens Meta onboarding so the trainer can connect their own WhatsApp Business account to Yallajog.
                </p>
              </div>
              <Button
                variant="secondary"
                onClick={handleLaunchEmbeddedSignup}
                disabled={!onboardingReady || !facebookSdkReady || whatsAppLoading || embeddedSignupLoading || whatsAppSaving}
              >
                {embeddedSignupLoading
                  ? "Opening Meta..."
                  : !facebookSdkReady && onboardingReady
                    ? "Loading Meta SDK..."
                    : "Connect WhatsApp with Meta"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              If the popup does not appear, allow popups for this site and make sure the button is not still in the loading state.
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={webhookSubscribed}
              onChange={(event) => setWebhookSubscribed(event.target.checked)}
              disabled={whatsAppLoading || whatsAppSaving}
            />
            Webhook subscription completed
          </label>

          <label className="space-y-2 text-sm font-medium block">
            Internal notes
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Track onboarding progress, template approvals, or missing Meta setup steps"
              rows={4}
              disabled={whatsAppLoading || whatsAppSaving}
            />
          </label>

          {connectedAt && (
            <p className="text-xs text-muted-foreground">
              Connected at {new Date(connectedAt).toLocaleString()}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Each trainer can keep their own WhatsApp Business account mapping here while the shared Meta app credentials stay on the server.
            </p>
            <Button onClick={handleSaveWhatsApp} disabled={whatsAppLoading || whatsAppSaving}>
              {whatsAppSaving ? "Saving..." : "Save WhatsApp settings"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageCircleMore className="h-4 w-4" />
            WhatsApp Inbox
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-[260px_minmax(0,1fr)]">
            <div className="space-y-2">
              <p className="text-sm font-medium">Send to trainee</p>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={selectedMessageTraineeId}
                onChange={(event) => setSelectedMessageTraineeId(event.target.value)}
                disabled={!canUseWhatsAppMessaging(connectionStatus) || messageSending}
              >
                <option value="">Select trainee</option>
                {traineesWithPhone.map((trainee) => (
                  <option key={trainee.id} value={String(trainee.id)}>
                    {trainee.name} {trainee.phone ? `(${trainee.phone})` : ""}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                {selectedTrainee?.phone
                  ? `Messages will be sent to ${selectedTrainee.phone}.`
                  : "Only trainees with phone numbers are available here."}
              </p>
            </div>

            <div className="space-y-3">
              <Textarea
                value={messageDraft}
                onChange={(event) => setMessageDraft(event.target.value)}
                placeholder="Type a WhatsApp message to the selected trainee"
                rows={4}
                disabled={!canUseWhatsAppMessaging(connectionStatus) || messageSending}
              />
              <div className="flex justify-end">
                <Button onClick={handleSendMessage} disabled={!canUseWhatsAppMessaging(connectionStatus) || messageSending}>
                  {messageSending ? "Sending..." : "Send WhatsApp message"}
                </Button>
              </div>
            </div>
          </div>

          <div className="rounded-lg border">
            <div className="border-b px-4 py-3">
              <p className="text-sm font-medium">Recent messages</p>
            </div>
            <div className="max-h-[420px] overflow-y-auto">
              {messagesLoading ? (
                <div className="p-4 text-sm text-muted-foreground">Loading messages...</div>
              ) : messages.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">
                  {canUseWhatsAppMessaging(connectionStatus)
                    ? "No WhatsApp messages stored yet. Send a test message or wait for an inbound webhook."
                    : "Connect WhatsApp first to load and send messages."}
                </div>
              ) : (
                <div className="divide-y">
                  {messages.map((message) => (
                    <div key={message.id} className="space-y-2 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={message.direction === "outgoing" ? "default" : "outline"}>
                          {message.direction === "outgoing" ? "Outgoing" : "Incoming"}
                        </Badge>
                        {message.status && <Badge variant="outline">{message.status}</Badge>}
                        {message.traineeName && <Badge variant="outline">{message.traineeName}</Badge>}
                        <span className="text-xs text-muted-foreground">
                          {new Date(message.sentAt ?? message.receivedAt ?? message.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{message.textBody ?? "Unsupported WhatsApp message type"}</p>
                      <p className="text-xs text-muted-foreground">
                        {message.direction === "outgoing"
                          ? `To ${message.toPhone ?? "unknown number"}`
                          : `From ${message.fromPhone ?? "unknown number"}`}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

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
