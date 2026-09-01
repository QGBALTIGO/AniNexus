-- Repair reading titles that were classified as anime before media_type existed.
DELETE FROM media_cache AS wrong
USING media_cache AS correct
WHERE wrong.media_type='ANIME'
  AND wrong.payload->>'format' IN ('MANGA','NOVEL','ONE_SHOT')
  AND correct.media_type='MANGA'
  AND correct.media_id=wrong.media_id;

UPDATE media_cache
SET media_type='MANGA',
    payload=jsonb_set(payload,'{mediaType}','"MANGA"'::jsonb,true),
    updated_at=now()
WHERE media_type='ANIME'
  AND payload->>'format' IN ('MANGA','NOVEL','ONE_SHOT');

UPDATE media_cache
SET payload=jsonb_set(payload,'{mediaType}',to_jsonb(media_type),true)
WHERE payload->>'mediaType' IS DISTINCT FROM media_type;

CREATE INDEX IF NOT EXISTS media_cache_type_popularity_idx
  ON media_cache(
    media_type,
    (CASE WHEN payload->>'popularity' ~ '^[0-9]+([.][0-9]+)?$' THEN (payload->>'popularity')::numeric ELSE 0 END) DESC
  );

CREATE INDEX IF NOT EXISTS media_cache_type_score_idx
  ON media_cache(
    media_type,
    (CASE WHEN payload->>'score' ~ '^[0-9]+([.][0-9]+)?$' THEN (payload->>'score')::numeric ELSE 0 END) DESC
  );
