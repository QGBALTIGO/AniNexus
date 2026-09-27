import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { personalHome, registerPersonalHome, validTimeZone } from '../lib/personal-home.mjs';
const now = new Date('2026-09-27T03:30:00Z');
const row = (id, changes = {}) => ({ media_id:id, media_type:'ANIME',status:'CURRENT',progress:3,updated_at:now.toISOString(),cached_at:now.toISOString(),
  media:{ title:`Obra ${id}`, episodes:12,status:'FINISHED',cover:'https://example.com/cover.jpg' }, ...changes });
test('personal home is type-safe and uses real progress without invented releases',()=>{
  const data=personalHome([row(1),row(1,{media_type:'MANGA',media:{title:'Mangá',chapters:20,status:'FINISHED'}}),row(2,{media:{title:'No ar',episodes:100,status:'RELEASING'}}),row(3,{progress:12}),row(4,{status:'PAUSED'})],{now});
  assert.equal(data.continue.length,3);assert.equal(data.continue[0].next,4);assert.equal(data.backlog.length,1);assert.equal(data.backlog[0].remaining,9);
  assert.equal(data.continue[1].href,'/manga/1');assert.equal(data.coverage.tracked,5);
});
test('schedule uses the requested local day, rejects stale metadata and never assumes unknown dates',()=>{
  const episode={airingAt:Date.parse('2026-09-27T02:00:00Z')/1000,episode:4};
  const scheduled=row(1,{media:{title:'Programado',status:'RELEASING',nextAiringEpisode:episode}});
  const data=personalHome([scheduled,row(2,{...scheduled,media_id:2,cached_at:'2026-09-01'}),row(3,{media:{title:'Estreia',status:'NOT_YET_RELEASED',startDate:{year:2027}}})],{now,timeZone:'America/Cuiaba'});
  assert.equal(data.today,'2026-09-26');assert.equal(data.todayItems.length,1);assert.equal(data.todayItems[0].alreadyScheduled,true);assert.equal(data.premieres.length,0);assert.equal(data.coverage.staleMetadata,1);
  assert.equal(personalHome([scheduled],{now,timeZone:'Asia/Tokyo'}).today,'2026-09-27');
});
test('empty incomplete and hostile cached metadata is bounded and honest',()=>{
  const data=personalHome([row(1,{media:null}),row(2,{media:{title:'Unknown',cover:'javascript:alert(1)',episodes:null}}),row(2)],{now});
  assert.equal(data.coverage.missingMetadata,1);assert.equal(data.continue[0].cover,null);assert.equal(data.backlog.length,0);assert.equal(data.continue[0].total,null);
  assert.equal(personalHome(Array.from({length:99},(_,i)=>row(i+1)),{now}).continue.length,12);
  assert.equal(validTimeZone('invalid'),null);
});
test('premieres validate actual calendar dates and sorts schedule across year boundaries',()=>{
  const data=personalHome([row(1,{media:{title:'Invalid',status:'NOT_YET_RELEASED',startDate:{year:2027,month:2,day:31}}}),row(2,{status:'PLANNING',media:{title:'Valid',status:'NOT_YET_RELEASED',startDate:{year:2027,month:1,day:1}}})],{now});
  assert.deepEqual(data.premieres.map(i=>i.id),[2]);
});
test('private read route requires account, parameterizes identity and never hydrates remote media',async()=>{
  const app=Fastify();const calls=[];
  registerPersonalHome(app,{privateReadRate:{},clock:()=>now,requireUser:async(req,reply)=>req.headers.authorization?{id:'fixture-user'}:(reply.code(401).send({error:'AUTH_REQUIRED'}),null),q:async(sql,params)=>{calls.push({sql,params});return{rows:[row(1)]}}});
  assert.equal((await app.inject('/api/me/home')).statusCode,401);assert.equal(calls.length,0);
  assert.equal((await app.inject({url:'/api/me/home?timeZone=invalid',headers:{authorization:'fixture'}})).statusCode,400);
  const result=await app.inject({url:'/api/me/home?timeZone=America%2FCuiaba',headers:{authorization:'fixture'}});
  assert.equal(result.statusCode,200);assert.equal(result.headers['cache-control'],'private, no-store');assert.deepEqual(calls[0].params,['fixture-user']);assert.equal(result.json().continue[0].id,1);
  await app.close();
});
