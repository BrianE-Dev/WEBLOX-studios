CREATE TABLE IF NOT EXISTS workspace_messages (
  id text PRIMARY KEY,
  message_type text NOT NULL CHECK (message_type IN ('announcement', 'weekly_report')),
  subject text NOT NULL,
  body text NOT NULL,
  sender_account_id text REFERENCES accounts(id) ON DELETE SET NULL,
  sender_name text NOT NULL,
  sender_email text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspace_message_recipients (
  message_id text NOT NULL REFERENCES workspace_messages(id) ON DELETE CASCADE,
  account_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  delivered_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  PRIMARY KEY (message_id, account_id)
);
CREATE INDEX IF NOT EXISTS workspace_message_recipient_inbox_idx
  ON workspace_message_recipients (account_id, delivered_at DESC);

CREATE TABLE IF NOT EXISTS scheduled_report_runs (
  report_date date PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  message_id text REFERENCES workspace_messages(id) ON DELETE SET NULL
);
