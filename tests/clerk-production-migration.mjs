import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const url=String(process.env.CLERK_MIGRATION_TEST_DATABASE_URL||'');
const parsed=url?new URL(url):null;
if(!parsed||!['127.0.0.1','localhost'].includes(parsed.hostname)||parsed.pathname!=='/aninexus_test'){
  throw new Error('Refusing any database except disposable localhost/aninexus_test');
}

Object.assign(process.env,{
  DATABASE_URL:url,
  NODE_ENV:'production',
  AUTH_PROVIDER:'clerk',
  CLERK_SECRET_KEY:'sk_live_'+'s'.repeat(40),
  CLERK_PUBLISHABLE_KEY:'pk_live_'+'p'.repeat(40),
  CLERK_AUTHORIZED_PARTIES:'https://aninexus.example.invalid',
  PUBLIC_ORIGIN:'https://aninexus.example.invalid',
  REDIS_PASSWORD:'synthetic-redis-password-for-tests-only-123456',
  IP_HASH_SALT:'synthetic-ip-hash-salt-for-tests-only-123456',
  CLERK_VERIFIED_EMAIL_REBIND:'auto',
});

const {initDb,pool}=await import('../lib/db.mjs');
const {syncClerkUser}=await import('../lib/auth.mjs');

const clerkUser=(id,email,{verified=true}={})=>({
  id,
  firstName:'Fixture',
  fullName:'Fixture User',
  username:'fixture',
  primaryEmailAddressId:'email_1',
  emailAddresses:[{
    id:'email_1',
    emailAddress:email,
    verification:{status:verified?'verified':'unverified'},
  }],
});

await initDb();

async function makeLegacy(email,{verified=true}={}){
  const id=crypto.randomUUID();
  const old='user_DEV'+crypto.randomBytes(8).toString('hex');
  await pool.query(
    `INSERT INTO users(id,email,username,password_hash,clerk_user_id,display_name,email_verified)
     VALUES($1,$2,$3,NULL,$4,$5,$6)`,
    [id,email,'legacy_'+crypto.randomBytes(5).toString('hex'),'user_'+old.slice(5),'Legacy AniNexus',verified],
  );
  return {id,old:'user_'+old.slice(5)};
}

test('Production Clerk verified email rebind preserves the same AniNexus account and library',async()=>{
  const email='migration-'+crypto.randomUUID()+'@example.invalid';
  const legacy=await makeLegacy(email);
  await pool.query(
    `INSERT INTO user_anime(user_id,media_id,status,progress)
     VALUES($1,123456,'CURRENT',7)`,
    [legacy.id],
  );
  const newClerk='user_PROD'+crypto.randomBytes(8).toString('hex');
  const user=await syncClerkUser(clerkUser(newClerk,email));

  assert.equal(user.id,legacy.id);
  assert.equal(user.clerk_user_id,newClerk);
  const dbUser=(await pool.query('SELECT id,clerk_user_id,username,display_name FROM users WHERE id=$1',[legacy.id])).rows[0];
  assert.equal(dbUser.id,legacy.id);
  assert.equal(dbUser.clerk_user_id,newClerk);
  assert.match(String(dbUser.username),/^legacy_/);
  assert.equal(Number((await pool.query('SELECT count(*) FROM user_anime WHERE user_id=$1 AND media_id=123456',[legacy.id])).rows[0].count),1);

  const audit=(await pool.query(
    'SELECT old_clerk_user_id,new_clerk_user_id,email FROM clerk_identity_rebinds WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1',
    [legacy.id],
  )).rows[0];
  assert.equal(audit.old_clerk_user_id,legacy.old);
  assert.equal(audit.new_clerk_user_id,newClerk);
  assert.equal(String(audit.email),email);

  await syncClerkUser(clerkUser(newClerk,email));
  assert.equal(Number((await pool.query('SELECT count(*) FROM clerk_identity_rebinds WHERE user_id=$1',[legacy.id])).rows[0].count),1);
});

test('Unverified Clerk email cannot take over an existing AniNexus identity',async()=>{
  const email='unverified-'+crypto.randomUUID()+'@example.invalid';
  const legacy=await makeLegacy(email);
  const attacker='user_PROD'+crypto.randomBytes(8).toString('hex');

  await assert.rejects(
    ()=>syncClerkUser(clerkUser(attacker,email,{verified:false})),
    /linked to another identity/,
  );
  const row=(await pool.query('SELECT clerk_user_id FROM users WHERE id=$1',[legacy.id])).rows[0];
  assert.equal(row.clerk_user_id,legacy.old);
  assert.equal(Number((await pool.query('SELECT count(*) FROM clerk_identity_rebinds WHERE user_id=$1',[legacy.id])).rows[0].count),0);
});

test('A new verified Production Clerk identity creates a normal new AniNexus account',async()=>{
  const email='new-'+crypto.randomUUID()+'@example.invalid';
  const id='user_PROD'+crypto.randomBytes(8).toString('hex');
  const user=await syncClerkUser(clerkUser(id,email));
  assert.equal(user.email,email);
  assert.equal(user.clerk_user_id,id);
  assert.ok(user.id);
});

test.after(async()=>{await pool.end()});
