ALTER TABLE list_transfers DROP CONSTRAINT IF EXISTS list_transfers_service_check;
ALTER TABLE list_transfers ADD CONSTRAINT list_transfers_service_check CHECK(service IN ('ANILIST','MAL','ANINEXUS'));

CREATE TABLE IF NOT EXISTS list_import_previews (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service text NOT NULL CHECK(service IN ('ANILIST','MAL')),
  payload jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  transfer_id uuid REFERENCES list_transfers(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS list_import_previews_expiry_idx ON list_import_previews(expires_at);
CREATE INDEX IF NOT EXISTS list_import_previews_user_idx ON list_import_previews(user_id);
CREATE INDEX IF NOT EXISTS media_cache_mal_id_idx ON media_cache(media_type,(payload->>'idMal'));
