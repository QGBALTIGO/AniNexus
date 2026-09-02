import assert from 'node:assert/strict';
import { fetchAnimeScheduleTimetable, normalizeAnimeScheduleItem } from '../lib/anime-schedule.mjs';

const episodeDate = '2026-09-03T21:30:00Z';
const fixture = {
  title: 'Anime de teste',
  route: 'anime-de-teste',
  romaji: 'Test Anime',
  english: 'Test Anime',
  native: 'テスト',
  episodeDate,
  episodeNumber: 7,
  episodes: 12,
  lengthMin: 24,
  status: 'Ongoing',
  genres: [{ name: 'Action' }],
  mediaTypes: [{ route: 'tv' }],
  imageVersionRoute: 'anime-de-teste/poster.webp',
  websites: {
    aniList: 'https://anilist.co/anime/12345/test-anime',
    mal: 'https://myanimelist.net/anime/54321/Test_Anime'
  },
  streams: [{ name: 'Crunchyroll', url: 'https://www.crunchyroll.com/series/test' }],
  stats: { averageScore: 99, ratingCount: 999999, trackedCount: 999999 }
};

const normalized = normalizeAnimeScheduleItem(fixture);
assert.equal(normalized.anilistId, 12345);
assert.equal(normalized.idMal, 54321);
assert.equal(normalized.episode, 7);
assert.equal(normalized.format, 'TV');
assert.equal(normalized.contentProvider, 'animeschedule');
for (const key of ['score', 'averageScore', 'ratingCount', 'popularity', 'favourites']) {
  assert.equal(Object.hasOwn(normalized, key), false, `${key} must not cross the content-provider boundary`);
}

const originalFetch = globalThis.fetch;
let calls = 0;
globalThis.fetch = async (url, init) => {
  calls++;
  assert.match(String(url), /\/api\/v3\/timetables\/sub/);
  assert.equal(init.headers.authorization, 'Bearer private-test-token');
  return new Response(JSON.stringify([fixture]), { headers: { 'content-type': 'application/json' } });
};

try {
  const airingAt = Math.floor(Date.parse(episodeDate) / 1000);
  const result = await fetchAnimeScheduleTimetable(airingAt - 3600, airingAt + 3600, {
    token: 'private-test-token',
    endpoint: 'https://animeschedule.net/api/v3'
  });
  assert.equal(calls, 1);
  assert.equal(result.length, 1);
  assert.equal(result[0].airingAt, airingAt);
} finally {
  globalThis.fetch = originalFetch;
}

console.log('Content providers: 1 test passed');
