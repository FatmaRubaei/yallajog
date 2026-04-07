import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { trainersTable, traineesTable } from "@workspace/db/schema";
import { eq, isNull } from "drizzle-orm";

const router = Router();

router.post("/register", async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: "Name, email and password are required" });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }
  const existing = await db.select().from(trainersTable).where(eq(trainersTable.email, email.toLowerCase()));
  if (existing.length > 0) {
    return res.status(409).json({ error: "Email already registered" });
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const [trainer] = await db.insert(trainersTable).values({
    name,
    email: email.toLowerCase(),
    passwordHash,
  }).returning();

  const allTrainers = await db.select().from(trainersTable);
  if (allTrainers.length === 1) {
    await db.update(traineesTable)
      .set({ trainerId: trainer.id })
      .where(isNull(traineesTable.trainerId));
  }

  (req.session as any).trainerId = trainer.id;
  (req.session as any).trainerName = trainer.name;
  (req.session as any).trainerEmail = trainer.email;

  res.status(201).json({
    id: trainer.id,
    name: trainer.name,
    email: trainer.email,
    createdAt: trainer.createdAt,
  });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }
  const [trainer] = await db.select().from(trainersTable).where(eq(trainersTable.email, email.toLowerCase()));
  if (!trainer) {
    return res.status(401).json({ error: "Invalid email or password" });
  }
  const valid = await bcrypt.compare(password, trainer.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid email or password" });
  }
  (req.session as any).trainerId = trainer.id;
  (req.session as any).trainerName = trainer.name;
  (req.session as any).trainerEmail = trainer.email;

  res.json({
    id: trainer.id,
    name: trainer.name,
    email: trainer.email,
    createdAt: trainer.createdAt,
  });
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ ok: true });
  });
});

router.get("/me", (req, res) => {
  const session = req.session as any;
  if (!session.trainerId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  res.json({
    id: session.trainerId,
    name: session.trainerName,
    email: session.trainerEmail,
  });
});

export default router;
