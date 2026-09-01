CREATE TABLE IF NOT EXISTS user_manga (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_id bigint NOT NULL,
  status text NOT NULL CHECK (status IN ('PLANNING','CURRENT','COMPLETED','PAUSED','DROPPED')),
  score numeric(4,1) CHECK (score IS NULL OR (score >= 0 AND score <= 10)),
  reaction text CHECK (reaction IN ('LIKE','DISLIKE','LOVE','WOW') OR reaction IS NULL),
  progress integer NOT NULL DEFAULT 0 CHECK (progress >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id, media_id)
);

CREATE INDEX IF NOT EXISTS user_manga_user_updated_idx ON user_manga(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS user_manga_media_idx ON user_manga(media_id);

ALTER TABLE impressions ADD COLUMN IF NOT EXISTS media_type text NOT NULL DEFAULT 'ANIME';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='impressions_media_type_check') THEN
    ALTER TABLE impressions ADD CONSTRAINT impressions_media_type_check CHECK (media_type IN ('ANIME','MANGA')) NOT VALID;
    ALTER TABLE impressions VALIDATE CONSTRAINT impressions_media_type_check;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS impressions_media_type_visible_idx
  ON impressions(media_type, media_id, created_at DESC) WHERE hidden=false;

ALTER TABLE media_cache ADD COLUMN IF NOT EXISTS media_type text;
UPDATE media_cache
  SET media_type=CASE WHEN payload->>'mediaType'='MANGA' THEN 'MANGA' ELSE 'ANIME' END
  WHERE media_type IS NULL;
ALTER TABLE media_cache ALTER COLUMN media_type SET DEFAULT 'ANIME';
ALTER TABLE media_cache ALTER COLUMN media_type SET NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid='media_cache'::regclass
      AND contype='p'
      AND pg_get_constraintdef(oid)='PRIMARY KEY (media_type, media_id)'
  ) THEN
    ALTER TABLE media_cache DROP CONSTRAINT media_cache_pkey;
    ALTER TABLE media_cache ADD CONSTRAINT media_cache_pkey PRIMARY KEY(media_type, media_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS media_cache_type_updated_idx
  ON media_cache(media_type, updated_at DESC);
