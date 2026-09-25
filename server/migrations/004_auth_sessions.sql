CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash text PRIMARY KEY,
  account_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_sessions_account_idx ON auth_sessions (account_id);
CREATE INDEX IF NOT EXISTS auth_sessions_expiry_idx ON auth_sessions (expires_at);
