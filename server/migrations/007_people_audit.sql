ALTER TABLE staff_directory ADD COLUMN IF NOT EXISTS job_type text NOT NULL DEFAULT 'Unspecified';
ALTER TABLE staff_directory ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE staff_directory ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE staff_directory ADD COLUMN IF NOT EXISTS created_by_account_id text;
ALTER TABLE staff_directory ADD COLUMN IF NOT EXISTS created_by_name text NOT NULL DEFAULT 'Existing record';
ALTER TABLE staff_directory ADD COLUMN IF NOT EXISTS created_by_email text NOT NULL DEFAULT '';

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS job_type text NOT NULL DEFAULT '';
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS created_by_account_id text;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS created_by_name text NOT NULL DEFAULT 'Existing record';
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS created_by_email text NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  person_type text NOT NULL CHECK (person_type IN ('staff', 'intern')),
  person_account_id text,
  person_email text NOT NULL,
  person_name text NOT NULL,
  action text NOT NULL CHECK (action IN ('added', 'updated', 'removed', 'restored')),
  role text NOT NULL DEFAULT '',
  job_type text NOT NULL DEFAULT '',
  performed_by_account_id text,
  performed_by_name text NOT NULL,
  performed_by_email text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_audit_log_created_idx ON admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_person_idx ON admin_audit_log (person_type, person_email, created_at DESC);
