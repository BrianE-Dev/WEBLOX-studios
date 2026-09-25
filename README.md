# WEBLOX-studios
Official Weblox Studios website — a technology venture studio building high-quality websites, web applications, digital products, and technology solutions.

## Local API and PostgreSQL

The Node API uses PostgreSQL for accounts, invitations, sessions, enquiries, internship applications, and the staff directory. On startup it applies any unapplied versioned SQL migrations in `server/migrations/`.

1. Create a PostgreSQL login role and database, with the role as database owner.
2. Copy `.env.example` to `.env` and set `DATABASE_URL` to the local connection string. Keep `.env` private; it is ignored by Git.
3. Run `npm run server`. The API checks its database connection, applies migrations, and then listens on port 3001 (or the `PORT`/`API_PORT` environment variable when set).
4. Create the first administrator once with `npm run admin:bootstrap -- "admin@example.com" "Admin name"`. Save the generated one-time password; it is not stored in plaintext. Sign in at `/staff-admin.html` and change it immediately.
5. In the staff administrator page, create invitations and send each one through a private channel. Staff activate the invitation and choose their own password.
6. In another terminal, run `npm run dev` for the Vite app and API proxy.

Authentication sessions are stored in PostgreSQL as token hashes and expire after seven days. Staff portfolio drafts and published snapshots are stored in PostgreSQL; only published snapshots are exposed on the public portfolio page.

## Production API

The API can be deployed as a Node web service from this repository's root with build command `npm install` and start command `npm run server`. Configure `DATABASE_URL` with the hosted PostgreSQL connection string, `APP_ORIGIN` with the exact public frontend origin, and `NODE_ENV=production`. The service listens on the platform-provided `PORT` when available. For Render, keep the API and database in the same region and use the database's internal connection URL in the service settings. Set `API_URL` to the deployed API origin in the frontend host and rebuild the frontend. `API_URL` is included in the browser build because it is the public API address; never put credentials or secrets in it.

Existing staff entries that were created in the old browser-local admin page are not automatically imported; add them through the staff administrator page to issue server-backed invitations.
