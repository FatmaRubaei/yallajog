import { Router } from "express";
import { db } from "@workspace/db";
import { traineesTable, trainersTable, whatsappMessagesTable } from "@workspace/db/schema";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import {
  exchangeEmbeddedSignupCode,
  fetchMetaGraphObject,
  getMetaAppConfig,
  MetaGraphError,
  normalizePhone,
  registerWhatsAppPhoneNumber,
  resolveEmbeddedSignupAccountSelection,
  sendWhatsAppTextMessage,
  subscribeEmbeddedSignupApp,
} from "../lib/whatsapp";
import { logger } from "../lib/logger";

const router = Router();

const allowedStatuses = new Set([
  "not_connected",
  "draft",
  "pending_review",
  "connected",
  "disabled",
]);

function normalizeOptionalText(value: unknown): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized === "" ? null : normalized;
}

function resolveConnectionStatus(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return allowedStatuses.has(normalized) ? normalized : undefined;
}

function isWebhookSubscribed(value: unknown): boolean | undefined {
  if (typeof value !== "boolean") {
    return undefined;
  }
  return value;
}

function normalizeRequiredText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized === "" ? null : normalized;
}

async function updateTrainerWhatsAppAccount(
  trainerId: number,
  updates: Record<string, unknown>,
) {
  const [trainer] = await db
    .update(trainersTable)
    .set(updates)
    .where(eq(trainersTable.id, trainerId))
    .returning();

  if (!trainer) {
    return null;
  }

  return {
    connectionStatus: trainer.whatsappConnectionStatus,
    businessAccountId: trainer.whatsappBusinessAccountId,
    phoneNumberId: trainer.whatsappPhoneNumberId,
    displayPhoneNumber: trainer.whatsappDisplayPhoneNumber,
    businessName: trainer.whatsappBusinessName,
    webhookSubscribed: trainer.whatsappWebhookSubscribed,
    connectedAt: trainer.whatsappConnectedAt,
    notes: trainer.whatsappNotes,
  };
}

function isWhatsAppReadyToSend(connectionStatus: string | null | undefined) {
  return connectionStatus === "connected" || connectionStatus === "pending_review";
}

function buildMetaSendErrorMessage(error: MetaGraphError) {
  const details = [error.message.trim()];
  if (error.code !== null) {
    details.push(`Meta code ${error.code}`);
  }
  if (error.type) {
    details.push(error.type);
  }
  return details.join(" | ");
}

router.get("/trainer/whatsapp", async (req, res) => {
  const trainerId = (req as any).trainerId as number;
  const [trainer] = await db
    .select()
    .from(trainersTable)
    .where(eq(trainersTable.id, trainerId));

  if (!trainer) {
    return res.status(404).json({ error: "Trainer not found" });
  }

  return res.json({
    app: {
      appId: getMetaAppConfig().appId,
      embeddedSignupConfigId: getMetaAppConfig().embeddedSignupConfigId,
      onboardingReady: getMetaAppConfig().onboardingReady,
    },
    account: {
      connectionStatus: trainer.whatsappConnectionStatus,
      businessAccountId: trainer.whatsappBusinessAccountId,
      phoneNumberId: trainer.whatsappPhoneNumberId,
      displayPhoneNumber: trainer.whatsappDisplayPhoneNumber,
      businessName: trainer.whatsappBusinessName,
      webhookSubscribed: trainer.whatsappWebhookSubscribed,
      connectedAt: trainer.whatsappConnectedAt,
      notes: trainer.whatsappNotes,
    },
  });
});

