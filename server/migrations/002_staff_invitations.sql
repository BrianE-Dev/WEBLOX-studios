CREATE TABLE IF NOT EXISTS staff_invitations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email text NOT NULL REFERENCES staff_directory(email) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS staff_invitations_email_idx
  ON staff_invitations (email, expires_at DESC);

CREATE INDEX IF NOT EXISTS accounts_role_idx ON accounts (role);
