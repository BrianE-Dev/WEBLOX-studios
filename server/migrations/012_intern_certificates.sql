CREATE TABLE IF NOT EXISTS internship_certificates (
  id text PRIMARY KEY,
  credential_id text NOT NULL UNIQUE,
  intern_account_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  issued_by_account_id text REFERENCES accounts(id) ON DELETE SET NULL,
  certificate_data jsonb NOT NULL,
  pdf bytea NOT NULL,
  image_svg text NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS internship_certificates_intern_issued_idx
  ON internship_certificates (intern_account_id, issued_at DESC);
