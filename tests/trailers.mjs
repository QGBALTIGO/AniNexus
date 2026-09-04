import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildLatestTrailers, youtubeVideoId } from '../lib/trailers.mjs';

const now = '2026-09-03T18:00:00.000Z';
const article = (overrides = {}) => ({
  slug: 'anime-teste-ganha-trailer',
  title: 'Anime Teste ganha novo trailer e data de estreia',
  summary: 'A nova temporada do anime estreia em outubro.',
  eventType: 'TRAILER',
  publishedAt: '2026-09-03T16:00:00.000Z',
  sourceName: 'Fonte Teste',
  image: 'https://example.com/anime.webp',
  mediaEmbeds: [{ type: 'video', embedUrl: 'https://www.youtube.com/embed/abc123XYZ01' }],
  ...overrides,
});

assert.equal(youtubeVideoId('https://youtu.be/abc123XYZ01?t=2'), 'abc123XYZ01');
assert.equal(youtubeVideoId('https://www.youtube.com/watch?v=abc123XYZ02'), 'abc123XYZ02');
assert.equal(youtubeVideoId('https://www.youtube-nocookie.com/embed/abc123XYZ03'), 'abc123XYZ03');
assert.equal(youtubeVideoId('https://example.com/watch?v=abc123XYZ04'), '');

const items = buildLatestTrailers([
  article({ title: 'Anime Antigo ganha trailer', publishedAt: '2026-07-01T10:00:00.000Z' }),
  article({ title: 'Jogo Teste ganha trailer de DLC', mediaEmbeds: [{ url: 'https://youtu.be/abc123XYZ04' }] }),
  article({ title: 'Anime Teste terá série live-action', mediaEmbeds: [{ url: 'https://youtu.be/abc123XYZ05' }] }),
  article({ title: 'Anime sem vídeo ganha trailer', mediaEmbeds: [] }),
  article({ title: 'Anime Segundo revela teaser', publishedAt: '2026-09-03T17:00:00.000Z', mediaEmbeds: [{ url: 'https://youtu.be/abc123XYZ02' }] }),
  article(),
  article({ title: 'Anime duplicado ganha PV', publishedAt: '2026-09-03T15:00:00.000Z' }),
], { now, maxAgeDays: 21, limit: 9 });

assert.deepEqual(items.map(item => item.videoId), ['abc123XYZ02', 'abc123XYZ01']);
assert.deepEqual(items.map(item => item.kind), ['TEASER', 'TRAILER']);
assert.ok(items.every(item => item.articlePath.startsWith('/noticias/')));
assert.ok(items.every(item => item.thumbnail.includes(item.videoId)));

const document = JSON.parse(fs.readFileSync(new URL('../data/trailers.json', import.meta.url), 'utf8'));
assert.equal(document.total, document.items.length);
assert.ok(document.items.length > 0, 'the static trailer feed must not be empty');
for (const item of document.items) {
  assert.match(item.videoId, /^[A-Za-z0-9_-]{11}$/);
  assert.ok(Date.parse(document.generatedAt) - Date.parse(item.publishedAt) <= 21 * 86_400_000);
  assert.doesNotMatch(`${item.title} ${item.articleTitle}`.toLowerCase(), /\b(?:game|jogo|dlc)\b|live[ -]?action/);
}

console.log(`✓ latest trailer pipeline (${document.items.length} current static items)`);
