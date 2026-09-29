CREATE TABLE IF NOT EXISTS staff_attendance_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('clock_in', 'clock_out')),
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS staff_attendance_events_occurred_idx
  ON staff_attendance_events (occurred_at DESC);

INSERT INTO staff_attendance_events (account_id, action, occurred_at)
SELECT account_id, 'clock_in', clock_in_at
FROM staff_attendance
WHERE clock_in_at IS NOT NULL;

INSERT INTO staff_attendance_events (account_id, action, occurred_at)
SELECT account_id, 'clock_out', clock_out_at
FROM staff_attendance
WHERE clock_out_at IS NOT NULL;
