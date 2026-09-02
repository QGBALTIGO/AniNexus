ALTER TABLE news_articles
  ADD COLUMN IF NOT EXISTS source_content jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS content_mode text NOT NULL DEFAULT 'legacy';

ALTER TABLE news_articles DROP CONSTRAINT IF EXISTS news_articles_source_content_check;
ALTER TABLE news_articles ADD CONSTRAINT news_articles_source_content_check
  CHECK (jsonb_typeof(source_content)='array') NOT VALID;
ALTER TABLE news_articles VALIDATE CONSTRAINT news_articles_source_content_check;

ALTER TABLE news_articles DROP CONSTRAINT IF EXISTS news_articles_content_mode_check;
ALTER TABLE news_articles ADD CONSTRAINT news_articles_content_mode_check
  CHECK (content_mode IN ('full','excerpt','editorial','legacy')) NOT VALID;
ALTER TABLE news_articles VALIDATE CONSTRAINT news_articles_content_mode_check;

ALTER TABLE news_articles DROP CONSTRAINT IF EXISTS news_articles_title_check;
ALTER TABLE news_articles ADD CONSTRAINT news_articles_title_check
  CHECK (char_length(title) BETWEEN 3 AND 500) NOT VALID;
ALTER TABLE news_articles VALIDATE CONSTRAINT news_articles_title_check;

ALTER TABLE news_article_revisions
  ADD COLUMN IF NOT EXISTS source_content jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS content_mode text NOT NULL DEFAULT 'legacy';

CREATE INDEX IF NOT EXISTS news_articles_content_mode_idx
  ON news_articles(status,content_mode,source_published_at DESC);
