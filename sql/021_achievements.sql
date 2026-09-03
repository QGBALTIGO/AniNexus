CREATE TABLE IF NOT EXISTS achievement_profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  share_feed boolean NOT NULL DEFAULT true,
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  equipped_title text,
  first_evaluated_at timestamptz,
  last_evaluated_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (char_length(timezone) BETWEEN 3 AND 80),
  CHECK (equipped_title IS NULL OR char_length(equipped_title) <= 80)
);

CREATE TABLE IF NOT EXISTS achievement_anime_history (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_id bigint NOT NULL CHECK (media_id > 0),
  ever_added boolean NOT NULL DEFAULT true,
  ever_completed boolean NOT NULL DEFAULT false,
  ever_rated boolean NOT NULL DEFAULT false,
  trusted_import boolean NOT NULL DEFAULT false,
  max_progress integer NOT NULL DEFAULT 0 CHECK (max_progress >= 0),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, media_id)
);
CREATE INDEX IF NOT EXISTS achievement_anime_history_user_idx
  ON achievement_anime_history(user_id, ever_completed, ever_rated);

CREATE TABLE IF NOT EXISTS achievement_activity_days (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_date date NOT NULL,
  source text NOT NULL CHECK (source IN ('PROGRESS','RATING','EPISODE','CONTRIBUTION')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, activity_date)
);
CREATE INDEX IF NOT EXISTS achievement_activity_days_user_date_idx
  ON achievement_activity_days(user_id, activity_date DESC);

CREATE TABLE IF NOT EXISTS achievement_contribution_history (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contribution_type text NOT NULL CHECK (contribution_type IN ('IMPRESSION','THREAD','POST','NEWS_COMMENT')),
  contribution_id uuid NOT NULL,
  counted boolean NOT NULL DEFAULT true,
  contributed_at timestamptz NOT NULL DEFAULT now(),
  moderated_at timestamptz,
  PRIMARY KEY (contribution_type, contribution_id)
);
CREATE INDEX IF NOT EXISTS achievement_contribution_history_user_idx
  ON achievement_contribution_history(user_id, counted);

CREATE TABLE IF NOT EXISTS achievement_unlocks (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id text NOT NULL CHECK (char_length(achievement_id) BETWEEN 3 AND 80),
  tier text NOT NULL CHECK (tier IN ('BRONZE','SILVER','GOLD','PLATINUM','DIAMOND')),
  xp integer NOT NULL CHECK (xp IN (20,50,100,200,400)),
  source text NOT NULL DEFAULT 'ACTION' CHECK (source IN ('ACTION','RETROACTIVE')),
  batch_id uuid NOT NULL DEFAULT gen_random_uuid(),
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, achievement_id)
);
CREATE INDEX IF NOT EXISTS achievement_unlocks_feed_idx
  ON achievement_unlocks(unlocked_at DESC, batch_id);

CREATE TABLE IF NOT EXISTS achievement_pins (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slot smallint NOT NULL CHECK (slot BETWEEN 1 AND 3),
  achievement_id text NOT NULL CHECK (char_length(achievement_id) BETWEEN 3 AND 80),
  pinned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, slot),
  UNIQUE (user_id, achievement_id),
  FOREIGN KEY (user_id, achievement_id)
    REFERENCES achievement_unlocks(user_id, achievement_id) ON DELETE CASCADE
);
