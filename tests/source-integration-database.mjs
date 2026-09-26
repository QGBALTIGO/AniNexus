import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const url=String(process.env.SOURCE_INTEGRATION_TEST_DATABASE_URL||'');
const parsed=url?new URL(url):null;
if(!parsed||!['127.0.0.1','localhost'].includes(parsed.hostname)||parsed.pathname!=='/aninexus_test')throw new Error('Refusing any database except disposable localhost/aninexus_test');
process.env.DATABASE_URL=url;
const {initDb,pool}=await import('../lib/db.mjs');

test('source account link migration is additive, one-to-one and cascades with AniNexus account',async()=>{
  await initDb();await initDb();
  const table=(await pool.query("SELECT to_regclass('public.source_account_links') AS name")).rows[0]?.name;
  assert.equal(table,'source_account_links');
  const one=crypto.randomUUID(),two=crypto.randomUUID(),subject='src_'+'b'.repeat(64),link=crypto.randomUUID(),secret='v1.'+'x'.repeat(72);
  await pool.query("INSERT INTO users(id,email,username,password_hash) VALUES($1,$2,$3,'test')",[one,`source-${one}@example.invalid`,`source_${one.replaceAll('-','').slice(0,12)}`]);
  await pool.query("INSERT INTO users(id,email,username,password_hash) VALUES($1,$2,$3,'test')",[two,`source-${two}@example.invalid`,`source_${two.replaceAll('-','').slice(0,12)}`]);
  await pool.query('INSERT INTO source_account_links(user_id,source_subject,source_link_id,source_revoke_token,source_profile) VALUES($1,$2,$3,$4,$5::jsonb)',[one,subject,link,secret,JSON.stringify({public:true})]);
  await assert.rejects(()=>pool.query('INSERT INTO source_account_links(user_id,source_subject,source_link_id,source_revoke_token) VALUES($1,$2,$3,$4)',[two,subject,crypto.randomUUID(),secret]),error=>error?.code==='23505');
  await pool.query('DELETE FROM users WHERE id=$1',[one]);
  assert.equal(Number((await pool.query('SELECT count(*) FROM source_account_links WHERE source_subject=$1',[subject])).rows[0].count),0);
  await pool.query('DELETE FROM users WHERE id=$1',[two]);
});

test.after(async()=>{await pool.end()});
