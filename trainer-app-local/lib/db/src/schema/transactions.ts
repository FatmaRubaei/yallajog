import { pgTable, serial, integer, numeric, text, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { traineesTable } from "./trainees";

export const transactionsTable = pgTable("transactions", {
  id: serial("id").primaryKey(),
  traineeId: integer("trainee_id").notNull().references(() => traineesTable.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  activityMonth: text("activity_month").notNull(),
  method: text("method"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTransactionSchema = createInsertSchema(transactionsTable).omit({ id: true, createdAt: true });
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactionsTable.$inferSelect;