router.post("/trainer/whatsapp/embedded-signup/complete", async (req, res) => {
  const trainerId = (req as any).trainerId as number;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const code = normalizeRequiredText(body["code"]);
  const wabaId = normalizeRequiredText(body["wabaId"]);
  const phoneNumberId = normalizeRequiredText(body["phoneNumberId"]);

  if (!code) {
    return res.status(400).json({ error: "Meta authorization code is required" });
  }

  const metaConfig = getMetaAppConfig();

  if (!metaConfig.appId || !metaConfig.appSecret || !metaConfig.embeddedSignupConfigId) {
    return res.status(500).json({ error: "Meta app configuration is incomplete on the server" });
  }

  try {
    const accessToken = await exchangeEmbeddedSignupCode(code, metaConfig.appId, metaConfig.appSecret);
    const resolvedAccount = await resolveEmbeddedSignupAccountSelection(accessToken, {
      wabaId,
      phoneNumberId,
    });
    const resolvedWabaId = resolvedAccount.wabaId;
    const resolvedPhoneNumberId = resolvedAccount.phoneNumberId;

    if (!resolvedWabaId || !resolvedPhoneNumberId) {
      return res.status(400).json({ error: "Meta embedded signup did not return the expected WhatsApp IDs" });
    }

    const [waba, phoneNumber] = await Promise.all([
      fetchMetaGraphObject<{ id?: string; name?: string }>(resolvedWabaId, ["id", "name"], accessToken),
      fetchMetaGraphObject<{ id?: string; display_phone_number?: string; verified_name?: string }>(
        resolvedPhoneNumberId,
        ["id", "display_phone_number", "verified_name"],
        accessToken,
      ),
    ]);

    let webhookSubscribed = false;
    let phoneRegistered = false;
    const setupNotes: string[] = [];

    try {
      webhookSubscribed = await subscribeEmbeddedSignupApp(resolvedWabaId, accessToken);
    } catch (err) {
      webhookSubscribed = false;
      setupNotes.push(`Webhook subscription failed: ${err instanceof Error ? err.message : String(err)}`);
      logger.warn({ trainerId, wabaId: resolvedWabaId, err }, "WhatsApp WABA webhook subscription failed");
    }

    try {
      phoneRegistered = await registerWhatsAppPhoneNumber(resolvedPhoneNumberId, accessToken);
    } catch (err) {
      phoneRegistered = false;
      setupNotes.push(`Phone registration failed: ${err instanceof Error ? err.message : String(err)}`);
      logger.warn({ trainerId, phoneNumberId: resolvedPhoneNumberId, err }, "WhatsApp phone number registration failed");
    }

    const connectionStatus = phoneRegistered ? "connected" : "pending_review";
    const connectedAt = phoneRegistered ? new Date() : null;

    const account = await updateTrainerWhatsAppAccount(trainerId, {
      whatsappConnectionStatus: connectionStatus,
      whatsappBusinessAccountId: resolvedWabaId,
      whatsappPhoneNumberId: resolvedPhoneNumberId,
      whatsappDisplayPhoneNumber: phoneNumber.display_phone_number?.trim() || null,
      whatsappBusinessName: (waba.name?.trim() || phoneNumber.verified_name?.trim() || null),
      whatsappAccessToken: accessToken,
      whatsappAccessTokenUpdatedAt: new Date(),
      whatsappWebhookSubscribed: webhookSubscribed,
      whatsappConnectedAt: connectedAt,
      whatsappNotes: setupNotes.length > 0 ? setupNotes.join("\n") : null,
    });

    if (!account) {
      return res.status(404).json({ error: "Trainer not found" });
    }

    return res.json({
      account,
      meta: {
        wabaId: resolvedWabaId,
        phoneNumberId: resolvedPhoneNumberId,
        displayPhoneNumber: phoneNumber.display_phone_number?.trim() || null,
        businessName: (waba.name?.trim() || phoneNumber.verified_name?.trim() || null),
        webhookSubscribed,
        phoneRegistered,
        setupNotes,
      },
    });
  } catch (error) {
    return res.status(502).json({
      error: error instanceof Error ? error.message : "Meta embedded signup could not be completed",
    });
  }
});

