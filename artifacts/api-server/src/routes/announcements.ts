import { Router } from "express";
import { db } from "@workspace/db";
import { announcementsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import {
  CreateAnnouncementBody,
  UpdateAnnouncementParams,
  UpdateAnnouncementBody,
  DeleteAnnouncementParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/", async (_req, res) => {
  const announcements = await db.select().from(announcementsTable);
  res.json(announcements);
});

router.post("/", async (req, res) => {
  const body = CreateAnnouncementBody.parse(req.body);
  const [announcement] = await db.insert(announcementsTable).values(body as any).returning();
  res.status(201).json(announcement);
});

router.put("/:id", async (req, res) => {
  const { id } = UpdateAnnouncementParams.parse({ id: Number(req.params.id) });
  const body = UpdateAnnouncementBody.parse(req.body);
  const [announcement] = await db.update(announcementsTable).set(body as any).where(eq(announcementsTable.id, id)).returning();
  if (!announcement) return res.status(404).json({ error: "Not found" });
  res.json(announcement);
});

router.delete("/:id", async (req, res) => {
  const { id } = DeleteAnnouncementParams.parse({ id: Number(req.params.id) });
  await db.delete(announcementsTable).where(eq(announcementsTable.id, id));
  res.status(204).end();
});

export default router;
