import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const auth=readFileSync(new URL('../preview-v38/auth-v38.js',import.meta.url),'utf8');

test('Clerk global configuration points sign-in and sign-up back to AniNexus',()=>{
  assert.match(auth,/const absoluteRouteUrl = path => new URL\(routeUrl\(path\), location\.origin\)\.href/);
  assert.match(auth,/const signInUrl = absoluteRouteUrl\('\/login'\)/);
  assert.match(auth,/const signUpUrl = absoluteRouteUrl\('\/criar-conta'\)/);
  assert.match(auth,/signInUrl,\s*\n\s*signUpUrl,/);
  assert.match(auth,/signInForceRedirectUrl: accountUrl/);
  assert.match(auth,/signUpForceRedirectUrl: accountUrl/);
});

test('mounted Clerk components stay embedded and use popup OAuth',()=>{
  assert.match(auth,/routing: 'virtual'/);
  assert.match(auth,/oauthFlow: 'popup'/);
  assert.match(auth,/signUpUrl: absoluteRouteUrl\('\/criar-conta'\)/);
  assert.match(auth,/signInUrl: absoluteRouteUrl\('\/login'\)/);
  assert.match(auth,/forceRedirectUrl: accountUrl/);
});

test('generic Clerk failure is localized inside AniNexus',()=>{
  assert.match(auth,/unable to complete action at this time/);
  assert.match(auth,/Não foi possível concluir esta ação agora/);
});
