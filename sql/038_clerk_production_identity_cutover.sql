-- One-time bridge from the Clerk Development instance to Production.
-- Candidate identities are populated only by application code while using sk_test_.
-- Production can consume each candidate once after the same email is verified.
CREATE TABLE IF NOT EXISTS clerk_identity_cutovers (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  legacy_clerk_user_id text NOT NULL,
  production_clerk_user_id text,
  authorized_at timestamptz NOT NULL DEFAULT now(),
  rebound_at timestamptz,
  CONSTRAINT clerk_identity_cutovers_legacy_shape
    CHECK (legacy_clerk_user_id ~ '^user_[A-Za-z0-9]{8,}$'),
  CONSTRAINT clerk_identity_cutovers_production_shape
    CHECK (production_clerk_user_id IS NULL OR production_clerk_user_id ~ '^user_[A-Za-z0-9]{8,}$'),
  CONSTRAINT clerk_identity_cutovers_distinct_ids
    CHECK (production_clerk_user_id IS NULL OR production_clerk_user_id <> legacy_clerk_user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS clerk_identity_cutovers_legacy_unique
  ON clerk_identity_cutovers(legacy_clerk_user_id);

CREATE UNIQUE INDEX IF NOT EXISTS clerk_identity_cutovers_production_unique
  ON clerk_identity_cutovers(production_clerk_user_id)
  WHERE production_clerk_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS clerk_identity_cutovers_pending_idx
  ON clerk_identity_cutovers(authorized_at)
  WHERE production_clerk_user_id IS NULL;
