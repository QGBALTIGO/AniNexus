import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import Fastify from 'fastify';
import staticPlugin from '@fastify/static';
import vm from 'node:vm';
import {Readable} from 'node:stream';
import {createPublicDocumentRenderer,createPublicShellReader,publicDocumentRoute} from '../lib/public-document.mjs';

const shell=await fs.readFile(new URL('../index.html',import.meta.url),'utf8');
const serverSource=await fs.readFile(new URL('../server.mjs',import.meta.url),'utf8');
function fixture(options={}){
  const {query:customQuery,...settings}=options;
  const calls=[];let clock=0;
  const render=createPublicDocumentRenderer({readShell:async()=>shell,now:()=>clock,
    query:async(sql,params)=>{calls.push({sql,params});
      if(customQuery)return customQuery(sql,params);
      if(sql.includes('media_cache'))return {rows:[{payload:{title:`${params[0]} fixture ${params[1]}`,description:'Uma sinopse <b>verificada</b>.',cover:'https://fixture.invalid/cover.jpg'}}]};
      if(sql.includes('news_articles'))return {rows:[{title:'Notícia verificada',summary:'Resumo de uma notícia publicada.',source_author:'Autora da fonte',published_at:'2026-10-01T12:00:00Z',updated_at:'2026-10-02T12:00:00Z',image_url:'https://fixture.invalid/news.jpg'}]};
      if(sql.includes('users'))return {rows:[{username:'fixture_member',display_name:'Membro público'}]};
      throw new Error('Unexpected metadata source');},...settings});
  return {render,calls,advance:ms=>{clock+=ms}};
}
const attr=(html,key)=>html.match(new RegExp(`<meta (?:name|property)="${key}" content="([^"]*)"`))?.[1];
for(const type of ['anime','manga'])test(`initial ${type} HTML contains typed title, description, canonical and social metadata`,async()=>{
  const f=fixture(),result=await f.render(`/${type}/obra-101?utm_source=fixture`),html=result.html;
  assert.equal(result.status,200);assert.match(html,new RegExp(`<title>${type.toUpperCase()} fixture 101 \\| AniNexus</title>`));
  assert.equal(attr(html,'description'),'Uma sinopse verificada.');assert.equal(attr(html,'og:title'),`${type.toUpperCase()} fixture 101 | AniNexus`);
  assert.equal(attr(html,'og:url'),`https://aninexus.com.br/${type}/obra-101`);assert.equal(attr(html,'twitter:image'),'https://fixture.invalid/cover.jpg');
  assert.deepEqual(f.calls[0].params,[type.toUpperCase(),101]);assert.equal((html.match(/<title>/g)||[]).length,1);
  assert.equal((html.match(/name="description"/g)||[]).length,1);assert.match(html,/preview-v22\/detail-v22\.js/,'current public runtime is retained');
});
test('article HTML has public NewsArticle facts and never increments a view',async()=>{
  const f=fixture(),result=await f.render('/noticias/fixture-news');assert.equal(result.status,200);
  const raw=result.html.match(/id="aninexus-route-structured-data">([\s\S]*?)<\/script>/)[1],data=JSON.parse(raw);
  assert.equal(data['@type'],'NewsArticle');assert.equal(data.headline,'Notícia verificada');assert.equal(data.author.name,'Autora da fonte');
  assert.equal(data.datePublished,'2026-10-01T12:00:00.000Z');assert.equal(attr(result.html,'og:type'),'article');
  assert.match(f.calls[0].sql,/status='published'.*translation_status='ready'.*language='pt-BR'/s);assert.doesNotMatch(f.calls[0].sql,/\b(?:UPDATE|INSERT)\b|view_count/i);
});
for(const route of ['/admin','/minha-conta','/minha-biblioteca','/meus-mangas','/login','/entrar'])test(`${route} has noindex and no identity-dependent metadata query`,async()=>{
  const f=fixture(),result=await f.render(route);assert.equal(result.status,200);assert.equal(result.private,true);assert.equal(attr(result.html,'robots'),'noindex,nofollow');assert.equal(f.calls.length,0);
});
test('missing article/profile and unknown paths use honest 404 metadata',async()=>{
  const f=fixture({query:async()=>({rows:[]})});
  for(const route of ['/noticias/absent','/u/absent_user','/unknown-fixture']){const result=await f.render(route);assert.equal(result.status,404);assert.equal(attr(result.html,'robots'),'noindex,nofollow')}
});
test('public profile query only selects public active identity fields',async()=>{
  const f=fixture(),result=await f.render('/u/fixture_member');assert.match(result.html,/<title>Perfil de Membro público \| AniNexus<\/title>/);
  assert.match(f.calls[0].sql,/privacy='public'.*status='active'.*deleted_at IS NULL/s);assert.match(f.calls[0].sql,/SELECT username,display_name/);assert.doesNotMatch(f.calls[0].sql,/email|password|role|cookie|token/i);
});
test('missing media cache does not invent a verified title or invoke a provider',async()=>{
  const f=fixture({query:async()=>({rows:[]})}),result=await f.render('/manga/not-a-verified-title-101');
  assert.equal(result.status,200);assert.equal(result.fallback,true);assert.match(result.html,/<title>Mangá \| AniNexus<\/title>/);assert.equal(attr(result.html,'robots'),'noindex,follow');assert.equal(f.calls.length,1);
});
test('dynamic attributes and JSON-LD cannot terminate tags or load credentialed/unsafe images',async()=>{
  const f=fixture({query:async()=>({rows:[{title:'Title " /><script src="evil"> & teste',summary:'<script>bad</script> resumo',image_url:'javascript:alert(1)',source_author:'</script><script src="evil">',published_at:'invalid'}]})});
  const result=await f.render('/noticias/escaping');assert.doesNotMatch(result.html,/<script src="evil">/);assert.equal(attr(result.html,'og:image'),'https://aninexus.com.br/assets/logo.png');
  const raw=result.html.match(/id="aninexus-route-structured-data">([\s\S]*?)<\/script>/)[1];assert.doesNotMatch(raw,/<\/script>/);assert.equal(JSON.parse(raw).datePublished,undefined);
});
test('metadata lookup has a deadline, deduplicates in flight and temporarily caches failure',async()=>{
  let queries=0;const f=fixture({timeoutMs:15,query:()=>{queries++;return new Promise(()=>{})}});
  const start=performance.now(),results=await Promise.all([f.render('/anime/outage-101'),f.render('/anime/outage-101'),f.render('/anime/outage-101')]);
  assert.ok(performance.now()-start<1000);assert.equal(queries,1);assert.ok(results.every(x=>x.fallback));
  await f.render('/anime/outage-101');assert.equal(queries,1);f.advance(10_001);await f.render('/anime/outage-101');assert.equal(queries,2);
});
test('public metadata cache is bounded and expires independently of frontend shell',async()=>{
  const f=fixture({cacheSize:2});for(const id of [101,102,103])await f.render(`/anime/fixture-${id}`);
  await f.render('/anime/fixture-101');assert.equal(f.calls.length,4);f.advance(120_001);await f.render('/anime/fixture-101');assert.equal(f.calls.length,5);
});
test('aliases, Pages parameters and season paths keep valid metadata without query identity',async()=>{
  const f=fixture();for(const [raw,route] of [['/catalogo?q=fixture','/animes/catalogo'],['/?p=%2Fmanga%2Ffixture-101&token=excluded','/manga/fixture-101'],['/AniNexus/?p=%2Fnoticias','/noticias'],['/descubra','/animes-em-alta']]){
    const result=await f.render(raw);assert.equal(result.status,200);assert.equal(attr(result.html,'og:url'),`https://aninexus.com.br${route}`);assert.doesNotMatch(attr(result.html,'og:url'),/token|\?/);
  }
  assert.equal((await f.render('/animes/temporadas/2026/outono')).status,200);
  for(const malformed of ['/?p=https%3A%2F%2Fevil.invalid','/%00bad','/%ZZ','//evil.invalid/path'])assert.equal(publicDocumentRoute(malformed),null);
});
test('shell reader detects a new shell, retains release assets and rejects oversized content',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'aninexus-document-')),file=path.join(dir,'index.html');
  try{
    await fs.writeFile(file,'<head><script src="/release-a.js"></script></head>');const read=createPublicShellReader({file});assert.match(await read(),/release-a/);
    await fs.writeFile(file,'<head><script src="/release-b-longer.js"></script></head>');assert.match(await read(),/release-b-longer/);
    await assert.rejects(createPublicShellReader({file,maxBytes:5})(),/Invalid public shell/);
  }finally{await fs.unlink(file);await fs.rmdir(dir)}
});

