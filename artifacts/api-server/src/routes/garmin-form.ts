import { Router } from "express";
import { createHmac } from "crypto";
import { db } from "@workspace/db";
import { traineesTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

// ── Token helpers ─────────────────────────────────────────────────────────────

function secret() {
  return process.env.SESSION_SECRET ?? "garmin-form-secret";
}

export function generateGarminFormToken(traineeId: number): string {
  const expiry = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
  const payload = `${traineeId}.${expiry}`;
  const sig = createHmac("sha256", secret()).update(payload).digest("hex");
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}

function verifyToken(token: string): { traineeId: number } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString();
    const lastDot = decoded.lastIndexOf(".");
    if (lastDot === -1) return null;
    const payload = decoded.slice(0, lastDot);
    const sig = decoded.slice(lastDot + 1);
    const expectedSig = createHmac("sha256", secret()).update(payload).digest("hex");
    if (sig !== expectedSig) return null;
    const parts = payload.split(".");
    if (parts.length !== 2) return null;
    const [idStr, expiryStr] = parts;
    if (Date.now() > Number(expiryStr)) return null;
    return { traineeId: Number(idStr) };
  } catch {
    return null;
  }
}

// ── Public router (no auth required) ─────────────────────────────────────────

export const garminFormPublicRouter = Router();

/** GET /api/garmin-form/:token — return trainee first name for the form greeting */
garminFormPublicRouter.get("/garmin-form/:token", async (req, res) => {
  const verified = verifyToken(req.params.token);
  if (!verified) return res.status(401).json({ error: "Invalid or expired link" });

  const [trainee] = await db
    .select({ name: traineesTable.name })
    .from(traineesTable)
    .where(eq(traineesTable.id, verified.traineeId));

  if (!trainee) return res.status(404).json({ error: "Trainee not found" });

  return res.json({ name: trainee.name });
});

/** POST /api/garmin-form/:token/submit — trainee submits their credentials */
garminFormPublicRouter.post("/garmin-form/:token/submit", async (req, res) => {
  const verified = verifyToken(req.params.token);
  if (!verified) return res.status(401).json({ error: "Invalid or expired link" });

  const body = (req.body ?? {}) as Record<string, unknown>;
  const garminEmail = typeof body.garminEmail === "string" ? body.garminEmail.trim() : null;
  const garminPassword = typeof body.garminPassword === "string" ? body.garminPassword : null;
  const garminPermission = Boolean(body.garminPermission);

  if (!garminEmail || !garminPassword) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  await db
    .update(traineesTable)
    .set({ garminEmail, garminPassword, garminPermission })
    .where(eq(traineesTable.id, verified.traineeId));

  return res.json({ ok: true });
});

// ── Auth-protected router ─────────────────────────────────────────────────────

export const garminFormAuthRouter = Router();

/** POST /api/garmin-form/generate — generate a signed form link for a trainee */
garminFormAuthRouter.post("/garmin-form/generate", async (req, res) => {
  const trainerId = (req as any).trainerId as number;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const traineeId = Number(body.traineeId);

  if (!traineeId) return res.status(400).json({ error: "traineeId required" });

  const [trainee] = await db
    .select({ id: traineesTable.id })
    .from(traineesTable)
    .where(and(eq(traineesTable.id, traineeId), eq(traineesTable.trainerId, trainerId)));

  if (!trainee) return res.status(404).json({ error: "Trainee not found" });

  const token = generateGarminFormToken(trainee.id);
  return res.json({ token });
});
