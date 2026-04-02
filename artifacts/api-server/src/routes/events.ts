import { Router } from "express";
import { db } from "@workspace/db";
import { eventsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import {
  CreateEventBody,
  UpdateEventParams,
  UpdateEventBody,
  DeleteEventParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/", async (_req, res) => {
  const events = await db.select().from(eventsTable);
  res.json(events);
});

router.post("/", async (req, res) => {
  const body = CreateEventBody.parse(req.body);
  const [event] = await db.insert(eventsTable).values(body as any).returning();
  res.status(201).json(event);
});

router.put("/:id", async (req, res) => {
  const { id } = UpdateEventParams.parse({ id: Number(req.params.id) });
  const body = UpdateEventBody.parse(req.body);
  const [event] = await db.update(eventsTable).set(body as any).where(eq(eventsTable.id, id)).returning();
  if (!event) return res.status(404).json({ error: "Not found" });
  res.json(event);
});

router.delete("/:id", async (req, res) => {
  const { id } = DeleteEventParams.parse({ id: Number(req.params.id) });
  await db.delete(eventsTable).where(eq(eventsTable.id, id));
  res.status(204).end();
});

export default router;
