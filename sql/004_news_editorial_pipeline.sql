ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS source_hash text;
ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS story_hash text;
ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS original_title text;
ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS source_author text;
ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS source_language text;
ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS sources jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS content_sections jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS reading_minutes smallint NOT NULL DEFAULT 1 CHECK (reading_minutes BETWEEN 1 AND 120);
ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS word_count integer NOT NULL DEFAULT 0 CHECK (word_count >= 0);
ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS quality_score numeric(4,3) NOT NULL DEFAULT 0 CHECK (quality_score BETWEEN 0 AND 1);
ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS first_seen_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS last_seen_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS view_count bigint NOT NULL DEFAULT 0 CHECK (view_count >= 0);

CREATE UNIQUE INDEX IF NOT EXISTS news_articles_auto_source_hash_uq
  ON news_articles(source_hash)
  WHERE source_kind='AUTOMATED' AND source_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS news_articles_story_idx
  ON news_articles(story_hash, source_published_at DESC)
  WHERE source_kind='AUTOMATED';

CREATE INDEX IF NOT EXISTS news_articles_feed_idx
  ON news_articles(status, quality_score DESC, source_published_at DESC, published_at DESC);

CREATE INDEX IF NOT EXISTS news_articles_last_seen_idx
  ON news_articles(last_seen_at DESC);
