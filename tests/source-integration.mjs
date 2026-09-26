import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SOURCE_API_ORIGIN='https://source.test';
process.env.SOURCE_LINK_ENCRYPTION_KEY='synthetic-source-link-key-that-is-never-production';
const mod=await import('../lib/source-integration.mjs');

const reward={coins:50,dados:1,claimed:true,available:false,claimedAt:new Date().toISOString(),coinsGranted:50,dadosGranted:1};
const profile={displayName:'Source Fixture',username:'fixture',favorite:{id:1,name:'Mihawk',work:'One Piece',image:'https://img.test/mihawk.webp'},stats:{level:4,xp:1321,xpCurrent:321,xpNeeded:1000,coins:92,uniqueCharacters:12,totalCharacters:19,totalAvailableCharacters:500,collectionPercent:2.4},public:true,integration:{linked:true,badge:'Source AniNexus',reward},updatedAt:new Date().toISOString()};
const originalFetch=globalThis.fetch;
test.after(()=>{globalThis.fetch=originalFetch});

function response(status,body){return{ok:status>=200&&status<300,status,json:async()=>body}}

test('revocation capability is encrypted at rest and round-trips',()=>{
  const plain='revoke-token-synthetic-1234567890';
  const sealed=mod.sealSourceRevokeToken(plain);
  assert.match(sealed,/^v1\./);
  assert.equal(sealed.includes(plain),false);
  assert.equal(mod.openSourceRevokeToken(sealed),plain);
  assert.throws(()=>mod.openSourceRevokeToken(sealed+'corrupt'));
});

test('consume sends only the one-time token and validates the Source contract',async()=>{
  let seen;
  globalThis.fetch=async(url,options)=>{seen={url,options};return response(200,{linkId:'7cf86bb2-4be4-4a10-9690-a40ac64c25dd',sourceSubject:'src_'+'a'.repeat(64),revokeToken:'r'.repeat(40),reward,profile})};
  const result=await mod.consumeSourceLink('t'.repeat(40));
  assert.equal(result.profile.stats.uniqueCharacters,12);
  assert.equal(result.reward.coinsGranted,50);
  assert.equal(result.profile.integration.badge,'Source AniNexus');
  assert.equal(result.profile.integration.reward.claimed,true);
  assert.equal(seen.url,'https://source.test/api/integrations/aninexus/consume');
  assert.equal(seen.options.method,'POST');
  assert.equal(seen.options.redirect,'error');
  assert.deepEqual(JSON.parse(seen.options.body),{token:'t'.repeat(40)});
});

test('invalid upstream profile is rejected instead of entering the AniNexus database',async()=>{
  globalThis.fetch=async()=>response(200,{linkId:'7cf86bb2-4be4-4a10-9690-a40ac64c25dd',sourceSubject:'src_'+'a'.repeat(64),revokeToken:'r'.repeat(40),profile:{displayName:'broken'}});
  await assert.rejects(()=>mod.consumeSourceLink('t'.repeat(40)),error=>error.code==='SOURCE_INVALID_RESPONSE');
});

test('upstream 404 remains distinguishable so stale links can be removed',async()=>{
  globalThis.fetch=async()=>response(404,{detail:'Vínculo Source não encontrado.'});
  await assert.rejects(()=>mod.fetchSourceProfile('7cf86bb2-4be4-4a10-9690-a40ac64c25dd'),error=>error.status===404);
});

test('revoke is server-to-server and sends the capability only in the request body',async()=>{
  let seen;
  globalThis.fetch=async(url,options)=>{seen={url,options};return response(200,{ok:true})};
  await mod.revokeSourceLink('7cf86bb2-4be4-4a10-9690-a40ac64c25dd','r'.repeat(40));
  assert.equal(seen.url,'https://source.test/api/integrations/aninexus/revoke');
  assert.deepEqual(JSON.parse(seen.options.body),{linkId:'7cf86bb2-4be4-4a10-9690-a40ac64c25dd',revokeToken:'r'.repeat(40)});
});

test('public profile parser strips unexpected upstream fields',()=>{
  const sanitized=mod.publicSourceProfile({...profile,telegramUserId:123,secret:'x'});
  assert.ok(sanitized);
  assert.equal('telegramUserId' in sanitized,false);
  assert.equal('secret' in sanitized,false);
});
