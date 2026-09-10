ALTER TABLE impressions
  ADD COLUMN IF NOT EXISTS status_snapshot text,
  ADD COLUMN IF NOT EXISTS progress_snapshot integer,
  ADD COLUMN IF NOT EXISTS score_snapshot numeric(4,1),
  ADD COLUMN IF NOT EXISTS impression_stage text NOT NULL DEFAULT 'PRELIMINARY',
  ADD COLUMN IF NOT EXISTS has_spoilers boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS edited_at timestamptz;

UPDATE impressions
SET has_spoilers = spoiler OR body ~ '\|\|[^|]+\|\|'
WHERE has_spoilers IS DISTINCT FROM (spoiler OR body ~ '\|\|[^|]+\|\|');

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='impressions_snapshot_status_check') THEN
    ALTER TABLE impressions ADD CONSTRAINT impressions_snapshot_status_check
      CHECK (status_snapshot IS NULL OR status_snapshot IN ('PLANNING','CURRENT','COMPLETED','PAUSED','DROPPED')) NOT VALID;
    ALTER TABLE impressions VALIDATE CONSTRAINT impressions_snapshot_status_check;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='impressions_stage_check') THEN
    ALTER TABLE impressions ADD CONSTRAINT impressions_stage_check
      CHECK (impression_stage IN ('PRELIMINARY','FINAL')) NOT VALID;
    ALTER TABLE impressions VALIDATE CONSTRAINT impressions_stage_check;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS media_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id bigint NOT NULL CHECK (media_id > 0),
  media_type text NOT NULL CHECK (media_type IN ('ANIME','MANGA')),
  subject_number integer NOT NULL CHECK (subject_number > 0),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES media_comments(id) ON DELETE CASCADE,
  root_id uuid REFERENCES media_comments(id) ON DELETE CASCADE,
  depth smallint NOT NULL DEFAULT 0 CHECK (depth >= 0 AND depth <= 100),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 3000),
  has_spoilers boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'visible' CHECK (status IN ('visible','hidden','removed')),
  hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz
);
CREATE INDEX IF NOT EXISTS media_comments_subject_idx
  ON media_comments(media_type,media_id,subject_number,created_at DESC) WHERE hidden=false AND status='visible';
CREATE INDEX IF NOT EXISTS media_comments_root_idx ON media_comments(root_id,created_at);

CREATE TABLE IF NOT EXISTS impression_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  impression_id uuid NOT NULL REFERENCES impressions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES impression_replies(id) ON DELETE CASCADE,
  root_id uuid REFERENCES impression_replies(id) ON DELETE CASCADE,
  depth smallint NOT NULL DEFAULT 0 CHECK (depth >= 0 AND depth <= 100),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 3000),
  has_spoilers boolean NOT NULL DEFAULT false,
  hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz
);
CREATE INDEX IF NOT EXISTS impression_replies_impression_idx
  ON impression_replies(impression_id,created_at) WHERE hidden=false;
CREATE INDEX IF NOT EXISTS impression_replies_root_idx ON impression_replies(root_id,created_at);

CREATE TABLE IF NOT EXISTS likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  likeable_type text NOT NULL CHECK (likeable_type IN ('IMPRESSION','IMPRESSION_REPLY','ANIME_COMMENT','POST','NEWS_COMMENT')),
  likeable_id text NOT NULL CHECK (char_length(likeable_id) BETWEEN 1 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,likeable_type,likeable_id)
);
CREATE INDEX IF NOT EXISTS likes_target_idx ON likes(likeable_type,likeable_id);

ALTER TABLE community_threads ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'GERAL';
ALTER TABLE community_threads ADD COLUMN IF NOT EXISTS media_type text NOT NULL DEFAULT 'ANIME';
ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS root_id uuid REFERENCES community_posts(id) ON DELETE CASCADE;
ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS depth smallint NOT NULL DEFAULT 0;
ALTER TABLE news_comments ADD COLUMN IF NOT EXISTS root_id uuid REFERENCES news_comments(id) ON DELETE CASCADE;
ALTER TABLE news_comments ADD COLUMN IF NOT EXISTS depth smallint NOT NULL DEFAULT 0;

WITH RECURSIVE post_tree AS (
  SELECT id,id AS root_id,0::smallint AS depth
  FROM community_posts
  WHERE parent_id IS NULL
  UNION ALL
  SELECT child.id,parent.root_id,(parent.depth+1)::smallint
  FROM community_posts child
  JOIN post_tree parent ON parent.id=child.parent_id
  WHERE parent.depth < 100
)
UPDATE community_posts post
SET root_id=tree.root_id,depth=tree.depth
FROM post_tree tree
WHERE post.id=tree.id AND (post.root_id IS DISTINCT FROM tree.root_id OR post.depth IS DISTINCT FROM tree.depth);

WITH RECURSIVE news_tree AS (
  SELECT id,id AS root_id,0::smallint AS depth
  FROM news_comments
  WHERE parent_id IS NULL
  UNION ALL
  SELECT child.id,parent.root_id,(parent.depth+1)::smallint
  FROM news_comments child
  JOIN news_tree parent ON parent.id=child.parent_id
  WHERE parent.depth < 100
)
UPDATE news_comments comment
SET root_id=tree.root_id,depth=tree.depth
FROM news_tree tree
WHERE comment.id=tree.id AND (comment.root_id IS DISTINCT FROM tree.root_id OR comment.depth IS DISTINCT FROM tree.depth);

CREATE INDEX IF NOT EXISTS community_posts_root_idx ON community_posts(root_id,created_at);
CREATE INDEX IF NOT EXISTS news_comments_root_idx ON news_comments(root_id,created_at);

DO $$ BEGIN
  ALTER TABLE content_reports DROP CONSTRAINT IF EXISTS content_reports_target_type_check;
  ALTER TABLE content_reports ADD CONSTRAINT content_reports_target_type_check
    CHECK (target_type IN ('THREAD','POST','IMPRESSION','IMPRESSION_REPLY','ANIME_COMMENT','NEWS_COMMENT','USER')) NOT VALID;
  ALTER TABLE content_reports VALIDATE CONSTRAINT content_reports_target_type_check;
END $$;
