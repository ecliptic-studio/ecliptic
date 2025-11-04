#!/usr/bin/env bun
import { Database } from "bun:sqlite";
import { readdir, readFile } from "fs/promises";
import { join } from "path";

const DATABASE_URL = process.env.DATABASE_URL || join(import.meta.dir, "..", "ecliptic.db");
const migration_DIR = join(import.meta.dir, "..", "migrations");

export async function runmigration(db?: Database) {
  db = db ?? new Database(DATABASE_URL, { create: true });
  const isInMemory = db.filename === ':memory:';

  !isInMemory && console.log(`Running migrations on ${db.filename} in directory ${migration_DIR}`)

  try {
    !isInMemory && console.log("🔍 Checking migration...");

    // Get list of already applied migration (if table exists)
    let appliedmigration = new Set<string>();
    try {
      const result = db.prepare("SELECT filename FROM migration").all() as { filename: string }[];
      appliedmigration = new Set(result.map(row => row.filename));
    } catch (error) {
      // Migration table doesn't exist yet - will be created by first migration
      !isInMemory && console.log("📋 Migration table doesn't exist yet (will be created by first migration)");
    }

    // Read all SQL files from migration directory
    let files: string[];
    try {
      files = await readdir(migration_DIR);
    } catch (error) {
      console.error("❌ Could not read migration directory:", error);
      process.exit(1);
    }

    // Filter and sort SQL files
    const sqlFiles = files
      .filter(file => file.endsWith(".sql"))
      .sort(); // Alphabetical sort by filename

    if (sqlFiles.length === 0) {
      !isInMemory && console.log("✅ No migration found");
      db.close();
      return;
    }

    // Apply pending migration
    let appliedCount = 0;
    for (const file of sqlFiles) {
      if (appliedmigration.has(file)) {
        !isInMemory && console.log(`⏭️  Skipping ${file} (already applied)`);
        continue;
      }

      !isInMemory && console.log(`📝 Applying ${file}...`);

      try {
        const filePath = join(migration_DIR, file);
        const sql = await readFile(filePath, "utf-8");

        // Execute migration in a transaction
        db.run("BEGIN");
        db.exec(sql);

        // Record migration (migration table should exist after first migration)
        db.prepare("INSERT INTO migration (filename) VALUES (?)").run(file);
        db.run("COMMIT");

        !isInMemory && console.log(`✅ Applied ${file}`);
        appliedCount++;
      } catch (error) {
        db.run("ROLLBACK");
        console.error(`❌ Failed to apply ${file}:`, error);
        db.close();
        process.exit(1);
      }
    }

    if (appliedCount === 0) {
      !isInMemory && console.log("✅ All migration up to date");
    } else {
      !isInMemory && console.log(`\n✅ Successfully applied ${appliedCount} migration(s)`);
    }

    // keep connection open for in-memory database
    !isInMemory && db.close();
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    db.close();
    process.exit(1);
  }
}
if (import.meta.main) {
  runmigration().catch(error => {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  });
}
