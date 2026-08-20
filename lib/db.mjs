import pg from 'pg';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://aninexus:aninexus@postgres:5432/aninexus',
  max: Math.max(2, Math.min(100, Number(process.env.PG_POOL_MAX || 20))),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 10_000,
  query_timeout: 12_000,
  application_name: 'aninexus',
});
pool.on('error', err => console.error('[postgres]', err.message));

export async function initDb() {
  const dir=path.join(__dirname,'..','sql');
  const files=(await fs.readdir(dir)).filter(x=>x.endsWith('.sql')).sort((a,b)=>a.localeCompare(b,'en',{numeric:true}));
  for(const file of files){const sql=await fs.readFile(path.join(dir,file),'utf8');if(sql.trim())await pool.query(sql);}
  await pool.query('DELETE FROM sessions WHERE expires_at < now()').catch(() => {});
}

export async function q(text, params=[]) {
  if (typeof text !== 'string' || text.length > 100_000) throw new TypeError('Invalid SQL query');
  if (!Array.isArray(params) || params.length > 200) throw new TypeError('Invalid SQL parameters');
  return pool.query(text, params);
}
