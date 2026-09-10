BEGIN;
SET LOCAL statement_timeout = '60s';

-- Older detail fallbacks could persist complete cached works inside each
-- relation/recommendation. Strip those nested detail graphs once so cold
-- requests stay small and the migration remains a no-op after cleanup.
WITH compacted AS (
  SELECT media_type,media_id,
    payload || jsonb_build_object(
      'relations',COALESCE((
        SELECT jsonb_agg(
          (relation_row - 'media') || jsonb_build_object(
            'media',COALESCE(relation_row->'media','{}'::jsonb)
              - 'relations' - 'recommendations' - 'characters' - 'staff' - 'editorial' - 'jikan'
          )
          ORDER BY position
        )
        FROM jsonb_array_elements(
          CASE WHEN jsonb_typeof(payload->'relations')='array' THEN payload->'relations' ELSE '[]'::jsonb END
        ) WITH ORDINALITY AS relation_items(relation_row,position)
      ),'[]'::jsonb),
      'recommendations',COALESCE((
        SELECT jsonb_agg(
          (recommendation_row - 'media') || jsonb_build_object(
            'media',COALESCE(recommendation_row->'media','{}'::jsonb)
              - 'relations' - 'recommendations' - 'characters' - 'staff' - 'editorial' - 'jikan'
          )
          ORDER BY position
        )
        FROM jsonb_array_elements(
          CASE WHEN jsonb_typeof(payload->'recommendations')='array' THEN payload->'recommendations' ELSE '[]'::jsonb END
        ) WITH ORDINALITY AS recommendation_items(recommendation_row,position)
      ),'[]'::jsonb)
    ) AS clean_payload
  FROM media_cache
  WHERE pg_column_size(payload)>262144
)
UPDATE media_cache AS target
SET payload=compacted.clean_payload,updated_at=now()
FROM compacted
WHERE target.media_type=compacted.media_type
  AND target.media_id=compacted.media_id;

COMMIT;
