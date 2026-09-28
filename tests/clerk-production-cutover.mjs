import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clerkFrontendApiOrigin, clerkInstanceKind } from '../lib/clerk-config.mjs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const publishableKey = (kind, host) => `pk_${kind}_${Buffer.from(`${host}$`).toString('base64')}`;

test('Clerk environment kind is derived only from the secret-key prefix', () => {
  assert.equal(clerkInstanceKind('sk_test_example'), 'development');
  assert.equal(clerkInstanceKind('sk_live_example'), 'production');
  assert.equal(clerkInstanceKind(''), 'unknown');
  assert.equal(clerkInstanceKind('pk_live_not-a-secret'), 'unknown');
});

test('Clerk Frontend API origin is decoded from test and live publishable keys', () => {
  assert.equal(clerkFrontendApiOrigin(publishableKey('test', 'sample.clerk.accounts.dev')), 'https://sample.clerk.accounts.dev');
  assert.equal(clerkFrontendApiOrigin(publishableKey('live', 'clerk.aninexus.com.br')), 'https://clerk.aninexus.com.br');
  assert.equal(clerkFrontendApiOrigin('pk_live_invalid'), '');
});

test('identity cutover is one-time, verified and production-only in the auth implementation', () => {
  const auth = read('lib/auth.mjs');
  const migration = read('sql/038_clerk_production_identity_cutover.sql');
  assert.match(auth, /CLERK_INSTANCE_KIND === 'production' && emailState\.verified/);
  assert.match(auth, /c\.user_id IS NULL AND \$7::boolean/);
  assert.match(auth, /c\.production_clerk_user_id IS NULL/);
  assert.match(auth, /c\.legacy_clerk_user_id=u\.clerk_user_id/);
  assert.match(auth, /INSERT INTO clerk_identity_cutovers/);
  assert.match(auth, /production_clerk_user_id=EXCLUDED\.production_clerk_user_id/);
  assert.match(migration, /user_id uuid PRIMARY KEY REFERENCES users\(id\) ON DELETE CASCADE/);
  assert.match(migration, /production_clerk_user_id text/);
});

test('production build injects the live Clerk FAPI origin into CSP', () => {
  const builder = read('scripts/build-public.mjs');
  const server = read('server.mjs');
  assert.match(builder, /clerkFrontendApiOrigin\(clerkPublishableKey\)/);
  assert.match(builder, /script-src 'self'/);
  assert.match(builder, /connect-src 'self'/);
  assert.match(server, /CLERK_FRONTEND_API_ORIGIN/);
});
