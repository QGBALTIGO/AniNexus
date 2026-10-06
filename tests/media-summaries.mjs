import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV='test';
process.env.DATABASE_URL='postgres://fixture:fixture@127.0.0.1:1/fixture';
process.env.REDIS_URL='redis://127.0.0.1:1';
process.env.CATALOG_GRAPHQL_ENDPOINT='https://provider.example.test/graphql';
process.env.PERSIST_MEDIA_CACHE='false';

const {getMediaSummaries}=await import('../lib/provider.mjs');
const {pool}=await import('../lib/db.mjs');
const INTERNAL=8000000000000000;
const raw=(id,type='MANGA')=>({id,type,title:{english:`External ${id}`},coverImage:{extraLarge:`https://fixture.example/remote-${id}.jpg`},genres:['Fantasy'],tags:[],format:type==='MANGA'?'MANGA':'TV',studios:{nodes:[]},externalLinks:[]});
const cached=(id,payload,mediaType='MANGA')=>({media_id:String(id),media_type:mediaType,payload:{id,mediaType,...payload}});

function fixture(t,{cache=[],links=[],metrics={},response,upstreamError,cacheError=false,linksError=false}={}){
  const calls={fetch:[],cache:[],links:[],metrics:[],writes:[],unexpected:[]};
  t.mock.method(pool,'query',async(sql,params=[])=>{
    if(sql.includes('SELECT media_id,payload FROM media_cache')){
      calls.cache.push(params);if(cacheError)throw Error('fixture cache unavailable');
      return{rows:cache.filter(row=>params[0].includes(Number(row.media_id))&&row.media_type===params[1])};
    }
    if(sql.includes('FROM manga_catalog_links')){
      calls.links.push(params);if(linksError)throw Error('fixture links unavailable');
      return{rows:links.filter(row=>params[0].includes(Number(row.media_id)))};
    }
    if(sql.startsWith('WITH selected AS')){
      calls.metrics.push(params);
      return{rows:params[0].map(id=>({media_id:String(id),...(metrics[`${params[1]}:${id}`]||{})}))};
    }
    if(sql.startsWith('SELECT media_id,dubbed_pt_br'))return{rows:[]};
    if(sql.startsWith('INSERT INTO media_cache')){calls.writes.push(...JSON.parse(params[0]));return{rows:[]}};
    calls.unexpected.push(sql);throw Error(`Unexpected fixture query: ${sql}`);
  });
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    const body=JSON.parse(options.body);calls.fetch.push({url:String(url),...body});
    assert.equal(String(url),process.env.CATALOG_GRAPHQL_ENDPOINT);
    assert.ok(body.variables.ids.every(id=>Number.isInteger(id)&&id>0&&id<=2147483647),'Only positive GraphQL Int IDs may reach the provider');
    if(upstreamError)throw upstreamError;
    const type=body.query.includes('type:MANGA')?'MANGA':'ANIME';
    const media=typeof response==='function'?response(body):response||body.variables.ids.map(id=>raw(id,type));
    return new Response(JSON.stringify({data:{Page:{media}}}),{headers:{'content-type':'application/json'}});
  });
  t.after(()=>assert.deepEqual(calls.unexpected,[]));
  return calls;
}

test('complete local manga retains identity and metadata without upstream reads',async t=>{
  const calls=fixture(t,{cache:[cached(INTERNAL,{title:'Local title',cover:'https://fixture.example/local.jpg',externalIds:{mangaball:'local:one'}})]});
  const [media]=await getMediaSummaries([INTERNAL],'MANGA');
  assert.equal(media.id,INTERNAL);assert.equal(media.mediaType,'MANGA');assert.equal(media.title,'Local title');
  assert.deepEqual(media.externalIds,{mangaball:'local:one'});assert.equal(calls.fetch.length,0);assert.equal(calls.links.length,0);
});

test('explicit mapping fills missing artwork under the internal identity and local metrics',async t=>{
  const local={title:'Local title',cover:null,banner:'https://fixture.example/local-banner.jpg',description:'Local synopsis',slug:'local-title-'+INTERNAL,externalIds:{mangaball:'local:one'},genres:['Local genre'],characters:[{id:7,name:'Local character'}]};
  const calls=fixture(t,{cache:[cached(INTERNAL,local)],links:[{media_id:String(INTERNAL),anilist_id:'101'}],metrics:{[`MANGA:${INTERNAL}`]:{score:'8.4',rating_count:3,list_count:5,favorite_count:2,impression_count:1}}});
  const [media]=await getMediaSummaries([INTERNAL],'MANGA');
  assert.deepEqual(calls.fetch.map(call=>call.variables.ids),[[101]]);
  assert.equal(media.id,INTERNAL);assert.equal(media.mediaType,'MANGA');assert.equal(media.title,local.title);assert.equal(media.cover,'https://fixture.example/remote-101.jpg');
  for(const key of ['banner','description','slug','externalIds','genres','characters'])assert.deepEqual(media[key],local[key]);
  assert.equal(media.score,8.4);assert.equal(media.ratingCount,3);assert.equal(media.popularity,28);assert.equal(media.metricsSource,'aninexus');
  assert.deepEqual(calls.metrics[0],[ [INTERNAL], 'MANGA' ]);
});

