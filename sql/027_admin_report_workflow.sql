ALTER TABLE content_reports
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resolution text,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='content_reports'::regclass
      AND conname='content_reports_resolution_length'
  ) THEN
    ALTER TABLE content_reports
      ADD CONSTRAINT content_reports_resolution_length
      CHECK (resolution IS NULL OR char_length(resolution)<=4000);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS content_reports_assignment_idx
  ON content_reports(assigned_to,status,created_at DESC);
