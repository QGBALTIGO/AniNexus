CREATE INDEX IF NOT EXISTS user_anime_public_profile_idx
  ON user_anime(user_id, updated_at DESC, media_id DESC);

CREATE INDEX IF NOT EXISTS user_anime_public_profile_status_idx
  ON user_anime(user_id, status, updated_at DESC, media_id DESC);

CREATE INDEX IF NOT EXISTS user_manga_public_profile_idx
  ON user_manga(user_id, updated_at DESC, media_id DESC);

CREATE INDEX IF NOT EXISTS user_manga_public_profile_status_idx
  ON user_manga(user_id, status, updated_at DESC, media_id DESC);

CREATE INDEX IF NOT EXISTS profile_follows_public_following_idx
  ON profile_follows(follower_id, created_at DESC, followed_id);

CREATE INDEX IF NOT EXISTS profile_follows_public_followers_idx
  ON profile_follows(followed_id, created_at DESC, follower_id);
