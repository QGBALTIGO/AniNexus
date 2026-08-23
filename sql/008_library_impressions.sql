-- Hot path for the Meus Animes impression history.
CREATE INDEX IF NOT EXISTS impressions_user_visible_idx
  ON impressions(user_id, created_at DESC)
  WHERE hidden=false;

-- The public impressions feed orders only visible rows by recency.
CREATE INDEX IF NOT EXISTS impressions_visible_time_idx
  ON impressions(created_at DESC)
  WHERE hidden=false;
