# WEBLOX Studios Project Documentation

## 1. Project overview

WEBLOX Studios is a multi-page company website and internal staff platform. It includes:

- A public studio website with service enquiries and internship applications.
- Staff sign-in, attendance, check-ins, and account activation.
- Staff and intern administration, plus a master administrator console.
- An inbox for announcements and weekly attendance/check-in reports.
- Staff portfolio editing and publishing.
- A Node.js HTTP API backed by PostgreSQL.

The frontend is built with Vite and React dependencies. Most current pages are separate HTML entry points whose behavior is implemented with browser JavaScript modules. The API runs as a separate Node process.

## 2. Technology stack

- **Frontend/build:** Vite, HTML, CSS, JavaScript modules, React dependencies.
- **Backend:** Node.js built-in HTTP server (ES modules).
- **Database:** PostgreSQL using `pg`.
- **Authentication:** Password hashes using Node `scrypt`; opaque session tokens are stored as SHA-256 hashes in PostgreSQL and delivered in an HttpOnly cookie.
- **Hosting:** Static frontend can be built/deployed on Vercel; API configuration in the repository targets a Render service.

## 3. Repository layout

| Path | Purpose |
| --- | --- |
| `index.html` | Public website entry point. |
| `sign-in.html` | Public/client sign-in page. |
| `portfolio.html` | Public staff portfolio renderer. Reads only published portfolio snapshots. |
| `staff-sign-in.html` | Staff and intern sign-in/activation entry point. |
| `staff-dashboard.html` | Staff home, profile, attendance, inbox, and announcements/reports. |
| `staff-portfolio.html` | Staff portfolio builder. |
| `staff-admin.html` | Staff administrator console for onboarding, directory, activity, and messaging. |
| `master-admin.html` | Master administrator console for admins and organization-wide administration. |
| `intern-portal.html` | Intern check-ins and workspace inbox. |
| `src/main.jsx` | Main public app bootstrapping. |
| `src/App.jsx` | React component placeholder; currently returns `null`. |
| `src/lib/recovered-app.js` | Current public-site app implementation loaded by the main entry. |
| `src/portfolio.js` | Public portfolio rendering. |
| `src/staff-sign-in.js` | Staff sign-in and invitation activation behavior. |
| `src/staff-dashboard.js` | Staff session, attendance, inbox, and dashboard interactions. |
| `src/staff-portfolio.js` | Portfolio editor, autosave, preview, and publish controls. |
| `src/staff-admin.js` | Staff admin sign-in, invitation, directory, activity, and message tools. |
| `src/master-admin.js` | Master admin sign-in and organization administration. |
| `src/intern-portal.js` | Intern check-ins and inbox interactions. |
| `src/lib/staffAuth.js` | Shared browser-side auth/session request helpers. |
| `src/lib/internshipApi.js` | Public internship API client helpers. |
| `src/branded-loader.js` | Branded page loader; minimum display duration is 7,000 ms. |
| `src/styles.css`, `src/portfolio.css` | Shared and portfolio styles. |
| `server/index.js` | HTTP API routes, auth, input checks, scheduled report trigger. |
| `server/store.js` | PostgreSQL data access. |
| `server/migrate.js` | Applies ordered, versioned SQL migrations. |
| `server/migrations/*.sql` | Database schema and incremental changes. |
| `server/bootstrap-admin.js` | One-time first master administrator setup. |
| `vite.config.js` | Vite build inputs and local `/api` proxy. |
| `vercel.json` | Production `/api/*` rewrite to the hosted API service. |
| `.env.example` | Example local environment variables. |

## 4. Prerequisites

- Node.js with npm.
- PostgreSQL, either local or hosted.
- A database and database login owned/authorized to create and update the app schema.
- For production, a static frontend host and a Node-compatible API host.

Install packages from the repository root:

```sh
npm install
```

