ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'staff';

UPDATE accounts SET account_type = 'admin' WHERE role = 'admin';

DO $$ BEGIN
  ALTER TABLE accounts ADD CONSTRAINT accounts_account_type_check
    CHECK (account_type IN ('admin', 'staff'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
