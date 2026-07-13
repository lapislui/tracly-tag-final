import { Router, type IRouter } from "express";
import { and, eq, gte, lte, sql, desc, count } from "drizzle-orm";
import {
  db,
  codesTable,
  productsTable,
  batchesTable,
  locationsTable,
  usersTable,
  companiesTable,
} from "@workspace/db";
import { requireAuth, requireModule } from '../lib/session.js';

const router: IRouter = Router();

router.use("/reports", requireAuth);

function companyScope(user: NonNullable<typeof globalThis> extends never ? never : { role: string; companyId: number | null }) {
  return (user.role === "master" || user.role === "super_master")
    ? undefined
    : eq(productsTable.companyId, user.companyId!);
}

function dateRangeConds(from: unknown, to: unknown) {
  const conds = [];
  if (typeof from === "string" && from.length > 0) {
    const d = new Date(from);
    if (!Number.isNaN(d.getTime())) conds.push(gte(codesTable.createdAt, d.toISOString()));
  }
  if (typeof to === "string" && to.length > 0) {
    const d = new Date(to);
    if (!Number.isNaN(d.getTime())) {
      // Make `to` inclusive of the entire day.
      d.setUTCHours(23, 59, 59, 999);
      conds.push(lte(codesTable.createdAt, d.toISOString()));
    }
  }
  return conds;
}

router.get("/reports/dashboard", requireModule("dashboard"), async (req, res): Promise<void> => {
  const scope = companyScope(req.user!);

  const [productsAgg] = await db
    .select({ count: count() })
    .from(productsTable)
    .where(
      (req.user!.role === "master" || req.user!.role === "super_master")
        ? undefined
        : eq(productsTable.companyId, req.user!.companyId!),
    );

  const [batchesAgg] = await db
    .select({ count: count() })
    .from(batchesTable)
    .innerJoin(productsTable, eq(batchesTable.productId, productsTable.id))
    .where(scope);

  const [codesAgg] = await db
    .select({
      total: count(),
      mapped: sql<number>`sum(case when ${codesTable.mapped} then 1 else 0 end)`,
      unmapped: sql<number>`sum(case when ${codesTable.mapped} then 0 else 1 end)`,
    })
    .from(codesTable)
    .innerJoin(productsTable, eq(codesTable.productId, productsTable.id))
    .where(scope);

  const [locsAgg] = await db
    .select({ count: count() })
    .from(locationsTable)
    .where(
      (req.user!.role === "master" || req.user!.role === "super_master")
        ? undefined
        : eq(locationsTable.companyId, req.user!.companyId!),
    );

  const [usersAgg] = await db
    .select({ count: count() })
    .from(usersTable)
    .where(
      (req.user!.role === "master" || req.user!.role === "super_master")
        ? undefined
        : eq(usersTable.companyId, req.user!.companyId!),
    );

  const [companiesAgg] = await db
    .select({ count: count() })
    .from(companiesTable);

  const recent = await db
    .select({
      id: codesTable.id,
      productId: codesTable.productId,
      productName: productsTable.name,
      batchId: codesTable.batchId,
      batchNumber: batchesTable.batchNumber,
      level: codesTable.level,
      rawString: codesTable.rawString,
      serialNumber: codesTable.serialNumber,
      ssccCode: codesTable.ssccCode,
      mapped: codesTable.mapped,
      mappedAt: codesTable.mappedAt,
      mappedByUserId: codesTable.mappedByUserId,
      mappedByUsername: usersTable.username,
      locationId: codesTable.locationId,
      locationName: locationsTable.locationName,
      createdAt: codesTable.createdAt,
    })
    .from(codesTable)
    .innerJoin(productsTable, eq(codesTable.productId, productsTable.id))
    .leftJoin(batchesTable, eq(codesTable.batchId, batchesTable.id))
    .leftJoin(usersTable, eq(codesTable.mappedByUserId, usersTable.id))
    .leftJoin(locationsTable, eq(codesTable.locationId, locationsTable.id))
    .where(scope)
    .orderBy(desc(codesTable.createdAt))
    .limit(10);

  const byLevel = await db
    .select({
      level: codesTable.level,
      count: count(),
    })
    .from(codesTable)
    .innerJoin(productsTable, eq(codesTable.productId, productsTable.id))
    .where(scope)
    .groupBy(codesTable.level);

  res.json({
    totalProducts: productsAgg?.count ?? 0,
    totalBatches: batchesAgg?.count ?? 0,
    totalCodes: codesAgg?.total ?? 0,
    totalMapped: codesAgg?.mapped ?? 0,
    totalUnmapped: codesAgg?.unmapped ?? 0,
    totalLocations: locsAgg?.count ?? 0,
    totalUsers: usersAgg?.count ?? 0,
    totalCompanies: companiesAgg?.count ?? 0,
    recentCodes: recent,
    codesByLevel: byLevel,
  });
});

