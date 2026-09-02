import fs from 'node:fs/promises';
import path from 'node:path';
import { collectEditorialStories, likelyPortuguese } from '../lib/news-rich-v37.mjs';

const OUT = path.resolve('data/news.json');
const RETENTION_DAYS = Math.max(3, Math.min(10, Number(process.env.NEWS_RETENTION_DAYS || 7)));
const STALE_GRACE_DAYS = Math.max(RETENTION_DAYS, Math.min(21, Number(process.env.NEWS_STALE_GRACE_DAYS || 14)));
const MAX_ITEMS = Math.max(20, Math.min(80, Number(process.env.NEWS_STATIC_MAX_ITEMS || 60)));
const MIN_QUALITY = Math.max(.38, Math.min(.9, Number(process.env.NEWS_MIN_QUALITY || .50)));
const MIN_SAFE_FEED = Math.max(6, Math.min(20, Number(process.env.NEWS_MIN_SAFE_FEED || 10)));
const now = Date.now();

async function readDoc(file) {
  try {
    return JSON.parse(await fs.readFile(path.resolve(file), 'utf8')) || {};
  } catch {
    return {};
  }
}

function ageOk(item, days = RETENTION_DAYS) {
  const timestamp = new Date(item.publishedAt || item.source_published_at || 0).getTime();
  return Number.isFinite(timestamp) && now - timestamp < days * 86_400_000 && now - timestamp > -36 * 3_600_000;
}

function contentOk(item) {
  const text = `${item?.title || ''} ${item?.summary || ''}`;
  return Boolean(item?.title && item?.summary && likelyPortuguese(text) && !/all the news and reviews|interest fool night|news and interest|weekly roundup|live blog/i.test(text));
}

function fidelityOk(item) {
  return contentOk(item) && ['full', 'excerpt'].includes(item?.contentMode) && Array.isArray(item?.sourceContent) && item.sourceContent.length > 0;
}

function valid(item, days = RETENTION_DAYS) {
  return contentOk(item) && ageOk(item, days);
}

function staticItem(article) {
  const published = new Date(article.publishedAt || Date.now());
  const expires = new Date(published.getTime() + RETENTION_DAYS * 86_400_000);
  const coverage = article.coverage || {};
  const gallery = (Array.isArray(article.mediaGallery) ? article.mediaGallery : []).filter(item => item?.url).slice(0, 18);
  const embeds = (Array.isArray(article.mediaEmbeds) ? article.mediaEmbeds : []).filter(item => item?.url).slice(0, 6);
  const sourceContent = (Array.isArray(article.sourceContent) ? article.sourceContent : []).slice(0, 160);
  return {
    id: article.id,
    slug: article.slug,
    source: article.sourceName,
    sourceType: article.sourceKey,
    sourceLanguage: 'pt-BR',
    language: 'pt-BR',
    title: article.title,
    originalTitle: article.title,
    summary: article.summary,
    author: article.author || '',
    tags: article.tags || [],
    url: article.sourceUrl,
    sourceUrl: article.sourceUrl,
    image: article.imageUrl || gallery[0]?.url || '',
    mediaQuery: article.mediaQuery || article.title || '',
    mediaType: article.eventType === 'MANGA' ? 'manga' : 'anime',
    mediaGallery: gallery,
    mediaEmbeds: embeds,
    sourceContent,
    contentMode: article.contentMode === 'full' ? 'full' : 'excerpt',
    publishedAt: published.toISOString(),
    updatedAt: article.updatedAt || published.toISOString(),
    expiresAt: expires.toISOString(),
    category: article.category,
    eventType: article.eventType,
    facts: [],
    contentSections: [],
    sources: article.sources || [],
    sourceCount: 1,
    readingMinutes: Math.max(1, article.readingMinutes || 1),
    wordCount: article.wordCount || 0,
    qualityScore: Number(article.qualityScore || 0),
    contentVersion: 2,
    coverage: {
      facts: 0,
      sections: 0,
      blocks: Number(coverage.blocks || sourceContent.length),
      sourceCount: 1,
      ingestMode: coverage.ingestMode || '',
      contentMode: article.contentMode === 'full' ? 'full' : 'excerpt',
      mediaCount: Number(coverage.mediaCount || gallery.length),
      embedCount: Number(coverage.embedCount || embeds.length),
      sourcePagesRead: 0
    }
  };
}

