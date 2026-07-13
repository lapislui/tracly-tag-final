import { Router, type IRouter } from "express";
import { and, eq, desc, inArray, or, sql } from "drizzle-orm";
import {
  db,
  codesTable,
  productsTable,
  batchesTable,
  locationsTable,
  usersTable,
  companiesTable,
  customerScansTable,
} from "@workspace/db";
import { GenerateCodesBody, MapCodeBody } from "@workspace/api-zod";
import { requireAuth, requireModule } from '../lib/session.js';
import { generateUnitCode, generateSsccCode, parseGs1Code } from '../lib/gs1.js';

function gstinToGtin(input: string): string {
  if (!input) return "00000000000000";
  const clean = input.replace(/\D/g, "");
  if (clean.length === 13 || clean.length === 14) {
    const padded = clean.padStart(14, "0").slice(0, 14);
    const digits = padded.slice(0, 13).split("").map(Number);
    let sum = 0;
    for (let i = 0; i < 13; i++) {
      const weight = i % 2 === 0 ? 3 : 1;
      sum += digits[i] * weight;
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    return padded.slice(0, 13) + checkDigit;
  }
  
  const padded = clean.padEnd(13, "0").slice(0, 13);
  const nums = padded.split("").map(Number);
  let sum = 0;
  for (let i = 0; i < 13; i++) {
    const weight = i % 2 === 0 ? 3 : 1;
    sum += nums[i] * weight;
  }
  const cd = (10 - (sum % 10)) % 10;
  return padded + cd;
}

const router: IRouter = Router();

// Debug endpoint - shows recent codes in database
router.get("/codes/debug/recent", async (_req, res): Promise<void> => {
  try {
    const codes = await db
      .select({
        id: codesTable.id,
        serialNumber: codesTable.serialNumber,
        ssccCode: codesTable.ssccCode,
        rawString: codesTable.rawString,
        level: codesTable.level,
        createdAt: codesTable.createdAt,
      })
      .from(codesTable)
      .orderBy(desc(codesTable.createdAt))
      .limit(10);
    
    res.json({ 
      total_codes_shown: codes.length,
      codes: codes.map(c => ({
        id: c.id,
        level: c.level,
        serialNumber: c.serialNumber || "null",
        ssccCode: c.ssccCode || "null",
        rawString: c.rawString.substring(0, 50) + (c.rawString.length > 50 ? "..." : ""),
        createdAt: c.createdAt,
      }))
    });
  } catch (error: any) {
    console.error("Debug endpoint error:", error);
    res.status(500).json({ error: error.message });
  }
});

const getCityFromZip = (zip: string) => {
  const cleanZip = String(zip || "").toLowerCase().trim();
  
  if (cleanZip.includes("mumbai")) return "Mumbai";
  if (cleanZip.includes("pune")) return "Pune";
  if (cleanZip.includes("delhi") || cleanZip.includes("new delhi")) return "New Delhi";
  if (cleanZip.includes("chennai")) return "Chennai";
  if (cleanZip.includes("hyderabad")) return "Hyderabad";
  if (cleanZip.includes("bangalore") || cleanZip.includes("bengaluru")) return "Bengaluru";
  if (cleanZip.includes("new york") || cleanZip.includes(" ny")) return "New York";
  if (cleanZip.includes("singapore")) return "Singapore";
  if (cleanZip.includes("dubai")) return "Dubai";

  // Fallbacks for zip code prefixes
  if (cleanZip.startsWith("411")) return "Pune";
  if (cleanZip.startsWith("400")) return "Mumbai";
  if (cleanZip.startsWith("110")) return "New Delhi";
  if (cleanZip.startsWith("600")) return "Chennai";
  if (cleanZip.startsWith("500")) return "Hyderabad";
  if (cleanZip.startsWith("560")) return "Bengaluru";
  if (cleanZip.startsWith("100")) return "New York";
  if (cleanZip.length === 6 && !isNaN(Number(cleanZip))) return "Singapore";
  
  // Try to parse from a comma separated address
  const parts = cleanZip.split(",");
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed && isNaN(Number(trimmed)) && trimmed.length > 2) {
      return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    }
  }

  const defaultCities = ["Mumbai", "Singapore", "Dubai", "New Delhi", "Pune"];
  let hash = 0;
  for (let i = 0; i < cleanZip.length; i++) {
    hash = cleanZip.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % defaultCities.length;
  return defaultCities[idx] || "Mumbai";
};

