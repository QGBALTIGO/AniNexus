import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../preview-v40/activity-v40.js',import.meta.url),'utf8');
function activity(){
  const storage=new Map(),window={},listeners=new Map();
  runInNewContext(source,{window,localStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)},document:{readyState:'loading',querySelector:()=>null,addEventListener:(name,fn)=>listeners.set(name,fn)},addEventListener:()=>{},dispatchEvent:()=>{},CustomEvent:class{},fetch:async()=>({ok:false})});
  const api=window.AniNexusCommunityActivity;
  return{api,listeners,plain:rows=>JSON.parse(JSON.stringify(rows))};
}
const entry={kind:'state',media_id:101,username:'alice',status:'CURRENT',created_at:'2026-09-05T12:00:00Z'};

test('community merges current snapshots by member and typed work, never by transport id',()=>{
  const {api,plain}=activity();
  const rows=plain(api.merge([{...entry,id:'remote',title:'Anime',cover:'cover.jpg'},{...entry,id:'local',status:'PAUSED',created_at:'2026-09-05T12:05:00Z'},{...entry,username:'bob'},{...entry,media_type:'MANGA'}]));
  assert.equal(rows.length,3);
  assert.equal(rows[0].status,'PAUSED');assert.equal(rows[0].title,'Anime');assert.equal(rows[0].cover,'cover.jpg');
  assert.equal(rows.filter(x=>x.media_type==='MANGA').length,1);
  assert.equal(rows.filter(x=>x.username==='bob').length,1);
});

test('community keeps distinct impressions and discussions while collapsing their identical copies',()=>{
  const {api}=activity();
  const first={...entry,kind:'impression',id:'one',body:'Primeira impressão'},second={...first,id:'two',body:'Outra impressão'};
  assert.equal(api.merge([first,first,second,{...first,kind:'thread'}]).length,3);
});

test('local reading snapshots preserve volumes and all reactions without colliding with anime',()=>{
  const {api,plain}=activity(),state={status:'CURRENT',progress:4,volumeProgress:2,reactions:['Amei','Que arte!']};
  api.record(101,state,Date.now(),false,'MANGA');api.record(101,state,Date.now());
  const rows=plain(api.local());assert.equal(rows.length,2);
  assert.deepEqual(rows.find(x=>x.media_type==='MANGA').reactions,['Amei','Que arte!']);
  assert.equal(rows.find(x=>x.media_type==='MANGA').volume_progress,2);
});

test('identical local saves coalesce but a changed secondary reaction remains an update',()=>{
  const {api}=activity(),now=Date.now(),state={status:'CURRENT',progress:4,reactions:['Amei','Que arte!']};
  api.record(101,state,now);api.record(101,state,now+100);
  assert.equal(api.local().length,1);
  api.record(101,{...state,reactions:['Amei','Chorei']},now+200);
  assert.equal(api.local().length,2);
});
