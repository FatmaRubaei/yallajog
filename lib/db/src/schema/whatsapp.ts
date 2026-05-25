import { pgTable, serial, text, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { traineesTable } from "./trainees";
import { trainersTable } from "./trainers";

export const whatsappMessagesTable = pgTable("whatsapp_messages", {
  id: serial("id").primaryKey(),
  trainerId: integer("trainer_id").references(() => trainersTable.id, { onDelete: "cascade" }),
  traineeId: integer("trainee_id").references(() => traineesTable.id, { onDelete: "set null" }),
  direction: text("direction").notNull(), // "outbound" | "inbound"
  toPhone: text("to_phone"),
  fromPhone: text("from_phone"),
  body: text("body").notNull(),
  waMessageId: text("wa_message_id"),
  status: text("status").notNull().default("pending"), // pending | sent | delivered | read | failed
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const whatsappConnectionsTable = pgTable("whatsapp_connections", {
  id: serial("id").primaryKey(),
  trainerId: integer("trainer_id").references(() => trainersTable.id, { onDelete: "cascade" }),
  wabaId: text("waba_id"),
  phoneNumberId: text("phone_number_id"),
  phoneNumber: text("phone_number"),
  accessToken: text("access_token"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type WhatsappMessage = typeof whatsappMessagesTable.$inferSelect;
export type WhatsappConnection = typeof whatsappConnectionsTable.$inferSelect;
