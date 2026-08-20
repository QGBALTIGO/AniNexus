CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext UNIQUE NOT NULL,
  username citext UNIQUE NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user','moderator','admin')),
  avatar_url text,
  bio text,
  theme text NOT NULL DEFAULT 'system' CHECK (theme IN ('system','dark','light')),
  email_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ip_hash text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_exp_idx ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS user_anime (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_id bigint NOT NULL,
  status text NOT NULL CHECK (status IN ('PLANNING','CURRENT','COMPLETED','PAUSED','DROPPED')),
  score numeric(4,1),
  reaction text CHECK (reaction IN ('LIKE','DISLIKE','LOVE','WOW') OR reaction IS NULL),
  progress integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id, media_id)
);
CREATE INDEX IF NOT EXISTS user_anime_media_idx ON user_anime(media_id);

CREATE TABLE IF NOT EXISTS impressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_id bigint NOT NULL,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1200),
  spoiler boolean NOT NULL DEFAULT false,
  hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS impressions_media_idx ON impressions(media_id, created_at DESC);

CREATE TABLE IF NOT EXISTS media_annotations (
  media_id bigint PRIMARY KEY,
  dubbed_pt_br boolean NOT NULL DEFAULT false,
  subtitle_pt_br boolean NOT NULL DEFAULT false,
  streaming jsonb NOT NULL DEFAULT '[]'::jsonb,
  synopsis_pt_br text,
  title_pt_br text,
  editorial jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS media_cache (
  media_id bigint PRIMARY KEY,
  slug text,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS media_cache_slug_idx ON media_cache(slug);

CREATE TABLE IF NOT EXISTS dmca_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_name text NOT NULL,
  requester_email citext NOT NULL,
  rights_holder text NOT NULL,
  content_url text NOT NULL,
  description text NOT NULL,
  good_faith boolean NOT NULL,
  signature text NOT NULL,
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received','reviewing','actioned','rejected')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email citext NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS analytics_events (
  id bigserial PRIMARY KEY,
  event_name text NOT NULL,
  path text NOT NULL,
  media_id bigint,
  session_key text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS analytics_events_time_idx ON analytics_events(created_at DESC);
