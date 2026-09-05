ALTER TABLE user_anime ADD COLUMN IF NOT EXISTS reactions jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE user_anime ADD COLUMN IF NOT EXISTS volume_progress integer NOT NULL DEFAULT 0 CHECK (volume_progress BETWEEN 0 AND 100000);
ALTER TABLE user_manga ADD COLUMN IF NOT EXISTS reactions jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE user_manga ADD COLUMN IF NOT EXISTS volume_progress integer NOT NULL DEFAULT 0 CHECK (volume_progress BETWEEN 0 AND 100000);
