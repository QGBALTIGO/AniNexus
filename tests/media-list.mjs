import test from 'node:test';
import assert from 'node:assert/strict';
import { mediaListEntry } from '../lib/media-list.mjs';

test('reading list validates and preserves reactions and volume progress',()=>{
  const row=mediaListEntry.parse({status:'CURRENT',volumeProgress:2,score:8.5,reactions:['Amei','Viciante','Amei']});
  assert.deepEqual(row.reactions,['Amei','Viciante']);assert.equal(row.volumeProgress,2);assert.equal(row.score,8.5);
});
test('planning resets progress and ratings, completed titles can have unknown totals',()=>{
  const row=mediaListEntry.parse({status:'PLANNING',progress:12,volumeProgress:4,score:9});
  assert.equal(row.progress,0);assert.equal(row.volumeProgress,0);assert.equal(row.score,null);
  assert.equal(mediaListEntry.parse({status:'COMPLETED',score:9}).score,9);
});
test('invalid progress, ratings and excessive reaction payloads are rejected',()=>{
  for(const data of [{progress:-1},{progress:1.5},{volumeProgress:100001},{score:11},{reactions:['x'.repeat(61)]},{reactions:Array(33).fill('Amei')}])assert.equal(mediaListEntry.safeParse({status:'CURRENT',...data}).success,false);
});
test('legacy clients do not erase reactions when the field is absent',()=>{
  const row=mediaListEntry.parse({status:'PAUSED',progress:8,reaction:'LOVE'});
  assert.equal(row.reactions,undefined);assert.equal(row.reaction,'LOVE');
});
