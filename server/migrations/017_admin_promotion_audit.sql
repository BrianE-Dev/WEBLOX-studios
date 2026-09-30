ALTER TABLE admin_audit_log
  DROP CONSTRAINT IF EXISTS admin_audit_log_action_check;

ALTER TABLE admin_audit_log
  ADD CONSTRAINT admin_audit_log_action_check
  CHECK (action IN ('added', 'updated', 'removed', 'restored', 'promoted_to_admin'));
