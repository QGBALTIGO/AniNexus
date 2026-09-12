import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAniListImportXml, fetchAniListEntries, normalizedUsernameKey, parseAniListListPage, usernameModerationReason } from '../lib/profile-settings.mjs';

test('username moderation normalizes accents and common substitutions without blocking ordinary handles',()=>{
  assert.equal(normalizedUsernameKey('P0rr4'), 'porra');
  assert.equal(usernameModerationReason('p0rr4'), 'OFFENSIVE_USERNAME');
  assert.equal(usernameModerationReason('computador'), null);
  assert.equal(usernameModerationReason('kayky.sousa'), null);
});

test('AniList list import normalizes progress and carries durable anime and manga metadata',async()=>{
  const animeEntry={mediaId:1,status:'REPEATING',score:8.5,progress:12,progressVolumes:0,updatedAt:1_700_000_000,media:{id:1,idMal:101,type:'ANIME',title:{english:'Anime One',romaji:'Anime Ichi'},coverImage:{extraLarge:'https://img.test/anime.jpg',color:'#123456'},bannerImage:'https://img.test/anime-banner.jpg',episodes:12,format:'TV',status:'FINISHED'}};
  const mangaEntry={mediaId:2,status:'CURRENT',score:0,progress:44,progressVolumes:7,updatedAt:1_700_000_100,media:{id:2,idMal:202,type:'MANGA',title:{romaji:'Manga Two'},coverImage:{large:'https://img.test/manga.jpg'},chapters:80,volumes:8,format:'MANGA',status:'RELEASING'}};
  const payload={data:{anime:{lists:[{entries:[animeEntry]}]},manga:{lists:[{entries:[mangaEntry]}]}}};
  const fetchImpl=async()=>new Response(JSON.stringify(payload),{status:200,headers:{'content-type':'application/json'}});
  const rows=await fetchAniListEntries({username:'reader',types:['ANIME','MANGA'],fetchImpl});
  assert.deepEqual(rows.map(row=>({id:row.mediaId,type:row.mediaType,status:row.status,score:row.score,progress:row.progress,volumes:row.volumeProgress})),[
    {id:1,type:'ANIME',status:'CURRENT',score:8.5,progress:12,volumes:0},
    {id:2,type:'MANGA',status:'CURRENT',score:null,progress:44,volumes:7},
  ]);
  assert.deepEqual(rows.map(row=>({id:row.media.id,title:row.media.title,cover:row.media.cover,format:row.media.format})),[
    {id:1,title:'Anime One',cover:'https://img.test/anime.jpg',format:'TV'},
    {id:2,title:'Manga Two',cover:'https://img.test/manga.jpg',format:'MANGA'},
  ]);
});

test('AniList import falls back to the official public list pages during a GraphQL outage',async()=>{
  const page=(type,entry)=>`<!doctype html><html><head><meta property="og:title" content="reader"></head><body><div class="user"><h1 class="name">reader</h1><div class="lists"><div class="list-wrap"><div class="list-entries">${entry}</div></div></div></div></body></html>`;
  const anime=page('anime','<div class="entry row"><div class="title"><a href="/anime/21/ONE-PIECE/">ONE PIECE</a></div><div class="score" score="5"><svg data-icon="star"></svg></div><div class="progress">1017/1200<span>+</span></div><div class="status">Current</div></div>');
  const manga=page('manga','<div class="entry row"><div class="title"><a href="/manga/30013/ONE-PIECE/">ONE PIECE</a></div><div class="score" score="4"><svg data-icon="star"></svg></div><div class="progress">1071/1200<span>+</span></div><div class="progress progress-volumes">105/120<span>+</span></div><div class="status">Repeating</div></div>');
  const requests=[];
  const fetchImpl=async url=>{requests.push(String(url));if(String(url).includes('graphql'))return new Response(JSON.stringify({errors:[{message:'The AniList API has been temporarily disabled due to severe stability issues.',status:403}]}),{status:403,headers:{'content-type':'application/json'}});return new Response(String(url).endsWith('/mangalist')?manga:anime,{status:200,headers:{'content-type':'text/html; charset=UTF-8'}})};
  const rows=await fetchAniListEntries({username:'reader',types:['ANIME','MANGA'],fetchImpl,timeoutMs:3000});
  assert.equal(rows.source,'PUBLIC_PAGE');
  assert.deepEqual(rows.map(row=>({id:row.mediaId,type:row.mediaType,status:row.status,score:row.score,progress:row.progress,volumes:row.volumeProgress})),[
    {id:21,type:'ANIME',status:'CURRENT',score:10,progress:1017,volumes:0},
    {id:30013,type:'MANGA',status:'CURRENT',score:8,progress:1071,volumes:105},
  ]);
  assert.equal(rows[0].media.title,'ONE PIECE');
  assert.equal(rows[1].media.mediaType,'MANGA');
  assert.equal(requests.length,3);
});

test('AniList public page parser rejects a generic shell and accepts a valid empty public list',()=>{
  assert.equal(parseAniListListPage('<html><title>AniList</title><div id="app"></div></html>','ANIME','reader').valid,false);
  const parsed=parseAniListListPage('<html><meta property="og:title" content="reader"><div class="user"><h1 class="name">reader</h1><div class="lists"></div></div></html>','ANIME','reader');
  assert.equal(parsed.valid,true);assert.deepEqual(parsed.entries,[]);
});

test('AniList public page parser normalizes a 100-point score without rescanning every row',()=>{
  const html='<html><meta property="og:title" content="reader"><div class="user"><h1 class="name">reader</h1><div class="lists"><div class="entry row"><div class="title"><a href="/anime/1/Test/">Test</a></div><div class="score" score="83"></div><div class="progress">2/12</div><div class="status">Watching</div></div></div></div></html>';
  assert.equal(parseAniListListPage(html,'ANIME','reader').entries[0].score,8.3);
});

test('AniList export emits MAL XML accepted by the AniList import screen and reports unmapped titles',()=>{
  const built=buildAniListImportXml({username:'reader',mediaType:'ANIME',entries:[
    {mediaId:1,idMal:101,title:'Anime & One',status:'CURRENT',score:8.6,progress:12},
    {mediaId:2,idMal:null,title:'Sem MAL',status:'PLANNING',score:null,progress:0},
  ]});
  assert.equal(built.exported,1);assert.equal(built.skipped,1);
  assert.match(built.content,/<series_animedb_id>101<\/series_animedb_id>/);
  assert.match(built.content,/<!\[CDATA\[Anime & One\]\]>/);
  assert.match(built.content,/<my_status>Watching<\/my_status>/);
  assert.doesNotMatch(built.content,/Sem MAL/);
});
