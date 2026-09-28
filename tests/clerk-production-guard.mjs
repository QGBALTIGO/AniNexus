import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

function runWith(keys){
  const env={
    ...process.env,
    NODE_ENV:'production',
    AUTH_PROVIDER:'clerk',
    CLERK_REQUIRE_PRODUCTION_KEYS:'true',
    CLERK_AUTHORIZED_PARTIES:'https://aninexus.example.invalid',
    PUBLIC_ORIGIN:'https://aninexus.example.invalid',
    REDIS_PASSWORD:'synthetic-redis-password-for-guard-tests-123456',
    IP_HASH_SALT:'synthetic-ip-hash-salt-for-guard-tests-123456',
    ...keys,
  };
  return spawnSync(process.execPath,['--input-type=module','--eval',"await import('./lib/auth.mjs')"],{
    cwd:process.cwd(),
    env,
    encoding:'utf8',
  });
}

test('production enforcement rejects Clerk Development keys',()=>{
  const result=runWith({
    CLERK_SECRET_KEY:'sk_test_'+'s'.repeat(40),
    CLERK_PUBLISHABLE_KEY:'pk_test_'+'p'.repeat(40),
  });
  assert.notEqual(result.status,0);
  assert.match(result.stderr+result.stdout,/requires Clerk pk_live_ and sk_live_ keys/);
});

test('production enforcement accepts Clerk Production key prefixes',()=>{
  const result=runWith({
    CLERK_SECRET_KEY:'sk_live_'+'s'.repeat(40),
    CLERK_PUBLISHABLE_KEY:'pk_live_'+'p'.repeat(40),
  });
  assert.equal(result.status,0,result.stderr+result.stdout);
});