router.put("/trainer/whatsapp", async (req, res) => {
  const trainerId = (req as any).trainerId as number;
  const body = (req.body ?? {}) as Record<string, unknown>;

  const connectionStatus = resolveConnectionStatus(body["connectionStatus"]);
  const businessAccountId = normalizeOptionalText(body["businessAccountId"]);
  const phoneNumberId = normalizeOptionalText(body["phoneNumberId"]);
  const displayPhoneNumber = normalizeOptionalText(body["displayPhoneNumber"]);
  const businessName = normalizeOptionalText(body["businessName"]);
  const notes = normalizeOptionalText(body["notes"]);
  const webhookSubscribed = isWebhookSubscribed(body["webhookSubscribed"]);

  if (body["connectionStatus"] !== undefined && !connectionStatus) {
    return res.status(400).json({ error: "Invalid WhatsApp connection status" });
  }

  const updates: Record<string, unknown> = {};

  if (connectionStatus) {
    updates.whatsappConnectionStatus = connectionStatus;
  }
  if (businessAccountId !== undefined) {
    updates.whatsappBusinessAccountId = businessAccountId;
  }
  if (phoneNumberId !== undefined) {
    updates.whatsappPhoneNumberId = phoneNumberId;
  }
  if (displayPhoneNumber !== undefined) {
    updates.whatsappDisplayPhoneNumber = displayPhoneNumber;
  }
  if (businessName !== undefined) {
    updates.whatsappBusinessName = businessName;
  }
  if (notes !== undefined) {
    updates.whatsappNotes = notes;
  }
  if (webhookSubscribed !== undefined) {
    updates.whatsappWebhookSubscribed = webhookSubscribed;
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "No WhatsApp settings were provided" });
  }

  if (connectionStatus === "connected") {
    updates.whatsappConnectedAt = new Date();
  }

  if (connectionStatus && connectionStatus !== "connected") {
    updates.whatsappConnectedAt = null;
  }

  const account = await updateTrainerWhatsAppAccount(trainerId, updates);

  if (!account) {
    return res.status(404).json({ error: "Trainer not found" });
  }

  return res.json(account);
});

router.get("/trainer/whatsapp/messages", async (req, res) => {
  const trainerId = (req as any).trainerId as number;
  const traineeId = normalizeRequiredText(req.query["traineeId"]);

  let whereClause;

  if (traineeId) {
    const [trainee] = await db
      .select({ phone: traineesTable.phone })
      .from(traineesTable)
      .where(and(eq(traineesTable.id, Number(traineeId)), eq(traineesTable.trainerId, trainerId)));

    const traineePhone = trainee?.phone ? normalizePhone(trainee.phone) : null;

    if (traineePhone) {
      // Match by traineeId OR by phone (with/without + prefix) for unlinked historical messages
      const phoneVariants = [traineePhone, traineePhone.replace(/^\+/, "")];
      whereClause = and(
        eq(whatsappMessagesTable.trainerId, trainerId),
        or(
          eq(whatsappMessagesTable.traineeId, Number(traineeId)),
          inArray(whatsappMessagesTable.fromPhone, phoneVariants),
          inArray(whatsappMessagesTable.toPhone, phoneVariants),
        ),
      );
    } else {
      whereClause = and(
        eq(whatsappMessagesTable.trainerId, trainerId),
        eq(whatsappMessagesTable.traineeId, Number(traineeId)),
      );
    }
  } else {
    whereClause = eq(whatsappMessagesTable.trainerId, trainerId);
  }

  const rows = await db
    .select({
      id: whatsappMessagesTable.id,
      whatsappMessageId: whatsappMessagesTable.whatsappMessageId,
      direction: whatsappMessagesTable.direction,
      status: whatsappMessagesTable.status,
      fromPhone: whatsappMessagesTable.fromPhone,
      toPhone: whatsappMessagesTable.toPhone,
      textBody: whatsappMessagesTable.textBody,
      sentAt: whatsappMessagesTable.sentAt,
      receivedAt: whatsappMessagesTable.receivedAt,
      createdAt: whatsappMessagesTable.createdAt,
      traineeId: whatsappMessagesTable.traineeId,
      traineeName: traineesTable.name,
    })
    .from(whatsappMessagesTable)
    .leftJoin(traineesTable, eq(traineesTable.id, whatsappMessagesTable.traineeId))
    .where(whereClause)
    .orderBy(desc(whatsappMessagesTable.createdAt))
    .limit(100);

  return res.json({
    messages: rows,
  });
});