test('unmapped internal and out-of-Int IDs retain partial metadata without GraphQL',async t=>{
  const calls=fixture(t,{cache:[cached(INTERNAL,{title:'Known local title',cover:null})]});
  const result=await getMediaSummaries([INTERNAL,INTERNAL+1,2147483648],'MANGA');
  assert.equal(calls.fetch.length,0);assert.deepEqual(result.map(media=>media.id),[INTERNAL]);assert.equal(result[0].title,'Known local title');assert.equal(result[0].cover,null);
});

test('conflicting or invalid explicit links never fall back to an arbitrary provider ID',async t=>{
  const ids=[INTERNAL,INTERNAL+1,30013];
  const calls=fixture(t,{cache:ids.map(id=>cached(id,{title:'Partial local title',cover:null})),links:[
    {media_id:String(INTERNAL),anilist_id:'101'},{media_id:String(INTERNAL),anilist_id:'102'},
    {media_id:String(INTERNAL+1),anilist_id:'2147483648'},{media_id:'30013',anilist_id:'101'},{media_id:'30013',anilist_id:'102'}
  ]});
  const result=await getMediaSummaries(ids,'MANGA');assert.equal(calls.fetch.length,0);assert.deepEqual(result.map(media=>media.id),ids);
});

test('one provider result fans out to two internal identities and survives a mixed batch',async t=>{
  const ids=[30013,INTERNAL,INTERNAL+1,INTERNAL+2,INTERNAL];
  const calls=fixture(t,{cache:[cached(INTERNAL,{title:'Local A'}),cached(INTERNAL+1,{title:'Local B'}),cached(INTERNAL+2,{title:'Unmapped local'})],links:[{media_id:String(INTERNAL),anilist_id:'101'},{media_id:String(INTERNAL+1),anilist_id:'101'}]});
  const result=await getMediaSummaries(ids,'MANGA');
  assert.deepEqual(calls.fetch.map(call=>call.variables.ids),[[30013,101]]);assert.deepEqual(result.map(media=>media.id),ids.slice(0,4));
  assert.equal(result[1].title,'Local A');assert.equal(result[2].title,'Local B');assert.equal(result[1].cover,result[2].cover);assert.equal(result[3].cover,undefined);
});

test('cache keys and metric reads keep the same numeric ID separate by media type',async t=>{
  const calls=fixture(t,{cache:[cached(101,{title:'Anime local',cover:'https://fixture.example/anime.jpg',id:999},'ANIME'),cached(101,{title:'Manga local',cover:'https://fixture.example/manga.jpg'})]});
  const [anime]=await getMediaSummaries([101],'ANIME'),[manga]=await getMediaSummaries([101],'MANGA');
  assert.equal(anime.id,101);assert.equal(manga.id,101);assert.equal(anime.mediaType,'ANIME');assert.equal(manga.mediaType,'MANGA');assert.equal(anime.title,'Anime local');assert.equal(manga.title,'Manga local');
  assert.deepEqual(calls.metrics.map(call=>call[1]),['ANIME','MANGA']);assert.equal(calls.fetch.length,0);
});

test('wrong, absent or unknown upstream media types and unsolicited IDs are rejected',async t=>{
  const calls=fixture(t,{response:[raw(101,'ANIME'),raw(102,'NOVEL'),{...raw(103),type:undefined},raw(999)]});
  const result=await getMediaSummaries([101,102,103],'MANGA');assert.deepEqual(result,[]);assert.equal(calls.fetch.length,1);
});

test('failed upstream and failed mapping reads preserve local metadata without unsafe fallback',async t=>{
  const calls=fixture(t,{cache:[cached(INTERNAL,{title:'Local A'}),cached(101,{title:'Local direct'})],links:[{media_id:String(INTERNAL),anilist_id:'102'}],upstreamError:Error('fixture upstream unavailable'),linksError:true});
  const result=await getMediaSummaries([INTERNAL,101],'MANGA');
  assert.equal(calls.fetch.length,0);assert.deepEqual(result.map(media=>media.title),['Local A','Local direct']);
});

