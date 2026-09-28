-- Clerk Development -> Production identity handoff audit.
-- AniNexus keeps its stable users.id; only the external Clerk identity may be rebound.
CREATE TABLE IF NOT EXISTS clerk_identity_rebinds (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  old_clerk_user_id text NOT NULL,
  new_clerk_user_id text NOT NULL,
  email citext NOT NULL,
  reason text NOT NULL DEFAULT 'verified_email_production_migration',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (new_clerk_user_id)
);
CREATE INDEX IF NOT EXISTS clerk_identity_rebinds_user_idx
  ON clerk_identity_rebinds(user_id, created_at DESC);