const logCustomerScan = async (codeId: number, query: any) => {
  try {
    const customerName = String(query.customerName || "Anonymous Customer");
    const mobileNumber = String(query.mobileNumber || "N/A");
    const zipCode = String(query.zipCode || "N/A");
    const city = getCityFromZip(zipCode);
    
    const now = new Date();
    const scanTime = now.toTimeString().split(" ")[0];
    const day = String(now.getDate()).padStart(2, "0");
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = monthNames[now.getMonth()];
    const year = now.getFullYear();
    const scanDate = `${day} ${month} ${year}`;
    
    await db.insert(customerScansTable).values({
      codeId,
      customerName,
      mobileNumber,
      zipCode,
      city,
      scanTime,
      scanDate,
    });
    console.log(`[Public Verify] Logged customer scan for code ID ${codeId} (${customerName}, ${city})`);
  } catch (err) {
    console.error("Failed to log customer scan:", err);
    throw err;
  }
};

router.get("/codes/public/:serial", async (req, res): Promise<void> => {
  let serial = req.params.serial;
  if (!serial) {
    res.status(400).json({ error: "Serial number is required" });
    return;
  }

  try {
    const aliasUser = usersTable;
    
    // Helper function to build the select query
    const buildQuery = (condition: any) => {
      return db
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
          mappedByUsername: aliasUser.username,
          locationId: codesTable.locationId,
          locationName: locationsTable.locationName,
          createdAt: codesTable.createdAt,
          mfgDate: batchesTable.mfgDate,
          expiryDate: batchesTable.expiryDate,
          marketedBy: productsTable.marketedBy,
          registrationNo: productsTable.registrationNo,
          companyName: companiesTable.name,
          companyAddress: companiesTable.address,
          companyGstin: companiesTable.gstin,
          // Keep public verification resilient even when optional product
          // branding columns are absent in an older deployed database.
          productLogoUrl: sql<string | null>`null`,
          sapDescription: sql<string | null>`null`,
        })
        .from(codesTable)
        .innerJoin(productsTable, eq(codesTable.productId, productsTable.id))
        .leftJoin(batchesTable, eq(codesTable.batchId, batchesTable.id))
        .leftJoin(aliasUser, eq(codesTable.mappedByUserId, aliasUser.id))
        .leftJoin(locationsTable, eq(codesTable.locationId, locationsTable.id))
        .leftJoin(companiesTable, eq(productsTable.companyId, companiesTable.id))
        .where(condition)
        .limit(1);
    };
    
    // Normalize serial: remove common scanner prefixes and trim whitespace
    let searchSerial = serial.trim();
    if (searchSerial.includes("::")) {
      searchSerial = searchSerial.split("::")[1] || searchSerial;
    } else if (searchSerial.includes(":")) {
      const parts = searchSerial.split(":");
      searchSerial = parts[parts.length - 1] || searchSerial;
    }

    // Extract actual serial/SSCC from new format: <gst/gtin>-<expiry>-<batch>-<serial>
    if (searchSerial.includes("-")) {
      const parts = searchSerial.split("-");
      if (parts.length >= 4) {
        const potentialSerial = parts[parts.length - 1];
        if (potentialSerial && potentialSerial.length >= 6 && !potentialSerial.includes(" ")) {
          const matches = await db
            .select({ id: codesTable.id })
            .from(codesTable)
            .where(eq(codesTable.serialNumber, potentialSerial))
            .limit(1);
          if (matches.length > 0) {
            searchSerial = potentialSerial;
            console.log(`[Public Verify] Normalized dash-separated URL to serial: "${searchSerial}"`);
          }
        }
      }
    }

    // Extract actual serial/SSCC from concatenated product string if formatted with (21) or (00)
    if (searchSerial.includes("-")) {
      const parts = searchSerial.split("-");
      const serialIndex = parts.findIndex(p => p.startsWith("21"));
      if (serialIndex > -1) {
        searchSerial = parts.slice(serialIndex).join("-").substring(2);
      } else {
        const ssccIndex = parts.findIndex(p => p.startsWith("00"));
        if (ssccIndex > -1) {
          searchSerial = parts.slice(ssccIndex).join("-").substring(2);
        }
      }
    } else if (searchSerial.includes("(21)")) {
      const match = searchSerial.match(/\(21\)([^()]+)/);
      if (match && match[1]) {
        searchSerial = match[1];
      }
    } else if (searchSerial.includes("(00)")) {
      const match = searchSerial.match(/\(00\)([^()]+)/);
      if (match && match[1]) {
        searchSerial = match[1];
      }
    } else if (searchSerial.startsWith("01") && searchSerial.length >= 18) {
      searchSerial = searchSerial.substring(18);
    } else if (searchSerial.startsWith("00") && searchSerial.length >= 20) {
      searchSerial = searchSerial.substring(2);
    }
    
    console.log(`[Public Verify] Searching for: "${serial}" (normalized: "${searchSerial}")`);
    
    // Try direct lookup (serialNumber or ssccCode) FIRST - most common for QR codes
    let rows = await buildQuery(
      or(
        eq(codesTable.serialNumber, searchSerial),
        eq(codesTable.ssccCode, searchSerial)
      )
    );
    
    if (rows.length > 0) {
      console.log(`[Public Verify] Found by serialNumber/ssccCode`);
      await logCustomerScan(rows[0].id, req.query);
      res.json(rows[0]);
      return;
    }

    // Try rawString match SECOND (barcode label scans)
    rows = await buildQuery(eq(codesTable.rawString, searchSerial));
    if (rows.length > 0) {
      console.log(`[Public Verify] Found by rawString (barcode match)`);
      await logCustomerScan(rows[0].id, req.query);
      res.json(rows[0]);
      return;
    }

    // Try parsing as GS1 code and extract serial/SSCC
    const parsed = parseGs1Code(searchSerial);
    if (parsed.serialNumber || parsed.ssccCode) {
      const searchConditions = [];
      if (parsed.serialNumber) {
        searchConditions.push(eq(codesTable.serialNumber, parsed.serialNumber));
        console.log(`[Public Verify] Parsed GS1 serialNumber: "${parsed.serialNumber}"`);
      }
      if (parsed.ssccCode) {
        searchConditions.push(eq(codesTable.ssccCode, parsed.ssccCode));
        console.log(`[Public Verify] Parsed GS1 ssccCode: "${parsed.ssccCode}"`);
      }
      
      if (searchConditions.length > 0) {
        rows = await buildQuery(or(...searchConditions));
        if (rows.length > 0) {
          console.log(`[Public Verify] Found by GS1 parsing`);
          await logCustomerScan(rows[0].id, req.query);
          res.json(rows[0]);
          return;
        }
      }
    }

    // If not found in database, insert a placeholder code record dynamically and log the scan details
    console.log(`[Public Verify] NOT FOUND. Creating placeholder code to log scan details.`);
    try {
      const isSscc = searchSerial.length === 18 && /^\d+$/.test(searchSerial);
      const [fallbackProduct] = await db.select({ id: productsTable.id }).from(productsTable).limit(1);
      const fallbackProductId = fallbackProduct ? fallbackProduct.id : 1;
      
      const inserted = await db.insert(codesTable).values({
        productId: fallbackProductId,
        level: isSscc ? "shipper" : "unit",
        rawString: `INVALID_${searchSerial}_${Date.now()}`,
        serialNumber: isSscc ? null : searchSerial,
        ssccCode: isSscc ? searchSerial : null,
        mapped: false,
      }).returning();
      
      if (inserted && inserted[0]) {
        await logCustomerScan(inserted[0].id, req.query);
      }
    } catch (dbErr) {
      console.error("Failed to insert placeholder code for failed scan logging:", dbErr);
    }

    res.status(404).json({ 
      error: "Product serial verification code not found or invalid",
      searched: searchSerial,
      hint: "Code does not exist in database. Please verify the code was generated and saved."
    });
  } catch (error: any) {
    console.error("Error fetching public code details:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

const aliasUser = usersTable;

async function fetchEnrichedCodes(ids: number[]) {
  if (ids.length === 0) return [];
  const rows = await db
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
      mappedByUsername: aliasUser.username,
      locationId: codesTable.locationId,
      locationName: locationsTable.locationName,
      createdAt: codesTable.createdAt,
      mfgDate: batchesTable.mfgDate,
      expiryDate: batchesTable.expiryDate,
      marketedBy: productsTable.marketedBy,
      registrationNo: productsTable.registrationNo,
      companyName: companiesTable.name,
      companyAddress: companiesTable.address,
      companyGstin: companiesTable.gstin,
    })
    .from(codesTable)
    .innerJoin(productsTable, eq(codesTable.productId, productsTable.id))
    .leftJoin(batchesTable, eq(codesTable.batchId, batchesTable.id))
    .leftJoin(aliasUser, eq(codesTable.mappedByUserId, aliasUser.id))
    .leftJoin(locationsTable, eq(codesTable.locationId, locationsTable.id))
    .leftJoin(companiesTable, eq(productsTable.companyId, companiesTable.id))
    .where(
      ids.length === 1
        ? eq(codesTable.id, ids[0]!)
        : inArray(codesTable.id, ids),
    )
    .orderBy(desc(codesTable.createdAt));
  return rows;
}

