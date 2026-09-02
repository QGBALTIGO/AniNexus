-- Persisted-catalog fallback indexes for cold upstreams and traffic spikes.
CREATE INDEX IF NOT EXISTS media_cache_updated_idx
  ON media_cache(updated_at DESC);

CREATE INDEX IF NOT EXISTS media_cache_season_idx
  ON media_cache((payload->>'season'),((payload->>'seasonYear')::int),updated_at DESC)
  WHERE payload->>'seasonYear' ~ '^[0-9]{4}$';

CREATE INDEX IF NOT EXISTS media_cache_genres_gin_idx
  ON media_cache USING gin ((payload->'genres'));
