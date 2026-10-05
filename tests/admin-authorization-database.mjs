import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { q, pool } from '../lib/db.mjs';
import { initCache, redis, cacheSet, cacheGet } from '../lib/cache.mjs';
import { hashPassword, createSession, invalidateUserIdentityCache } from '../lib/auth.mjs';
import { lockModerationUsers } from '../lib/user-moderation.mjs';

const database = new URL(process.env.DATABASE_URL || 'http://invalid');
if (process.env.ANINEXUS_SYNTHETIC_STAGE !== 'true' || process.env.NODE_ENV !== 'development' || database.hostname !== 'postgres' || database.pathname !== '/aninexus_stage') throw new Error('Requires the dedicated synthetic staging database');
const endpoints = ['http://app:3000', 'http://app2:3000'];
const origin = 'http://127.0.0.1:18081';
const run = crypto.randomBytes(4).toString('hex');
const fixtures = {};
const cookies = {};
const tokens = {};
const legacy = '/api/admin/users';
const routes = [legacy, legacy + '/moderation', '/api/admin/v2/users/moderation'];
const routeFor = (route, id) => route.endsWith('/moderation') ? route.slice(0, -11) + '/' + id + '/moderation' : route + '/' + id;
const payload = (route, change) => route === legacy ? {banReason:null, moderationNote:null, ...change} : {reason:'Verificação sintética autorizada', ...change};
const getUser = async name => (await q('SELECT * FROM users WHERE id=$1', [fixtures[name].id])).rows[0];
async function reset(name) {
  const row = fixtures[name];
  await q("UPDATE users SET role=$2,status='active',suspended_until=NULL,deleted_at=NULL,ban_reason=NULL WHERE id=$1", [row.id,row.role]);
  await invalidateUserIdentityCache(await getUser(name));
}
async function request(actor, method, path, body, instance=0, cookieOverride) {
  const response = await fetch(endpoints[instance] + path, {method,headers:{Origin:origin,...(actor?{Cookie:cookieOverride || cookies[actor]}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
  const text=await response.text();
  return {status:response.status, body:text?JSON.parse(text):null};
}
async function session(name) {
  let cookie;
  await createSession({setCookie(key,value){cookie=key+'='+value},clearCookie(){}},await getUser(name),{ip:'127.0.0.1',headers:{'user-agent':'synthetic-stage'},protocol:'http'});
  return cookie;
}

test('administrative authorization and revocation across both app instances', async t => {
  await initCache();
  const hash=await hashPassword('SyntheticOnly12345');
  for(const [name,role] of [['owner','admin'],['otherAdmin','admin'],['mod','moderator'],['otherMod','moderator'],['member','user'],['otherMember','user']]) {
    const id=crypto.randomUUID();
    const {rows}=await q("INSERT INTO users(id,email,username,password_hash,role,email_verified,clerk_user_id) VALUES($1,$2,$3,$4,$5,true,$6) RETURNING *", [id,`${name}-${run}@example.invalid`,`${name}_${run}`,hash,role,`user_stage${name}${run}`]);
    fixtures[name]=rows[0];
    cookies[name]=await session(name);
    tokens[name]=cookies[name].split('=')[1];
  }
  try {
    await t.test('anonymous and regular members cannot use administrative routes',async()=>{
      assert.equal((await request(null,'GET','/api/admin/overview')).status,401);
      assert.equal((await request('member','GET','/api/admin/overview')).status,403);
      assert.equal((await request('member','PATCH',routeFor(legacy,fixtures.otherMember.id),payload(legacy,{role:'admin'}))).status,403);
    });
    for(const route of routes) {
      await t.test(`${route}: moderator cannot promote their own account`,async()=>{
        await reset('mod');
        const result=await request('mod','PATCH',routeFor(route,fixtures.mod.id),payload(route,{role:'admin'}));
        assert.equal(result.status,route===legacy?400:409);
        assert.equal((await getUser('mod')).role,'moderator');
      });
      await t.test(`${route}: moderator cannot change a user role`,async()=>{
        await reset('member');
        assert.equal((await request('mod','PATCH',routeFor(route,fixtures.member.id),payload(route,{role:'admin'}))).status,403);
        assert.equal((await getUser('member')).role,'user');
      });
      for(const target of ['otherMod','otherAdmin']) await t.test(`${route}: moderator cannot restrict ${target}`,async()=>{
        await reset(target);
        assert.equal((await request('mod','PATCH',routeFor(route,fixtures[target].id),payload(route,{status:'banned'}))).status,403);
        assert.equal((await getUser(target)).status,'active');
      });
      await t.test(`${route}: moderator can suspend an ordinary member`,async()=>{
        await reset('member');
        const until=new Date(Date.now()+3600000).toISOString();
        const result=await request('mod','PATCH',routeFor(route,fixtures.member.id),payload(route,{status:'suspended',...(route===legacy?{suspendedUntil:until}:{suspendUntil:until})}));
        assert.equal(result.status,200);
        assert.equal((await request('member','GET','/api/me',null,1)).status,403);
        await reset('member');
      });
      await t.test(`${route}: administrator can promote a member`,async()=>{
        await reset('member');
        const result=await request('owner','PATCH',routeFor(route,fixtures.member.id),payload(route,{role:'moderator'}));
        assert.equal(result.status,200);
        assert.equal((await getUser('member')).role,'moderator');
        if(route===legacy){assert.equal(result.body.ok,true);assert.equal(typeof result.body.user.session_version,'number');assert.equal('clerk_user_id' in result.body.user,false)}
        await reset('member');
      });
      await t.test(`${route}: alternate UUID casing cannot bypass self restriction`,async()=>{
        try {
          const result=await request('owner','PATCH',routeFor(route,fixtures.owner.id.toUpperCase()),payload(route,{status:'banned'}));
          assert.equal(result.status,route===legacy?400:409);
          assert.equal((await getUser('owner')).status,'active');
        } finally { await reset('owner') }
      });
    }
    await t.test('alternate UUID casing cannot bypass self deletion',async()=>{
      try {
        assert.equal((await request('owner','DELETE',legacy+'/'+fixtures.owner.id.toUpperCase())).status,400);
        assert.equal((await getUser('owner')).deleted_at,null);
      } finally { await reset('owner') }
    });
    await t.test('legacy role change evicts Clerk and every session cache',async()=>{
      await reset('otherMod');
      const second=await session('otherMod');
      const row=await getUser('otherMod');
      await cacheSet('auth:clerk-user:'+row.clerk_user_id,row,120);
      assert.equal((await request('otherMod','GET','/api/admin/overview',null,1)).status,200);
      assert.equal((await request('owner','PATCH',legacy+'/'+row.id,payload(legacy,{role:'user'}))).status,200);
      assert.equal(await cacheGet('auth:clerk-user:'+row.clerk_user_id),null);
      for(const cookie of [cookies.otherMod,second]) {
        const key='auth:session:'+crypto.createHash('sha256').update(cookie.split('=')[1]).digest('hex');
        assert.equal(await cacheGet(key),null);
        assert.equal((await request('otherMod','GET','/api/admin/overview',null,1,cookie)).status,403);
      }
      await reset('otherMod');
    });
    await t.test('stale cache written after invalidation cannot retain authority',async()=>{
      await reset('otherMod');
      const stale=await getUser('otherMod');
      assert.equal((await request('otherMod','GET','/api/admin/overview',null,1)).status,200);
      await q("UPDATE users SET role='user' WHERE id=$1",[stale.id]);
      const key='auth:session:'+crypto.createHash('sha256').update(tokens.otherMod).digest('hex');
      await cacheSet(key,stale,120);
      assert.equal((await request('otherMod','GET','/api/admin/overview',null,1)).status,403);
      await reset('otherMod');
    });
    await t.test('deletion cannot be undone by a stale cache entry',async()=>{
      await reset('otherMember');
      const stale=await getUser('otherMember');
      const key='auth:session:'+crypto.createHash('sha256').update(tokens.otherMember).digest('hex');
      await cacheSet('auth:clerk-user:'+stale.clerk_user_id,stale,120);
      assert.equal((await request('owner','DELETE',legacy+'/'+stale.id)).status,204);
      assert.equal(await cacheGet('auth:clerk-user:'+stale.clerk_user_id),null);
      await cacheSet(key,stale,120);
      assert.equal((await request('otherMember','GET','/api/me',null,1)).status,401);
    });
    for(const state of ['deleted','expired']) await t.test(`${state} sessions are rejected even if their cache survives`,async()=>{
      await reset('member');
      const cookie=await session('member');
      const token=cookie.split('=')[1],hash=crypto.createHash('sha256').update(token).digest('hex');
      await q(state==='deleted'?'DELETE FROM sessions WHERE token_hash=$1':"UPDATE sessions SET expires_at=now()-interval '1 minute' WHERE token_hash=$1",[hash]);
      assert.equal((await request('member','GET','/api/me',null,1,cookie)).status,401);
    });
    await t.test('a waiting moderation transaction cannot keep a concurrently revoked role',async()=>{
      await reset('otherMod');await reset('member');
      const oldActor=await getUser('otherMod'),writer=await pool.connect(),follower=await pool.connect();
      let waiting;
      try {
        await writer.query('BEGIN');await follower.query('BEGIN');
        await writer.query("UPDATE users SET role='user' WHERE id=$1",[oldActor.id]);
        waiting=lockModerationUsers(follower,oldActor,fixtures.member.id);
        let blocked=false;
        for(let attempt=0;attempt<20;attempt++) {
          const state=(await q('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1',[follower.processID])).rows[0];
          if(state?.wait_event_type==='Lock'){blocked=true;break}
          await new Promise(resolve=>setTimeout(resolve,20));
        }
        assert.equal(blocked,true,'must exercise a real PostgreSQL lock wait');
        await writer.query('COMMIT');
        assert.equal((await waiting).forbidden,true);
        assert.equal((await getUser('member')).status,'active');
      }finally{
        await writer.query('ROLLBACK');await waiting?.catch(()=>{});await follower.query('ROLLBACK');
        writer.release();follower.release();await reset('otherMod');
      }
    });
    await t.test('library data stays scoped to its synthetic owner',async()=>{
      await reset('member');await reset('otherMember');
      await q("INSERT INTO user_anime(user_id,media_id,status) VALUES($1,42,'CURRENT')",[fixtures.member.id]);
      const own=await request('member','GET','/api/me/list');
      const other=await request('otherMember','GET','/api/me/list');
      assert.equal(own.status,200);assert.equal(own.body.items.length,1);
      assert.equal(other.status,200);assert.equal(other.body.items.length,0);
    });
  } finally {
    for(const row of Object.values(fixtures)) {
      await invalidateUserIdentityCache(await getUser(Object.keys(fixtures).find(name=>fixtures[name].id===row.id)));
      await q('DELETE FROM users WHERE id=$1',[row.id]);
    }
    await redis.quit();await pool.end();
  }
});
