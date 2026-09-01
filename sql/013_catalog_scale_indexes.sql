-- Persisted-catalog fallback indexes for cold upstreams and traffic spikes.
CREATE INDEX IF NOT EXISTS media_cache_updated_idx
  ON media_cache(updated_at DESC);

CREATE INDEX IF NOT EXISTS media_cache_popularity_idx
  ON media_cache(((payload->>'popularity')::numeric) DESC,updated_at DESC)
  WHERE payload->>'popularity' ~ '^[0-9]+([.][0-9]+)?$';

CREATE INDEX IF NOT EXISTS media_cache_score_idx
  ON media_cache(((payload->>'score')::numeric) DESC)
  WHERE payload->>'score' ~ '^[0-9]+([.][0-9]+)?$';

CREATE INDEX IF NOT EXISTS media_cache_season_idx
  ON media_cache((payload->>'season'),((payload->>'seasonYear')::int),updated_at DESC)
  WHERE payload->>'seasonYear' ~ '^[0-9]{4}$';

CREATE INDEX IF NOT EXISTS media_cache_genres_gin_idx
  ON media_cache USING gin ((payload->'genres'));
