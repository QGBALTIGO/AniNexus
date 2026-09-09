import crypto from 'node:crypto';
import { cacheRemember } from './cache.mjs';

const TRANSLATION_TTL = 30 * 24 * 60 * 60;
const ATTRIBUTION = /\s*(?:\((?:source|fonte)\s*:[^)]+\)|\[(?:source|fonte|written by)[^\]]*\])\s*/gi;
const TRAILING_ATTRIBUTION = /(?:^|\n)\s*(?:source|fonte)\s*:\s*[^\n]+\s*$/gim;

export function cleanSynopsisText(value = '') {
  return String(value || '')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(ATTRIBUTION, ' ')
    .replace(TRAILING_ATTRIBUTION, '')
    .replace(/\s+(?:source|fonte)\s*:\s*[^.!?]+\.?\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 4_000);
}

function languageHits(value, words) {
  const text = ` ${String(value || '').toLowerCase()} `;
  return words.reduce((total, word) => total + (text.match(new RegExp(`\\b${word}\\b`, 'g')) || []).length, 0);
}

export function looksPortuguese(value = '') {
  const text = String(value || '');
  const pt = languageHits(text, ['uma', 'que', 'para', 'com', 'seu', 'sua', 'quando', 'após', 'mundo', 'história', 'vida', 'jovem', 'escola', 'poder', 'dos', 'das', 'não', 'como', 'mas', 'por', 'em', 'de', 'do', 'da', 'temporada', 'aventura']);
  const en = languageHits(text, ['the', 'and', 'with', 'his', 'her', 'when', 'after', 'world', 'story', 'life', 'young', 'school', 'power', 'from', 'into', 'but']);
  return (/[áàâãéêíóôõúç]/i.test(text) && pt >= 1) || (pt >= 2 && pt > en * 1.35);
}

function splitText(value, max = 440) {
  const sentences = String(value || '').match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [value];
  const chunks = [];
  let current = '';
  for (const sentence of sentences) {
    if (`${current} ${sentence}`.trim().length > max && current) {
      chunks.push(current.trim());
      current = sentence;
    } else current = `${current} ${sentence}`.trim();
  }
  if (current) chunks.push(current);
  return chunks.slice(0, 8);
}

async function fetchJson(url, fetchImpl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6_500);
  try {
    const response = await fetchImpl(url, {
      headers: { accept: 'application/json', 'user-agent': 'AniNexus/3.8' },
      redirect: 'error',
      signal: controller.signal,
    });
    if (!response.ok || !String(response.headers.get('content-type') || '').includes('application/json')) throw new Error('translation upstream');
    return response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function googleChunk(text, fetchImpl) {
  const url = new URL('https://translate.googleapis.com/translate_a/single');
  Object.entries({ client: 'gtx', sl: 'en', tl: 'pt', dt: 't', q: text }).forEach(([key, value]) => url.searchParams.set(key, value));
  const json = await fetchJson(url, fetchImpl);
  return (json?.[0] || []).map(item => item?.[0] || '').join('');
}

async function memoryChunk(text, fetchImpl) {
  const url = new URL('https://api.mymemory.translated.net/get');
  url.searchParams.set('q', text);
  url.searchParams.set('langpair', 'en|pt-BR');
  const json = await fetchJson(url, fetchImpl);
  const result = String(json?.responseData?.translatedText || '');
  if (/MYMEMORY WARNING|QUERY LENGTH LIMIT/i.test(result)) throw new Error('translation upstream');
  return result;
}

function validTranslation(source, result) {
  const text = cleanSynopsisText(result);
  if (text.length < Math.min(80, source.length * 0.48) || !looksPortuguese(text) || text.toLowerCase() === source.toLowerCase()) throw new Error('invalid translation');
  return text;
}

async function translateWith(engine, chunks, fetchImpl, source) {
  const translated = (await Promise.all(chunks.map(chunk => engine(chunk, fetchImpl)))).join(' ');
  return validTranslation(source, translated);
}

export async function getPortugueseSynopsis(value, options = {}) {
  const source = cleanSynopsisText(value);
  if (!source || looksPortuguese(source)) return source;
  const fetchImpl = options.fetchImpl || fetch;
  const work = async () => {
    const chunks = splitText(source);
    return Promise.any([
      translateWith(googleChunk, chunks, fetchImpl, source),
      translateWith(memoryChunk, chunks, fetchImpl, source),
    ]);
  };
  if (options.cache === false) return work();
  const digest = crypto.createHash('sha256').update(source).digest('hex').slice(0, 32);
  return cacheRemember(`synopsis:pt:v1:${digest}`, TRANSLATION_TTL, work, { staleTtl: 180 * 24 * 60 * 60 });
}
