import { pgTable, serial, text, integer, numeric, boolean, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { trainersTable } from "./trainers";

export const traineesTable = pgTable("trainees", {
  id: serial("id").primaryKey(),
  trainerId: integer("trainer_id").references(() => trainersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  city: text("city"),
  birthdate: date("birthdate"),
  runsPerWeek: integer("runs_per_week"),
  hrZone4: integer("hr_zone4"),
  hrZone5a: integer("hr_zone5a"),
  hrZone5c: integer("hr_zone5c"),
  targetHr: integer("target_hr"),
  targetSpeedFrom: text("target_speed_from"),
  targetSpeedTo: text("target_speed_to"),
  testDate: date("test_date"),
  lactateThresholdHr: integer("lactate_threshold_hr"),
  preferredPayment: text("preferred_payment"),
  planType: text("plan_type").notNull().default("free"),
  planFinishDate: date("plan_finish_date"),
  monthlyFee: numeric("monthly_fee", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTraineeSchema = createInsertSchema(traineesTable).omit({ id: true, createdAt: true });
export type InsertTrainee = z.infer<typeof insertTraineeSchema>;
export type Trainee = typeof traineesTable.$inferSelect;
