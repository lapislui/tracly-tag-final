import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { requireAuth, requireRole } from '../lib/session.js';
import { resetAndSeedDatabase } from '../lib/db-reset.js';
import { systemConfigsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

// Helper to read config from database
const readConfig = async () => {
  let hideMappingCode = true;
  let datamatrixUrlMode = false;
  try {
    const rows = await db
      .select()
      .from(systemConfigsTable);

    const mapCodeRow = rows.find(r => r.key === "hideMappingCode");
    if (mapCodeRow) {
      hideMappingCode = mapCodeRow.value === "true";
    }
    const dmRow = rows.find(r => r.key === "datamatrixUrlMode");
    if (dmRow) {
      datamatrixUrlMode = dmRow.value === "true";
    }
  } catch (err) {
    // ignore
  }
  return { hideMappingCode, datamatrixUrlMode };
};

// Helper to write config to database
const writeConfig = async (config: { hideMappingCode?: boolean; datamatrixUrlMode?: boolean }) => {
  try {
    if (config.hideMappingCode !== undefined) {
      await db
        .insert(systemConfigsTable)
        .values({
          key: "hideMappingCode",
          value: String(config.hideMappingCode),
        })
        .onConflictDoUpdate({
          target: systemConfigsTable.key,
          set: { value: String(config.hideMappingCode) },
        });
    }
    if (config.datamatrixUrlMode !== undefined) {
      await db
        .insert(systemConfigsTable)
        .values({
          key: "datamatrixUrlMode",
          value: String(config.datamatrixUrlMode),
        })
        .onConflictDoUpdate({
          target: systemConfigsTable.key,
          set: { value: String(config.datamatrixUrlMode) },
        });
    }
  } catch (err) {
    // ignore
  }
};

// Public/standard auth config getter
router.get("/system-config", requireAuth, async (req, res) => {
  const config = await readConfig();
  res.json(config);
});

// Super master config setter
router.post("/system-config", requireAuth, requireRole("super_master"), async (req, res) => {
  const { hideMappingCode, datamatrixUrlMode } = req.body;
  const updates: { hideMappingCode?: boolean; datamatrixUrlMode?: boolean } = {};
  
  if (hideMappingCode !== undefined) {
    if (typeof hideMappingCode !== "boolean") {
      res.status(400).json({ error: "Invalid value for hideMappingCode" });
      return;
    }
    updates.hideMappingCode = hideMappingCode;
  }
  
  if (datamatrixUrlMode !== undefined) {
    if (typeof datamatrixUrlMode !== "boolean") {
      res.status(400).json({ error: "Invalid value for datamatrixUrlMode" });
      return;
    }
    updates.datamatrixUrlMode = datamatrixUrlMode;
  }
  
  await writeConfig(updates);
  const config = await readConfig();
  res.json({ success: true, config });
});

// Apply auth and role protection to all routes under /system
router.use("/system", requireAuth, requireRole("super_master"));

router.post("/system/reset-database", async (req, res): Promise<void> => {
  try {
    const { seedData } = req.body;
    req.log.info("Supermaster database reset requested...");
    await resetAndSeedDatabase(db, seedData);
    req.log.info("Database reset completed successfully");
    res.json({ success: true, message: "Database reset and seeded successfully." });
  } catch (err: any) {
    req.log.error({ err }, "Database reset failed");
    res.status(500).json({ error: err.message || "Failed to reset database" });
  }
});

router.get("/system/info", async (req, res): Promise<void> => {
  try {
    res.json({
      env: process.env,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cwd: process.cwd(),
    });
  } catch (err: any) {
    req.log.error({ err }, "Failed to fetch system info");
    res.status(500).json({ error: err.message || "Failed to fetch system info" });
  }
});

export default router;
