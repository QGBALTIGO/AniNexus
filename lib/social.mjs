const SPOILER_MARKER_SOURCE = '\\|\\|([^|]+?)\\|\\|';

export const LIKEABLE_TYPES = Object.freeze([
  'IMPRESSION',
  'IMPRESSION_REPLY',
  'ANIME_COMMENT',
  'POST',
  'NEWS_COMMENT',
]);

export const REPORT_REASONS = Object.freeze([
  'SPOILER_NAO_MARCADO',
  'OFENSA_OU_ASSEDIO',
  'DISCURSO_DE_ODIO',
  'SPAM',
  'CONTEUDO_IMPROPRIO',
  'FORA_DO_ASSUNTO',
  'OUTRO',
]);

export function normalizeSocialBody(value, maxLength = 3000) {
  const normalized = String(value ?? '').normalize('NFKC').trim();
  if (!normalized || normalized.length > maxLength) return null;
  return normalized;
}

export function parseSpoilerMarkup(rawBody) {
  const body = String(rawBody ?? '');
  const segments = [];
  let cursor = 0;
  for (const match of body.matchAll(new RegExp(SPOILER_MARKER_SOURCE, 'g'))) {
    const index = Number(match.index) || 0;
    if (index > cursor) segments.push({ type: 'text', content: body.slice(cursor, index) });
    segments.push({ type: 'spoiler', content: match[1] });
    cursor = index + match[0].length;
  }
  if (cursor < body.length) segments.push({ type: 'text', content: body.slice(cursor) });
  return segments.length ? segments : [{ type: 'text', content: body }];
}

export function hasSpoilerMarkup(rawBody) {
  return new RegExp(SPOILER_MARKER_SOURCE).test(String(rawBody ?? ''));
}

export function socialBodyPayload(row, { hideSpoilers = true } = {}) {
  const legacyWholeBody = Boolean(row?.spoiler) && !hasSpoilerMarkup(row?.body);
  const segments = legacyWholeBody
    ? [{ type: 'spoiler', content: String(row?.body ?? '') }]
    : parseSpoilerMarkup(row?.body);
  return {
    ...row,
    body: String(row?.body ?? ''),
    hasSpoilers: legacyWholeBody || Boolean(row?.has_spoilers) || hasSpoilerMarkup(row?.body),
    hideSpoilers: Boolean(hideSpoilers),
    segments,
  };
}

export function flattenedReplyDepth(depth) {
  const value = Math.max(0, Number(depth) || 0);
  return Math.min(value, 2);
}
