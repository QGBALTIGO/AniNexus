import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAniListImportXml, fetchAniListEntries, normalizedUsernameKey, usernameModerationReason } from '../lib/profile-settings.mjs';

test('username moderation normalizes accents and common substitutions without blocking ordinary handles',()=>{
  assert.equal(normalizedUsernameKey('P0rr4'), 'porra');
  assert.equal(usernameModerationReason('p0rr4'), 'OFFENSIVE_USERNAME');
  assert.equal(usernameModerationReason('computador'), null);
  assert.equal(usernameModerationReason('kayky.sousa'), null);
});

test('AniList list import normalizes anime manga scores progress and repeating status',async()=>{
  const payload={data:{anime:{lists:[{entries:[{mediaId:1,status:'REPEATING',score:8.5,progress:12,progressVolumes:0,updatedAt:1_700_000_000,media:{id:1,idMal:101,type:'ANIME',title:{english:'Anime One'}}}]}]},manga:{lists:[{entries:[{mediaId:2,status:'CURRENT',score:0,progress:44,progressVolumes:7,updatedAt:1_700_000_100,media:{id:2,idMal:202,type:'MANGA',title:{romaji:'Manga Two'}}}]}]}}};
  const fetchImpl=async()=>new Response(JSON.stringify(payload),{status:200,headers:{'content-type':'application/json'}});
  const rows=await fetchAniListEntries({username:'reader',types:['ANIME','MANGA'],fetchImpl});
  assert.deepEqual(rows.map(row=>({id:row.mediaId,type:row.mediaType,status:row.status,score:row.score,progress:row.progress,volumes:row.volumeProgress})),[
    {id:1,type:'ANIME',status:'CURRENT',score:8.5,progress:12,volumes:0},
    {id:2,type:'MANGA',status:'CURRENT',score:null,progress:44,volumes:7},
  ]);
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
