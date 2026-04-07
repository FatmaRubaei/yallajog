import { Router } from "express";
import { db } from "@workspace/db";
import { transactionsTable, traineesTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import {
  ListTraineeTransactionsParams,
  CreateTransactionParams,
  CreateTransactionBody,
  DeleteTransactionParams,
  GetTraineeBalanceParams,
} from "@workspace/api-zod";

const router = Router({ mergeParams: true });

router.get("/", async (req, res) => {
  const { id } = ListTraineeTransactionsParams.parse({ id: Number(req.params.id) });
  const transactions = await db.select().from(transactionsTable).where(eq(transactionsTable.traineeId, id));
  res.json(transactions.map(t => ({ ...t, amount: Number(t.amount) })));
});

router.post("/", async (req, res) => {
  const { id } = CreateTransactionParams.parse({ id: Number(req.params.id) });
  const body = CreateTransactionBody.parse(req.body);
  const [transaction] = await db.insert(transactionsTable).values({
    traineeId: id,
    ...body,
  } as any).returning();
  res.status(201).json({ ...transaction, amount: Number(transaction.amount) });
});

router.delete("/:txId", async (req, res) => {
  const id = Number(req.params.id);
  const txId = Number(req.params.txId);
  await db.delete(transactionsTable).where(
    and(eq(transactionsTable.id, txId), eq(transactionsTable.traineeId, id))
  );
  res.status(204).end();
});

export const balanceRouter = Router({ mergeParams: true });

balanceRouter.get("/", async (req, res) => {
  const { id } = GetTraineeBalanceParams.parse({ id: Number(req.params.id) });
  const [trainee] = await db.select().from(traineesTable).where(eq(traineesTable.id, id));
  if (!trainee) return res.status(404).json({ error: "Not found" });
  const transactions = await db.select().from(transactionsTable).where(eq(transactionsTable.traineeId, id));
  const totalPaid = transactions.filter(t => Number(t.amount) > 0).reduce((s, t) => s + Number(t.amount), 0);
  const totalCharged = transactions.filter(t => Number(t.amount) < 0).reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
  res.json({
    traineeId: id,
    totalCharged,
    totalPaid,
    balance: totalCharged - totalPaid,
    monthlyFee: trainee.monthlyFee ? Number(trainee.monthlyFee) : null,
  });
});

export default router;
