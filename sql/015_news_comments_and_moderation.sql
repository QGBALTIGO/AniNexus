CREATE TABLE IF NOT EXISTS news_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_slug text NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES news_comments(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 2 AND 1800),
  spoiler boolean NOT NULL DEFAULT false,
  hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS news_comments_article_idx
  ON news_comments(article_slug, created_at) WHERE hidden=false;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid='content_reports'::regclass
      AND conname='content_reports_target_type_check'
      AND pg_get_constraintdef(oid) LIKE '%NEWS_COMMENT%'
  ) THEN
    ALTER TABLE content_reports DROP CONSTRAINT content_reports_target_type_check;
    ALTER TABLE content_reports ADD CONSTRAINT content_reports_target_type_check
      CHECK (target_type IN ('THREAD','POST','IMPRESSION','NEWS_COMMENT','USER')) NOT VALID;
    ALTER TABLE content_reports VALIDATE CONSTRAINT content_reports_target_type_check;
  END IF;
END $$;
