import pg from 'pg';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://aninexus:aninexus@postgres:5432/aninexus',
  max: Math.max(2, Math.min(100, Number(process.env.PG_POOL_MAX || 20))),
  min: Math.max(0, Math.min(10, Number(process.env.PG_POOL_MIN || 0))),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 10_000,
  query_timeout: 12_000,
  application_name: 'aninexus',
  allowExitOnIdle:false,
});
pool.on('error', err => console.error('[postgres]', err.message));

export async function initDb() {
  const client=await pool.connect();
  try{
    // Prevent multiple horizontally-scaled app/worker containers from running DDL together.
    await client.query('SELECT pg_advisory_lock($1)',[84110622]);
    const dir=path.join(__dirname,'..','sql');
    const files=(await fs.readdir(dir)).filter(x=>x.endsWith('.sql')).sort((a,b)=>a.localeCompare(b,'en',{numeric:true}));
    for(const file of files){const sql=await fs.readFile(path.join(dir,file),'utf8');if(sql.trim())await client.query(sql);}
    await client.query('DELETE FROM sessions WHERE expires_at < now()').catch(() => {});
  }finally{
    await client.query('SELECT pg_advisory_unlock($1)',[84110622]).catch(()=>{});
    client.release();
  }
}

export async function dbReady(){
  try{const r=await pool.query('SELECT 1 AS ok');return r.rows[0]?.ok===1}catch{return false}
}

export async function q(text, params=[]) {
  if (typeof text !== 'string' || text.length > 100_000) throw new TypeError('Invalid SQL query');
  if (!Array.isArray(params) || params.length > 200) throw new TypeError('Invalid SQL parameters');
  return pool.query(text, params);
}
