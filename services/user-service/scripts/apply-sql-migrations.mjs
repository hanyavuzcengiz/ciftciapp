/**
 * prisma/migrations altındaki migration.sql dosyalarını DATABASE_URL üzerinde sırayla çalıştırır.
 * Kullanım (repo kökü): pnpm db:user:migrate
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", "..", "..", ".env") });
const migrationsDir = path.join(__dirname, "..", "prisma", "migrations");

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error("DATABASE_URL tanımlı değil.");
  process.exit(1);
}

const dirs = (await readdir(migrationsDir, { withFileTypes: true }))
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

const client = new pg.Client({ connectionString: url });
await client.connect();

try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS app_sql_migrations (
      service_name TEXT NOT NULL,
      migration_name TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (service_name, migration_name)
    )
  `);

  for (const dir of dirs) {
    const sqlPath = path.join(migrationsDir, dir, "migration.sql");
    let sql;
    try {
      sql = await readFile(sqlPath, "utf8");
    } catch {
      continue;
    }
    const already = await client.query(
      "SELECT 1 FROM app_sql_migrations WHERE service_name = $1 AND migration_name = $2 LIMIT 1",
      ["user-service", dir]
    );
    if (already.rowCount > 0) {
      console.log(`↷ ${dir} (skip, already applied)`);
      continue;
    }

    console.log(`→ ${dir}`);
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query(
        "INSERT INTO app_sql_migrations (service_name, migration_name) VALUES ($1, $2)",
        ["user-service", dir]
      );
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
  }
  console.log("Tamam.");
} finally {
  await client.end();
}
