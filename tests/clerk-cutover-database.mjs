import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const url=String(process.env.CLERK_CUTOVER_TEST_DATABASE_URL||'');
const parsed=url?new URL(url):null;
if(!parsed||!['127.0.0.1','localhost'].includes(parsed.hostname)||parsed.pathname!=='/aninexus_test')throw new Error('Refusing any database except disposable localhost/aninexus_test');

process.env.DATABASE_URL=url;
process.env.NODE_ENV='test';
process.env.AUTH_PROVIDER='clerk';
process.env.CLERK_SECRET_KEY='sk_live_ci-only-not-a-real-secret';
process.env.CLERK_PUBLISHABLE_KEY='pk_live_'+Buffer.from('clerk.example.invalid$').toString('base64');

const {initDb,pool}=await import('../lib/db.mjs');
const {syncClerkUser,CLERK_INSTANCE_KIND}=await import('../lib/auth.mjs');

test('verified Production Clerk identity rebind preserves AniNexus UUID and product data',async()=>{
  await initDb();
  assert.equal(CLERK_INSTANCE_KIND,'production');

  const userId=crypto.randomUUID();
  const suffix=userId.replaceAll('-','').slice(0,12);
  const email=`clerk-cutover-${suffix}@example.invalid`;
  const legacyClerkId=`user_DEV${suffix}`;
  const productionClerkId=`user_PROD${suffix}`;
  const mediaId=987654321;

  await pool.query(
    "INSERT INTO users(id,email,username,password_hash,clerk_user_id,email_verified) VALUES($1,$2,$3,NULL,$4,true)",
    [userId,email,`cutover_${suffix}`,legacyClerkId]
  );
  await pool.query(
    "INSERT INTO user_anime(user_id,media_id,status,progress) VALUES($1,$2,'CURRENT',7)",
    [userId,mediaId]
  );
  await pool.query(
    'INSERT INTO clerk_identity_cutovers(user_id,legacy_clerk_user_id) VALUES($1,$2)',
    [userId,legacyClerkId]
  );

  const synced=await syncClerkUser({
    id:productionClerkId,
    fullName:'Usuário Cutover',
    username:null,
    firstName:'Usuário',
    hasImage:false,
    imageUrl:'',
    primaryEmailAddressId:'idn_cutover',
    primaryEmailAddress:{emailAddress:email},
    emailAddresses:[{
      id:'idn_cutover',
      emailAddress:email,
      verification:{status:'verified'},
    }],
  });

  assert.equal(synced.id,userId);
  assert.equal(synced.clerk_user_id,productionClerkId);

  const user=(await pool.query('SELECT id,clerk_user_id FROM users WHERE id=$1',[userId])).rows[0];
  assert.equal(user.id,userId);
  assert.equal(user.clerk_user_id,productionClerkId);

  const anime=(await pool.query('SELECT progress FROM user_anime WHERE user_id=$1 AND media_id=$2',[userId,mediaId])).rows[0];
  assert.equal(anime.progress,7);

  const ledger=(await pool.query('SELECT legacy_clerk_user_id,production_clerk_user_id,rebound_at FROM clerk_identity_cutovers WHERE user_id=$1',[userId])).rows[0];
  assert.equal(ledger.legacy_clerk_user_id,legacyClerkId);
  assert.equal(ledger.production_clerk_user_id,productionClerkId);
  assert.ok(ledger.rebound_at);

  await assert.rejects(
    ()=>syncClerkUser({
      id:`user_OTHER${suffix}`,
      fullName:'Outro',
      primaryEmailAddressId:'idn_cutover_2',
      primaryEmailAddress:{emailAddress:email},
      emailAddresses:[{id:'idn_cutover_2',emailAddress:email,verification:{status:'verified'}}],
    }),
    /linked to another identity/
  );

  await pool.query('DELETE FROM users WHERE id=$1',[userId]);
});

test('verified Production identity repairs a missed Development snapshot once',async()=>{
  await initDb();
  const userId=crypto.randomUUID();
  const suffix=userId.replaceAll('-','').slice(0,12);
  const email=`clerk-no-ledger-${suffix}@example.invalid`;
  const legacyClerkId=`user_DEV${suffix}`;
  const productionClerkId=`user_PROD${suffix}`;

  await pool.query(
    "INSERT INTO users(id,email,username,password_hash,clerk_user_id,email_verified) VALUES($1,$2,$3,NULL,$4,true)",
    [userId,email,`no_ledger_${suffix}`,legacyClerkId]
  );

  const synced=await syncClerkUser({
    id:productionClerkId,
    fullName:'Usuário sem ledger',
    primaryEmailAddressId:'idn_no_ledger',
    primaryEmailAddress:{emailAddress:email},
    emailAddresses:[{id:'idn_no_ledger',emailAddress:email,verification:{status:'verified'}}],
  });

  assert.equal(synced.id,userId);
  assert.equal(synced.clerk_user_id,productionClerkId);
  const ledger=(await pool.query(
    'SELECT legacy_clerk_user_id,production_clerk_user_id,rebound_at FROM clerk_identity_cutovers WHERE user_id=$1',
    [userId]
  )).rows[0];
  assert.equal(ledger.legacy_clerk_user_id,legacyClerkId);
  assert.equal(ledger.production_clerk_user_id,productionClerkId);
  assert.ok(ledger.rebound_at);

  await assert.rejects(
    ()=>syncClerkUser({
      id:`user_OTHER${suffix}`,
      fullName:'Outro',
      primaryEmailAddressId:'idn_no_ledger_2',
      primaryEmailAddress:{emailAddress:email},
      emailAddresses:[{id:'idn_no_ledger_2',emailAddress:email,verification:{status:'verified'}}],
    }),
    /linked to another identity/
  );

  await pool.query('DELETE FROM users WHERE id=$1',[userId]);
});

test.after(async()=>{await pool.end()});
