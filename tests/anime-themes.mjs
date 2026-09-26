import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchAnimeThemes} from '../lib/anime-themes.mjs';

const json = payload => new Response(JSON.stringify(payload),{headers:{'content-type':'application/json'}});
test('themes uses AniList mapping and returns a valid work',async()=>{
  const result=await fetchAnimeThemes(196356,{fetchImpl:async(url,options)=>{
    assert.equal(url.searchParams.get('filter[site]'),'AniList');
    assert.equal(url.searchParams.get('filter[external_id]'),'196356');
    assert.equal(options.redirect,'error');
    return json({anime:[{id:42,animethemes:[]}]});
  }});
  assert.equal(result.id,42);
});
test('valid empty catalogue differs from unavailable provider',async()=>{
  assert.equal(await fetchAnimeThemes(1,{fetchImpl:async()=>json({anime:[]})}),null);
});
for(const [name,fetchImpl] of [
  ['blocked',async()=>new Response('blocked',{status:403})],
  ['invalid HTML',async()=>new Response('<html>')],
  ['invalid shape',async()=>json({error:'no data'})],
  ['network',async()=>{throw new Error('offline')}],
  ['timeout',async(_url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('timeout')),{once:true}))]
])test(`themes handles ${name} without treating it as an empty catalogue`,async()=>{
  await assert.rejects(fetchAnimeThemes(1,{fetchImpl,timeout:20}),{code:'THEMES_UNAVAILABLE',statusCode:503});
});
test('invalid media ID never requests the provider',async()=>{
  await assert.rejects(fetchAnimeThemes(-1,{fetchImpl:()=>assert.fail('unexpected request')}),TypeError);
});
