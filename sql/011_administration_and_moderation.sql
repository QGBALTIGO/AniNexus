ALTER TABLE users ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_until timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_reason text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS moderation_note text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='users_status_valid') THEN
    ALTER TABLE users ADD CONSTRAINT users_status_valid CHECK (status IN ('active','suspended','banned'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='users_ban_reason_length') THEN
    ALTER TABLE users ADD CONSTRAINT users_ban_reason_length CHECK (ban_reason IS NULL OR char_length(ban_reason)<=1000);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='users_moderation_note_length') THEN
    ALTER TABLE users ADD CONSTRAINT users_moderation_note_length CHECK (moderation_note IS NULL OR char_length(moderation_note)<=4000);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS users_status_created_idx ON users(status,created_at DESC);
CREATE INDEX IF NOT EXISTS users_last_seen_idx ON users(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_target_idx ON audit_log(target_type,target_id,created_at DESC);
