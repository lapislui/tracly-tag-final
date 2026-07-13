import { Router, type IRouter } from "express";
import { and, eq, desc } from "drizzle-orm";
import { db, batchesTable, productsTable } from "@workspace/db";
import { CreateBatchBody } from "@workspace/api-zod";
import { requireAuth, requireModule } from '../lib/session.js';

const router: IRouter = Router();

router.use("/batches", requireAuth, requireModule("batches"));

router.get("/batches", async (req, res): Promise<void> => {
  const rawProductId = req.query.productId;
  const productId =
    typeof rawProductId === "string" ? parseInt(rawProductId, 10) : null;

  const conds = [];
  if (productId && !Number.isNaN(productId)) {
    conds.push(eq(batchesTable.productId, productId));
  }
  if (req.user!.role !== "master" && req.user!.role !== "super_master") {
    conds.push(eq(productsTable.companyId, req.user!.companyId!));
  }
  const where = conds.length === 0 ? undefined : conds.length === 1 ? conds[0] : and(...conds);

  const rows = await db
    .select({
      id: batchesTable.id,
      productId: batchesTable.productId,
      productName: productsTable.name,
      batchNumber: batchesTable.batchNumber,
      mfgDate: batchesTable.mfgDate,
      expiryDate: batchesTable.expiryDate,
      createdAt: batchesTable.createdAt,
    })
    .from(batchesTable)
    .innerJoin(productsTable, eq(batchesTable.productId, productsTable.id))
    .where(where)
    .orderBy(desc(batchesTable.createdAt));
  res.json(rows);
});

router.post("/batches", async (req, res): Promise<void> => {
  const parsed = CreateBatchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const [row] = await db
      .insert(batchesTable)
      .values({
        productId: parsed.data.productId,
        batchNumber: parsed.data.batchNumber,
        mfgDate: parsed.data.mfgDate.toISOString(),
        expiryDate: parsed.data.expiryDate.toISOString(),
      })
      .returning();

    const [withProduct] = await db
      .select({
        id: batchesTable.id,
        productId: batchesTable.productId,
        productName: productsTable.name,
        batchNumber: batchesTable.batchNumber,
        mfgDate: batchesTable.mfgDate,
        expiryDate: batchesTable.expiryDate,
        createdAt: batchesTable.createdAt,
      })
      .from(batchesTable)
      .innerJoin(productsTable, eq(batchesTable.productId, productsTable.id))
      .where(eq(batchesTable.id, row!.id));

    res.status(201).json(withProduct);
  } catch (err) {
    req.log.error({ err }, "Batch create failed");
    res.status(400).json({ error: "Batch number must be unique per product" });
  }
});

router.delete("/batches/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw ?? "", 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  await db.delete(batchesTable).where(eq(batchesTable.id, id));
  res.sendStatus(204);
});

export default router;
