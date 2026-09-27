-- Forecast reputation has no monetary value. Sources are observations, not proof of airing.
CREATE TABLE IF NOT EXISTS prediction_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dedupe_key text NOT NULL UNIQUE CHECK (char_length(dedupe_key) BETWEEN 1 AND 200),
  media_id bigint NOT NULL CHECK (media_id > 0),
  media_type text NOT NULL CHECK (media_type IN ('ANIME','MANGA')),
  media_title text NOT NULL CHECK (char_length(media_title) BETWEEN 1 AND 300),
  cover text,
  type text NOT NULL CHECK (type IN ('CATALOG_DATE_OBSERVED','SCORE_AT_DEADLINE')),
  question text NOT NULL CHECK (char_length(question) BETWEEN 10 AND 500),
  criteria text NOT NULL CHECK (char_length(criteria) BETWEEN 20 AND 3000),
  source text NOT NULL CHECK (source='AniList'),
  source_url text NOT NULL CHECK (source_url ~ '^https://anilist[.]co/(anime|manga)/[0-9]+$'),
  rule jsonb NOT NULL CHECK (jsonb_typeof(rule)='object'),
  baseline jsonb NOT NULL CHECK (jsonb_typeof(baseline)='object'),
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','OPEN','LOCKED','RESOLVED','VOID')),
  opens_at timestamptz NOT NULL,
  closes_at timestamptz NOT NULL,
  resolution_deadline timestamptz NOT NULL,
  voting_cutoff timestamptz,
  result text CHECK (result IN ('YES','NO')),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (opens_at < closes_at AND closes_at < resolution_deadline),
  CHECK ((status='RESOLVED' AND result IS NOT NULL AND resolved_at IS NOT NULL)
    OR (status='VOID' AND result IS NULL AND resolved_at IS NOT NULL)
    OR (status IN ('DRAFT','OPEN','LOCKED') AND result IS NULL AND resolved_at IS NULL))
);
CREATE INDEX IF NOT EXISTS prediction_questions_status_close_idx ON prediction_questions(status,closes_at,id);
CREATE INDEX IF NOT EXISTS prediction_questions_media_idx ON prediction_questions(media_type,media_id,created_at DESC);
CREATE INDEX IF NOT EXISTS prediction_questions_created_idx ON prediction_questions(created_at DESC,id);
CREATE INDEX IF NOT EXISTS prediction_questions_resolution_idx ON prediction_questions(status,resolution_deadline,id);
CREATE TABLE IF NOT EXISTS prediction_job_state (
  name text PRIMARY KEY,
  next_run_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  details jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details)='object')
);
CREATE TABLE IF NOT EXISTS prediction_votes (
  question_id uuid NOT NULL REFERENCES prediction_questions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  choice text NOT NULL CHECK (choice IN ('YES','NO')),
  eligible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(question_id,user_id)
);
CREATE INDEX IF NOT EXISTS prediction_votes_user_idx ON prediction_votes(user_id,updated_at DESC,question_id);
CREATE TABLE IF NOT EXISTS prediction_resolutions (
  question_id uuid PRIMARY KEY REFERENCES prediction_questions(id) ON DELETE RESTRICT,
  outcome text CHECK (outcome IN ('YES','NO')),
  reason text NOT NULL,
  evidence jsonb NOT NULL,
  evidence_hash text NOT NULL CHECK (evidence_hash ~ '^[a-f0-9]{64}$'),
  resolved_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS prediction_snapshots (
  question_id uuid NOT NULL REFERENCES prediction_questions(id) ON DELETE CASCADE,
  bucket_at timestamptz NOT NULL,
  yes_count integer NOT NULL CHECK (yes_count>=0),
  no_count integer NOT NULL CHECK (no_count>=0),
  PRIMARY KEY(question_id,bucket_at)
);
-- Publication criteria cannot be rewritten after people have voted. Final outcomes
-- are append-only; corrections require a separately reviewed future workflow.
CREATE OR REPLACE FUNCTION guard_prediction_question() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IN ('RESOLVED','VOID') AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'PREDICTION_FINAL';
  END IF;
  IF OLD.status<>'DRAFT' AND (NEW.question,NEW.criteria,NEW.type,NEW.rule,NEW.source,NEW.source_url,
    NEW.opens_at,NEW.closes_at,NEW.resolution_deadline,NEW.media_id,NEW.media_type,NEW.baseline)
    IS DISTINCT FROM (OLD.question,OLD.criteria,OLD.type,OLD.rule,OLD.source,OLD.source_url,
    OLD.opens_at,OLD.closes_at,OLD.resolution_deadline,OLD.media_id,OLD.media_type,OLD.baseline) THEN
    RAISE EXCEPTION 'PREDICTION_CRITERIA_IMMUTABLE';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS prediction_question_guard ON prediction_questions;
CREATE TRIGGER prediction_question_guard BEFORE UPDATE ON prediction_questions FOR EACH ROW EXECUTE FUNCTION guard_prediction_question();
CREATE OR REPLACE FUNCTION guard_prediction_resolution() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'PREDICTION_EVIDENCE_IMMUTABLE';
END $$;
DROP TRIGGER IF EXISTS prediction_resolution_guard ON prediction_resolutions;
CREATE TRIGGER prediction_resolution_guard BEFORE UPDATE OR DELETE ON prediction_resolutions FOR EACH ROW EXECUTE FUNCTION guard_prediction_resolution();