const requireGenerateOrMapCodes = (req: any, res: any, next: any) => {
  if (!req.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  if (req.user.role === "master" || req.user.role === "super_master") {
    next();
    return;
  }
  const modules = (req.user.enabledModules || "").split(",");
  if (!modules.includes("generate_codes") && !modules.includes("mapping_code")) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
};

router.get("/codes", requireAuth, requireGenerateOrMapCodes, async (req, res): Promise<void> => {
  const level = typeof req.query.level === "string" ? req.query.level : null;
  const batchId =
    typeof req.query.batchId === "string"
      ? parseInt(req.query.batchId, 10)
      : null;
  const productId =
    typeof req.query.productId === "string"
      ? parseInt(req.query.productId, 10)
      : null;
  const limit =
    typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 5000;

  const conds = [];
  if (level) conds.push(eq(codesTable.level, level));
  if (batchId && !Number.isNaN(batchId))
    conds.push(eq(codesTable.batchId, batchId));
  if (productId && !Number.isNaN(productId))
    conds.push(eq(codesTable.productId, productId));
  if (req.user!.role !== "master" && req.user!.role !== "super_master") {
    conds.push(eq(productsTable.companyId, req.user!.companyId!));
  }
  const where =
    conds.length === 0 ? undefined : conds.length === 1 ? conds[0] : and(...conds);

  const rows = await db
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
      mappedByUsername: aliasUser.username,
      locationId: codesTable.locationId,
      locationName: locationsTable.locationName,
      createdAt: codesTable.createdAt,
      mfgDate: batchesTable.mfgDate,
      expiryDate: batchesTable.expiryDate,
      marketedBy: productsTable.marketedBy,
      registrationNo: productsTable.registrationNo,
      companyName: companiesTable.name,
      companyAddress: companiesTable.address,
      companyGstin: companiesTable.gstin,
      companyUrl: companiesTable.companyUrl,
    })
    .from(codesTable)
    .innerJoin(productsTable, eq(codesTable.productId, productsTable.id))
    .leftJoin(batchesTable, eq(codesTable.batchId, batchesTable.id))
    .leftJoin(aliasUser, eq(codesTable.mappedByUserId, aliasUser.id))
    .leftJoin(locationsTable, eq(codesTable.locationId, locationsTable.id))
    .leftJoin(companiesTable, eq(productsTable.companyId, companiesTable.id))
    .where(where)
    .orderBy(desc(codesTable.createdAt))
    .limit(Math.min(Math.max(limit, 1), 5000));

  res.json(rows);
});

