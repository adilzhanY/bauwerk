import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import { Pool } from "pg";

export const DB = Symbol("DB");

export function createPool(
  connectionString = process.env.DATABASE_URL ?? "postgres://localhost/bauwerk",
): Pool {
  return new Pool({ connectionString, max: 10 });
}

/** Applies every SQL file in migrations/ in name order. All statements are idempotent. */
export async function ensureSchema(pool: Pool): Promise<void> {
  const dir = fileURLToPath(new URL("../migrations/", import.meta.url));
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    await pool.query(readFileSync(`${dir}${file}`, "utf8"));
  }
}
