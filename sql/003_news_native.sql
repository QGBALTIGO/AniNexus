ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS image_alt text;
ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS source_name text;
ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS source_url text;
ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS source_published_at timestamptz;
ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'pt-BR';
ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS facts jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS news_articles_expiry_idx ON news_articles(status,expires_at);
CREATE INDEX IF NOT EXISTS news_articles_source_idx ON news_articles(source_name,source_published_at DESC);
