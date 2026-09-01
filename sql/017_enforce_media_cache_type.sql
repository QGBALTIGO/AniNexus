-- Enforce the media type at the storage boundary so related works cannot
-- contaminate anime and manga collections even if an upstream caller is wrong.
DELETE FROM media_cache AS wrong
USING media_cache AS correct
WHERE wrong.media_type='ANIME'
  AND (
    wrong.payload->>'mediaType'='MANGA'
    OR wrong.payload->>'format' IN ('MANGA','NOVEL','ONE_SHOT')
  )
  AND correct.media_type='MANGA'
  AND correct.media_id=wrong.media_id;

UPDATE media_cache
SET media_type='MANGA',
    payload=jsonb_set(payload,'{mediaType}','"MANGA"'::jsonb,true),
    updated_at=now()
WHERE media_type='ANIME'
  AND (
    payload->>'mediaType'='MANGA'
    OR payload->>'format' IN ('MANGA','NOVEL','ONE_SHOT')
  );

CREATE OR REPLACE FUNCTION enforce_media_cache_type()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  inferred_type text;
BEGIN
  inferred_type := CASE
    WHEN NEW.payload->>'mediaType'='MANGA'
      OR NEW.payload->>'format' IN ('MANGA','NOVEL','ONE_SHOT')
    THEN 'MANGA'
    ELSE 'ANIME'
  END;
  NEW.media_type := inferred_type;
  NEW.payload := jsonb_set(NEW.payload,'{mediaType}',to_jsonb(inferred_type),true);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS media_cache_type_guard ON media_cache;
CREATE TRIGGER media_cache_type_guard
BEFORE INSERT OR UPDATE OF media_type,payload ON media_cache
FOR EACH ROW EXECUTE FUNCTION enforce_media_cache_type();
