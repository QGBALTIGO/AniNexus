import { collectEditorialStories as collectSourceStories, likelyPortuguese, languageScore } from './news-sources-v36-normalized.mjs';
import { parseSourceContent } from './news-source-content.mjs';

/* Compatibility entrypoint kept for the worker and static updater. Source media is now
   extracted together with text, in DOM order, instead of being scraped into a separate gallery. */
export function extractSourceMedia(html = '', baseUrl = '') {
  const parsed = parseSourceContent(html, baseUrl);
  return { media: parsed.mediaGallery, embeds: parsed.mediaEmbeds };
}

export async function collectEditorialStories(options = {}) {
  const result = await collectSourceStories(options);
  return { ...result, collectorVersion: 40 };
}

export { likelyPortuguese, languageScore };
