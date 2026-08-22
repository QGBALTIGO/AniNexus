ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS translation_status text NOT NULL DEFAULT 'ready' CHECK (translation_status IN ('pending','ready','failed'));
ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS content_version integer NOT NULL DEFAULT 1 CHECK (content_version >= 1);
ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS content_signature text;
ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS image_source_url text;
ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS source_count smallint NOT NULL DEFAULT 1 CHECK (source_count >= 0);
ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS last_source_update_at timestamptz;

CREATE INDEX IF NOT EXISTS news_articles_translation_idx
  ON news_articles(status,translation_status,source_published_at DESC);

CREATE INDEX IF NOT EXISTS news_articles_recent_quality_idx
  ON news_articles(status,translation_status,quality_score DESC,source_published_at DESC)
  WHERE status='published';

CREATE TABLE IF NOT EXISTS news_article_revisions (
  id bigserial PRIMARY KEY,
  article_id uuid NOT NULL REFERENCES news_articles(id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version >= 1),
  title text NOT NULL,
  summary text NOT NULL,
  facts jsonb NOT NULL DEFAULT '[]'::jsonb,
  content_sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  image_url text,
  quality_score numeric(4,3) NOT NULL DEFAULT 0 CHECK (quality_score BETWEEN 0 AND 1),
  content_signature text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(article_id,version)
);
CREATE INDEX IF NOT EXISTS news_article_revisions_article_idx
  ON news_article_revisions(article_id,version DESC);

CREATE TABLE IF NOT EXISTS news_ingest_runs (
  id bigserial PRIMARY KEY,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','success','partial','failed')),
  sources_ok integer NOT NULL DEFAULT 0 CHECK (sources_ok >= 0),
  sources_failed integer NOT NULL DEFAULT 0 CHECK (sources_failed >= 0),
  collected_items integer NOT NULL DEFAULT 0 CHECK (collected_items >= 0),
  grouped_stories integer NOT NULL DEFAULT 0 CHECK (grouped_stories >= 0),
  published_stories integer NOT NULL DEFAULT 0 CHECK (published_stories >= 0),
  skipped_translation integer NOT NULL DEFAULT 0 CHECK (skipped_translation >= 0),
  skipped_quality integer NOT NULL DEFAULT 0 CHECK (skipped_quality >= 0),
  duration_ms integer NOT NULL DEFAULT 0 CHECK (duration_ms >= 0),
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS news_ingest_runs_time_idx ON news_ingest_runs(started_at DESC);
