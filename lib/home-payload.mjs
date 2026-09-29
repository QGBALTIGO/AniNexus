// Card payload sent to the website. The complete read model is retained for miniapp clients.
const HOME_CARD_FIELDS = [
  'id', 'title', 'titleRomaji', 'titleNative', 'cover', 'genres',
  'episodes', 'format', 'status', 'seasonYear', 'score', 'ratingCount',
  'popularity', 'metricsSource', 'contentProvider', 'streaming',
];

function compactMedia(media) {
  if (!media) return null;
  return Object.fromEntries(HOME_CARD_FIELDS
    .filter(field => media[field] != null)
    .map(field => [field, media[field]]));
}

export function compactHomePayload(home) {
  return Object.fromEntries(Object.entries(home).map(([section, items]) => [
    section,
    Array.isArray(items) ? items.map(item => section === 'schedule'
      ? { airingAt: item.airingAt, episode: item.episode, media: compactMedia(item.media) }
      : compactMedia(item)) : [],
  ]));
}
