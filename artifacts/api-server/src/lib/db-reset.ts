import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import {
  companiesTable,
  usersTable,
  productsTable,
  locationsTable,
  batchesTable,
  codesTable,
  customerScansTable,
  deviceCodesTable,
  passkeysTable,
} from "@workspace/db";
import { generateUnitCode, generateSsccCode } from './gs1.js';

export async function seedDatabase(dbInstance: any, seedData?: any) {
  if (seedData) {
    // 1. Insert company
    const companyVal = seedData.company || {
      name: "Demo Pharma Pvt Ltd",
      email: "ops@demopharma.in",
      address: "Plot 14, MIDC Industrial Area, Pune, Maharashtra 411019",
      gstin: "27AABCD1234E1Z5",
    };
    const [insertedCo] = await dbInstance
      .insert(companiesTable)
      .values(companyVal)
      .returning();

    // 2. Insert users
    const usersList = seedData.users || [];
    const usersToInsert = [];
    for (const u of usersList) {
      const passwordHash = await bcrypt.hash(u.password || "password123", 10);
      usersToInsert.push({
        username: u.username,
        email: u.email,
        phone: u.phone || null,
        passwordHash,
        role: u.role,
        companyId: (u.role === "super_master" || u.role === "master") ? null : insertedCo.id,
      });
    }
    const insertedUsers = await dbInstance.insert(usersTable).values(usersToInsert).returning();

    // 3. Insert locations
    const locationsList = seedData.locations || [];
    let warehouse: any = null;
    if (locationsList.length > 0) {
      const locationsToInsert = locationsList.map((loc: any) => ({
        companyId: insertedCo.id,
        locationType: loc.locationType,
        uniqueName: loc.uniqueName,
        locationName: loc.locationName,
        contactNo: loc.contactNo || null,
        state: loc.state || null,
        city: loc.city || null,
        address: loc.address || null,
      }));
      const insertedLocs = await dbInstance.insert(locationsTable).values(locationsToInsert).returning();
      warehouse = insertedLocs[0];
    }

    // 4. Insert products
    const productsList = seedData.products || [];
    let insertedProds: any[] = [];
    if (productsList.length > 0) {
      const productsToInsert = productsList.map((prod: any) => ({
        companyId: insertedCo.id,
        skuId: prod.skuId,
        name: prod.name,
        skuSize: prod.skuSize || "",
        marketedBy: prod.marketedBy || null,
        sapDescription: prod.sapDescription || null,
        gtin: prod.gtin || null,
        mrp: prod.mrp ? Number(prod.mrp) : null,
        registrationNo: prod.registrationNo || null,
        l1Size: prod.l1Size ? Number(prod.l1Size) : null,
        l2Size: prod.l2Size ? Number(prod.l2Size) : null,
        shipperSize: prod.shipperSize ? Number(prod.shipperSize) : null,
        cautionLogoUrl: prod.cautionLogoUrl || null,
        productLogoUrl: prod.productLogoUrl || null,
        labelPdfUrl: prod.labelPdfUrl || null,
        expiryDate: prod.expiryDate || null,
      }));
      insertedProds = await dbInstance.insert(productsTable).values(productsToInsert).returning();
    }

    // 5. Insert batches
    const batchesList = seedData.batches || [];
    const batchesToInsert = [];
    for (const bat of batchesList) {
      const matchedProd = insertedProds.find((p: any) => p.skuId === bat.productSkuId);
      if (matchedProd) {
        batchesToInsert.push({
          productId: matchedProd.id,
          batchNumber: bat.batchNumber,
          mfgDate: bat.mfgDate || null,
          expiryDate: bat.expiryDate || null,
        });
      }
    }
    
    let insertedBatches: any[] = [];
    if (batchesToInsert.length > 0) {
      insertedBatches = await dbInstance.insert(batchesTable).values(batchesToInsert).returning();
    }

    // 6. Generate codes & scans
    const codeRows: any[] = [];
    for (const batch of insertedBatches) {
      const matchedProd = insertedProds.find((p: any) => p.id === batch.productId);
      if (!matchedProd) continue;

      for (let i = 0; i < 20; i++) {
        const { raw, serial } = generateUnitCode({
          gtin: matchedProd.gtin || "08901234567896",
          expiry: batch.expiryDate || matchedProd.expiryDate || "2028-12-31",
          batch: batch.batchNumber,
        });
        codeRows.push({
          productId: matchedProd.id,
          batchId: batch.id,
          level: "unit",
          rawString: raw,
          serialNumber: serial,
          ssccCode: null,
        });
      }
      
      for (let i = 0; i < 2; i++) {
        const { raw, sscc } = generateSsccCode("8901234", Math.floor(Math.random() * 100000));
        codeRows.push({
          productId: matchedProd.id,
          batchId: batch.id,
          level: "shipper",
          rawString: raw,
          serialNumber: null,
          ssccCode: sscc,
        });
      }
    }

    if (codeRows.length > 0) {
      const insertedCodes = await dbInstance.insert(codesTable).values(codeRows).returning();
      const opUser = insertedUsers.find((u: any) => u.role === "operator");
      const opUserId = opUser ? opUser.id : insertedUsers[0]?.id;

      if (warehouse && insertedCodes.length > 0) {
        const toMap = insertedCodes.slice(0, Math.min(insertedCodes.length, 5));
        for (const c of toMap) {
          await dbInstance
            .update(codesTable)
            .set({
              mapped: true,
              mappedAt: new Date().toISOString(),
              mappedByUserId: opUserId,
              locationId: warehouse.id,
            })
            .where(eq(codesTable.id, c.id));
        }
      }
    }
    return;
  }

  // Company
  const [demoCo] = await dbInstance
    .insert(companiesTable)
    .values({
      name: "luphonix",
      email: "ops@luphonix.in",
      address: "Plot 14, MIDC Industrial Area, Pune, Maharashtra 411019",
      gstin: "27AABCD1234E1Z5",
    })
    .returning();

  // Users
  const supermasterUsername = process.env.SUPERMASTER_USERNAME || "supermaster";
  const supermasterPassword = process.env.SUPERMASTER_PASSWORD || "kp_dk@2026";
  const superMasterHash = await bcrypt.hash(supermasterPassword, 10);
  const masterHash = await bcrypt.hash("master123", 10);
  const adminHash = await bcrypt.hash("admin123", 10);
  const managerHash = await bcrypt.hash("manager123", 10);
  const opHash = await bcrypt.hash("op123", 10);

  const users = await dbInstance.insert(usersTable).values([
    {
      username: supermasterUsername,
      email: process.env.SUPERMASTER_EMAIL || "supermaster@tracelytag.com",
      phone: "+91 8000000000",
      passwordHash: superMasterHash,
      role: "super_master",
      companyId: null,
    },
    {
      username: "master",
      email: "master@tracelytag.com",
      phone: "+91 9000000000",
      passwordHash: masterHash,
      role: "master",
      companyId: null,
    },
    {
      username: "demo_admin",
      email: "admin@demopharma.in",
      phone: "+91 9111111111",
      passwordHash: adminHash,
      role: "admin",
      companyId: demoCo!.id,
    },
    {
      username: "demo_manager",
      email: "manager@demopharma.in",
      phone: "+91 9155555555",
      passwordHash: managerHash,
      role: "client_admin",
      companyId: demoCo!.id,
    },
    {
      username: "demo_op",
      email: "op@demopharma.in",
      phone: "+91 9222222222",
      passwordHash: opHash,
      role: "operator",
      companyId: demoCo!.id,
    },
  ]).returning();

  // Locations
  const [warehouse] = await dbInstance
    .insert(locationsTable)
    .values([
      {
        companyId: demoCo!.id,
        locationType: "Warehouse",
        uniqueName: "WH-PUNE-01",
        locationName: "Pune Central Warehouse",
        contactNo: "+91 2027451234",
        state: "Maharashtra",
        city: "Pune",
        address: "Plot 14, MIDC Industrial Area, Pune 411019",
      },
      {
        companyId: demoCo!.id,
        locationType: "Distributor",
        uniqueName: "DST-MUM-04",
        locationName: "Mumbai Distributor Hub",
        contactNo: "+91 2261234500",
        state: "Maharashtra",
        city: "Mumbai",
        address: "Andheri East, Mumbai 400069",
      },
      {
        companyId: demoCo!.id,
        locationType: "Retailer",
        uniqueName: "RTL-DEL-12",
        locationName: "Connaught Place Pharmacy",
        contactNo: "+91 1141234567",
        state: "Delhi",
        city: "New Delhi",
        address: "Block A, Connaught Place, New Delhi 110001",
      },
    ])
    .returning();

  // Products
  const [paracet, vitaminC] = await dbInstance
    .insert(productsTable)
    .values([
      {
        companyId: demoCo!.id,
        skuId: "PARA-500-10S",
        name: "Paracetamol 500mg",
        skuSize: "10x10 Tablets",
        marketedBy: "Demo Pharma Pvt Ltd",
        sapDescription: "PARACETAMOL TABLETS IP 500MG",
        gtin: "08901234567896",
        mrp: 45.00,
        registrationNo: "MH/DRUGS/2023/0451",
        l1Size: 10,
        l2Size: 100,
        shipperSize: 1000,
        cautionLogoUrl: null,
        productLogoUrl: null,
        labelPdfUrl: null,
        expiryDate: "2028-04-30",
      },
      {
        companyId: demoCo!.id,
        skuId: "VITC-1000-30S",
        name: "Vitamin C 1000mg Effervescent",
        skuSize: "30 Tablets Tube",
        marketedBy: "Demo Pharma Pvt Ltd",
        sapDescription: "ASCORBIC ACID 1000MG EFFERVESCENT",
        gtin: "08907654321094",
        mrp: 299.00,
        registrationNo: "MH/DRUGS/2023/0892",
        l1Size: 6,
        l2Size: 36,
        shipperSize: 216,
        cautionLogoUrl: null,
        productLogoUrl: null,
        labelPdfUrl: null,
        expiryDate: "2027-12-31",
      },
    ])
    .returning();

  // Batches
  const [batchA, batchB] = await dbInstance
    .insert(batchesTable)
    .values([
      {
        productId: paracet!.id,
        batchNumber: "PCM2604A",
        mfgDate: "2026-04-01",
        expiryDate: "2028-04-30",
      },
      {
        productId: vitaminC!.id,
        batchNumber: "VTC2604B",
        mfgDate: "2026-04-15",
        expiryDate: "2027-12-31",
      },
    ])
    .returning();

  // Sample codes
  const codeRows: Array<{
    productId: number;
    batchId: number | null;
    level: string;
    rawString: string;
    serialNumber: string | null;
    ssccCode: string | null;
  }> = [];

  for (let i = 0; i < 30; i++) {
    const { raw, serial } = generateUnitCode({
      gtin: paracet!.gtin!,
      expiry: batchA!.expiryDate || paracet!.expiryDate,
      batch: batchA!.batchNumber,
    });
    codeRows.push({
      productId: paracet!.id,
      batchId: batchA!.id,
      level: "unit",
      rawString: raw,
      serialNumber: serial,
      ssccCode: null,
    });
  }
  for (let i = 0; i < 20; i++) {
    const { raw, serial } = generateUnitCode({
      gtin: vitaminC!.gtin!,
      expiry: batchB!.expiryDate || vitaminC!.expiryDate,
      batch: batchB!.batchNumber,
    });
    codeRows.push({
      productId: vitaminC!.id,
      batchId: batchB!.id,
      level: "unit",
      rawString: raw,
      serialNumber: serial,
      ssccCode: null,
    });
  }
  for (let i = 0; i < 5; i++) {
    const { raw, sscc } = generateSsccCode("8901234", i);
    codeRows.push({
      productId: paracet!.id,
      batchId: batchA!.id,
      level: "shipper",
      rawString: raw,
      serialNumber: null,
      ssccCode: sscc,
    });
  }
  for (let i = 0; i < 2; i++) {
    const { raw, sscc } = generateSsccCode("8901234", 100 + i);
    codeRows.push({
      productId: paracet!.id,
      batchId: batchA!.id,
      level: "pallet",
      rawString: raw,
      serialNumber: null,
      ssccCode: sscc,
    });
  }

  const insertedCodes = await dbInstance.insert(codesTable).values(codeRows).returning();

  const opUser = users.find((u: any) => u.username === "demo_op");
  const opUserId = opUser ? opUser.id : 4;

  // Map a few codes to warehouse
  const toMap = insertedCodes.slice(0, 12);
  for (const c of toMap) {
    await dbInstance
      .update(codesTable)
      .set({
        mapped: true,
        mappedAt: new Date().toISOString(),
        mappedByUserId: opUserId,
        locationId: warehouse!.id,
      })
      .where(eq(codesTable.id, c.id));
  }

  // Seeding Customer Scans
  const customerScans = [
    {
      codeId: insertedCodes[0]!.id,
      customerName: "Aravind Sharma",
      mobileNumber: "+91 98765 00121",
      zipCode: "400001",
      city: "Mumbai",
      scanTime: "14:22:10",
      scanDate: "15 Jun 2024",
    },
    ...Array.from({ length: 12 }).map((_, idx) => ({
      codeId: insertedCodes[1]!.id,
      customerName: "Michael Chang",
      mobileNumber: "+65 8299 1192",
      zipCode: "039794",
      city: "Singapore",
      scanTime: `13:${10 + idx}:45`,
      scanDate: "15 Jun 2024",
    })),
    {
      codeId: insertedCodes[2]!.id,
      customerName: "Elena Petrova",
      mobileNumber: "+971 50 123 441",
      zipCode: "DXB-992",
      city: "Dubai",
      scanTime: "11:40:02",
      scanDate: "14 Jun 2024",
    },
    ...Array.from({ length: 4 }).map((_, idx) => ({
      codeId: insertedCodes[3]!.id,
      customerName: "Rajesh Kumar",
      mobileNumber: "+91 99123 88123",
      zipCode: "110001",
      city: "New Delhi",
      scanTime: `09:${15 + idx * 5}:33`,
      scanDate: "14 Jun 2024",
    })),
  ];

  await dbInstance.insert(customerScansTable).values(customerScans);
}

export async function resetAndSeedDatabase(dbInstance: any, seedData?: any) {
  // Delete all records from tables in correct dependency order
  await dbInstance.delete(customerScansTable);
  await dbInstance.delete(deviceCodesTable);
  await dbInstance.delete(passkeysTable);
  await dbInstance.delete(codesTable);
  await dbInstance.delete(batchesTable);
  await dbInstance.delete(productsTable);
  await dbInstance.delete(locationsTable);
  await dbInstance.delete(usersTable);
  await dbInstance.delete(companiesTable);

  // Run the seeding logic
  await seedDatabase(dbInstance, seedData);
}