Useful npm scripts:

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite development server. The `/api` requests proxy to `http://localhost:3001`. |
| `npm run server` | Start the Node API; it migrates the database before listening. |
| `npm run admin:bootstrap -- "email" "Name"` | Create the first master administrator if none exists. |
| `npm run build` | Build all configured HTML entries into `dist/`. |
| `npm run preview` | Preview the Vite production build locally. |

## 5. Local development setup

1. Create a PostgreSQL database and application login. Grant the login ownership or the privileges needed to create and update the schema.
2. Copy `.env.example` to `.env` and set the local connection string:

   ```env
   DATABASE_URL=postgresql://weblox_app:your_password@localhost:5432/weblox_studios
   API_PORT=3001
   APP_ORIGIN=http://localhost:5173
   ```

3. Keep `.env` private and do not commit credentials.
4. Start the API in one terminal:

   ```sh
   npm run server
   ```

   The API applies pending migrations and listens on `PORT`, `API_PORT`, or port `3001` in that precedence order.

5. Start the frontend in another terminal:

   ```sh
   npm run dev
   ```

6. Open the Vite URL printed in the terminal, normally `http://localhost:5173`.
7. Create the initial master administrator once:

   ```sh
   npm run admin:bootstrap -- "admin@example.com" "Administrator Name"
   ```

   Save the generated one-time password immediately. It is only printed at creation time and is stored in the database as a salted password hash. Sign in to `/master-admin.html` and change it. The README currently mentions `/staff-admin.html`; the bootstrap creates a `master_admin` account, so use the master admin page for that account.

## 6. Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string. |
| `PORT` | No | Hosting platform port; takes precedence over `API_PORT`. |
| `API_PORT` | No | Local API port; defaults to `3001`. |
| `APP_ORIGIN` | No | Exact allowed frontend origin for API CORS; defaults to `http://localhost:5173`. |
| `DATABASE_SSL` | No | Set to `true` to enable TLS with certificate validation for PostgreSQL. |
| `DB_POOL_MAX` | No | Maximum PostgreSQL pool size; defaults to `10`. |
| `NODE_ENV` | No | In production, adds the `Secure` attribute to session cookies. |
| `REPORT_TIME_ZONE` | No | IANA timezone used for weekly report scheduling; defaults to `Africa/Lagos`. |

## 7. Product workflows

### 7.1 Public website

The public site is built from the root HTML entry and `src/lib/recovered-app.js`. Visitors can browse studio information and submit service enquiries or internship applications. Those submissions are validated by the API and persisted in PostgreSQL.

### 7.2 Staff and intern access

- Admins invite staff through the staff admin console. Invitations expire after 48 hours and are delivered by copying a URL and sharing it through a private channel.
- Staff activate an invitation and choose their own password. Passwords must be at least 8 characters where set through account creation/password update flows.
- Admins can onboard interns with a temporary password and share it privately.
- Staff and interns authenticate at `/staff-sign-in.html`; the account type determines the destination and available portal.
- Sessions last seven days. Signing out deletes the active server session and clears the cookie.

### 7.3 Attendance and intern check-ins

- Staff, staff administrators, and master administrators can record clock-in and clock-out events through the staff attendance endpoint and dashboard controls.
- Interns submit morning and evening check-ins and can update their entries. Their portal shows the check-in history.
- Admin dashboards show staff activity and intern check-in records.

### 7.4 Announcements and weekly reports

- Staff administrators and master administrators can compose announcements or weekly reports, preview the automatic weekly summary, select recipients individually, and send messages to selected active staff and interns.
- Staff and interns read messages in their workspace inbox; unread messages can be marked as read.
- A timer in the API checks once per minute. At or after Friday 6:30 PM in `REPORT_TIME_ZONE`, it creates the scheduled weekly team report if one has not already been recorded for that date.
- The report summarizes staff clock-ins/clock-outs and intern morning/evening check-ins. It is delivered through the app inbox; the current implementation does not send email.
- Scheduled reports run only while the API process is running. Production should keep at least one API instance continuously available. The database's unique scheduled date prevents duplicate scheduled reports across restarts/instances.

