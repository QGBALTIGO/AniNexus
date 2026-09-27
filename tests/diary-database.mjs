import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import pg from 'pg';
import Fastify from 'fastify';
import {registerDiary} from '../lib/diary.mjs';
const connectionString=process.env.MEDIA_TEST_DATABASE_URL;if(!connectionString)throw Error('MEDIA_TEST_DATABASE_URL is required');
const client=new pg.Client({connectionString}),schema='diary_test_'+crypto.randomBytes(8).toString('hex');await client.connect();
const app=Fastify(),alice=crypto.randomUUID(),bob=crypto.randomUUID(),clientKey=crypto.randomUUID();
try{
  await client.query('BEGIN');await client.query(`CREATE SCHEMA ${schema}`);await client.query(`SET LOCAL search_path TO ${schema}`);
  await client.query('CREATE TABLE users(id uuid PRIMARY KEY); CREATE TABLE media_cache(media_id bigint,media_type text,payload jsonb,PRIMARY KEY(media_id,media_type)); CREATE TABLE user_anime(user_id uuid,media_id bigint,updated_at timestamptz); CREATE TABLE user_manga(user_id uuid,media_id bigint,updated_at timestamptz)');
  const migration=await fs.readFile(new URL('../sql/034_personal_diary.sql',import.meta.url),'utf8');await client.query(migration);await client.query(migration);
  await client.query('INSERT INTO users VALUES($1),($2)',[alice,bob]);await client.query(`INSERT INTO media_cache VALUES(1,'ANIME','{"title":"Frieren","duration":24,"genres":["Fantasy"]}'),(1,'MANGA','{"title":"Frieren mangá","genres":["Fantasy"]}')`);
  await client.query('INSERT INTO user_anime VALUES($1,1,now())',[alice]);
  registerDiary(app,{q:(sql,params)=>client.query(sql,params),requireUser:async req=>({id:req.headers['x-user']||alice}),clock:()=>new Date('2026-09-27T18:00:00Z'),privateReadRate:{},writeRate:{}});
  const payload={clientKey,mediaId:1,mediaType:'ANIME',date:'2026-09-27',timeZone:'America/Cuiaba',kind:'EPISODE',startUnit:1,endUnit:3,score:9.5};
  const post=body=>app.inject({method:'POST',url:'/api/me/diary',payload:body});
  const created=await post(payload);assert.equal(created.statusCode,201,created.body);const id=created.json().item.id;
  assert.equal((await post(payload)).json().item.id,id);assert.equal((await post({...payload,score:8})).statusCode,409);
  assert.equal((await app.inject({method:'PATCH',url:'/api/me/diary/'+id,headers:{'x-user':bob},payload:{note:'Changed'}})).statusCode,404);
  assert.equal((await app.inject({method:'PATCH',url:'/api/me/diary/'+id,payload:{note:'Minha fantasia favorita'}})).statusCode,200);
  await client.query(`UPDATE media_cache SET payload=payload||'{"title":"Novo título","duration":99}' WHERE media_type='ANIME'`);
  assert.equal((await post(payload)).json().item.media_snapshot.title,'Frieren');
  const manga=await post({...payload,clientKey:crypto.randomUUID(),mediaType:'MANGA',kind:'CHAPTER',score:0});assert.equal(manga.statusCode,201,manga.body);
  let recap=(await app.inject('/api/me/diary/recap?start=2026-09-01&end=2026-09-27')).json().stats;
  assert.equal(recap.entries,2);assert.equal(recap.anime_works,1);assert.equal(recap.manga_works,1);assert.equal(recap.episodes,3);assert.equal(recap.chapters,3);assert.equal(recap.minutes,72);assert.equal(Number(recap.average_score),4.8);assert.equal(recap.genres[0].genre,'Fantasy');
  assert.equal((await app.inject({url:'/api/me/diary',headers:{'x-user':bob}})).json().items.length,0);
  assert.equal((await app.inject('/api/me/diary/titles?search=Novo')).json().items.length,1);
  assert.equal((await app.inject({method:'DELETE',url:'/api/me/diary/'+id,headers:{'x-user':bob}})).statusCode,404);
  assert.equal((await app.inject({method:'DELETE',url:'/api/me/diary/'+id})).statusCode,200);
  assert.equal((await app.inject('/api/me/diary')).json().items.length,1);
  // Pagination must not lose entries sharing the same calendar date.
  for(let i=0;i<31;i++)assert.equal((await post({...payload,clientKey:crypto.randomUUID()})).statusCode,201);
  const first=(await app.inject('/api/me/diary')).json(),second=(await app.inject('/api/me/diary?cursor='+first.nextCursor)).json();
  assert.equal(first.items.length,30);assert.equal(second.items.length,2);assert.equal(new Set([...first.items,...second.items].map(i=>i.id)).size,32);
  await client.query('DELETE FROM users WHERE id=$1',[alice]);assert.equal((await client.query('SELECT count(*) FROM personal_diary')).rows[0].count,'0');
  console.log('Diary PostgreSQL: migration, snapshots, idempotency, privacy, recap, pagination and account deletion verified.');
}finally{await app.close();await client.query('ROLLBACK');await client.end();}