router.get("/reports/stock", requireModule("reports"), async (req, res): Promise<void> => {
  const scope = companyScope(req.user!);
  const productId =
    typeof req.query.productId === "string"
      ? parseInt(req.query.productId, 10)
      : null;
  const conds = [];
  if (scope) conds.push(scope);
  if (productId && !Number.isNaN(productId)) {
    conds.push(eq(codesTable.productId, productId));
  }
  conds.push(...dateRangeConds(req.query.from, req.query.to));
  const where =
    conds.length === 0 ? undefined : conds.length === 1 ? conds[0] : and(...conds);

  const rows = await db
    .select({
      productId: productsTable.id,
      productName: productsTable.name,
      batchId: batchesTable.id,
      batchNumber: batchesTable.batchNumber,
      totalCodes: count(codesTable.id),
      mapped: sql<number>`sum(case when ${codesTable.mapped} then 1 else 0 end)`,
      unmapped: sql<number>`sum(case when ${codesTable.mapped} then 0 else 1 end)`,
      location: sql<string | null>`null`,
    })
    .from(codesTable)
    .innerJoin(productsTable, eq(codesTable.productId, productsTable.id))
    .innerJoin(batchesTable, eq(codesTable.batchId, batchesTable.id))
    .where(where)
    .groupBy(productsTable.id, productsTable.name, batchesTable.id, batchesTable.batchNumber);

  res.json(rows);
});

router.get("/reports/product", requireModule("reports"), async (req, res): Promise<void> => {
  const scope = companyScope(req.user!);
  const conds = [];
  if (scope) conds.push(scope);
  conds.push(...dateRangeConds(req.query.from, req.query.to));
  const where =
    conds.length === 0 ? undefined : conds.length === 1 ? conds[0] : and(...conds);
  const rows = await db
    .select({
      productId: productsTable.id,
      productName: productsTable.name,
      batchId: batchesTable.id,
      batchNumber: batchesTable.batchNumber,
      size: productsTable.skuSize,
      total: count(codesTable.id),
      mapped: sql<number>`sum(case when ${codesTable.mapped} then 1 else 0 end)`,
      unmapped: sql<number>`sum(case when ${codesTable.mapped} then 0 else 1 end)`,
    })
    .from(codesTable)
    .innerJoin(productsTable, eq(codesTable.productId, productsTable.id))
    .innerJoin(batchesTable, eq(codesTable.batchId, batchesTable.id))
    .where(where)
    .groupBy(productsTable.id, productsTable.name, batchesTable.id, batchesTable.batchNumber, productsTable.skuSize);

  res.json(rows);
});

router.get("/reports/shipper-summary", requireModule("reports"), async (req, res): Promise<void> => {
  const scope = companyScope(req.user!);
  const conds = [eq(codesTable.level, "shipper")];
  if (scope) conds.push(scope);
  conds.push(...dateRangeConds(req.query.from, req.query.to));
  const where = conds.length === 1 ? conds[0] : and(...conds);

  const rows = await db
    .select({
      productId: productsTable.id,
      productName: productsTable.name,
      batchId: batchesTable.id,
      batchNumber: batchesTable.batchNumber,
      size: productsTable.skuSize,
      total: count(codesTable.id),
      shipperMapped: sql<number>`sum(case when ${codesTable.mapped} then 1 else 0 end)`,
      shipperUnmapped: sql<number>`sum(case when ${codesTable.mapped} then 0 else 1 end)`,
    })
    .from(codesTable)
    .innerJoin(productsTable, eq(codesTable.productId, productsTable.id))
    .innerJoin(batchesTable, eq(codesTable.batchId, batchesTable.id))
    .where(where)
    .groupBy(productsTable.id, productsTable.name, batchesTable.id, batchesTable.batchNumber, productsTable.skuSize);
  res.json(rows);
});

router.get("/reports/pallet-summary", requireModule("reports"), async (req, res): Promise<void> => {
  const scope = companyScope(req.user!);
  const conds = [eq(codesTable.level, "pallet")];
  if (scope) conds.push(scope);
  conds.push(...dateRangeConds(req.query.from, req.query.to));
  const where = conds.length === 1 ? conds[0] : and(...conds);

  const rows = await db
    .select({
      productId: productsTable.id,
      productName: productsTable.name,
      batchId: batchesTable.id,
      batchNumber: batchesTable.batchNumber,
      size: productsTable.skuSize,
      total: count(codesTable.id),
      palletMapped: sql<number>`sum(case when ${codesTable.mapped} then 1 else 0 end)`,
      palletUnmapped: sql<number>`sum(case when ${codesTable.mapped} then 0 else 1 end)`,
    })
    .from(codesTable)
    .innerJoin(productsTable, eq(codesTable.productId, productsTable.id))
    .innerJoin(batchesTable, eq(codesTable.batchId, batchesTable.id))
    .where(where)
    .groupBy(productsTable.id, productsTable.name, batchesTable.id, batchesTable.batchNumber, productsTable.skuSize);
  res.json(rows);
});

router.get("/reports/marked-by", requireModule("reports"), async (req, res): Promise<void> => {
  const scope = companyScope(req.user!);
  const conds = [eq(codesTable.mapped, true)];
  if (scope) conds.push(scope);
  const where = conds.length === 1 ? conds[0] : and(...conds);

  const rows = await db
    .select({
      codeId: codesTable.id,
      rawString: codesTable.rawString,
      level: codesTable.level,
      productName: productsTable.name,
      batchNumber: batchesTable.batchNumber,
      locationName: locationsTable.locationName,
      mappedByUsername: usersTable.username,
      mappedAt: codesTable.mappedAt,
    })
    .from(codesTable)
    .innerJoin(productsTable, eq(codesTable.productId, productsTable.id))
    .leftJoin(batchesTable, eq(codesTable.batchId, batchesTable.id))
    .leftJoin(locationsTable, eq(codesTable.locationId, locationsTable.id))
    .leftJoin(usersTable, eq(codesTable.mappedByUserId, usersTable.id))
    .where(where)
    .orderBy(desc(codesTable.mappedAt))
    .limit(500);

  res.json(rows);
});

export default router;