test('actual public document handler wins over static index, serves HEAD and keeps private HTML uncached',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'aninexus-static-document-')),app=Fastify();
  const f=fixture();
  const start=serverSource.indexOf('async function servePublicDocument('),end=serverSource.indexOf("\napp.get('/*'",start);
  const serve=vm.runInNewContext('('+serverSource.slice(start,end).trim()+')',{publicDocument:f.render,publicDocumentRoute,Buffer,Readable});
  try{
    await fs.writeFile(path.join(dir,'index.html'),'<head><title>Generic static title</title></head>');
    app.addHook('onRequest',async(req,reply)=>{if(['GET','HEAD'].includes(req.method)&&new URL(req.url,'https://aninexus.com.br').pathname==='/')return serve(req,reply)});
    await app.register(staticPlugin,{root:dir,wildcard:false});
    app.get('/*',async(req,reply)=>/^\/(?:api(?:\/|$)|health)/.test(req.url)?reply.code(404).send({error:'NOT_FOUND'}):serve(req,reply));
    for(const url of ['/', '/?p=%2Fanime%2Ffixture-101','/manga/fixture-101','/admin']){
      const result=await app.inject({url});assert.equal(result.statusCode,200);assert.doesNotMatch(result.body,/Generic static title/);
      if(url==='/admin')assert.equal(result.headers['cache-control'],'private, no-store');
      if(url.includes('fixture'))assert.match(result.body,/(?:ANIME|MANGA) fixture 101/);
    }
    for(const url of ['/?p=%2Fanime%2Ffixture-101','/anime/fixture-101']){
      const get=await app.inject({url}),head=await app.inject({method:'HEAD',url});
      assert.equal(head.statusCode,200);assert.equal(head.body,'');assert.match(head.headers['content-type'],/text\/html/);
      assert.equal(Number(head.headers['content-length']),Buffer.byteLength(get.body),'HEAD describes the corresponding GET representation');
    }
    assert.equal((await app.inject({url:'/api/not-a-route'})).statusCode,404);
    assert.equal((await app.inject({url:'/unknown-document'})).statusCode,404);
  }finally{await app.close();await fs.unlink(path.join(dir,'index.html'));await fs.rmdir(dir)}
});
