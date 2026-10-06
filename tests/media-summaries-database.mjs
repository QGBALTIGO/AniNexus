import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

const database=new URL(process.env.DATABASE_URL||'postgres://invalid/invalid');
assert.equal(process.env.ANINEXUS_SYNTHETIC_STAGE,'true');
assert.equal(process.env.NODE_ENV,'development');
assert.equal(database.hostname,'postgres');
assert.equal(database.pathname,'/aninexus_stage');
process.env.PERSIST_MEDIA_CACHE='false';
const {pool}=await import('../lib/db.mjs');
const {getMediaSummaries}=await import('../lib/provider.mjs');

test('real synthetic database resolves explicit provider links and typed local cache',async t=>{
  const token=randomUUID(),first=8000000000990001,second=8000000000990002;
  const originalFetch=globalThis.fetch,requests=[];
  globalThis.fetch=async(_url,options)=>{
    const body=JSON.parse(options.body);requests.push(body);
    assert.deepEqual(body.variables.ids,[101]);
    return new Response(JSON.stringify({data:{Page:{media:[{id:101,type:'MANGA',title:{romaji:'Título remoto'},coverImage:{large:'https://example.invalid/fixture.jpg'},format:'MANGA'}]}}}),{headers:{'content-type':'application/json'}});
  };
  try{
    for(const [id,type,title,cover] of [[first,'MANGA','Título local',''],[second,'MANGA','Sem vínculo',''],[first,'ANIME','Anime distinto','https://example.invalid/anime.jpg']]){
      await pool.query('INSERT INTO media_cache(media_type,media_id,slug,payload) VALUES($1,$2,$3,$4)',[type,id,`${type.toLowerCase()}-${id}`,JSON.stringify({id,mediaType:type,title,cover,format:type==='MANGA'?'MANGA':'TV',externalIds:type==='MANGA'?{mangaball:token}:undefined})]);
    }
    await pool.query('INSERT INTO manga_catalog_links(provider,external_id,media_id,anilist_id) VALUES($1,$2,$3,$4)',['synthetic-fixture',token,first,101]);
    await t.test('mapped metadata fills gaps without replacing local identity or title',async()=>{
      const items=await getMediaSummaries([first,second],'MANGA');
      assert.deepEqual(items.map(x=>x.id),[first,second]);
      assert.equal(items[0].title,'Título local');assert.equal(items[0].cover,'https://example.invalid/fixture.jpg');
      assert.deepEqual(items[0].externalIds,{mangaball:token});
      assert.equal(items[0].ratingCount,0);assert.equal(items[0].metricsSource,'aninexus');
      assert.equal(items[1].title,'Sem vínculo');assert.equal(items[1].cover,'');
      assert.equal(requests.length,1);
    });
    await t.test('same internal number in anime is independent and requires no provider call',async()=>{
      const [anime]=await getMediaSummaries([first],'ANIME');
      assert.equal(anime.title,'Anime distinto');assert.equal(anime.mediaType,'ANIME');assert.equal(requests.length,1);
    });
    await t.test('conflicting real links stay unresolved with local metadata intact',async()=>{
      await pool.query('INSERT INTO manga_catalog_links(provider,external_id,media_id,anilist_id) VALUES($1,$2,$3,$4)',['synthetic-conflict',token,first,102]);
      const [manga]=await getMediaSummaries([first],'MANGA');
      assert.equal(manga.title,'Título local');assert.equal(manga.cover,'');assert.equal(requests.length,1);
    });
  }finally{
    globalThis.fetch=originalFetch;
    await pool.query('DELETE FROM manga_catalog_links WHERE external_id=$1 AND provider IN ($2,$3)',[token,'synthetic-fixture','synthetic-conflict']);
    await pool.query('DELETE FROM media_cache WHERE media_id=ANY($1::bigint[])',[ [first,second] ]);
    await pool.end();
  }
});
