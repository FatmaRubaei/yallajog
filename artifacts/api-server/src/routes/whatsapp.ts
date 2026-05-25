import { Router } from "express";
import { db } from "@workspace/db";
import { whatsappMessagesTable, whatsappConnectionsTable, traineesTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

const WA_API_BASE = "https://graph.facebook.com/v19.0";

function getEnvConnection() {
  const phoneNumberId = process.env["WHATSAPP_PHONE_NUMBER_ID"];
  const accessToken = process.env["WHATSAPP_ACCESS_TOKEN"];
  const wabaId = process.env["WHATSAPP_WABA_ID"];
  if (!phoneNumberId || !accessToken) return null;
  return { phoneNumberId, accessToken, wabaId: wabaId ?? "" };
}

async function getTrainerConnection(trainerId: number) {
  const envConn = getEnvConnection();
  if (envConn) return envConn;
  const [conn] = await db
    .select()
    .from(whatsappConnectionsTable)
    .where(and(eq(whatsappConnectionsTable.trainerId, trainerId), eq(whatsappConnectionsTable.isActive, true)));
  if (!conn?.phoneNumberId || !conn?.accessToken) return null;
  return { phoneNumberId: conn.phoneNumberId, accessToken: conn.accessToken, wabaId: conn.wabaId ?? "" };
}

async function sendWhatsAppMessage(phoneNumberId: string, accessToken: string, to: string, body: string) {
  const normalizedTo = to.replace(/\D/g, "");
  const url = `${WA_API_BASE}/${phoneNumberId}/messages`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: normalizedTo,
      type: "text",
      text: { preview_url: false, body },
    }),
  });
  const data = await response.json() as any;
  if (!response.ok) {
    throw Object.assign(new Error(data?.error?.message ?? "WhatsApp API error"), { code: response.status, data });
  }
  return data;
}

router.get("/status", async (req, res) => {
  const trainerId = (req as any).trainerId as number;
  const conn = await getTrainerConnection(trainerId);
  res.json({
    configured: !!conn,
    hasEnvConfig: !!getEnvConnection(),
  });
});

router.get("/messages", async (req, res) => {
  const trainerId = (req as any).trainerId as number;
  const traineeId = req.query["traineeId"] ? Number(req.query["traineeId"]) : undefined;

  let messages;
  if (traineeId) {
    messages = await db
      .select()
      .from(whatsappMessagesTable)
      .where(and(eq(whatsappMessagesTable.trainerId, trainerId), eq(whatsappMessagesTable.traineeId, traineeId)))
      .orderBy(desc(whatsappMessagesTable.createdAt));
  } else {
    messages = await db
      .select()
      .from(whatsappMessagesTable)
      .where(eq(whatsappMessagesTable.trainerId, trainerId))
      .orderBy(desc(whatsappMessagesTable.createdAt));
  }
  res.json(messages);
});

router.post("/send", async (req, res) => {
  const trainerId = (req as any).trainerId as number;
  const { traineeId, to, body } = req.body as { traineeId?: number; to?: string; body: string };

  if (!body?.trim()) {
    return res.status(400).json({ error: "Message body is required" });
  }

  let toPhone = to;
  let resolvedTraineeId = traineeId;

  if (traineeId && !toPhone) {
    const [trainee] = await db.select().from(traineesTable).where(eq(traineesTable.id, traineeId));
    if (!trainee?.phone) {
      return res.status(400).json({ error: "Trainee has no phone number saved" });
    }
    toPhone = trainee.phone;
  }

  if (!toPhone) {
    return res.status(400).json({ error: "Phone number or traineeId is required" });
  }

  const conn = await getTrainerConnection(trainerId);
  if (!conn) {
    return res.status(503).json({ error: "WhatsApp not configured. Add WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN." });
  }

  const [msgRecord] = await db.insert(whatsappMessagesTable).values({
    trainerId,
    traineeId: resolvedTraineeId ?? null,
    direction: "outbound",
    toPhone,
    body,
    status: "pending",
  }).returning();

  try {
    const result = await sendWhatsAppMessage(conn.phoneNumberId, conn.accessToken, toPhone, body);
    const waMessageId = result?.messages?.[0]?.id ?? null;
    await db.update(whatsappMessagesTable)
      .set({ status: "sent", waMessageId })
      .where(eq(whatsappMessagesTable.id, msgRecord.id));
    res.json({ success: true, messageId: msgRecord.id, waMessageId });
  } catch (err: any) {
    logger.error({ err }, "WhatsApp send failed");
    const errorMsg = err?.data?.error?.message ?? err?.message ?? "Unknown error";
    await db.update(whatsappMessagesTable)
      .set({ status: "failed", errorMessage: errorMsg })
      .where(eq(whatsappMessagesTable.id, msgRecord.id));
    res.status(502).json({ error: errorMsg, code: err?.code, details: err?.data });
  }
});

router.post("/save-connection", async (req, res) => {
  const trainerId = (req as any).trainerId as number;
  const { phoneNumberId, accessToken, wabaId, phoneNumber } = req.body as any;

  if (!phoneNumberId || !accessToken) {
    return res.status(400).json({ error: "phoneNumberId and accessToken are required" });
  }

  await db
    .update(whatsappConnectionsTable)
    .set({ isActive: false })
    .where(eq(whatsappConnectionsTable.trainerId, trainerId));

  const [conn] = await db.insert(whatsappConnectionsTable).values({
    trainerId,
    phoneNumberId,
    accessToken,
    wabaId: wabaId ?? null,
    phoneNumber: phoneNumber ?? null,
    isActive: true,
  }).returning();

  res.json({ success: true, id: conn.id });
});

export const whatsappWebhookRouter = Router();

whatsappWebhookRouter.get("/", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  const verifyToken = process.env["WHATSAPP_WEBHOOK_VERIFY_TOKEN"] ?? "local-whatsapp-webhook-token";

  if (mode === "subscribe" && token === verifyToken) {
    logger.info("WhatsApp webhook verified");
    return res.status(200).send(challenge);
  }
  res.status(403).json({ error: "Forbidden" });
});

whatsappWebhookRouter.post("/", async (req, res) => {
  res.status(200).send("OK");

  try {
    const body = req.body as any;
    if (body?.object !== "whatsapp_business_account") return;

    for (const entry of body?.entry ?? []) {
      for (const change of entry?.changes ?? []) {
        const value = change?.value;

        for (const msg of value?.messages ?? []) {
          if (msg.type !== "text") continue;
          const fromPhone = msg.from;
          const msgBody = msg.text?.body ?? "";
          const waMessageId = msg.id;

          const [trainee] = await db.select().from(traineesTable).where(eq(traineesTable.phone, fromPhone));

          await db.insert(whatsappMessagesTable).values({
            trainerId: trainee?.trainerId ?? null,
            traineeId: trainee?.id ?? null,
            direction: "inbound",
            fromPhone,
            body: msgBody,
            waMessageId,
            status: "received",
          });
          logger.info({ fromPhone, msgBody }, "Received WhatsApp message");
        }

        for (const status of value?.statuses ?? []) {
          const waMessageId = status.id;
          const newStatus = status.status;
          await db
            .update(whatsappMessagesTable)
            .set({ status: newStatus })
            .where(eq(whatsappMessagesTable.waMessageId, waMessageId));
        }
      }
    }
  } catch (err) {
    logger.error({ err }, "WhatsApp webhook processing error");
  }
});

export default router;
