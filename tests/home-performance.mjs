import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compactHomePayload } from '../lib/home-payload.mjs';

test('compact Home retains visible card data and strips heavy detail data', () => {
  const media = {
    id: 21, title: 'One Piece', cover: 'https://s4.anilist.co/cover.jpg',
    genres: ['Action'], episodes: 1000, score: 9.2, ratingCount: 15,
    metricsSource: 'aninexus', streaming: [{ site: 'Netflix', url: 'https://netflix.com' }],
    description: 'x'.repeat(30_000), relations: [{ id: 22 }], characters: [{ id: 1 }],
  };
  const full = { season: [media], schedule: [{ airingAt: 1790000000, episode: 12, media }], top: [media] };
  const small = compactHomePayload(full);
  assert.equal(small.season[0].title, 'One Piece');
  assert.equal(small.season[0].score, 9.2);
  assert.equal(small.schedule[0].episode, 12);
  assert.deepEqual(small.schedule[0].media.streaming, media.streaming);
  assert.equal('description' in small.season[0], false);
  assert.equal('relations' in small.schedule[0].media, false);
  assert.ok(JSON.stringify(small).length < JSON.stringify(full).length / 20);
  assert.equal(full.season[0].description.length, 30_000);
});
