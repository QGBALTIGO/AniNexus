-- Public, customizable member profiles. All changes are additive and idempotent.
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_banner_url text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS location text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS website_url text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS instagram_handle text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_handle text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_source text NOT NULL DEFAULT 'clerk';
ALTER TABLE users ADD COLUMN IF NOT EXISTS show_library boolean NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS show_activity boolean NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS show_stats boolean NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS username_changed_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='users_avatar_source_valid') THEN
    ALTER TABLE users ADD CONSTRAINT users_avatar_source_valid CHECK (avatar_source IN ('clerk','custom'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='users_profile_banner_url_length') THEN
    ALTER TABLE users ADD CONSTRAINT users_profile_banner_url_length CHECK (profile_banner_url IS NULL OR char_length(profile_banner_url)<=2000);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='users_location_length') THEN
    ALTER TABLE users ADD CONSTRAINT users_location_length CHECK (location IS NULL OR char_length(location)<=80);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='users_website_url_length') THEN
    ALTER TABLE users ADD CONSTRAINT users_website_url_length CHECK (website_url IS NULL OR char_length(website_url)<=2000);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='users_instagram_handle_length') THEN
    ALTER TABLE users ADD CONSTRAINT users_instagram_handle_length CHECK (instagram_handle IS NULL OR char_length(instagram_handle)<=30);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='users_telegram_handle_length') THEN
    ALTER TABLE users ADD CONSTRAINT users_telegram_handle_length CHECK (telegram_handle IS NULL OR char_length(telegram_handle)<=32);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS user_profile_aliases (
  alias citext PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_profile_aliases_user_idx ON user_profile_aliases(user_id);
CREATE INDEX IF NOT EXISTS users_public_profile_idx ON users(privacy,status,created_at DESC) WHERE deleted_at IS NULL;
