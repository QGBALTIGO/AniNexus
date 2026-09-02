-- Content providers may populate metadata, but AniNexus owns every community
-- metric. Remove historical provider metrics from the content cache.
UPDATE media_cache
SET payload=payload
  - 'score'
  - 'meanScore'
  - 'averageScore'
  - 'ratingCount'
  - 'listCount'
  - 'popularity'
  - 'favourites'
  - 'metricsSource'
WHERE payload ?| ARRAY[
  'score','meanScore','averageScore','ratingCount','listCount',
  'popularity','favourites','metricsSource'
];

DROP INDEX IF EXISTS media_cache_popularity_idx;
DROP INDEX IF EXISTS media_cache_score_idx;
DROP INDEX IF EXISTS media_cache_type_popularity_idx;
DROP INDEX IF EXISTS media_cache_type_score_idx;

CREATE INDEX IF NOT EXISTS user_anime_media_score_idx
  ON user_anime(media_id,score) WHERE score IS NOT NULL;

CREATE INDEX IF NOT EXISTS user_manga_media_score_idx
  ON user_manga(media_id,score) WHERE score IS NOT NULL;

CREATE INDEX IF NOT EXISTS user_favorites_media_metric_idx
  ON user_favorites(media_type,media_id);

CREATE INDEX IF NOT EXISTS impressions_media_metric_idx
  ON impressions(media_type,media_id) WHERE hidden=false;
