export function createPostgresStore(pool) {
  return {
    async findAccountByEmail(email) {
      const { rows } = await pool.query(
        `SELECT id, email, name, role, account_type AS "accountType", salt, hash, created_at AS "createdAt"
         FROM accounts WHERE email = $1`,
        [email.toLowerCase()],
      );
      return rows[0] ?? null;
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
        `SELECT d.email, d.name, d.role, (a.id IS NOT NULL) AS activated,
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

    async createStaffInvitation({ email, name, role, tokenHash, expiresAt }) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const existing = await client.query("SELECT 1 FROM accounts WHERE email = $1", [email]);
        if (existing.rowCount) {
          const error = new Error("A login account already exists for this email.");
          error.code = "STAFF_ACCOUNT_EXISTS";
          throw error;
        }
        await client.query(
          `INSERT INTO staff_directory (email, name, role)
           VALUES ($1, $2, $3)
           ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, updated_at = now()`,
          [email, name, role],
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
          `INSERT INTO accounts (id, email, name, role, account_type, salt, hash)
           SELECT $1, d.email, d.name, d.role, 'staff', $2, $3
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
         WHERE s.token_hash = $1 AND s.expires_at > now()`,
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
