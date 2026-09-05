import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import pg from 'pg';

const connectionString=process.env.MEDIA_TEST_DATABASE_URL;
if(!connectionString)throw new Error('MEDIA_TEST_DATABASE_URL is required');
const client=new pg.Client({connectionString});
const schema='media_list_test_'+crypto.randomBytes(8).toString('hex');
await client.connect();
try{
  await client.query('BEGIN');
  await client.query(`CREATE SCHEMA ${schema}`);
  await client.query(`SET LOCAL search_path TO ${schema}`);
  for(const table of ['user_anime','user_manga'])await client.query(`CREATE TABLE ${table} (user_id uuid NOT NULL,media_id bigint NOT NULL,status text,score numeric,reaction text,progress integer,updated_at timestamptz,PRIMARY KEY(user_id,media_id))`);
  const migration=await fs.readFile(new URL('../sql/022_media_list_reactions.sql',import.meta.url),'utf8');
  await client.query(migration);await client.query(migration);
  const source=await fs.readFile(new URL('../server.mjs',import.meta.url),'utf8');
  const user=crypto.randomUUID();
  for(const table of ['user_anime','user_manga']){
    const sql=source.match(new RegExp('`(INSERT INTO '+table+'\\(user_id,media_id,status,score,reaction,progress,reactions,volume_progress,updated_at\\)[^`]+)`'))?.[1];
    assert.ok(sql,`${table} upsert must be tested from the actual route`);
    await client.query(sql,[user,301,'CURRENT',8.5,null,3,JSON.stringify(['Amei','Viciante']),2]);
    let row=(await client.query(`SELECT * FROM ${table}`)).rows[0];
    assert.deepEqual(row.reactions,['Amei','Viciante']);assert.equal(row.volume_progress,2);assert.equal(Number(row.score),8.5);
    await client.query(sql,[user,301,'PAUSED',8,null,3,null,2]);
    row=(await client.query(`SELECT * FROM ${table}`)).rows[0];assert.deepEqual(row.reactions,['Amei','Viciante']);
    await client.query(sql,[user,301,'COMPLETED',9,null,48,'[]',8]);
    row=(await client.query(`SELECT * FROM ${table}`)).rows[0];assert.deepEqual(row.reactions,[]);assert.equal(row.progress,48);
    await client.query(`DELETE FROM ${table} WHERE user_id=$1 AND media_id=$2`,[user,301]);
    assert.equal((await client.query(`SELECT count(*) FROM ${table}`)).rows[0].count,'0');
  }
  console.log('Media lists: migration is repeatable; both route upserts preserve reactions and volumes.');
}finally{await client.query('ROLLBACK');await client.end()}
