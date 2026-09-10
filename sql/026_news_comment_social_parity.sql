ALTER TABLE news_comments
  ADD COLUMN IF NOT EXISTS has_spoilers boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS edited_at timestamptz;

UPDATE news_comments
SET has_spoilers = spoiler OR body ~ '\|\|[^|]+\|\|'
WHERE has_spoilers IS DISTINCT FROM (spoiler OR body ~ '\|\|[^|]+\|\|');

CREATE INDEX IF NOT EXISTS news_comments_visible_root_idx
  ON news_comments(article_slug,root_id,created_at)
  WHERE hidden=false;
