-- Member-facing prediction detail. Confidence only weights community summaries;
-- reputation is fixed per eligible resolved vote and never has monetary value.
ALTER TABLE prediction_votes ADD COLUMN IF NOT EXISTS confidence_pct smallint NOT NULL DEFAULT 50
  CHECK (confidence_pct IN (10,25,50,75,100));

CREATE TABLE IF NOT EXISTS prediction_follows (
  question_id uuid NOT NULL REFERENCES prediction_questions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(question_id,user_id)
);
CREATE INDEX IF NOT EXISTS prediction_follows_user_idx ON prediction_follows(user_id,created_at DESC);

CREATE TABLE IF NOT EXISTS prediction_arguments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES prediction_questions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 10 AND 1500),
  hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(question_id,user_id)
);
CREATE INDEX IF NOT EXISTS prediction_arguments_visible_idx ON prediction_arguments(question_id,created_at,id) WHERE hidden=false;
