import { boolean, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const trainersTable = pgTable("trainers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  whatsappConnectionStatus: text("whatsapp_connection_status").notNull().default("not_connected"),
  whatsappBusinessAccountId: text("whatsapp_business_account_id"),
  whatsappPhoneNumberId: text("whatsapp_phone_number_id"),
  whatsappDisplayPhoneNumber: text("whatsapp_display_phone_number"),
  whatsappBusinessName: text("whatsapp_business_name"),
  whatsappAccessToken: text("whatsapp_access_token"),
  whatsappAccessTokenUpdatedAt: timestamp("whatsapp_access_token_updated_at"),
  whatsappWebhookSubscribed: boolean("whatsapp_webhook_subscribed").notNull().default(false),
  whatsappConnectedAt: timestamp("whatsapp_connected_at"),
  whatsappNotes: text("whatsapp_notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTrainerSchema = createInsertSchema(trainersTable).omit({
  id: true,
  createdAt: true,
  whatsappConnectionStatus: true,
  whatsappBusinessAccountId: true,
  whatsappPhoneNumberId: true,
  whatsappDisplayPhoneNumber: true,
  whatsappBusinessName: true,
  whatsappAccessToken: true,
  whatsappAccessTokenUpdatedAt: true,
  whatsappWebhookSubscribed: true,
  whatsappConnectedAt: true,
  whatsappNotes: true,
});
export type InsertTrainer = z.infer<typeof insertTrainerSchema>;
export type Trainer = typeof trainersTable.$inferSelect;
