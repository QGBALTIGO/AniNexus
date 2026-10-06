import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import Fastify from 'fastify';

const source=await fs.readFile(new URL('../server.mjs',import.meta.url),'utf8');
const start=source.indexOf("app.addHook('onSend',");
const end=source.indexOf("app.addHook('onResponse',",start);
assert.ok(start>=0&&end>start,'production response hook is available');
let responseHook;
vm.runInNewContext(source.slice(start,end),{
  app:{addHook(name,handler){assert.equal(name,'onSend');responseHook=handler;}},
  process:{env:{PUBLIC_ORIGIN:'https://aninexus.com.br'}},performance
});
const app=Fastify();
app.addHook('onRequest',async req=>{req.aninexusStartedAt=performance.now()});
app.addHook('onSend',responseHook);
app.route({method:['GET','POST','PATCH','DELETE'],url:'/*',handler:(req,reply)=>{
  if(req.query?.status)reply.code(Number(req.query.status));
  if(req.query?.html)return reply.type('text/html').send('<!doctype html><title>Fixture</title>');
  return {fixture:true};
}});
test.after(()=>app.close());

for(const pathname of ['/api/admin/users','/api/admin/v2/users','/api/admin/audit-log','/api/moderation/reports','/api/me','/api/me/library','/api/auth/session']){
  test(`${pathname}: private data remains uncacheable for success, failure and mutation`,async()=>{
    for(const method of ['GET','PATCH'])for(const status of [200,401,403,503]){
      const response=await app.inject({method,url:`${pathname}?status=${status}`});
      assert.equal(response.statusCode,status);
      assert.equal(response.headers['cache-control'],'private, no-store');
    }
  });
}
test('typed public media summaries retain their bounded public caching policy',async()=>{
  const response=await app.inject('/api/media/summaries?type=MANGA&ids=101');
  assert.equal(response.headers['cache-control'],'public, max-age=20, stale-while-revalidate=180, stale-if-error=600');
});
test('HTML and public responses keep transport, sniffing and privacy headers',async()=>{
  const response=await app.inject('/anime/fixture-101?html=1');
  assert.equal(response.headers['cache-control'],'no-cache, max-age=0, must-revalidate');
  assert.equal(response.headers['x-content-type-options'],'nosniff');
  assert.equal(response.headers['referrer-policy'],'strict-origin-when-cross-origin');
  assert.match(response.headers['strict-transport-security'],/max-age=31536000/);
  assert.match(response.headers['permissions-policy'],/camera=\(\)/);
});
