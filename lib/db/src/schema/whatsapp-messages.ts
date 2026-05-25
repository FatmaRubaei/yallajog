import { integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { trainersTable } from "./trainers";
import { traineesTable } from "./trainees";

export const whatsappMessagesTable = pgTable(
  "whatsapp_messages",
  {
    id: serial("id").primaryKey(),
    trainerId: integer("trainer_id")
      .notNull()
      .references(() => trainersTable.id, { onDelete: "cascade" }),
    traineeId: integer("trainee_id").references(() => traineesTable.id, { onDelete: "set null" }),
    whatsappMessageId: text("whatsapp_message_id"),
    direction: text("direction").notNull(),
    messageType: text("message_type").notNull().default("text"),
    status: text("status"),
    fromPhone: text("from_phone"),
    toPhone: text("to_phone"),
    textBody: text("text_body"),
    rawPayload: jsonb("raw_payload"),
    sentAt: timestamp("sent_at"),
    receivedAt: timestamp("received_at"),
    lastStatusAt: timestamp("last_status_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    whatsappMessageIdIdx: uniqueIndex("whatsapp_messages_whatsapp_message_id_idx").on(table.whatsappMessageId),
  }),
);

export type WhatsAppMessage = typeof whatsappMessagesTable.$inferSelect;
