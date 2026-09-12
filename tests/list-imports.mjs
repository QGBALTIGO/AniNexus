import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchMalEntries, normalizeMalEntries, mapMalEntries } from '../lib/mal-import.mjs';

const row=(id=1,type='anime')=>({[`${type}_id`]:id,[`${type}_title`]:`Obra ${id}`,status:1,score:8,num_watched_episodes:5,num_read_chapters:12,num_read_volumes:2,[`${type}_image_path`]:'https://cdn.myanimelist.net/images/test.jpg'});
const json=value=>new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}});
const profile=new Response(`<meta property="og:title" content="Tester&#039;s Profile - MyAnimeList.net">`);
test('MAL public import reads every page and keeps anime and manga progress separate',async()=>{
  const calls=[];
  const result=await fetchMalEntries({username:'tester',fetchImpl:async(url,options)=>{calls.push(url);assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');if(url.includes('/profile/'))return profile.clone();if(url.includes('/mangalist/'))return json([row(1,'manga')]);return json(url.includes('offset=0')?Array.from({length:300},(_,i)=>row(i+1)):[row(301)])}});
  assert.equal(result.account.username,'Tester');assert.equal(result.entries.length,302);assert.ok(calls.some(url=>url.includes('offset=300')));
  assert.equal(result.entries[0].progress,5);assert.equal(result.entries.at(-1).progress,12);assert.equal(result.entries.at(-1).volumeProgress,2);
});
test('MAL status normalization handles planning paused dropped and completed',()=>{
  assert.deepEqual([1,2,3,4,6].map(status=>normalizeMalEntries([{...row(),status}],'ANIME')[0].status),['CURRENT','COMPLETED','PAUSED','DROPPED','PLANNING']);
  assert.throws(()=>normalizeMalEntries([{...row(),status:99}],'ANIME'),{code:'MAL_INVALID_RESPONSE'});
});
test('MAL refuses unknown accounts private lists malformed responses and repeated pages',async()=>{
  await assert.rejects(fetchMalEntries({username:'tester',fetchImpl:async()=>new Response('',{status:404})}),{code:'MAL_USER_NOT_FOUND'});
  await assert.rejects(fetchMalEntries({username:'tester',fetchImpl:async url=>url.includes('/profile/')?profile.clone():new Response('',{status:403})}),{code:'MAL_LIST_UNAVAILABLE'});
  await assert.rejects(fetchMalEntries({username:'tester',fetchImpl:async url=>url.includes('/profile/')?profile.clone():json({error:'private'})}),{code:'MAL_LIST_UNAVAILABLE'});
  await assert.rejects(fetchMalEntries({username:'tester',fetchImpl:async url=>url.includes('/profile/')?profile.clone():json(Array.from({length:300},(_,i)=>row(i+1)))}),{code:'MAL_INVALID_RESPONSE'});
});
test('MAL IDs are mapped by exact media type and never stored as AniList IDs',async()=>{
  const entries=[...normalizeMalEntries([row(21),row(99)],'ANIME'),...normalizeMalEntries([row(21,'manga')],'MANGA')];
  const result=await mapMalEntries(entries,async(ids,type)=>[{id:type==='ANIME'?2101:2102,idMal:21,mediaType:type,title:'Mapped',cover:''}]);
  assert.deepEqual(result.entries.map(item=>item.mediaId),[2101,2102]);assert.equal(result.unmatched[0].idMal,99);assert.equal(result.entries[0].media.cover,entries[0].cover);
  await assert.rejects(mapMalEntries(entries,async()=>{throw new Error('upstream timeout')}),/upstream timeout/);
  await assert.rejects(mapMalEntries(entries,async()=>{throw new Error('must not fetch after deadline')},{deadlineAt:0}),{code:'MAL_UNAVAILABLE'});
});
