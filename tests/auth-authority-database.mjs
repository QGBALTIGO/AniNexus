import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const database=new URL(process.env.DATABASE_URL || 'http://invalid');
if(process.env.ANINEXUS_SYNTHETIC_STAGE!=='true'||process.env.NODE_ENV!=='development'||database.hostname!=='postgres'||database.pathname!=='/aninexus_stage')throw new Error('Requires the dedicated synthetic staging database');
process.env.AUTH_PROVIDER='clerk';
process.env.CLERK_SECRET_KEY='sk_test_synthetic-only-not-a-real-secret';
process.env.CLERK_PUBLISHABLE_KEY='pk_test_'+Buffer.from('synthetic.clerk.example.invalid$').toString('base64');
const {q,pool}=await import('../lib/db.mjs');
const {initCache,redis,cacheSet,cacheDel}=await import('../lib/cache.mjs');
const {currentUser,requireRole,getClerkClient,invalidateUserIdentityCache}=await import('../lib/auth.mjs');
const id=crypto.randomUUID(),suffix=crypto.randomBytes(5).toString('hex'),clerkId='user_synthetic'+suffix;
const clerk=getClerkClient();
// Only the provider's token-verification boundary is replaced. The real
// AniNexus resolver, database, Redis and authorization code run unchanged.
clerk.authenticateRequest=async()=>({isAuthenticated:true,toAuth:()=>({userId:clerkId})});
clerk.users.getUser=async()=>{throw new Error('External Clerk calls are forbidden in this synthetic test')};
const request=()=>({headers:{host:'127.0.0.1:18081'},protocol:'http',url:'/api/admin/overview'});
const response=()=>({status:200,code(code){this.status=code;return this},send(){}});

test('Clerk identity cache never grants stale database authority',async t=>{
  await initCache();
  const {rows}=await q("INSERT INTO users(id,email,username,password_hash,role,email_verified,clerk_user_id) VALUES($1,$2,$3,NULL,'moderator',true,$4) RETURNING *",[id,`clerk-${suffix}@example.invalid`,`clerk_${suffix}`,clerkId]);
  const stale=rows[0],key='auth:clerk-user:'+clerkId;
  async function reset(){await q("UPDATE users SET role='moderator',status='active',deleted_at=NULL,suspended_until=NULL,email_verified=true WHERE id=$1",[id]);await cacheSet(key,stale,120)}
  try{
    await t.test('legitimate moderator remains authorized',async()=>{await reset();assert.equal((await currentUser(request())).role,'moderator')});
    await t.test('role downgrade overrides cached role',async()=>{
      await reset();await q("UPDATE users SET role='user' WHERE id=$1",[id]);
      const reply=response();assert.equal(await requireRole(request(),reply,['admin','moderator']),null);assert.equal(reply.status,403);
    });
    await t.test('ban overrides cached active status',async()=>{
      await reset();await q("UPDATE users SET status='banned' WHERE id=$1",[id]);
      const req=request();assert.equal(await currentUser(req),null);assert.equal(req.aninexusAccountStatus,'banned');
    });
    await t.test('expired suspension resumes legitimate access',async()=>{
      await reset();await q("UPDATE users SET status='suspended',suspended_until=now()-interval '1 minute' WHERE id=$1",[id]);
      assert.equal((await currentUser(request())).status,'active');
    });
    await t.test('deleted account cannot use a surviving cache',async()=>{await reset();await q('UPDATE users SET deleted_at=now() WHERE id=$1',[id]);assert.equal(await currentUser(request()),null)});
    await t.test('unverified identity cannot inherit verification from cache',async()=>{await reset();await q('UPDATE users SET email_verified=false WHERE id=$1',[id]);assert.equal(await currentUser(request()),null)});
    await t.test('cache miss still enforces current database role',async()=>{
      await reset();await cacheDel(key);await q("UPDATE users SET role='user' WHERE id=$1",[id]);assert.equal((await currentUser(request())).role,'user');
    });
    await t.test('invalidation rejects the legacy string argument',async()=>{await assert.rejects(invalidateUserIdentityCache(id),TypeError)});
  }finally{
    await invalidateUserIdentityCache(stale);await q('DELETE FROM users WHERE id=$1',[id]);await redis.quit();await pool.end();
  }
});
