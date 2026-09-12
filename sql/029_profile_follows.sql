CREATE TABLE IF NOT EXISTS profile_follows (
  follower_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followed_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followed_id),
  CONSTRAINT profile_follows_not_self CHECK (follower_id <> followed_id)
);

CREATE INDEX IF NOT EXISTS profile_follows_followed_created_idx
  ON profile_follows(followed_id, created_at DESC);

CREATE INDEX IF NOT EXISTS profile_follows_follower_created_idx
  ON profile_follows(follower_id, created_at DESC);
