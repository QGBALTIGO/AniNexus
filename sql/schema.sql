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
  score numeric(4,1) CHECK (score IS NULL OR (score >= 0 AND score <= 10)),
  reaction text CHECK (reaction IN ('LIKE','DISLIKE','LOVE','WOW') OR reaction IS NULL),
  progress integer NOT NULL DEFAULT 0 CHECK (progress >= 0),
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
  requester_name text NOT NULL CHECK (char_length(requester_name) BETWEEN 2 AND 150),
  requester_email citext NOT NULL,
  rights_holder text NOT NULL CHECK (char_length(rights_holder) BETWEEN 2 AND 200),
  content_url text NOT NULL CHECK (char_length(content_url) <= 1200),
  description text NOT NULL CHECK (char_length(description) BETWEEN 30 AND 6000),
  good_faith boolean NOT NULL,
  signature text NOT NULL CHECK (char_length(signature) BETWEEN 2 AND 200),
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received','reviewing','actioned','rejected')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 100),
  email citext NOT NULL,
  subject text NOT NULL CHECK (char_length(subject) BETWEEN 3 AND 160),
  message text NOT NULL CHECK (char_length(message) BETWEEN 10 AND 5000),
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

CREATE TABLE IF NOT EXISTS user_follows (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_id bigint NOT NULL,
  media_type text NOT NULL DEFAULT 'ANIME' CHECK (media_type IN ('ANIME','MANGA')),
  notify_episode boolean NOT NULL DEFAULT true,
  notify_news boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,media_id,media_type)
);
CREATE INDEX IF NOT EXISTS user_follows_media_idx ON user_follows(media_id,media_type);

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('EPISODE','NEWS','COMMUNITY','SYSTEM')),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 180),
  body text CHECK (body IS NULL OR char_length(body) <= 1200),
  media_id bigint,
  url text CHECK (url IS NULL OR char_length(url) <= 1200),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id,created_at DESC);

CREATE TABLE IF NOT EXISTS community_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  media_id bigint,
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 180),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 6000),
  spoiler boolean NOT NULL DEFAULT false,
  locked boolean NOT NULL DEFAULT false,
  hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS community_threads_media_idx ON community_threads(media_id,created_at DESC);
CREATE INDEX IF NOT EXISTS community_threads_time_idx ON community_threads(created_at DESC);

CREATE TABLE IF NOT EXISTS community_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES community_threads(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  parent_id uuid REFERENCES community_posts(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 3000),
  spoiler boolean NOT NULL DEFAULT false,
  hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS community_posts_thread_idx ON community_posts(thread_id,created_at);

CREATE TABLE IF NOT EXISTS content_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid REFERENCES users(id) ON DELETE SET NULL,
  target_type text NOT NULL CHECK (target_type IN ('THREAD','POST','IMPRESSION','USER')),
  target_id text NOT NULL CHECK (char_length(target_id) <= 100),
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 3 AND 1000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewing','resolved','dismissed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS content_reports_status_idx ON content_reports(status,created_at);

CREATE TABLE IF NOT EXISTS news_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  source_kind text NOT NULL CHECK (source_kind IN ('AUTOMATED','EDITORIAL')),
  event_type text CHECK (event_type IN ('SEASON','TRAILER','EPISODE','MANGA','TRENDING','OTHER') OR event_type IS NULL),
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 220),
  summary text NOT NULL CHECK (char_length(summary) BETWEEN 10 AND 1200),
  body text CHECK (body IS NULL OR char_length(body) <= 30000),
  spoiler boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','review','scheduled','published','archived')),
  media_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  external_url text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  scheduled_at timestamptz,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS news_articles_published_idx ON news_articles(status,published_at DESC);

CREATE TABLE IF NOT EXISTS news_events (
  id bigserial PRIMARY KEY,
  dedupe_key text UNIQUE NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS news_events_pending_idx ON news_events(processed_at,created_at);

CREATE TABLE IF NOT EXISTS audit_log (
  id bigserial PRIMARY KEY,
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (char_length(action) <= 120),
  target_type text,
  target_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_log_time_idx ON audit_log(created_at DESC);