### 7.5 Portfolio builder

- Staff save a draft profile with biography, role/title, location, photo URL, skills, experience, education, contact details, social links, and project cards.
- Draft changes are autosaved through the authenticated portfolio API.
- Publishing creates a public slug and published snapshot. Only that published snapshot is exposed by the public portfolio route. Unpublishing stops public access while preserving the stored draft.
- The master admin can manage staff portfolios from its portfolio tools.
- Portfolio links and images accept HTTP(S) URLs; the backend sanitizes and limits submitted fields and arrays.

### 7.6 Administration

- Staff administrators manage staff invitations, active staff, intern accounts, attendance/activity records, and announcements/reports.
- Master administrators can manage administrator accounts and organization-wide staff/intern records, in addition to portfolio and reporting tools.
- Removal/deactivation and restore actions are audited where supported by the data store. The last master/admin account cannot be removed, and an admin cannot remove their own administrator account.

## 8. API reference

All API routes are under `/api`. Authenticated routes use the `weblox_session` HttpOnly cookie. The API applies origin checks against `APP_ORIGIN` and allows credentialed requests from that configured origin.

### Public and authentication routes

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Health check. |
| `POST` | `/api/enquiries` | Submit a service enquiry. |
| `POST` | `/api/internship-applications` | Submit a public internship application. |
| `GET` | `/api/portfolios/public/:slug` | Fetch a published staff portfolio. |
| `POST` | `/api/auth/activate` | Activate a staff invitation and set credentials. |
| `POST` | `/api/auth/login` | Authenticate and create a session cookie. |
| `GET` | `/api/auth/session` | Return the current authenticated account. |
| `POST` | `/api/auth/password` | Change the current password. |
| `POST` | `/api/auth/logout` | Delete the current session and clear its cookie. |

### Staff and intern routes

| Method | Path | Purpose |
| --- | --- | --- |
| `GET`, `PUT` | `/api/portfolios/me` | Read or save the signed-in staff member's portfolio draft. |
| `POST` | `/api/portfolios/me/publish` | Publish the current draft. |
| `POST` | `/api/portfolios/me/unpublish` | Unpublish the portfolio. |
| `GET`, `POST` | `/api/staff/attendance` | Read today's attendance or clock in/out. |
| `GET`, `POST` | `/api/intern/me/checkins` | Read or submit an intern check-in. |
| `GET` | `/api/workspace/inbox` | Read the current account's announcements/reports. |
| `POST` | `/api/workspace/inbox/:id/read` | Mark a message as read. |

### Administrator routes

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/admin/staff/invitations` | Create a staff invitation. |
| `GET` | `/api/admin/staff` | List staff and invitation records. |
| `GET`, `POST` | `/api/admin/interns` | List interns or onboard one. |
| `GET` | `/api/admin/activity` | Read staff activity and intern check-ins. |
| `GET` | `/api/admin/workspace/recipients` | List selectable recipients; master admin also gets sent-message history. |
| `GET` | `/api/admin/workspace/report-preview` | Generate the current weekly report preview. |
| `POST` | `/api/admin/workspace/messages` | Send an announcement/report to selected recipients. |
| `GET`, `POST` | `/api/admin/admins` | Master admin list/create administrator accounts. |
| `DELETE` | `/api/admin/admins/:id` | Master admin remove an administrator, subject to safeguards. |
| `GET`, `PUT`, `DELETE` | `/api/admin/staff/:id` | Read/update/remove a staff account. |
| `GET`, `PUT`, `DELETE` | `/api/admin/interns/:id` | Read/update/remove an intern account. |
| `POST` | `/api/admin/staff/:id/portfolio/publish` | Admin publish a staff portfolio. |
| `POST` | `/api/admin/staff/:id/portfolio/unpublish` | Admin unpublish a staff portfolio. |

Some restore and pending-invitation routes use additional `/restore` or `/api/admin/staff-directory/:email` paths; refer to `server/index.js` for exact authorization and request schemas.

## 9. Database and migrations

`server/migrate.js` reads SQL files in `server/migrations/` in filename order. It records applied migration IDs in `schema_migrations`; migrations are run before the API begins listening and by the bootstrap command.

The migration set covers:

- Accounts, enquiries, internship applications, staff directory, and portfolios.
- Account types, invitations, and PostgreSQL-backed sessions.
- Activity and audit events; gender and job details.
- Staff attendance and intern check-ins.
- Workspace announcements, report recipients/read state, and scheduled report deduplication.

Data access and transaction logic live in `server/store.js`. Back up PostgreSQL before production schema maintenance. Existing browser-local staff entries from older versions are not automatically imported; use the admin onboarding flow to create server-backed records.

## 10. Build and deployment

### Frontend

Run `npm run build`. Vite emits the configured pages and assets to `dist/`. The Vercel configuration rewrites `/api/:path*` to `https://weblox-api.onrender.com/api/:path*` and disables rewrite response caching for API requests. Update this target if the API service URL changes.

