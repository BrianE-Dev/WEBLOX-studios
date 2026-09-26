ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_account_type_check;

UPDATE accounts SET account_type = 'master_admin'
WHERE id = (
  SELECT id FROM accounts WHERE account_type = 'admin' ORDER BY created_at, id LIMIT 1
);

ALTER TABLE accounts
  ADD CONSTRAINT accounts_account_type_check
  CHECK (account_type IN ('master_admin', 'admin', 'staff'));
