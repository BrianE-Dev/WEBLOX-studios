CREATE TABLE IF NOT EXISTS dashboard_images (
  id text PRIMARY KEY,
  owner_account_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  original_name text NOT NULL,
  content_type text NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp', 'image/gif')),
  content bytea NOT NULL,
  byte_size integer NOT NULL CHECK (byte_size > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dashboard_images_owner_created_idx
  ON dashboard_images (owner_account_id, created_at DESC);
