CREATE TABLE IF NOT EXISTS manga_device_grants (
 code_hash text PRIMARY KEY, verifier_hash text NOT NULL,
 user_id uuid REFERENCES users(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), consumed boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS manga_device_links (
 token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,
 last_sync_at timestamptz
);
CREATE SEQUENCE IF NOT EXISTS manga_catalog_media_id_seq AS bigint START WITH 8000000000000000 NO CYCLE;
CREATE TABLE IF NOT EXISTS manga_catalog_links (
 provider text NOT NULL, external_id text NOT NULL, media_id bigint NOT NULL,
 anilist_id bigint, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(provider,external_id)
);
CREATE INDEX IF NOT EXISTS manga_device_links_user ON manga_device_links(user_id);