function richer(current, incoming) {
  if (!current) return incoming;
  if (!incoming) return current;
  const currentFidelity = fidelityOk(current);
  const incomingFidelity = fidelityOk(incoming);
  if (currentFidelity !== incomingFidelity) return incomingFidelity ? incoming : current;
  const currentScore = Number(current.wordCount || 0) + Number(current.sourceContent?.length || 0) * 30 + Number(current.qualityScore || 0) * 500;
  const incomingScore = Number(incoming.wordCount || 0) + Number(incoming.sourceContent?.length || 0) * 30 + Number(incoming.qualityScore || 0) * 500;
  return incomingScore > currentScore ? incoming : current;
}

function merge(items) {
  const map = new Map();
  for (const item of items) {
    if (!contentOk(item)) continue;
    const key = item.sourceUrl || item.url || item.slug || item.id;
    if (!key) continue;
    map.set(key, richer(map.get(key), item));
  }
  return [...map.values()];
}

const started = Date.now();
const [previousDoc, hotDoc, seedDoc] = await Promise.all([readDoc(OUT), readDoc('data/news-v37-hot.json'), readDoc('data/news-v36-seed.json')]);
const previousAll = (previousDoc.items || []).filter(contentOk);
const previousGrace = previousAll.filter(item => valid(item, STALE_GRACE_DAYS));
const emergency = [...(hotDoc.items || []), ...(seedDoc.items || [])].filter(contentOk).filter(item => ageOk(item, STALE_GRACE_DAYS));
let result = { stories: [], sourceResults: [], collected: 0, grouped: 0, skippedTranslation: 0, skippedQuality: 0 };
let collectorError = '';

try {
  result = await collectEditorialStories({
    maxPerSource: Number(process.env.NEWS_MAX_PER_SOURCE || 45),
    maxAgeHours: Number(process.env.NEWS_MAX_SOURCE_AGE_HOURS || 168),
    maxStories: Number(process.env.NEWS_MAX_STORIES || 60),
    minQuality: MIN_QUALITY
  });
} catch (error) {
  collectorError = String(error?.message || error);
  console.error('[news-static-v40] coleta falhou; entrando em modo degradado:', collectorError);
}

const fresh = (result.stories || []).map(staticItem).filter(item => valid(item) && fidelityOk(item));
let mode = 'fresh';
let candidates = merge(fresh);
if (candidates.length < MIN_SAFE_FEED) {
  mode = 'grace';
  candidates = merge([...candidates, ...previousGrace, ...emergency]);
  console.warn(`[news-static-v40] feed novo insuficiente (${fresh.length}); usando janela segura para manter ${candidates.length} matérias`);
}
const items = candidates.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt) || Number(b.qualityScore || 0) - Number(a.qualityScore || 0)).slice(0, MAX_ITEMS);

/* Never replace the last readable feed with an empty file during an upstream outage. */
if (!items.length) {
  if (previousAll.length) {
    console.warn('[news-static-v40] nenhum item novo utilizável; preservando data/news.json existente sem sobrescrever');
    process.exit(0);
  }
  throw new Error('AniNexus Notícias: não existe feed anterior nem seed PT-BR para recuperação.');
}

const stats = {
  collected: result.collected,
  grouped: result.grouped,
  published: items.length,
  newStories: fresh.length,
  fullArticles: items.filter(item => item.contentMode === 'full').length,
  previewArticles: items.filter(item => item.contentMode === 'excerpt').length,
  avgWords: Math.round(items.reduce((sum, item) => sum + Number(item.wordCount || 0), 0) / Math.max(1, items.length)),
  withHeroImage: items.filter(item => item.image).length,
  withOrderedMedia: items.filter(item => item.sourceContent?.some(block => block.type === 'image' || block.type === 'video')).length,
  skippedTranslation: 0,
  skippedQuality: result.skippedQuality,
  durationMs: Date.now() - started
};
const doc = {
  generatedAt: new Date().toISOString(),
  retentionDays: RETENTION_DAYS,
  staleGraceDays: STALE_GRACE_DAYS,
  language: 'pt-BR',
  editorialMode: 'source-fidelity',
  collectorVersion: 40,
  feedStatus: mode === 'fresh' && !collectorError ? 'fresh' : 'degraded',
  collectorError: collectorError || null,
  sources: ['JBox WordPress', 'ANMTV WordPress', 'AnimeNew RSS', 'GNews API (opcional, prévias)'],
  sourceHealth: result.sourceResults || [],
  stats,
  items
};

await fs.mkdir(path.dirname(OUT), { recursive: true });
await fs.writeFile(OUT, `${JSON.stringify(doc, null, 2)}\n`);
console.log(`[news-static-v40] ${items.length} matérias (${fresh.length} novas); modo=${doc.feedStatus}; ${stats.fullArticles} completas; ${stats.previewArticles} prévias; média ${stats.avgWords} palavras`);
