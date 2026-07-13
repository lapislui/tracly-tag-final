import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq, desc } from "drizzle-orm";
import { db, usersTable, companiesTable } from "@workspace/db";
import { CreateUserBody, UpdateUserBody } from "@workspace/api-zod";
import { requireAuth, requireModule } from '../lib/session.js';

const router: IRouter = Router();

router.put("/users/profile", requireAuth, async (req, res): Promise<void> => {
  const { email, phone, currentPassword, password } = req.body;
  if (!email) {
    res.status(400).json({ error: "Email is required" });
    return;
  }

  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, req.user!.id));

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const updateData: any = {
      email,
      phone: phone ?? null,
    };

    if (password && password.trim().length > 0) {
      if (!currentPassword || currentPassword.trim().length === 0) {
        res.status(400).json({ error: "Current password is required to set a new password" });
        return;
      }

      const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isMatch) {
        res.status(400).json({ error: "Incorrect current password" });
        return;
      }

      if (password.length < 6) {
        res.status(400).json({ error: "Password must be at least 6 characters long" });
        return;
      }
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }

    const [updatedUser] = await db
      .update(usersTable)
      .set(updateData)
      .where(eq(usersTable.id, req.user!.id))
      .returning();

    if (!updatedUser) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({
      id: updatedUser.id,
      username: updatedUser.username,
      email: updatedUser.email,
      phone: updatedUser.phone,
      role: updatedUser.role,
      companyId: updatedUser.companyId,
    });
  } catch (err: any) {
    req.log.error({ err }, "Failed to update profile");
    res.status(500).json({ error: err.message || "Failed to update profile" });
  }
});

router.use("/users", requireAuth, requireModule("users"));

