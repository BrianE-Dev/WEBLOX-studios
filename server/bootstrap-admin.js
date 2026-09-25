import "dotenv/config";
import pg from "pg";
import { randomBytes, randomUUID, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import { migrate } from "./migrate.js";

const scrypt = promisify(scryptCallback);
const email = String(process.argv[2] || "").trim().toLowerCase();
const name = String(process.argv[3] || "").trim();
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required in .env.");
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !name || name.length > 120) {
  throw new Error('Usage: npm run admin:bootstrap -- "admin@example.com" "Admin name"');
}

const password = randomBytes(30).toString("base64url");
const salt = randomBytes(16);
const hash = await scrypt(password, salt, 64);
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ...(process.env.DATABASE_SSL === "true" ? { ssl: { rejectUnauthorized: true } } : {}),
});
try {
  await migrate(pool);
  const existing = await pool.query("SELECT 1 FROM accounts WHERE account_type = 'admin' LIMIT 1");
  if (existing.rowCount) throw new Error("An administrator account already exists; bootstrap is disabled.");
  await pool.query(
    `INSERT INTO accounts (id, email, name, role, account_type, salt, hash)
     VALUES ($1, $2, $3, 'Administrator', 'admin', $4, $5)`,
    [randomUUID(), email, name, salt.toString("hex"), hash.toString("hex")],
  );
  console.log(`Administrator account created for ${email}. Save this one-time password now:`);
  console.log(password);
} finally {
  await pool.end();
}
