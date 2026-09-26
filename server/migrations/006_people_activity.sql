ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_account_type_check;
ALTER TABLE accounts
  ADD CONSTRAINT accounts_account_type_check
  CHECK (account_type IN ('master_admin', 'admin', 'staff', 'intern'));
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS staff_signins (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  signed_in_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS staff_signins_date_idx ON staff_signins (signed_in_at DESC);

CREATE TABLE IF NOT EXISTS staff_attendance (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  attendance_date date NOT NULL DEFAULT CURRENT_DATE,
  clock_in_at timestamptz,
  clock_out_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, attendance_date)
);
CREATE INDEX IF NOT EXISTS staff_attendance_date_idx ON staff_attendance (attendance_date DESC);

CREATE TABLE IF NOT EXISTS intern_checkins (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  checkin_date date NOT NULL DEFAULT CURRENT_DATE,
  morning text NOT NULL DEFAULT '',
  evening text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, checkin_date)
);
CREATE INDEX IF NOT EXISTS intern_checkins_date_idx ON intern_checkins (checkin_date DESC);
