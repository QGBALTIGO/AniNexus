CREATE TABLE IF NOT EXISTS source_account_links (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  source_subject text NOT NULL UNIQUE CHECK (source_subject ~ '^src_[a-f0-9]{64}$'),
  source_link_id uuid NOT NULL UNIQUE,
  source_revoke_token text NOT NULL CHECK (char_length(source_revoke_token) BETWEEN 40 AND 1024),
  public_visible boolean NOT NULL DEFAULT true,
  source_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  linked_at timestamptz NOT NULL DEFAULT now(),
  refreshed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS source_account_links_visibility_idx ON source_account_links(public_visible,refreshed_at DESC);