router.post("/codes", requireAuth, requireModule("generate_codes"), async (req, res): Promise<void> => {
  const parsed = GenerateCodesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [batch] = await db
    .select({
      id: batchesTable.id,
      productId: batchesTable.productId,
      batchNumber: batchesTable.batchNumber,
      batchExpiryDate: batchesTable.expiryDate,
      batchMfgDate: batchesTable.mfgDate,
      productExpiryDate: productsTable.expiryDate,
      gtin: productsTable.gtin,
      isGs1Compliant: productsTable.isGs1Compliant,
      companyId: productsTable.companyId,
      companyGstin: companiesTable.gstin,
      companyPrefix: companiesTable.companyPrefix,
    })
    .from(batchesTable)
    .innerJoin(productsTable, eq(batchesTable.productId, productsTable.id))
    .leftJoin(companiesTable, eq(productsTable.companyId, companiesTable.id))
    .where(eq(batchesTable.id, parsed.data.batchId));

  if (!batch) {
    res.status(404).json({ error: "Batch not found" });
    return;
  }

  if (
    req.user!.role !== "master" &&
    req.user!.role !== "super_master" &&
    batch.companyId !== req.user!.companyId
  ) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const isUnitLevel = ["unit", "l1", "l2"].includes(parsed.data.level);

  const inserts = [];
  for (let i = 0; i < parsed.data.quantity; i++) {
    if (isUnitLevel) {
      const gtinOrGst = batch.companyGstin || batch.gtin;
      if (batch.isGs1Compliant && gtinOrGst) {
        const gtinValue = gstinToGtin(gtinOrGst);
        const expiryValue = batch.batchExpiryDate || batch.productExpiryDate || "";
        const { raw, serial } = generateUnitCode({
          gtin: gtinValue,
          expiry: expiryValue,
          batch: batch.batchNumber,
        });
        inserts.push({
          productId: batch.productId,
          batchId: batch.id,
          level: parsed.data.level,
          rawString: raw,
          serialNumber: serial,
          ssccCode: null,
        });
      } else {
        const crypto = await import("crypto");
        const serial = crypto.randomBytes(6).toString("hex").toUpperCase();
        inserts.push({
          productId: batch.productId,
          batchId: batch.id,
          level: parsed.data.level,
          rawString: serial,
          serialNumber: serial,
          ssccCode: null,
        });
      }
    } else {
      const gtinOrGst = batch.companyGstin || batch.gtin;
      if (batch.isGs1Compliant && gtinOrGst) {
        const gtinValue = gstinToGtin(gtinOrGst);
        const prefixToUse = batch.companyPrefix || gtinValue.slice(1, 8) || "8901234";
        const { raw, sscc } = generateSsccCode(prefixToUse, i);
        inserts.push({
          productId: batch.productId,
          batchId: batch.id,
          level: parsed.data.level,
          rawString: raw,
          serialNumber: null,
          ssccCode: sscc,
        });
      } else {
        const crypto = await import("crypto");
        const serial = crypto.randomBytes(8).toString("hex").toUpperCase();
        const sscc = `SH-${serial}`;
        inserts.push({
          productId: batch.productId,
          batchId: batch.id,
          level: parsed.data.level,
          rawString: sscc,
          serialNumber: null,
          ssccCode: sscc,
        });
      }
    }
  }

  const inserted = await db.insert(codesTable).values(inserts).returning();
  const ids = inserted.map((r) => r.id);
  const rows = await fetchEnrichedCodes(ids);
  res.status(201).json({ generated: inserted.length, codes: rows });
});

