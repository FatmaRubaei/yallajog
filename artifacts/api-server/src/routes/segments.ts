import { Router } from "express";
import { db } from "@workspace/db";
import { segmentsTable, segmentTypesTable } from "@workspace/db/schema";
import { eq, like, and } from "drizzle-orm";
import {
  ListSegmentsQueryParams,
  CreateSegmentBody,
  GetSegmentParams,
  UpdateSegmentParams,
  UpdateSegmentBody,
  DeleteSegmentParams,
  CreateSegmentTypeBody,
  UpdateSegmentTypeParams,
  UpdateSegmentTypeBody,
  DeleteSegmentTypeParams,
} from "@workspace/api-zod";

const router = Router();

async function buildSegmentResponse(seg: typeof segmentsTable.$inferSelect) {
  if (!seg.typeId) return { ...seg, type: "General" };
  const [st] = await db.select().from(segmentTypesTable).where(eq(segmentTypesTable.id, seg.typeId));
  return { ...seg, type: st?.name ?? "General" };
}

router.get("/", async (req, res) => {
  const parsed = ListSegmentsQueryParams.safeParse(req.query);
  const params = parsed.success ? parsed.data : {};
  let segs = await db.select().from(segmentsTable);
  if (params.search) {
    const q = params.search.toLowerCase();
    segs = segs.filter(s => s.name.toLowerCase().includes(q) || s.template.toLowerCase().includes(q));
  }
  const results = await Promise.all(segs.map(buildSegmentResponse));
  res.json(results);
});

router.post("/", async (req, res) => {
  const body = CreateSegmentBody.parse(req.body);
  const [seg] = await db.insert(segmentsTable).values(body as any).returning();
  res.status(201).json(await buildSegmentResponse(seg));
});

router.get("/:id", async (req, res) => {
  const { id } = GetSegmentParams.parse({ id: Number(req.params.id) });
  const [seg] = await db.select().from(segmentsTable).where(eq(segmentsTable.id, id));
  if (!seg) return res.status(404).json({ error: "Not found" });
  res.json(await buildSegmentResponse(seg));
});

router.put("/:id", async (req, res) => {
  const { id } = UpdateSegmentParams.parse({ id: Number(req.params.id) });
  const body = UpdateSegmentBody.parse(req.body);
  const [seg] = await db.update(segmentsTable).set(body as any).where(eq(segmentsTable.id, id)).returning();
  if (!seg) return res.status(404).json({ error: "Not found" });
  res.json(await buildSegmentResponse(seg));
});

router.delete("/:id", async (req, res) => {
  const { id } = DeleteSegmentParams.parse({ id: Number(req.params.id) });
  await db.delete(segmentsTable).where(eq(segmentsTable.id, id));
  res.status(204).end();
});

export const segmentTypesRouter = Router();

segmentTypesRouter.get("/", async (_req, res) => {
  const types = await db.select().from(segmentTypesTable);
  res.json(types);
});

segmentTypesRouter.post("/", async (req, res) => {
  const body = CreateSegmentTypeBody.parse(req.body);
  const [st] = await db.insert(segmentTypesTable).values(body).returning();
  res.status(201).json(st);
});

segmentTypesRouter.put("/:id", async (req, res) => {
  const { id } = UpdateSegmentTypeParams.parse({ id: Number(req.params.id) });
  const body = UpdateSegmentTypeBody.parse(req.body);
  const [st] = await db.update(segmentTypesTable).set(body).where(eq(segmentTypesTable.id, id)).returning();
  if (!st) return res.status(404).json({ error: "Not found" });
  res.json(st);
});

segmentTypesRouter.delete("/:id", async (req, res) => {
  const { id } = DeleteSegmentTypeParams.parse({ id: Number(req.params.id) });
  await db.delete(segmentTypesTable).where(eq(segmentTypesTable.id, id));
  res.status(204).end();
});

export default router;
