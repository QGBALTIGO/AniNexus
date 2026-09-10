import test from 'node:test';
import assert from 'node:assert/strict';
import {
  flattenedReplyDepth,
  hasSpoilerMarkup,
  normalizeSocialBody,
  parseSpoilerMarkup,
  socialBodyPayload,
} from '../lib/social.mjs';

test('spoiler markup parses multiple independent, balanced segments', () => {
  assert.deepEqual(parseSpoilerMarkup('Antes ||segredo 1||, depois ||segredo 2||.'), [
    { type: 'text', content: 'Antes ' },
    { type: 'spoiler', content: 'segredo 1' },
    { type: 'text', content: ', depois ' },
    { type: 'spoiler', content: 'segredo 2' },
    { type: 'text', content: '.' },
  ]);
  assert.equal(hasSpoilerMarkup('um | literal e ||sem fechamento'), false);
  assert.equal(hasSpoilerMarkup('||válido||'), true);
});

test('legacy whole-body spoiler remains protected while new markup is partial', () => {
  const legacy = socialBodyPayload({ body: '<b>não é HTML</b>', spoiler: true });
  assert.equal(legacy.hasSpoilers, true);
  assert.deepEqual(legacy.segments, [{ type: 'spoiler', content: '<b>não é HTML</b>' }]);
  const partial = socialBodyPayload({ body: 'Seguro ||oculto||', spoiler: false });
  assert.deepEqual(partial.segments.map(segment => segment.type), ['text', 'spoiler']);
});

test('social text normalization and visual reply flattening are deterministic', () => {
  assert.equal(normalizeSocialBody('  texto\u00a0social  ', 20), 'texto social');
  assert.equal(normalizeSocialBody('   ', 20), null);
  assert.equal(flattenedReplyDepth(1), 1);
  assert.equal(flattenedReplyDepth(8), 2);
});
