CREATE TABLE IF NOT EXISTS staff_presence (
  token_hash text PRIMARY KEY REFERENCES auth_sessions(token_hash) ON DELETE CASCADE,
  account_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS staff_presence_last_seen_idx ON staff_presence (last_seen_at);
