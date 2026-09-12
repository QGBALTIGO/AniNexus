import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { hydrateCharacterFavorites, rankCharacterCatalog, setCharacterFavorite } from '../lib/character-ranking.mjs';
import { pool } from '../lib/db.mjs';

test('detail characters can be favorited then removed repeatedly without metadata',async t=>{
  const saved=new Set();
  t.mock.method(pool,'query',async(sql,params)=>{
    if(sql.startsWith('INSERT INTO character_favorites'))saved.add(`${params[0]}:${params[1]}`);
    else if(sql.startsWith('DELETE FROM character_favorites'))saved.delete(`${params[0]}:${params[1]}`);
    else if(sql.startsWith('SELECT count(*)'))return{rows:[{favorite_count:[...saved].filter(key=>key.endsWith(`:${params[0]}`)).length}]};
    else throw new Error(`Unexpected query: ${sql}`);
    return{rows:[]};
  });
  for(const mediaType of ['ANIME','MANGA']){
    const id=mediaType==='ANIME'?999991:999992;
    const metadata={name:'Personagem fora do ranking inicial',mediaId:101,mediaType};
    assert.equal((await setCharacterFavorite('member',id,true,metadata)).favorite,true);
    await setCharacterFavorite('other',id,true,metadata);
    assert.deepEqual(await setCharacterFavorite('member',id,false),{characterId:id,favorite:false,favoriteCount:1});
    assert.equal((await setCharacterFavorite('member',id,false)).favoriteCount,1);
    assert.equal(saved.has(`other:${id}`),true);
  }
  assert.equal(await setCharacterFavorite('member',999993,true,null),null);
});

const catalog=JSON.parse(fs.readFileSync(new URL('../data/characters.json',import.meta.url),'utf8'));

test('character catalog exposes ten unique candidates without provider metrics',()=>{
  assert.equal(catalog.metricsSource,'aninexus');
  assert.equal(catalog.items.length,10);
  assert.equal(new Set(catalog.items.map(item=>item.id)).size,10);
  for(const item of catalog.items){
    assert.equal(typeof item.name,'string');
    assert.match(item.image,/^https:\/\//);
    for(const importedMetric of ['score','rating','popularity','favourites','favoriteCount'])assert.equal(importedMetric in item,false);
  }
});

test('ranking uses only AniNexus favorite counts and stable editorial ties',()=>{
  const tied=rankCharacterCatalog(new Map(),10);
  assert.deepEqual(tied.map(item=>item.id),catalog.items.map(item=>item.id));
  const counts=new Map([[138100,7],[17,3],[40,3]]);
  const ranked=rankCharacterCatalog(counts,10);
  assert.equal(ranked[0].id,138100);
  assert.deepEqual(ranked.slice(1,3).map(item=>item.id),[40,17]);
  assert.deepEqual(ranked.slice(0,3).map(item=>item.favoriteCount),[7,3,3]);
  assert.deepEqual(ranked.map(item=>item.rank),[1,2,3,4,5,6,7,8,9,10]);
  assert.deepEqual(ranked.map(item=>item.seedOrder),[9,1,2,3,4,5,6,7,8,10]);
});

test('public character favorites preserve user order and expose catalog details',()=>{
  const hydrated=hydrateCharacterFavorites([{characterId:17,createdAt:'2026-09-08T00:00:00.000Z'},{characterId:999999}]);
  assert.equal(hydrated.length,1);
  assert.equal(hydrated[0].name,'Naruto Uzumaki');
  assert.equal(hydrated[0].work,'Naruto');
  assert.equal(hydrated[0].createdAt,'2026-09-08T00:00:00.000Z');
});

test('characters discovered on detail pages can enter the internal top ten',()=>{
  const dynamic={character_id:987654,character_name:'Akira Teste',native_name:'アキラ',image_url:'https://cdn.example.test/akira.jpg',work_title:'Obra Teste',media_id:765,media_type:'MANGA'};
  const ranked=rankCharacterCatalog(new Map([[987654,12]]),10,[dynamic]);
  assert.equal(ranked[0].id,987654);
  assert.equal(ranked[0].name,'Akira Teste');
  assert.equal(ranked[0].work,'Obra Teste');
  assert.equal(ranked[0].mediaType,'MANGA');
  assert.equal(ranked[0].favoriteCount,12);
  const [hydrated]=hydrateCharacterFavorites([{characterId:987654,createdAt:'2026-09-10T00:00:00.000Z',name:'Akira Teste',nativeName:'アキラ',image:'https://cdn.example.test/akira.jpg',work:'Obra Teste',mediaId:765,mediaType:'MANGA'}]);
  assert.equal(hydrated.name,'Akira Teste');
  assert.equal(hydrated.mediaId,765);
});
