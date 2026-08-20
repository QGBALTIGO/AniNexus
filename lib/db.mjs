import pg from 'pg';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://aninexus:aninexus@postgres:5432/aninexus',
  max: Number(process.env.PG_POOL_MAX || 20),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

export async function initDb() {
  const schema = await fs.readFile(path.join(__dirname, '..', 'sql', 'schema.sql'), 'utf8');
  await pool.query(schema);
  await pool.query('DELETE FROM sessions WHERE expires_at < now()').catch(() => {});
}

export async function q(text, params=[]) { return pool.query(text, params); }
