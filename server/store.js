async function appendAdminAudit(db, event) {
  await db.query(
    `INSERT INTO admin_audit_log
      (person_type, person_account_id, person_email, person_name, action, role, job_type,
       performed_by_account_id, performed_by_name, performed_by_email, details)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)`,
    [event.personType, event.personAccountId || null, event.personEmail, event.personName,
      event.action, event.role || '', event.jobType || '', event.actor?.id || null,
      event.actor?.name || 'Unknown administrator', event.actor?.email || '', JSON.stringify(event.details || {})],
  )
}

export function createPostgresStore(pool) {
  return {
    async findAccountByEmail(email) {
      const { rows } = await pool.query(
        `SELECT id, email, name, role, account_type AS "accountType", salt, hash, created_at AS "createdAt"
         FROM accounts WHERE email = $1 AND active = true`,
        [email.toLowerCase()],
      );
      return rows[0] ?? null;
    },

    async listAdmins(currentId) {
      const { rows } = await pool.query(
        `SELECT id, email, name, gender, created_at AS "createdAt", (id = $1) AS "isCurrent"
         FROM accounts WHERE account_type IN ('master_admin', 'admin') ORDER BY created_at, email`,
        [currentId],
      );
      return rows;
    },

    async createAdmin({ id, email, name, gender, salt, hash }) {
      await pool.query(
        `INSERT INTO accounts (id, email, name, role, account_type, salt, hash, gender)
         VALUES ($1, $2, $3, 'Administrator', 'admin', $4, $5, $6)`,
        [id, email, name, salt, hash, gender],
      );
    },

    async removeAdmin(id, currentId) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const lock = await client.query(
          "SELECT id FROM accounts WHERE account_type = 'admin' FOR UPDATE",
        );
        if (id === currentId) {
          await client.query("ROLLBACK");
          return "CURRENT_ACCOUNT";
        }
        if (lock.rowCount <= 1) {
          await client.query("ROLLBACK");
          return "LAST_ADMIN";
        }
        const removed = await client.query(
          "DELETE FROM accounts WHERE id = $1 AND account_type = 'admin'",
          [id],
        );
        await client.query("COMMIT");
        return removed.rowCount ? "REMOVED" : "NOT_FOUND";
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async createEnquiry(enquiry) {
      const { rows } = await pool.query(
        `INSERT INTO enquiries
          (name, company, email, phone, project_type, budget_range, description, timeline)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, name, company, email, phone, project_type AS "projectType",
           budget_range AS "budgetRange", description, timeline, created_at AS "createdAt"`,
        [enquiry.name, enquiry.company, enquiry.email, enquiry.phone, enquiry.projectType,
          enquiry.budgetRange, enquiry.description, enquiry.timeline],
      );
      return rows[0];
    },

    async createInternshipApplication(application) {
      const { rows } = await pool.query(
        `INSERT INTO internship_applications (email, payload)
         VALUES ($1, $2::jsonb)
         RETURNING id, created_at AS "createdAt"`,
        [application.email, JSON.stringify(application)],
      );
      return rows[0];
    },

    async listStaff() {
      const { rows } = await pool.query(
        `SELECT a.id, d.email, d.name, d.role, d.gender, d.job_type AS "jobType",
           d.created_at AS "createdAt", d.created_by_name AS "createdByName",
           d.created_by_email AS "createdByEmail", (a.id IS NOT NULL) AS activated,
           COALESCE(a.active, false) AS active,
           i.expires_at AS "inviteExpiresAt"
         FROM staff_directory d
         LEFT JOIN accounts a ON a.email = d.email AND a.account_type = 'staff'
         LEFT JOIN LATERAL (
           SELECT expires_at FROM staff_invitations
           WHERE email = d.email AND used_at IS NULL AND expires_at > now()
           ORDER BY created_at DESC LIMIT 1
         ) i ON true
         ORDER BY d.name, d.email`,
      );
      return rows;
    },

    async listPeople(accountType) {
      const { rows } = await pool.query(
        `SELECT id, email, name, role, gender, job_type AS "jobType", active, created_at AS "createdAt",
           created_by_name AS "createdByName", created_by_email AS "createdByEmail"
         FROM accounts WHERE account_type = $1 ORDER BY name, email`, [accountType],
      );
      return rows;
    },

    async listReportRecipients() {
      const { rows } = await pool.query(
        `SELECT id, email, name, account_type AS "accountType", role
         FROM accounts WHERE active = true AND account_type IN ('staff', 'intern') ORDER BY name, email`,
      );
      return rows;
    },

    async sendWorkspaceMessage({ type, subject, body, sender, recipientIds, reportDate = null }) {
      const id = randomUUID();
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `INSERT INTO workspace_messages (id, message_type, subject, body, sender_account_id, sender_name, sender_email)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [id, type, subject, body, sender?.id || null, sender?.name || 'WEBLOX Reports', sender?.email || ''],
        );
        if (recipientIds.length) await client.query(
          `INSERT INTO workspace_message_recipients (message_id, account_id)
           SELECT $1, id FROM accounts WHERE active = true AND account_type IN ('staff', 'intern') AND id = ANY($2::text[])
           ON CONFLICT DO NOTHING`, [id, recipientIds],
        );
        if (reportDate) await client.query(
          'INSERT INTO scheduled_report_runs (report_date, message_id) VALUES ($1, $2) ON CONFLICT (report_date) DO UPDATE SET message_id = EXCLUDED.message_id',
          [reportDate, id],
        );
        await client.query('COMMIT');
        return { id, recipientCount: recipientIds.length };
      } catch (error) { await client.query('ROLLBACK'); throw error }
      finally { client.release() }
    },

    async listInbox(accountId) {
      const { rows } = await pool.query(
        `SELECT m.id, m.message_type AS type, m.subject, m.body, m.sender_name AS "senderName",
           m.sender_email AS "senderEmail", m.created_at AS "createdAt", r.read_at AS "readAt"
         FROM workspace_message_recipients r JOIN workspace_messages m ON m.id = r.message_id
         WHERE r.account_id = $1 ORDER BY m.created_at DESC LIMIT 200`, [accountId],
      );
      return rows;
    },

    async markInboxRead(accountId, messageId) {
      const { rowCount } = await pool.query(
        `UPDATE workspace_message_recipients SET read_at = COALESCE(read_at, now())
         WHERE account_id = $1 AND message_id = $2`, [accountId, messageId],
      );
      return rowCount > 0;
    },

    async getWeeklyReportData() {
      const [{ rows: people }, { rows: attendance }, { rows: checkins }] = await Promise.all([
        pool.query(`SELECT id, name, email, role, account_type AS "accountType" FROM accounts WHERE active = true AND account_type IN ('staff', 'intern') ORDER BY account_type, name`),
        pool.query(`SELECT a.id AS "accountId", a.name, a.email, d.attendance_date AS date, d.clock_in_at AS "clockInAt", d.clock_out_at AS "clockOutAt" FROM staff_attendance d JOIN accounts a ON a.id = d.account_id WHERE d.attendance_date >= CURRENT_DATE - INTERVAL '6 days' AND a.active = true ORDER BY a.name, d.attendance_date`),
        pool.query(`SELECT a.id AS "accountId", a.name, a.email, c.checkin_date AS date, c.morning, c.evening FROM intern_checkins c JOIN accounts a ON a.id = c.account_id WHERE c.checkin_date >= CURRENT_DATE - INTERVAL '6 days' AND a.active = true ORDER BY a.name, c.checkin_date`),
      ]);
      return { people, attendance, checkins };
    },

    async hasScheduledReport(reportDate) {
      const { rowCount } = await pool.query('SELECT 1 FROM scheduled_report_runs WHERE report_date = $1', [reportDate]);
      return rowCount > 0;
    },

    async attachScheduledReport(reportDate, messageId) {
      await pool.query('UPDATE scheduled_report_runs SET message_id = $2 WHERE report_date = $1', [reportDate, messageId]);
    },

    async findStaffAccount(id) {
      const { rows } = await pool.query(
        `SELECT id, email, name, role, account_type AS "accountType"
         FROM accounts WHERE id = $1 AND account_type = 'staff' AND active = true`, [id],
      );
      return rows[0] ?? null;
    },

    async updateStaff({ id, oldEmail, email, name, role, jobType, gender, actor }) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const before = await client.query("SELECT email, name, role, job_type AS \"jobType\" FROM accounts WHERE id = $1 AND account_type = 'staff' FOR UPDATE", [id]);
        const { rows } = await client.query(
          `UPDATE accounts SET email = $2, name = $3, role = $4, job_type = $5, gender = $6
           WHERE id = $1 AND account_type = 'staff'
           RETURNING id, email, name, role, active`,
          [id, email, name, role, jobType, gender],
        );
        if (rows[0]) {
          const previousEmail = before.rows[0]?.email || oldEmail;
          await client.query("DELETE FROM staff_invitations WHERE email = $1", [previousEmail]);
          await client.query(
            `UPDATE staff_directory SET email = $2, name = $3, role = $4, job_type = $5, gender = $6, updated_at = now()
             WHERE email = $1`, [previousEmail, email, name, role, jobType, gender],
          );
          await appendAdminAudit(client, {
            personType: 'staff', personAccountId: id, personEmail: email, personName: name,
            action: 'updated', role, jobType, actor,
            details: { before: before.rows[0] || null, after: { email, name, role, jobType, gender } },
          })
        }
        await client.query("COMMIT");
        return rows[0] ?? null;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally { client.release(); }
    },

    async updatePendingStaff(email, name, role, jobType, gender, actor) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const previous = await client.query('SELECT name, role, job_type AS "jobType" FROM staff_directory WHERE email = $1 AND NOT EXISTS (SELECT 1 FROM accounts WHERE accounts.email = $1 AND account_type = \'staff\') FOR UPDATE', [email]);
        if (!previous.rowCount) { await client.query('ROLLBACK'); return false; }
        await client.query('UPDATE staff_directory SET name = $2, role = $3, job_type = $4, gender = $5, updated_at = now() WHERE email = $1', [email, name, role, jobType, gender]);
        await appendAdminAudit(client, { personType: 'staff', personEmail: email, personName: name, action: 'updated', role, jobType, actor, details: { before: previous.rows[0] } });
        await client.query('COMMIT');
        return true;
      } catch (error) { await client.query('ROLLBACK'); throw error; }
      finally { client.release(); }
    },

    async removePendingStaff(email, actor) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await client.query(`DELETE FROM staff_directory d WHERE d.email = $1
          AND NOT EXISTS (SELECT 1 FROM accounts WHERE accounts.email = d.email AND account_type = 'staff')
          RETURNING email, name, role, job_type AS "jobType"`, [email]);
        if (!result.rows[0]) { await client.query('ROLLBACK'); return false; }
        await appendAdminAudit(client, { personType: 'staff', personEmail: email, personName: result.rows[0].name, action: 'removed', role: result.rows[0].role, jobType: result.rows[0].jobType, actor });
        await client.query('COMMIT');
        return true;
      } catch (error) { await client.query('ROLLBACK'); throw error; }
      finally { client.release(); }
    },

    async setPersonActive(id, accountType, active, actor) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const { rows } = await client.query(
          `UPDATE accounts SET active = $3 WHERE id = $1 AND account_type = $2 AND active <> $3
           RETURNING id, email, name, role, job_type AS "jobType"`, [id, accountType, active],
        );
        if (!rows[0]) { await client.query('ROLLBACK'); return false; }
        await appendAdminAudit(client, {
          personType: accountType, personAccountId: id, personEmail: rows[0].email,
          personName: rows[0].name, action: active ? 'restored' : 'removed',
          role: rows[0].role, jobType: rows[0].jobType, actor,
        })
        await client.query('COMMIT');
        return true;
      } catch (error) { await client.query('ROLLBACK'); throw error; }
      finally { client.release(); }
    },

    async createIntern({ id, email, name, role, jobType, gender, salt, hash, actor }) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
        `INSERT INTO accounts (id, email, name, role, account_type, salt, hash, job_type, gender,
           created_by_account_id, created_by_name, created_by_email)
         VALUES ($1, $2, $3, $4, 'intern', $5, $6, $7, $8, $9, $10, $11)`,
        [id, email, name, role, salt, hash, jobType, gender, actor.id, actor.name, actor.email],
        );
        await appendAdminAudit(client, { personType: 'intern', personAccountId: id, personEmail: email, personName: name, action: 'added', role, jobType, actor });
        await client.query('COMMIT');
      } catch (error) { await client.query('ROLLBACK'); throw error; }
      finally { client.release(); }
    },

    async updateIntern({ id, email, name, role, jobType, gender, actor }) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const before = await client.query("SELECT email, name, role, job_type AS \"jobType\" FROM accounts WHERE id = $1 AND account_type = 'intern' FOR UPDATE", [id]);
        const { rows } = await client.query(
        `UPDATE accounts SET email = $2, name = $3, role = $4, job_type = $5, gender = $6
         WHERE id = $1 AND account_type = 'intern'
         RETURNING id, email, name, role, job_type AS "jobType", gender, active`, [id, email, name, role, jobType, gender],
        );
        if (!rows[0]) { await client.query('ROLLBACK'); return null; }
        await appendAdminAudit(client, {
        personType: 'intern', personAccountId: id, personEmail: email, personName: name,
        action: 'updated', role, jobType, actor,
        details: { before: before.rows[0] || null, after: { email, name, role, jobType, gender } },
        });
        await client.query('COMMIT');
        return rows[0];
      } catch (error) { await client.query('ROLLBACK'); throw error; }
      finally { client.release(); }
    },

    async listAdminAudit() {
      const { rows } = await pool.query(
        `SELECT id, person_type AS "personType", person_email AS "personEmail",
           person_name AS "personName", action, role, job_type AS "jobType",
           performed_by_name AS "performedByName", performed_by_email AS "performedByEmail",
           details, created_at AS "createdAt"
         FROM admin_audit_log ORDER BY created_at DESC LIMIT 500`,
      );
      return rows;
    },

    async recordStaffSignin(accountId) {
      await pool.query("INSERT INTO staff_signins (account_id) VALUES ($1)", [accountId]);
    },

    async recordAttendance(accountId, action) {
      const column = action === "clock_in" ? "clock_in_at" : "clock_out_at";
      const { rows } = await pool.query(
        `INSERT INTO staff_attendance (account_id, attendance_date, ${column})
         VALUES ($1, CURRENT_DATE, now())
         ON CONFLICT (account_id, attendance_date) DO UPDATE
           SET ${column} = EXCLUDED.${column}, updated_at = now()
         RETURNING attendance_date AS date, clock_in_at AS "clockInAt", clock_out_at AS "clockOutAt"`,
        [accountId],
      );
      return rows[0];
    },

    async getAttendance(accountId) {
      const { rows } = await pool.query(
        `SELECT attendance_date AS date, clock_in_at AS "clockInAt", clock_out_at AS "clockOutAt"
         FROM staff_attendance WHERE account_id = $1 AND attendance_date = CURRENT_DATE`, [accountId],
      );
      return rows[0] ?? null;
    },

    async listStaffActivity() {
      const { rows } = await pool.query(
        `SELECT a.name, a.email, 'login' AS "eventType", s.signed_in_at AS "occurredAt",
           NULL::date AS "attendanceDate", NULL::timestamptz AS "clockInAt", NULL::timestamptz AS "clockOutAt"
         FROM staff_signins s JOIN accounts a ON a.id = s.account_id WHERE a.account_type = 'staff'
         UNION ALL
         SELECT a.name, a.email, 'attendance' AS "eventType", d.updated_at AS "occurredAt",
           d.attendance_date AS "attendanceDate", d.clock_in_at AS "clockInAt", d.clock_out_at AS "clockOutAt"
         FROM staff_attendance d JOIN accounts a ON a.id = d.account_id WHERE a.account_type = 'staff'
         ORDER BY "occurredAt" DESC LIMIT 1000`,
      );
      return rows;
    },

    async saveInternCheckin(accountId, slot, text) {
      const { rows } = await pool.query(
        `INSERT INTO intern_checkins (account_id, checkin_date, ${slot})
         VALUES ($1, CURRENT_DATE, $2)
         ON CONFLICT (account_id, checkin_date) DO UPDATE
           SET ${slot} = EXCLUDED.${slot}, updated_at = now()
         RETURNING checkin_date AS date, morning, evening, updated_at AS "updatedAt"`, [accountId, text],
      );
      return rows[0];
    },

    async listInternCheckins() {
      const { rows } = await pool.query(
        `SELECT i.id AS "accountId", i.name, i.email, c.checkin_date AS date,
           c.morning, c.evening, c.updated_at AS "updatedAt"
         FROM accounts i LEFT JOIN intern_checkins c ON c.account_id = i.id
         WHERE i.account_type = 'intern' ORDER BY c.checkin_date DESC NULLS LAST, i.name`,
      );
      return rows;
    },

    async listMyInternCheckins(accountId) {
      const { rows } = await pool.query(
        `SELECT c.checkin_date AS date, c.morning, c.evening, c.updated_at AS "updatedAt"
         FROM intern_checkins c WHERE c.account_id = $1 ORDER BY c.checkin_date DESC`, [accountId],
      );
      return rows;
    },

    async createStaffInvitation({ email, name, role, jobType, gender, tokenHash, expiresAt, actor }) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const prior = await client.query("SELECT email, name, role, job_type AS \"jobType\" FROM staff_directory WHERE email = $1 FOR UPDATE", [email]);
        const existing = await client.query("SELECT 1 FROM accounts WHERE email = $1", [email]);
        if (existing.rowCount) {
          const error = new Error("A login account already exists for this email.");
          error.code = "STAFF_ACCOUNT_EXISTS";
          throw error;
        }
        await client.query(
          `INSERT INTO staff_directory (email, name, role, job_type, gender, created_by_account_id, created_by_name, created_by_email)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, job_type = EXCLUDED.job_type, gender = EXCLUDED.gender, updated_at = now()`,
          [email, name, role, jobType, gender, actor.id, actor.name, actor.email],
        );
        await client.query(
          `UPDATE staff_invitations SET used_at = now()
           WHERE email = $1 AND used_at IS NULL`,
          [email],
        );
        await client.query(
          `INSERT INTO staff_invitations (email, token_hash, expires_at)
           VALUES ($1, $2, $3)`,
          [email, tokenHash, expiresAt],
        );
        await appendAdminAudit(client, {
          personType: 'staff', personEmail: email, personName: name,
          action: prior.rowCount ? 'updated' : 'added', role, jobType, actor,
          details: prior.rowCount ? { previous: prior.rows[0] } : {},
        })
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async activateStaffInvitation({ email, tokenHash, account }) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const invitation = await client.query(
          `SELECT id FROM staff_invitations
           WHERE email = $1 AND token_hash = $2 AND used_at IS NULL AND expires_at > now()
           FOR UPDATE`,
          [email, tokenHash],
        );
        if (!invitation.rowCount) {
          await client.query("ROLLBACK");
          return false;
        }
        await client.query(
          `INSERT INTO accounts (id, email, name, role, account_type, salt, hash, job_type, gender,
             created_by_account_id, created_by_name, created_by_email)
           SELECT $1, d.email, d.name, d.role, 'staff', $2, $3, d.job_type, d.gender,
             d.created_by_account_id, d.created_by_name, d.created_by_email
           FROM staff_directory d WHERE d.email = $4`,
          [account.id, account.salt, account.hash, email],
        );
        await client.query("UPDATE staff_invitations SET used_at = now() WHERE id = $1", [invitation.rows[0].id]);
        await client.query("COMMIT");
        return true;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async updatePassword(id, salt, hash) {
      const { rowCount } = await pool.query(
        "UPDATE accounts SET salt = $2, hash = $3 WHERE id = $1",
        [id, salt, hash],
      );
      return rowCount === 1;
    },

    async createSession(accountId, tokenHash, expiresAt) {
      await pool.query("DELETE FROM auth_sessions WHERE expires_at <= now()");
      await pool.query(
        "INSERT INTO auth_sessions (token_hash, account_id, expires_at) VALUES ($1, $2, $3)",
        [tokenHash, accountId, expiresAt],
      );
    },

    async findSession(tokenHash) {
      const { rows } = await pool.query(
        `SELECT a.id, a.email, a.name, a.role, a.account_type AS "accountType",
           s.expires_at AS "expiresAt"
         FROM auth_sessions s JOIN accounts a ON a.id = s.account_id
         WHERE s.token_hash = $1 AND s.expires_at > now() AND a.active = true`,
        [tokenHash],
      );
      return rows[0] ?? null;
    },

    async deleteSession(tokenHash) {
      await pool.query("DELETE FROM auth_sessions WHERE token_hash = $1", [tokenHash]);
    },

    async deleteOtherSessions(accountId, exceptTokenHash) {
      await pool.query("DELETE FROM auth_sessions WHERE account_id = $1 AND token_hash <> $2", [accountId, exceptTokenHash]);
    },

    async getPortfolio(accountId) {
      const { rows } = await pool.query(
        `SELECT account_id AS "accountId", public_slug AS slug, status, draft, published,
           updated_at AS "updatedAt", published_at AS "publishedAt"
         FROM staff_portfolios WHERE account_id = $1`,
        [accountId],
      );
      return rows[0] ?? null;
    },

    async savePortfolioDraft(accountId, draft) {
      const { rows } = await pool.query(
        `INSERT INTO staff_portfolios (account_id, draft)
         VALUES ($1, $2::jsonb)
         ON CONFLICT (account_id) DO UPDATE
           SET draft = EXCLUDED.draft, updated_at = now()
         RETURNING account_id AS "accountId", public_slug AS slug, status, draft, published,
           updated_at AS "updatedAt", published_at AS "publishedAt"`,
        [accountId, JSON.stringify(draft)],
      );
      return rows[0];
    },

    async recordPortfolioAdminEdit({ accountId, actor }) {
      await appendAdminAudit(pool, {
        personType: 'staff', personAccountId: accountId, personEmail: '', personName: '',
        action: 'portfolio_updated', role: '', jobType: '', actor,
      });
    },

    async publishPortfolio(accountId, slugBase) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const { rows } = await client.query(
          "SELECT public_slug AS slug, draft FROM staff_portfolios WHERE account_id = $1 FOR UPDATE",
          [accountId],
        );
        if (!rows.length) {
          await client.query("ROLLBACK");
          return null;
        }
        const slug = rows[0].slug || `${slugBase}-${accountId.replace(/[^a-z0-9]/gi, "").slice(-12).toLowerCase()}`;
        const updated = await client.query(
          `UPDATE staff_portfolios SET public_slug = $2, status = 'published',
             published = draft, published_at = now(), updated_at = now()
           WHERE account_id = $1
           RETURNING account_id AS "accountId", public_slug AS slug, status, draft, published,
             updated_at AS "updatedAt", published_at AS "publishedAt"`,
          [accountId, slug],
        );
        await client.query("COMMIT");
        return updated.rows[0];
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async unpublishPortfolio(accountId) {
      const { rows } = await pool.query(
        `UPDATE staff_portfolios SET status = 'unpublished', updated_at = now()
         WHERE account_id = $1
         RETURNING account_id AS "accountId", public_slug AS slug, status, draft, published,
           updated_at AS "updatedAt", published_at AS "publishedAt"`,
        [accountId],
      );
      return rows[0] ?? null;
    },

    async findPublishedPortfolio(slug) {
      const { rows } = await pool.query(
        `SELECT public_slug AS slug, published, published_at AS "publishedAt"
         FROM staff_portfolios WHERE public_slug = $1 AND status = 'published'`,
        [slug],
      );
      return rows[0] ?? null;
    },
  };
}
