-- Profile privacy and traceable list transfers.
DO $$
DECLARE constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid='users'::regclass
      AND contype='c'
      AND pg_get_constraintdef(oid) ILIKE '%privacy%'
  LOOP
    EXECUTE format('ALTER TABLE users DROP CONSTRAINT %I',constraint_name);
  END LOOP;
  UPDATE users SET privacy='semi_public' WHERE privacy='followers';
  UPDATE users SET show_library=(privacy<>'private'),show_activity=(privacy<>'private'),show_stats=(privacy<>'private');
  ALTER TABLE users ADD CONSTRAINT users_privacy_valid
    CHECK (privacy IN ('public','semi_public','private'));
END $$;

CREATE TABLE IF NOT EXISTS list_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('IMPORT','EXPORT')),
  service text NOT NULL CHECK (service IN ('ANILIST','ANINEXUS')),
  media_type text CHECK (media_type IN ('ANIME','MANGA','ALL') OR media_type IS NULL),
  source_username text,
  strategy text CHECK (strategy IN ('KEEP','OVERWRITE') OR strategy IS NULL),
  status text NOT NULL DEFAULT 'RUNNING' CHECK (status IN ('RUNNING','COMPLETED','FAILED')),
  item_count integer NOT NULL DEFAULT 0 CHECK (item_count >= 0),
  skipped_count integer NOT NULL DEFAULT 0 CHECK (skipped_count >= 0),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS list_transfers_user_time_idx ON list_transfers(user_id,created_at DESC);
