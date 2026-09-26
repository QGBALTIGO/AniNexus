import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Fastify from 'fastify';
import {mangaEvent,registerMangaWebappLink} from '../lib/manga-webapp-link.mjs';

test('connection routes are registered in the production server and consent shell',()=>{
  assert.match(fs.readFileSync('server.mjs','utf8'),/registerMangaWebappLink\(app,\{q,transaction,requireUser\}\)/);
  assert.match(fs.readFileSync('index.html','utf8'),/assets\/manga-connect\.js/);
});
test('sync accepts only scoped bounded mutations',()=>{
  assert.equal(mangaEvent.safeParse({externalId:'manga:one',title:'One',favorite:false}).success,true);
  for(const extra of [{userId:'other'}, {progress:-1}, {progress:1.5}, {status:'ADMIN'}])
    assert.equal(mangaEvent.safeParse({externalId:'one',title:'One',favorite:true,...extra}).success,false);
});
test('no credential can bypass connection or approval authentication',async()=>{
  const app=Fastify();
  registerMangaWebappLink(app,{
    q:async()=>{throw Error('Unauthenticated request reached database')},
    transaction:async()=>{throw Error('Unauthenticated transaction')},
    requireUser:async(req,reply)=>{reply.code(401).send({error:'AUTH_REQUIRED'});return null},
  });
  try{
    for(const [method,url,payload] of [['GET','connection'],['DELETE','connection'],['POST','sync',{}],['POST','approve',{code:'a'.repeat(64)}]]){
      const r=await app.inject({method,url:'/api/manga-link/'+url,payload});
      assert.equal(r.statusCode,401);
      assert.equal(r.headers['cache-control'],'no-store');
    }
  }finally{await app.close()}
});
