import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { rankCharacterCatalog } from '../lib/character-ranking.mjs';

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
