import { pgTable, serial, integer, text, date, timestamp, real, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { traineesTable } from "./trainees";
import { segmentsTable } from "./segments";

export const weekPlansTable = pgTable("week_plans", {
  id: serial("id").primaryKey(),
  traineeId: integer("trainee_id").notNull().references(() => traineesTable.id, { onDelete: "cascade" }),
  weekStart: date("week_start").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const runsTable = pgTable("runs", {
  id: serial("id").primaryKey(),
  weekPlanId: integer("week_plan_id").notNull().references(() => weekPlansTable.id, { onDelete: "cascade" }),
  name: text("name"),
  runType: text("run_type").notNull(),
  order: integer("order").notNull().default(0),
});

export const runSegmentsTable = pgTable("run_segments", {
  id: serial("id").primaryKey(),
  runId: integer("run_id").notNull().references(() => runsTable.id, { onDelete: "cascade" }),
  segmentId: integer("segment_id").references(() => segmentsTable.id, { onDelete: "set null" }),
  resolvedText: text("resolved_text").notNull(),
  segmentType: text("segment_type"),
  durationMinutes: real("duration_minutes"),
  distanceKm: real("distance_km"),
  pace: text("pace"),
  completed: boolean("completed").notNull().default(false),
  order: integer("order").notNull().default(0),
});

export const insertWeekPlanSchema = createInsertSchema(weekPlansTable).omit({ id: true, createdAt: true });
export type InsertWeekPlan = z.infer<typeof insertWeekPlanSchema>;
export type WeekPlan = typeof weekPlansTable.$inferSelect;

export const insertRunSchema = createInsertSchema(runsTable).omit({ id: true });
export type InsertRun = z.infer<typeof insertRunSchema>;
export type Run = typeof runsTable.$inferSelect;

export const insertRunSegmentSchema = createInsertSchema(runSegmentsTable).omit({ id: true });
export type InsertRunSegment = z.infer<typeof insertRunSegmentSchema>;
export type RunSegment = typeof runSegmentsTable.$inferSelect;
