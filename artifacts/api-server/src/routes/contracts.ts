import { Router } from "express";
import { db } from "@workspace/db";
import { traineesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import {
  GetTraineeContractParams,
  UpdateTraineeContractParams,
  UpdateTraineeContractBody,
} from "@workspace/api-zod";

const router = Router({ mergeParams: true });

router.get("/", async (req, res) => {
  const { id } = GetTraineeContractParams.parse({ id: Number(req.params.id) });
  const [trainee] = await db.select().from(traineesTable).where(eq(traineesTable.id, id));
  if (!trainee) return res.status(404).json({ error: "Not found" });
  res.json({
    id: trainee.id,
    traineeId: trainee.id,
    preferredPayment: trainee.preferredPayment,
    planType: trainee.planType,
    planFinishDate: trainee.planFinishDate,
    monthlyFee: trainee.monthlyFee ? Number(trainee.monthlyFee) : null,
    updatedAt: trainee.createdAt,
  });
});

router.put("/", async (req, res) => {
  const { id } = UpdateTraineeContractParams.parse({ id: Number(req.params.id) });
  const body = UpdateTraineeContractBody.parse(req.body);
  const [trainee] = await db.update(traineesTable).set(body as any).where(eq(traineesTable.id, id)).returning();
  if (!trainee) return res.status(404).json({ error: "Not found" });
  res.json({
    id: trainee.id,
    traineeId: trainee.id,
    preferredPayment: trainee.preferredPayment,
    planType: trainee.planType,
    planFinishDate: trainee.planFinishDate,
    monthlyFee: trainee.monthlyFee ? Number(trainee.monthlyFee) : null,
    updatedAt: trainee.createdAt,
  });
});

export default router;