test('mapping outage cannot use a small local ID as AniList ID or persist incorrect artwork',async t=>{
  const calls=fixture(t,{cache:[cached(30013,{title:'Mapped local title',cover:null,description:'Keep local synopsis'})],links:[{media_id:'30013',anilist_id:'101'}],linksError:true});
  process.env.PERSIST_MEDIA_CACHE='true';
  try{
    const result=await getMediaSummaries([30013],'MANGA');
    await new Promise(resolve=>setTimeout(resolve,650));
    assert.deepEqual(calls.fetch.map(call=>call.variables.ids),[],`A failed lookup must not guess an identity; persisted artwork: ${JSON.stringify(calls.writes.map(row=>row.payload.cover))}`);
    assert.equal(calls.writes.length,0);assert.equal(result[0].id,30013);assert.equal(result[0].title,'Mapped local title');assert.equal(result[0].cover,null);assert.equal(result[0].description,'Keep local synopsis');
  }finally{process.env.PERSIST_MEDIA_CACHE='false'}
});

test('cache outage does not enrich or persist a remote payload without trusted local metadata',async t=>{
  const calls=fixture(t,{cache:[cached(INTERNAL,{title:'Keep local title',description:'Keep local synopsis'})],links:[{media_id:String(INTERNAL),anilist_id:'101'}],cacheError:true});
  process.env.PERSIST_MEDIA_CACHE='true';
  try{
    const result=await getMediaSummaries([INTERNAL],'MANGA');
    await new Promise(resolve=>setTimeout(resolve,650));
    assert.equal(result.length,0,`A failed cache read must not overwrite existing metadata; provider requests: ${JSON.stringify(calls.fetch.map(call=>call.variables.ids))}; persisted titles: ${JSON.stringify(calls.writes.map(row=>row.payload.title))}`);
    assert.equal(calls.fetch.length,0);assert.equal(calls.links.length,0);assert.equal(calls.writes.length,0);
  }finally{process.env.PERSIST_MEDIA_CACHE='false'}
});

test('mapped upstream failure does not erase metadata or expose the provider identity',async t=>{
  const calls=fixture(t,{cache:[cached(INTERNAL,{title:'Local title',cover:null,externalIds:{mangaball:'local:one'}})],links:[{media_id:String(INTERNAL),anilist_id:'101'}],upstreamError:Error('fixture upstream unavailable')});
  const [media]=await getMediaSummaries([INTERNAL],'MANGA');
  assert.deepEqual(calls.fetch.map(call=>call.variables.ids),[[101]]);assert.equal(media.id,INTERNAL);assert.equal(media.title,'Local title');assert.equal(media.cover,null);assert.deepEqual(media.externalIds,{mangaball:'local:one'});assert.equal(calls.writes.length,0);
});

test('an upstream row without a title cannot invent a generic title for an unknown work',async t=>{
  const calls=fixture(t,{response:[{...raw(101,'ANIME'),title:{}}]});
  assert.deepEqual(await getMediaSummaries([101],'ANIME'),[]);assert.equal(calls.fetch.length,1);
});

test('input normalization keeps order and batch limit while only valid GraphQL Int IDs leave',async t=>{
  const calls=fixture(t);
  const result=await getMediaSummaries([2147483647,2147483648,INTERNAL,0,-1,1.5,NaN,Number.MAX_SAFE_INTEGER+1,101,101],'ANIME');
  assert.deepEqual(calls.fetch.map(call=>call.variables.ids),[[2147483647,101]]);assert.deepEqual(result.map(media=>media.id),[2147483647,101]);
  calls.fetch.length=0;const batch=await getMediaSummaries(Array.from({length:70},(_,i)=>i+1),'ANIME');assert.equal(batch.length,60);assert.equal(calls.fetch[0].variables.ids.length,60);
});

test('mapped persistence queues only the merged internal identity, never the provider identity',async t=>{
  const calls=fixture(t,{cache:[cached(INTERNAL,{title:'Local persistent title',externalIds:{mangaball:'local:persist'},description:'Keep this synopsis'})],links:[{media_id:String(INTERNAL),anilist_id:'101'}]});
  process.env.PERSIST_MEDIA_CACHE='true';
  try{
    const [media]=await getMediaSummaries([INTERNAL],'MANGA');assert.equal(media.id,INTERNAL);
    await new Promise(resolve=>setTimeout(resolve,650));
    assert.equal(calls.writes.length,1);const [row]=calls.writes;assert.equal(row.media_id,INTERNAL);assert.equal(row.media_type,'MANGA');assert.equal(row.payload.id,INTERNAL);assert.equal(row.payload.title,'Local persistent title');assert.equal(row.payload.description,'Keep this synopsis');assert.deepEqual(row.payload.externalIds,{mangaball:'local:persist'});
    assert.equal(row.payload.metricsSource,undefined);assert.equal(row.payload.score,undefined);
  }finally{process.env.PERSIST_MEDIA_CACHE='false'}
});

test.after(async()=>{await pool.end()});