router.post("/trainer/whatsapp/messages", async (req, res) => {
  const trainerId = (req as any).trainerId as number;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const messageText = normalizeRequiredText(body["text"]);
  const traineeIdValue = normalizeRequiredText(body["traineeId"]);
  const toPhoneNumberValue = normalizeRequiredText(body["toPhoneNumber"]);

  if (!messageText) {
    return res.status(400).json({ error: "Message text is required" });
  }

  const [trainer] = await db
    .select()
    .from(trainersTable)
    .where(eq(trainersTable.id, trainerId));

  if (!trainer) {
    return res.status(404).json({ error: "Trainer not found" });
  }

  if (!trainer.whatsappAccessToken || !trainer.whatsappPhoneNumberId || !isWhatsAppReadyToSend(trainer.whatsappConnectionStatus)) {
    return res.status(400).json({ error: "Connect WhatsApp with Meta before sending messages" });
  }

  let traineeId: number | null = null;
  let toPhoneNumber: string | null = normalizePhone(toPhoneNumberValue);

  if (traineeIdValue) {
    const parsedTraineeId = Number(traineeIdValue);
    const [trainee] = await db
      .select()
      .from(traineesTable)
      .where(and(eq(traineesTable.id, parsedTraineeId), eq(traineesTable.trainerId, trainerId)));

    if (!trainee) {
      return res.status(404).json({ error: "Trainee not found" });
    }

    traineeId = trainee.id;
    toPhoneNumber = normalizePhone(trainee.phone);
  }

  if (!toPhoneNumber) {
    return res.status(400).json({ error: "A valid trainee phone number is required" });
  }

  try {
    const result = await sendWhatsAppTextMessage({
      accessToken: trainer.whatsappAccessToken,
      phoneNumberId: trainer.whatsappPhoneNumberId,
      to: toPhoneNumber,
      text: messageText,
    });

    const [message] = await db
      .insert(whatsappMessagesTable)
      .values({
        trainerId,
        traineeId,
        whatsappMessageId: result.messages?.[0]?.id ?? null,
        direction: "outgoing",
        messageType: "text",
        status: "accepted",
        fromPhone: normalizePhone(trainer.whatsappDisplayPhoneNumber),
        toPhone: toPhoneNumber,
        textBody: messageText,
        rawPayload: result,
        sentAt: new Date(),
        lastStatusAt: new Date(),
      })
      .returning();

    if (trainer.whatsappConnectionStatus !== "connected") {
      await db
        .update(trainersTable)
        .set({
          whatsappConnectionStatus: "connected",
          whatsappConnectedAt: new Date(),
        })
        .where(eq(trainersTable.id, trainerId));
    }

    return res.status(201).json({ message });
  } catch (error) {
    if (error instanceof MetaGraphError && error.code === 133010) {
      await db
        .update(trainersTable)
        .set({
          whatsappConnectionStatus: "pending_review",
          whatsappConnectedAt: null,
        })
        .where(eq(trainersTable.id, trainerId));

      return res.status(409).json({
        error:
          "Meta linked this WhatsApp number, but it is not fully registered for sending yet. Finish the phone-number verification in Meta or wait a few minutes, then try again.",
        meta: { code: error.code, type: error.type },
      });
    }

    if (error instanceof MetaGraphError) {
      logger.warn(
        {
          trainerId,
          phoneNumberId: trainer.whatsappPhoneNumberId,
          metaError: { message: error.message, code: error.code, type: error.type },
        },
        "WhatsApp send rejected by Meta",
      );

      return res.status(502).json({
        error: buildMetaSendErrorMessage(error),
        meta: { code: error.code, type: error.type },
      });
    }

    return res.status(502).json({
      error: error instanceof Error ? error.message : "Failed to send WhatsApp message",
    });
  }
});

export default router;
