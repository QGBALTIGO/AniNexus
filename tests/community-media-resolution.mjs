import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const internal=8000000000000001;
const read=name=>readFileSync(new URL(`../preview-v40/${name}-v40.js`,import.meta.url),'utf8');
const plain=value=>JSON.parse(JSON.stringify(value));
function runtime({host='aninexus.com.br',auth=false,items=[],failure=false}={}){
  const requests=[],listeners=new Map(),storage=new Map(),window={};
  const fetch=async(url,options={})=>{
    requests.push({url,options});
    if(failure)throw new Error('fixture unavailable');
    return{ok:true,json:async()=>String(url).includes('graphql')?{data:{Page:{media:items}}}:{items}};
  };
  if(auth)window.AniNexusAuth={enabled:true,publicApi:async url=>{requests.push({url,authenticated:true});if(failure)throw new Error('fixture unavailable');return{items}}};
  const context={window,location:{hostname:host,href:`https://${host}/comunidade`,pathname:'/comunidade'},URL,AbortSignal,scrollY:0,requestAnimationFrame:()=>1,localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},document:{readyState:'loading',querySelector:()=>null,documentElement:{},addEventListener:(name,fn)=>listeners.set(name,fn)},addEventListener:()=>{},dispatchEvent:()=>{},CustomEvent:class{},MutationObserver:class{observe(){}},setTimeout:()=>1,clearTimeout:()=>{},fetch,console};
  runInNewContext(read('activity'),context);
  return{context,window,requests,api:window.AniNexusCommunityActivity};
}

test('authenticated community metadata uses typed summaries and preserves internal identities',async()=>{
  const item={id:internal,mediaType:'MANGA',title:'Título local',cover:''};
  const {api,requests}=runtime({auth:true,items:[item]});
  assert.deepEqual(plain(await api.mediaSummaries([internal,internal,-1,1.5,Number.MAX_SAFE_INTEGER+1],'MANGA')),[item]);
  assert.equal(requests.length,1);
  const url=new URL(requests[0].url,'https://aninexus.com.br');
  assert.equal(url.pathname,'/api/media/summaries');
  assert.equal(url.searchParams.get('ids'),String(internal));
  assert.equal(url.searchParams.get('mediaType'),'MANGA');
});

test('same-origin metadata handles internal ids without an authenticated account',async()=>{
  const {api,requests}=runtime({items:[{id:internal,mediaType:'MANGA',title:'Importado'}]});
  assert.equal((await api.mediaSummaries([internal],'MANGA'))[0].id,internal);
  assert.equal(requests.length,1);assert.match(requests[0].url,/^\/api\/media\/summaries\?/);
  assert.equal(requests[0].options.credentials,'same-origin');
});

test('Pages fallback never sends internal or overflowing IDs to GraphQL',async()=>{
  const {api,requests}=runtime({host:'qgbaltigo.github.io',items:[{id:101,type:'MANGA',title:{romaji:'Mangá'}}]});
  assert.equal((await api.mediaSummaries([internal,2147483648,101,2147483647,NaN,-1,1.5],'MANGA')).length,1);
  assert.equal(requests.length,1);
  const body=JSON.parse(requests[0].options.body);
  assert.deepEqual(body.variables.ids,[101,2147483647]);
  assert.match(body.query,/type:MANGA/);
  requests.length=0;
  assert.deepEqual(plain(await api.mediaSummaries([internal,2147483648],'MANGA')),[]);
  assert.equal(requests.length,0);
});

test('summaries discard unrequested identities and mismatched media types',async()=>{
  const {api}=runtime({auth:true,items:[{id:internal,mediaType:'ANIME'},{id:102,mediaType:'MANGA'},{id:101,mediaType:'MANGA',title:'Correto'}]});
  assert.deepEqual(plain(await api.mediaSummaries([internal,101],'MANGA')),[{id:101,mediaType:'MANGA',title:'Correto'}]);
});

test('API failures do not retry internal IDs on a provider',async()=>{
  const {api,requests}=runtime({auth:true,failure:true});
  assert.deepEqual(plain(await api.mediaSummaries([internal,101],'MANGA')),[]);
  assert.equal(requests.length,1);assert.match(requests[0].url,/^\/api\/media\/summaries/);
});

test('actions without DOM metadata enrich through summaries, including normalized string titles',async()=>{
  const {api,requests}=runtime({auth:true,items:[{id:internal,mediaType:'MANGA',title:'Título importado',cover:'https://example.invalid/cover.jpg'}]});
  api.record(internal,{status:'CURRENT',progress:3},Date.now(),false,'MANGA');
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(requests.length,1);assert.match(requests[0].url,/^\/api\/media\/summaries/);
  assert.equal(api.local()[0].title,'Título importado');
  assert.equal(api.local()[0].media_id,internal);
});

test('Home uses shared summaries and retains a known title with a missing cover',async()=>{
  const {context,window,requests}=runtime({auth:true});
  const activity={id:'fixture',kind:'state',media_id:internal,media_type:'MANGA',username:'synthetic',title:'Título local',cover:'',status:'CURRENT',created_at:new Date().toISOString()};
  window.AniNexusAuth.publicApi=async url=>{requests.push({url});return{items:url.startsWith('/api/community/activity')?[activity]:[]}};
  const source=read('home-community').replace(/\}\)\(\);\s*$/,'window.__homeFixtureLoad=load;\n})();');
  runInNewContext(source,context);
  const rows=plain(await window.__homeFixtureLoad());
  assert.equal(rows.length,1);assert.equal(rows[0].title,'Título local');assert.equal(rows[0].cover,'');
  assert.equal(rows[0].media_id,internal);
  assert.equal(requests.filter(x=>x.url.includes('graphql')).length,0);
  assert.equal(requests.filter(x=>x.url.startsWith('/api/media/summaries')).length,1);
});

test('Community uses the same typed resolver for anime and manga',async()=>{
  const {context,window,requests}=runtime({auth:true,items:[{id:internal,mediaType:'MANGA',title:'Importado'}]});
  context.document.querySelector=selector=>selector==='#app'?{}:null;
  const source=read('community').replace(/\}\)\(\);\s*$/,'window.__communityFixtureMetadata=mediaByIds;\n})();');
  runInNewContext(source,context);
  const manga=await window.__communityFixtureMetadata([internal],'MANGA');
  assert.equal(manga.get(internal).title,'Importado');
  assert.equal(requests.length,1);assert.match(requests[0].url,/mediaType=MANGA/);
});

test('Home retries partial metadata after recovery but reuses a complete cover',async()=>{
  const {context,window}=runtime({auth:true});
  const activity={kind:'state',media_id:internal,media_type:'MANGA',username:'synthetic',title:'Título local',cover:'',status:'CURRENT'};
  let summaries=0;
  window.AniNexusAuth.publicApi=async url=>{
    if(url.startsWith('/api/community/activity'))return{items:[activity]};
    if(url.startsWith('/api/media/summaries'))return{items:[{id:internal,mediaType:'MANGA',title:'Título local',cover:++summaries===1?'':'https://example.invalid/recovered.jpg'}]};
    return{items:[]};
  };
  runInNewContext(read('home-community').replace(/\}\)\(\);\s*$/,'window.__homeFixtureLoad=load;\n})();'),context);
  assert.equal((await window.__homeFixtureLoad())[0].cover,'');
  assert.equal((await window.__homeFixtureLoad())[0].cover,'https://example.invalid/recovered.jpg');
  assert.equal((await window.__homeFixtureLoad())[0].cover,'https://example.invalid/recovered.jpg');
  assert.equal(summaries,2);
});
