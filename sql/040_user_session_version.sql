-- Existing moderation routes increment this column. Keep its introduction
-- additive so previous application releases remain compatible with the schema.
ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 0;