router.get("/users", async (req, res): Promise<void> => {
  const rows = await db
    .select({
      id: usersTable.id,
      username: usersTable.username,
      email: usersTable.email,
      phone: usersTable.phone,
      role: usersTable.role,
      companyId: usersTable.companyId,
      companyName: companiesTable.name,
      isActive: usersTable.isActive,
      enabledModules: usersTable.enabledModules,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .leftJoin(companiesTable, eq(usersTable.companyId, companiesTable.id))
    .orderBy(desc(usersTable.createdAt));

  // Scope: non-master sees only own company
  const filtered =
    (req.user!.role === "master" || req.user!.role === "super_master")
      ? rows
      : rows.filter((r) => r.companyId === req.user!.companyId);
  res.json(filtered);
});

router.post("/users", async (req, res): Promise<void> => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (req.user!.role === "operator") {
    res.status(403).json({ error: "Forbidden: Operators cannot manage users" });
    return;
  }

  let companyId = parsed.data.companyId ?? null;
  if (req.user!.role !== "master" && req.user!.role !== "super_master") {
    // Force company scope for non-masters
    companyId = req.user!.companyId;
    if (parsed.data.role === "master" || parsed.data.role === "super_master") {
      res.status(403).json({ error: "Cannot create master/super_master users" });
      return;
    }
  }

  // Prevent standard master from creating super_master users
  if (parsed.data.role === "super_master" && req.user!.role !== "super_master") {
    res.status(403).json({ error: "Forbidden: Cannot create super master users" });
    return;
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);

  try {
    const [row] = await db
      .insert(usersTable)
      .values({
        username: parsed.data.username,
        email: parsed.data.email,
        phone: parsed.data.phone ?? null,
        passwordHash,
        role: parsed.data.role,
        companyId,
        isActive: parsed.data.isActive ?? true,
        enabledModules: parsed.data.enabledModules ?? "dashboard,companies,products,batches,codes,locations,reports,users,generate_codes,mapping_code,customer_scan,summary",
      })
      .returning();

    let companyName: string | null = null;
    if (row!.companyId) {
      const [c] = await db
        .select({ name: companiesTable.name })
        .from(companiesTable)
        .where(eq(companiesTable.id, row!.companyId));
      companyName = c?.name ?? null;
    }

    res.status(201).json({
      id: row!.id,
      username: row!.username,
      email: row!.email,
      phone: row!.phone,
      role: row!.role,
      companyId: row!.companyId,
      companyName,
      isActive: row!.isActive,
      enabledModules: row!.enabledModules,
      createdAt: row!.createdAt,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create user");
    res.status(400).json({ error: "Username may already exist" });
  }
});

router.put("/users/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw ?? "", 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsed = UpdateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const [targetUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, id));

    if (!targetUser) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (req.user!.role === "operator") {
      res.status(403).json({ error: "Forbidden: Operators cannot manage users" });
      return;
    }

    // Prevent non-super_master from editing super_master users or setting role to super_master
    if (req.user!.role !== "super_master") {
      if (targetUser.role === "super_master" || parsed.data.role === "super_master") {
        res.status(403).json({ error: "Forbidden: Cannot edit super master users or change roles to super master" });
        return;
      }
    }

    // Security constraints
    if (req.user!.role !== "master" && req.user!.role !== "super_master") {
      if (targetUser.companyId !== req.user!.companyId) {
        res.status(403).json({ error: "Forbidden: Cannot edit users outside your company" });
        return;
      }
      if (targetUser.role === "master" || parsed.data.role === "master") {
        res.status(403).json({ error: "Forbidden: Cannot edit master users or change roles to master" });
        return;
      }
    }

    const updateData: any = {};
    if (parsed.data.email !== undefined) updateData.email = parsed.data.email;
    if (parsed.data.phone !== undefined) updateData.phone = parsed.data.phone ?? null;
    if (parsed.data.role !== undefined) updateData.role = parsed.data.role;
    if (parsed.data.isActive !== undefined) updateData.isActive = parsed.data.isActive;
    if (parsed.data.enabledModules !== undefined) updateData.enabledModules = parsed.data.enabledModules;
    if (parsed.data.companyId !== undefined) updateData.companyId = parsed.data.companyId ?? null;

    if (parsed.data.password && parsed.data.password.trim().length > 0) {
      if (parsed.data.password.length < 6) {
        res.status(400).json({ error: "Password must be at least 6 characters long" });
        return;
      }
      updateData.passwordHash = await bcrypt.hash(parsed.data.password, 10);
    }

    const [updatedUser] = await db
      .update(usersTable)
      .set(updateData)
      .where(eq(usersTable.id, id))
      .returning();

    let companyName: string | null = null;
    if (updatedUser!.companyId) {
      const [c] = await db
        .select({ name: companiesTable.name })
        .from(companiesTable)
        .where(eq(companiesTable.id, updatedUser!.companyId));
      companyName = c?.name ?? null;
    }

    res.json({
      id: updatedUser!.id,
      username: updatedUser!.username,
      email: updatedUser!.email,
      phone: updatedUser!.phone,
      role: updatedUser!.role,
      companyId: updatedUser!.companyId,
      companyName,
      isActive: updatedUser!.isActive,
      enabledModules: updatedUser!.enabledModules,
      createdAt: updatedUser!.createdAt,
    });
  } catch (err: any) {
    req.log.error({ err }, "Failed to update user");
    res.status(500).json({ error: err.message || "Failed to update user" });
  }
});


router.delete("/users/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw ?? "", 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  if (req.user!.role === "operator") {
    res.status(403).json({ error: "Forbidden: Operators cannot manage users" });
    return;
  }
  if (id === req.user!.id) {
    res.status(400).json({ error: "Cannot delete yourself" });
    return;
  }

  const [targetUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, id));

  if (!targetUser) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  // Prevent deleting super_master users by non-super_master
  if (req.user!.role !== "super_master" && targetUser.role === "super_master") {
    res.status(403).json({ error: "Forbidden: Cannot delete super master users" });
    return;
  }

  if (req.user!.role !== "master" && req.user!.role !== "super_master") {
    if (targetUser.companyId !== req.user!.companyId) {
      res.status(403).json({ error: "Forbidden: Cannot delete users outside your company" });
      return;
    }
    if (targetUser.role === "master") {
      res.status(403).json({ error: "Forbidden: Cannot delete master users" });
      return;
    }
  }

  await db.delete(usersTable).where(eq(usersTable.id, id));
  res.sendStatus(204);
});


export default router;
