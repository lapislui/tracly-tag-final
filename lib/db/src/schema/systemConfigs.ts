import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const systemConfigsTable = sqliteTable("system_configs", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export type SystemConfig = typeof systemConfigsTable.$inferSelect;
export type InsertSystemConfig = typeof systemConfigsTable.$inferInsert;
