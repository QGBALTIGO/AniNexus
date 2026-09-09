import assert from 'node:assert/strict';
import test from 'node:test';
import { cleanSynopsisText, getPortugueseSynopsis, looksPortuguese } from '../lib/synopsis.mjs';

test('removes provider attribution without removing the synopsis', () => {
  assert.equal(cleanSynopsisText('A pirate begins a journey. (Source: VIZ Media)'), 'A pirate begins a journey.');
  assert.equal(cleanSynopsisText('Uma jornada começa.\nFonte: Crunchyroll'), 'Uma jornada começa.');
  assert.equal(cleanSynopsisText('A story begins. Source: VIZ Media'), 'A story begins.');
  assert.equal(cleanSynopsisText('A story begins. [Written by MAL Rewrite]'), 'A story begins.');
});

test('keeps an existing Portuguese synopsis unchanged', async () => {
  const synopsis = 'Uma jovem descobre que sua história pode mudar o mundo para sempre.';
  assert.equal(looksPortuguese(synopsis), true);
  assert.equal(await getPortugueseSynopsis(synopsis, { cache: false, fetchImpl: () => { throw new Error('should not fetch'); } }), synopsis);
});

test('translates English through the first valid provider and cleans its attribution', async () => {
  const source = 'A young traveler begins a decisive adventure with close friends, faces dangerous enemies, and learns that their own story can change the entire world. (Source: VIZ Media)';
  const translated = 'Uma jovem viajante inicia uma aventura decisiva com amigos, enfrenta inimigos perigosos e descobre que sua própria história pode transformar o mundo. (Fonte: VIZ Media)';
  const fetchImpl = async url => {
    if (String(url).includes('translate.googleapis.com')) return new Response(JSON.stringify([[[translated, source]]]), { status: 200, headers: { 'content-type': 'application/json' } });
    return new Response(JSON.stringify({ responseData: { translatedText: translated } }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  assert.equal(await getPortugueseSynopsis(source, { cache: false, fetchImpl }), cleanSynopsisText(translated));
});

test('accepts a short Portuguese translation without requiring accented words', async () => {
  const source = 'The second season of Bungou Stray Dogs Wan!';
  const translated = await getPortugueseSynopsis(source, {
    cache: false,
    fetchImpl: async url => String(url).includes('translate.googleapis.com')
      ? new Response(JSON.stringify([[['A segunda temporada de Bungou Stray Dogs Wan!', source]]]), { status: 200, headers: { 'content-type': 'application/json' } })
      : new Response(JSON.stringify({ responseData: { translatedText: 'A segunda temporada de Bungou Stray Dogs Wan!' } }), { status: 200, headers: { 'content-type': 'application/json' } }),
  });
  assert.equal(translated, 'A segunda temporada de Bungou Stray Dogs Wan!');
});
