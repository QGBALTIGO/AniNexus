import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import {diaryEntrySchema,diaryPeriod,registerDiary} from '../lib/diary.mjs';
const now=new Date('2026-09-27T02:00:00Z'),key='10000000-0000-4000-8000-000000000001';
const entry={clientKey:key,mediaId:1,mediaType:'ANIME',date:'2026-09-26',timeZone:'America/Cuiaba',kind:'EPISODE',startUnit:1,endUnit:3,score:9.5};
test('diary validates real dates typed units ratings and bounded ranges',()=>{
  assert.equal(diaryEntrySchema.safeParse(entry).success,true);
  for(const patch of [{date:'2026-02-30'},{score:10.1},{score:-1},{kind:'CHAPTER'},{endUnit:0},{endUnit:1001},{timeZone:'Mars'},{unexpected:1}])assert.equal(diaryEntrySchema.safeParse({...entry,...patch}).success,false,JSON.stringify(patch));
  assert.equal(diaryEntrySchema.parse({...entry,score:0}).score,0);
  assert.equal(diaryEntrySchema.safeParse({...entry,mediaType:'MANGA',kind:'CHAPTER'}).success,true);
  assert.equal(diaryEntrySchema.safeParse({...entry,kind:'WORK',startUnit:null,endUnit:null}).success,true);
});
test('diary period follows local day and bounds ranges including leap years',()=>{
  assert.equal(diaryPeriod({timeZone:'America/Cuiaba'},now).end,'2026-09-26');
  for(const query of [{start:'2026-02-30'},{end:'2026-09-28'},{start:'2026-09-26',end:'2026-09-20'},{start:'2020-01-01'},{timeZone:'invalid'}])assert.equal(diaryPeriod(query,now),null);
  assert.ok(diaryPeriod({start:'2024-01-01',end:'2024-12-31'},now));
});
test('diary private mutations are validated and snapshots use cached metadata, never live rating',async()=>{
  const calls=[],app=Fastify();
  registerDiary(app,{q:async(sql,params)=>{calls.push({sql,params});if(sql.startsWith('SELECT payload'))return{rows:[{payload:{title:'Frieren',duration:24,genres:['Fantasy']}}]};if(sql.startsWith('INSERT'))return{rows:[{id:key,score:params[11]}]};return{rows:[]}},clock:()=>now,requireUser:async(req,reply)=>req.headers.authorization?{id:'owner'}:(reply.code(401).send({error:'AUTH_REQUIRED'}),null),privateReadRate:{},writeRate:{}});
  const create=payload=>app.inject({method:'POST',url:'/api/me/diary',headers:{authorization:'fixture'},payload});
  assert.equal((await app.inject('/api/me/diary')).statusCode,401);
  assert.equal((await create({...entry,date:'2026-09-27'})).statusCode,422);assert.equal(calls.length,0);
  const result=await create(entry);assert.equal(result.statusCode,201);const insert=calls.find(c=>c.sql.startsWith('INSERT'));
  assert.equal(insert.params[18],72);assert.equal(insert.params[19],'ESTIMATED');assert.equal(insert.params[11],9.5);assert.equal(JSON.parse(insert.params[5]).title,'Frieren');
  assert.ok(calls.every(c=>!/(?:UPDATE|INSERT INTO) user_(anime|manga)/.test(c.sql)));
  await app.close();
});
test('diary idempotency conflict and author scope protect history',async()=>{
  const calls=[],app=Fastify();registerDiary(app,{q:async(sql,params)=>{calls.push({sql,params});return{rows:sql.includes('client_key')?[{id:key,request_hash:'different'}]:[]}},clock:()=>now,requireUser:async()=>({id:'owner'}),privateReadRate:{},writeRate:{}});
  const result=await app.inject({method:'POST',url:'/api/me/diary',payload:entry});assert.equal(result.statusCode,409);assert.equal(calls.length,1);
  assert.equal((await app.inject({method:'PATCH',url:'/api/me/diary/'+key,payload:{score:8}})).statusCode,404);
  assert.equal((await app.inject({method:'DELETE',url:'/api/me/diary/'+key})).statusCode,404);
  assert.ok(calls.slice(1).every(c=>c.params[0]==='owner'&&/WHERE user_id=\$1 AND id=\$2/.test(c.sql)));await app.close();
});
