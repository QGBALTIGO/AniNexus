ALTER TABLE character_favorites
  ADD COLUMN IF NOT EXISTS character_name text,
  ADD COLUMN IF NOT EXISTS native_name text,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS work_title text,
  ADD COLUMN IF NOT EXISTS media_id bigint,
  ADD COLUMN IF NOT EXISTS media_type text;

ALTER TABLE character_favorites
  DROP CONSTRAINT IF EXISTS character_favorites_media_type_check;

ALTER TABLE character_favorites
  ADD CONSTRAINT character_favorites_media_type_check
  CHECK (media_type IS NULL OR media_type IN ('ANIME','MANGA'));

CREATE INDEX IF NOT EXISTS character_favorites_ranking_idx
  ON character_favorites(character_id, created_at DESC);