### API

Deploy the repository's Node service with:

- Build/install command: `npm install`
- Start command: `npm run server`
- `DATABASE_URL`: hosted PostgreSQL connection string
- `APP_ORIGIN`: exact production frontend origin, including scheme
- `NODE_ENV=production`
- Optional `DATABASE_SSL=true` if required by the database provider
- `REPORT_TIME_ZONE=Africa/Lagos` unless the organization chooses another timezone

The API process runs migrations on startup. For production, use a managed PostgreSQL backup policy, keep the API service continuously running for scheduled reports, and monitor its logs for migration, database, or scheduled-report errors.

## 11. Security and operational notes

- Never commit `.env`, database credentials, generated bootstrap passwords, or user invitation links.
- Share staff invitation URLs and intern temporary passwords through private channels.
- Passwords are stored as salted `scrypt` hashes; raw session tokens are not stored in the database.
- Session cookies are HttpOnly and SameSite=Lax; `Secure` is enabled when `NODE_ENV=production`.
- The API validates request origins, requires sessions on protected routes, checks account types, and applies bounds/sanitization to portfolio fields and message inputs.
- Use HTTPS for the deployed frontend/API and secure PostgreSQL connections in production.
- Maintain backups and restrict database/network access to the application service and trusted operators.
- Email delivery is not configured: invitations are copied for private sharing and internal messages are delivered to the in-app inbox.

## 12. Troubleshooting

| Symptom | Checks |
| --- | --- |
| API exits before listening | Check `DATABASE_URL`, PostgreSQL availability/permissions, and migration output. |
| Browser reports failed API requests | Confirm API is running, Vite `/api` proxy is active locally, and `APP_ORIGIN` exactly matches the browser origin. |
| Production API requests fail | Check the Vercel rewrite destination, Render service status, `APP_ORIGIN`, HTTPS, and database connectivity. |
| Login fails after bootstrap | Use the one-time password printed by bootstrap; if lost, use a controlled database/admin recovery procedure. Bootstrap cannot create a second initial admin. |
| Staff invitation cannot activate | Check expiry (48 hours), exact invited email, and whether it has already been activated. Create a fresh invitation if needed. |
| Weekly report did not arrive | Check that the API was running at Friday 6:30 PM or afterward, the configured timezone, active recipient accounts, database logs, and `scheduled_report_runs`. |
| Public portfolio is unavailable | Confirm the account has published a portfolio, verify the URL slug, and check that the snapshot is still published. |

## 13. Change and extension guidance

- Add API behavior in `server/index.js`, persistent operations in `server/store.js`, and schema changes as a new numbered SQL migration.
- Add or update browser behavior in the page's corresponding module under `src/` and keep element IDs synchronized with its HTML entry.
- Add new standalone pages to `build.rollupOptions.input` in `vite.config.js` so they are included in production builds.
- Keep authentication and role checks on the API; hiding a frontend control is not authorization.
- Keep the production API rewrite and frontend origin settings aligned when domains change.