router.post("/codes/:id/map", requireAuth, requireModule("mapping_code"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw ?? "", 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = MapCodeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  await db
    .update(codesTable)
    .set({
      mapped: true,
      mappedAt: new Date().toISOString(),
      mappedByUserId: req.user!.id,
      locationId: parsed.data.locationId,
    })
    .where(eq(codesTable.id, id));

  const [row] = await fetchEnrichedCodes([id]);
  if (!row) {
    res.status(404).json({ error: "Code not found" });
    return;
  }
  res.json(row);
});

router.get("/codes/scans", requireAuth, requireModule("customer_scan"), async (req, res): Promise<void> => {
  try {
    const scans = await db
      .select({
        id: customerScansTable.id,
        codeId: customerScansTable.codeId,
        customerName: customerScansTable.customerName,
        mobileNumber: customerScansTable.mobileNumber,
        zipCode: customerScansTable.zipCode,
        city: customerScansTable.city,
        scanTime: customerScansTable.scanTime,
        scanDate: customerScansTable.scanDate,
        createdAt: customerScansTable.createdAt,
        qr: codesTable.serialNumber,
        sscc: codesTable.ssccCode,
        level: codesTable.level,
        productName: productsTable.name,
        batchNumber: batchesTable.batchNumber,
        batchCreatedAt: batchesTable.createdAt,
      })
      .from(customerScansTable)
      .innerJoin(codesTable, eq(customerScansTable.codeId, codesTable.id))
      .innerJoin(productsTable, eq(codesTable.productId, productsTable.id))
      .leftJoin(batchesTable, eq(codesTable.batchId, batchesTable.id))
      .orderBy(desc(customerScansTable.id));

    // Group scans by codeId to get counts and the latest scan
    const groupedMap = new Map<number, any>();
    
    for (const scan of scans) {
      if (!groupedMap.has(scan.codeId)) {
        groupedMap.set(scan.codeId, {
          product: scan.productName,
          batch: scan.batchNumber || "N/A",
          batchDate: scan.batchCreatedAt ? new Date(scan.batchCreatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : "N/A",
          qr: scan.qr ? `...${scan.qr.slice(-6)}` : (scan.sscc ? `...${scan.sscc.slice(-6)}` : "N/A"),
          customer: scan.customerName,
          city: scan.city,
          mobile: scan.mobileNumber,
          scanTime: scan.scanTime,
          scanDate: scan.scanDate,
          count: 0,
          type: "normal",
          codeId: scan.codeId,
          level: scan.level,
          events: []
        });
      }
      
      const entry = groupedMap.get(scan.codeId);
      entry.count += 1;
      
      entry.events.push({
        customer: scan.customerName,
        city: scan.city,
        mobile: scan.mobileNumber,
        time: scan.scanTime,
        date: scan.scanDate,
        id: scan.id
      });
    }

    const result = Array.from(groupedMap.values()).map(entry => {
      if (entry.count > 5) {
        entry.type = "anomaly";
      } else if (entry.count > 1) {
        entry.type = "error";
      } else {
        entry.type = "normal";
      }
      return entry;
    });

    res.json(result);
  } catch (error: any) {
    console.error("Error fetching scans:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

export default router;

