CREATE TABLE IF NOT EXISTS user_favorites (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_id bigint NOT NULL,
  media_type text NOT NULL DEFAULT 'ANIME' CHECK (media_type IN ('ANIME','MANGA')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id, media_id, media_type)
);

CREATE INDEX IF NOT EXISTS user_favorites_user_created_idx
  ON user_favorites(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS user_favorites_media_idx
  ON user_favorites(media_id, media_type);
