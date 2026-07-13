import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, productsTable, companiesTable } from "@workspace/db";
import { CreateProductBody } from "@workspace/api-zod";
import { requireAuth, requireModule } from '../lib/session.js';
import { isValidGtin } from '../lib/gs1.js';

const router: IRouter = Router();

router.use("/products", requireAuth, requireModule("products"));

function effectiveCompanyId(user: NonNullable<typeof globalThis> extends never ? never : { role: string; companyId: number | null }): number | null {
  if (user.role === "master" || user.role === "super_master") return null;
  return user.companyId;
}

router.get("/products", async (req, res): Promise<void> => {
  const cid = effectiveCompanyId(req.user!);
  const rows = cid
    ? await db
        .select()
        .from(productsTable)
        .where(eq(productsTable.companyId, cid))
        .orderBy(desc(productsTable.createdAt))
    : await db
        .select()
        .from(productsTable)
        .orderBy(desc(productsTable.createdAt));
  res.json(
    rows.map((r) => ({
      ...r,
      mrp: typeof r.mrp === "string" ? parseFloat(r.mrp) : r.mrp,
      description: r.sapDescription || "",
    })),
  );
});

router.post("/products", async (req, res): Promise<void> => {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  let companyId = req.user!.companyId || ((req.user!.role === "master" || req.user!.role === "super_master") ? (req.body.companyId || req.query.companyId) : null);
  if (!companyId) {
    res
      .status(400)
      .json({ error: "Master must select a company context to add products" });
    return;
  }

  const isGs1Compliant = parsed.data.isGs1Compliant ?? false;

  if (isGs1Compliant) {
    if (!parsed.data.gtin) {
      const [company] = await db
        .select({ gstin: companiesTable.gstin })
        .from(companiesTable)
        .where(eq(companiesTable.id, Number(companyId)));

      if (!company || !company.gstin) {
        res.status(400).json({ error: "GTIN or Company GST is required for GS1 compliant products" });
        return;
      }
    } else {
      if (!isValidGtin(parsed.data.gtin)) {
        res.status(400).json({ error: "Invalid GTIN check digit" });
        return;
      }
    }
  }

  const [row] = await db
    .insert(productsTable)
    .values({
      companyId: Number(companyId!),
      skuId: parsed.data.skuId,
      name: parsed.data.name,
      skuSize: parsed.data.skuSize,
      marketedBy: parsed.data.marketedBy,
      sapDescription: parsed.data.sapDescription ?? null,
      gtin: parsed.data.gtin ?? null,
      mrp: Number(parsed.data.mrp),
      registrationNo: parsed.data.registrationNo ?? null,
      hsnCode: parsed.data.hsnCode ?? null,
      gstRate: parsed.data.gstRate !== undefined && parsed.data.gstRate !== null ? Number(parsed.data.gstRate) : null,
      unit: parsed.data.unit ?? null,
      weightValue: parsed.data.weightValue !== undefined && parsed.data.weightValue !== null ? Number(parsed.data.weightValue) : null,
      weightUnit: parsed.data.weightUnit ?? null,
      packagingType: parsed.data.packagingType ?? null,
      shelfLifeDays: parsed.data.shelfLifeDays !== undefined && parsed.data.shelfLifeDays !== null ? Number(parsed.data.shelfLifeDays) : null,
      countryOfOrigin: parsed.data.countryOfOrigin ?? "IND",
      isGs1Compliant,
      l1Size: parsed.data.l1Size,
      l2Size: parsed.data.l2Size,
      shipperSize: parsed.data.shipperSize,
      cautionLogoUrl: parsed.data.cautionLogoUrl ?? null,
      productLogoUrl: parsed.data.productLogoUrl ?? null,
      labelPdfUrl: parsed.data.labelPdfUrl ?? null,
      expiryDate:
        parsed.data.expiryDate instanceof Date
          ? parsed.data.expiryDate.toISOString().slice(0, 10)
          : String(parsed.data.expiryDate).slice(0, 10),
    })
    .returning();
  res.status(201).json({
    ...row,
    mrp: typeof row!.mrp === "string" ? parseFloat(row!.mrp) : row!.mrp,
  });
});

router.delete("/products/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw ?? "", 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  await db.delete(productsTable).where(eq(productsTable.id, id));
  res.sendStatus(204);
});

export default router;
