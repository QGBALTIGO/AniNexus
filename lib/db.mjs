import pg from 'pg';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import crypto from 'node:crypto';

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

export function migrationSqlForTransaction(sql) {
  const source=String(sql||'');
  if(!/^\s*BEGIN\s*;/i.test(source)||!/COMMIT\s*;\s*$/i.test(source))return source;
  return source.replace(/^\s*BEGIN\s*;\s*/i,'').replace(/\s*COMMIT\s*;\s*$/i,'');
}

export async function initDb() {
  const client=await pool.connect();
  try{
    // Prevent multiple horizontally-scaled app/worker containers from running DDL together.
    await client.query('SELECT pg_advisory_lock($1)',[84110622]);
    await client.query(`CREATE TABLE IF NOT EXISTS aninexus_schema_migrations (
      name text PRIMARY KEY,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const dir=path.join(__dirname,'..','sql');
    const discovered=(await fs.readdir(dir)).filter(x=>x.endsWith('.sql'));
    // schema.sql creates the base objects. Incremental migrations may ALTER or
    // reference them, so a fresh deployment must never run 002… before schema.sql.
    const migrations=discovered.filter(x=>x!=='schema.sql').sort((a,b)=>a.localeCompare(b,'en',{numeric:true}));
    const files=discovered.includes('schema.sql')?['schema.sql',...migrations]:migrations;
    const applied=new Map((await client.query('SELECT name,checksum FROM aninexus_schema_migrations')).rows.map(row=>[row.name,row.checksum]));
    for(const file of files){
      const sql=await fs.readFile(path.join(dir,file),'utf8');
      if(!sql.trim())continue;
      const checksum=crypto.createHash('sha256').update(sql).digest('hex');
      if(applied.has(file)){
        if(applied.get(file)!==checksum)throw Object.assign(new Error(`Applied migration changed: ${file}`),{code:'MIGRATION_CHECKSUM_MISMATCH'});
        continue;
      }
      await client.query('BEGIN');
      try{
        // A legacy migration may already wrap itself in BEGIN/COMMIT. Strip
        // only that outer pair so its DDL and bookkeeping stay one transaction.
        await client.query(migrationSqlForTransaction(sql));
        await client.query('INSERT INTO aninexus_schema_migrations(name,checksum) VALUES($1,$2)',[file,checksum]);
        await client.query('COMMIT');
      }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error}
    }
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
