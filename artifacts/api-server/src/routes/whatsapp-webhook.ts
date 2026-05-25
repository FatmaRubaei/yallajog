import { Router } from "express";
import { db } from "@workspace/db";
import { traineesTable, trainersTable, whatsappMessagesTable } from "@workspace/db/schema";
import { and, eq } from "drizzle-orm";
import { getMetaAppConfig, normalizePhone } from "../lib/whatsapp";

const router = Router();

type WebhookPayload = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        metadata?: {
          phone_number_id?: string;
          display_phone_number?: string;
        };
        contacts?: Array<{ wa_id?: string; profile?: { name?: string } }>;
        messages?: Array<{
          id?: string;
          from?: string;
          timestamp?: string;
          type?: string;
          text?: { body?: string };
        }>;
        statuses?: Array<{
          id?: string;
          status?: string;
          timestamp?: string;
          recipient_id?: string;
        }>;
      };
    }>;
  }>;
};

router.get("/whatsapp/webhook", (req, res) => {
  const mode = typeof req.query["hub.mode"] === "string" ? req.query["hub.mode"] : null;
  const token = typeof req.query["hub.verify_token"] === "string" ? req.query["hub.verify_token"] : null;
  const challenge = typeof req.query["hub.challenge"] === "string" ? req.query["hub.challenge"] : null;
  const verifyToken = getMetaAppConfig().webhookVerifyToken;

  if (mode === "subscribe" && token && challenge && verifyToken && token === verifyToken) {
    return res.status(200).send(challenge);
  }

  return res.status(403).json({ error: "Webhook verification failed" });
});

router.post("/whatsapp/webhook", async (req, res) => {
  const payload = (req.body ?? {}) as WebhookPayload;

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      const phoneNumberId = value?.metadata?.phone_number_id?.trim();

      if (!phoneNumberId) {
        continue;
      }

      const [trainer] = await db
        .select()
        .from(trainersTable)
        .where(eq(trainersTable.whatsappPhoneNumberId, phoneNumberId));

      if (!trainer) {
        continue;
      }

      for (const message of value?.messages ?? []) {
        const fromPhone = normalizePhone(message.from);
        const [trainee] = fromPhone
          ? await db
              .select()
              .from(traineesTable)
              .where(and(eq(traineesTable.trainerId, trainer.id), eq(traineesTable.phone, fromPhone)))
          : [undefined];

        await db
          .insert(whatsappMessagesTable)
          .values({
            trainerId: trainer.id,
            traineeId: trainee?.id ?? null,
            whatsappMessageId: message.id ?? null,
            direction: "incoming",
            messageType: message.type ?? "text",
            status: "received",
            fromPhone,
            toPhone: normalizePhone(value?.metadata?.display_phone_number),
            textBody: message.text?.body?.trim() || null,
            rawPayload: message,
            receivedAt: message.timestamp ? new Date(Number(message.timestamp) * 1000) : new Date(),
            lastStatusAt: new Date(),
          })
          .onConflictDoNothing();
      }

      for (const status of value?.statuses ?? []) {
        if (!status.id) {
          continue;
        }

        await db
          .update(whatsappMessagesTable)
          .set({
            status: status.status?.trim() || null,
            rawPayload: status,
            lastStatusAt: status.timestamp ? new Date(Number(status.timestamp) * 1000) : new Date(),
          })
          .where(eq(whatsappMessagesTable.whatsappMessageId, status.id));
      }
    }
  }

  return res.status(200).json({ received: true });
});

export default router;
