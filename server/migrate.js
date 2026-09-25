import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const migrationsDirectory = fileURLToPath(new URL("./migrations/", import.meta.url));

export async function migrate(pool) {
  const files = (await readdir(migrationsDirectory)).filter((file) => file.endsWith(".sql")).sort();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    for (const file of files) {
      const version = file.replace(/\.sql$/i, "");
      const { rows } = await client.query("SELECT 1 FROM schema_migrations WHERE version = $1", [version]);
      if (rows.length) continue;
      const sql = await readFile(join(migrationsDirectory, file), "utf8");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [version]);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
