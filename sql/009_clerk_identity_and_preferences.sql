-- Clerk owns authentication; AniNexus keeps only the verified identity link and
-- product data. The migration is idempotent and preserves legacy accounts until
-- each owner signs in with Clerk and imports their local data.
ALTER TABLE users ADD COLUMN IF NOT EXISTS clerk_user_id text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy text NOT NULL DEFAULT 'public';
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_clerk_user_id_shape'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_clerk_user_id_shape
      CHECK (clerk_user_id IS NULL OR clerk_user_id ~ '^user_[A-Za-z0-9]{8,}$');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_privacy_valid'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_privacy_valid
      CHECK (privacy IN ('public','followers','private'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS users_clerk_user_id_unique
  ON users(clerk_user_id) WHERE clerk_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  theme text NOT NULL DEFAULT 'system' CHECK (theme IN ('system','dark','light')),
  locale text NOT NULL DEFAULT 'pt-BR' CHECK (locale IN ('pt-BR')),
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  email_episode_notifications boolean NOT NULL DEFAULT true,
  email_news_notifications boolean NOT NULL DEFAULT false,
  reduce_motion boolean,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS watched_episodes (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_id bigint NOT NULL CHECK (media_id > 0),
  episode integer NOT NULL CHECK (episode > 0),
  watched_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id, media_id, episode)
);
CREATE INDEX IF NOT EXISTS watched_episodes_user_media_idx
  ON watched_episodes(user_id, media_id, episode DESC);

CREATE TABLE IF NOT EXISTS local_imports (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  imported_at timestamptz NOT NULL DEFAULT now(),
  source_version text NOT NULL DEFAULT 'browser-v2',
  item_count integer NOT NULL DEFAULT 0 CHECK (item_count >= 0),
  checksum text
);

CREATE TABLE IF NOT EXISTS clerk_webhook_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  payload_hash text NOT NULL
);
CREATE INDEX IF NOT EXISTS clerk_webhook_events_received_idx
  ON clerk_webhook_events(received_at DESC);
