CREATE TABLE IF NOT EXISTS character_favorites (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  character_id bigint NOT NULL CHECK (character_id > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id, character_id)
);

CREATE INDEX IF NOT EXISTS character_favorites_character_idx
  ON character_favorites(character_id);

CREATE INDEX IF NOT EXISTS character_favorites_user_created_idx
  ON character_favorites(user_id, created_at DESC);
