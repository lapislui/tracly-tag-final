import { db, usersTable } from "@workspace/db";
import { seedDatabase } from './lib/db-reset.js';

async function main() {
  console.log("Seeding TraclyTag database…");

  const existing = await db.select().from(usersTable);
  if (existing.length > 0) {
    console.log(`Already seeded (${existing.length} users). Skipping.`);
    process.exit(0);
  }

  await seedDatabase(db);
  console.log("Seed complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
