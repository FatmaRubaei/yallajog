import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const segmentTypesTable = pgTable("segment_types", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
});

export const segmentsTable = pgTable("segments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  typeId: integer("type_id").references(() => segmentTypesTable.id, { onDelete: "set null" }),
  template: text("template").notNull(),
  description: text("description"),
  isPersonal: boolean("is_personal").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSegmentTypeSchema = createInsertSchema(segmentTypesTable).omit({ id: true });
export type InsertSegmentType = z.infer<typeof insertSegmentTypeSchema>;
export type SegmentType = typeof segmentTypesTable.$inferSelect;

export const insertSegmentSchema = createInsertSchema(segmentsTable).omit({ id: true, createdAt: true });
export type InsertSegment = z.infer<typeof insertSegmentSchema>;
export type Segment = typeof segmentsTable.$inferSelect;
