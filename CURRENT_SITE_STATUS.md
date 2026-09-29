# WEBLOX Studios: Current Site Status

**Review date:** 2026-09-28  
**Scope:** What is present in this repository's current frontend and API implementation. This is a code-based feature inventory; it does not certify that a live production deployment is configured or that every workflow has been manually exercised.

## What the site currently does

WEBLOX Studios is a public company website with a React-based staff and intern workspace. The React frontend uses Vite and React Router, with a Node.js HTTP API and PostgreSQL database for persistent application data.

### Public website

- The homepage presents WEBLOX Studios, its services, product/venture focus, process, and company information.
- Public routes exist for ventures, services, the studio, careers, insights, contact, and the internship program. **Studio, Insights, and Careers are unfinished and should be treated as placeholders until the workflow below is completed.**
- Visitors can submit project enquiries through the homepage form. The API validates required information and stores submissions in PostgreSQL.
- Prospective interns can submit an application with personal/program details and a CV or résumé attachment. The API accepts PDF, DOC, and DOCX files up to 5 MB and stores applications for administrator review.
- The homepage offers a light/dark appearance toggle. Theme choice is saved in browser local storage.

### Staff and intern workspace

- Staff administrators can create staff invitations. Invitees activate an invitation and set a password. Intern accounts are created by an administrator with an initial password.
- Staff and interns sign in to the workspace. Authenticated sessions are stored server-side and use an HttpOnly cookie, with a seven-day lifetime.
- Staff can record attendance (clock in/out); interns can submit morning and evening check-ins and view their history.
- Staff and interns can read workspace inbox messages and mark messages as read.
- The staff portfolio editor supports a profile, skills, career history, projects, education, links, and other optional sections. Drafts can be saved and portfolios published or unpublished. Public portfolio pages display published data.
- Staff, interns, and administrators can manage account-scoped image/document libraries. Supported files include JPEG, PNG, WebP, GIF, and PDF, with per-file and account storage limits enforced by the API.
- Dashboard settings include light/dark themes. Interns can also manage a profile photo.
- Interns can view certificates issued to them and download their certificate PDF. The administrator console can issue certificates and manage certificate details/assets.

### Administration and operations

- Staff administrators can manage staff and intern records, invitations, attendance/check-in activity, internship applicants, and workspace messages.
- Master administrators have organization-wide administration tools, including administrator accounts, staff/intern records, workspace messaging, and a portfolio builder.
- Authorized administrators can review internship submissions and download applicant résumés.
- Administrators can preview weekly attendance/check-in summaries and send announcements or reports to selected workspace recipients.
- A scheduled task in the running API checks for the weekly report trigger (Friday, 6:30 PM in the configured report timezone, defaulting to Africa/Lagos) and avoids duplicate reports for the same date.
- PostgreSQL migrations manage application tables and schema changes. The Vercel configuration provides SPA route rewrites and proxies API requests to the configured API service.

## What has not been implemented (or is not evidenced here)

This section records gaps that can be established from the checked-in code, plus deployment checks that cannot be established from source alone. It avoids treating an absent code reference as proof that a feature is permanently out of scope.

- **Automated email delivery:** Staff invitations are generated as URLs to share privately, and workspace reports/messages are delivered through the in-app inbox. The API code does not implement invitation, enquiry, application, or report email delivery.
- **Password recovery:** The available authentication API supports login, invitation activation, session lookup, password change, and logout. No forgot-password or password-reset flow is present.
- **External payment processing:** No checkout, billing, or payment provider integration is present in the frontend/API implementation.
- **Automated tests and end-to-end coverage:** No test script or test suite is declared in `package.json`. This status inventory does not establish that routes and workflows work correctly in a live deployment.
- **Production readiness verification:** Source configuration references Vercel and a Render API target, but this repository review cannot confirm that hosting, DNS, environment variables, database connectivity, backups, monitoring, or the deployed build are currently healthy.
- **Import of legacy browser-local staff records:** Existing records from older browser-local admin pages are not automatically migrated into PostgreSQL; accounts need to be recreated through the server-backed admin workflow.

## Public page completion workflow: Studio, Insights, Careers

The routes `/studio`, `/insights`, and `/careers` are wired into the public site, but the pages have not been worked on to completion. Keep them marked as unfinished until content, design, behavior, and responsive review are all done. Use this workflow for each route.

### Shared workflow

1. **Set the page goal and audience.** Write one sentence describing who the page serves and the next action a visitor should take. Align tone and claims with WEBLOX's actual services and programs.
2. **Gather approved content.** Collect real descriptions, people, metrics, images, article material, job openings, eligibility requirements, and contact details. Mark unknown facts as content needed; do not invent proof points, roles, or commitments.
3. **Plan the content structure.** Define the page sections, primary call to action, supporting links, and empty states before implementation. Check that every CTA has a valid destination or working action.
4. **Design against the existing site.** Follow the current typography, spacing, color, logo, theme, and shared header/footer patterns. Provide light and dark theme treatment and mobile layouts.
5. **Implement the page.** Build reusable React components and styles in the existing app. Keep content easy to update; avoid embedding large page bodies in the legacy generated bundle. Add data/API integration only where the agreed workflow needs it.
6. **Review behavior and accessibility.** Check links, forms, keyboard use, focus visibility, labels, heading order, contrast, loading/error/empty states, and reduced-motion behavior.
7. **Review on desktop and mobile.** Confirm layout at narrow and wide viewports, check image crops and text wrapping, and ensure the primary action remains clear.
8. **Publish only after content approval.** Confirm all supplied facts and assets with the project owner, then update this status document and the broader documentation to describe the shipped behavior.

### Studio (`/studio`)

**Purpose to define:** Explain who WEBLOX Studios is, how the studio works, and why a founder or organization should work with it.

**Work to complete:**

- Gather approved company story, mission, vision, operating principles, team/founder information, and location/contact details.
- Decide whether the studio primarily presents itself as a venture builder, product engineering partner, or both; explain the relationship between these offers clearly.
- Create an information hierarchy such as: studio introduction, approach and capabilities, engagement model, selected proof/work (only approved examples), team, and contact CTA.
- Explain the engagement lifecycle and what a prospective partner can expect at each stage, including how to start a conversation.
- Source approved portraits, workspace/product imagery, and any partner/client marks; confirm usage rights and add meaningful alt text.
- Implement responsive sections, theme-aware imagery/logos, and working links to Services, Ventures, and the project enquiry/contact path.

**Completion check:** A first-time visitor can describe what WEBLOX does, how to engage, and what to do next without relying on unsupported claims.

### Insights (`/insights`)

**Purpose to define:** Decide whether this is a publication for articles, product/engineering notes, venture updates, or a combination, and identify its intended readers.

**Work to complete:**

- Choose the content model: static editorial posts for the first release or a maintainable CMS/database-backed publishing workflow. Do not imply dynamic publishing until it exists.
- Gather and edit launch articles with authors, publication dates, summaries, topics, cover images, and canonical detail-page destinations.
- Design the listing page: introduction, featured item, article cards, topic/category labels, and a useful empty state when there are no published articles.
- Decide whether article detail pages, search, filters, pagination, RSS, newsletter signup, and social sharing are launch requirements; implement only the approved scope and make unavailable actions absent or clearly disabled.
- Add metadata and sharing previews per article, semantic article markup, image alt text, and accessible navigation between listing and detail pages.
- Link the homepage Insights teasers to real published content; remove sample teaser text or identify it clearly as editorial draft material until articles are approved.

**Completion check:** Every visible article card opens a real, approved article; listing and detail pages work on mobile and desktop; no placeholder text or dead links remain.

### Careers (`/careers`)

**Purpose to define:** Clarify whether this page recruits employees, contractors, collaborators, interns, or multiple audiences, and distinguish the separate internship program.

**Work to complete:**

- Agree on hiring scope, location/remote policy, role types, application channel, and who receives and reviews applications.
- Gather approved company/culture information, benefits and working practices (only if confirmed), selection stages, and equal-opportunity/accessibility language appropriate to the organization.
- Define how openings are maintained. For a simple launch, use an approved static vacancy list with a truthful “no open roles” state; for frequent hiring, design an admin/CMS-backed role and application workflow.
- For each opening, supply title, team, employment type, location, responsibilities, qualifications, compensation disclosure policy, close date, and application instructions.
- Decide whether applications use email, an external applicant-tracking system, or a new backend form. If using a form, specify required fields, CV formats/size, consent and privacy copy, secure storage/access, confirmation to applicants, and admin review workflow before building it.
- Add clear links to the internship page and staff sign-in only where relevant; distinguish internship applications from employee applications.
- Implement responsive vacancy cards and explicit loading, error, and no-openings states if openings are fetched dynamically.

**Completion check:** Visitors can tell which roles are open, who is eligible, how to apply, what happens next, and how employee hiring differs from the internship program.

### Page status tracking

For each page, record: **Owner**, **content approver**, **content gathered**, **design reviewed**, **implementation complete**, **mobile/accessibility review**, and **launch approval**. A page is complete only when all required steps are approved and its links and actions work.

## Notes and source of truth

This document describes implemented code, not a product roadmap. Route wiring is in `src/App.jsx`; public and portal interfaces are under `src/`; API behavior is in `server/index.js` and `server/store.js`; database changes are under `server/migrations/`. See [DOCUMENTATION.md](DOCUMENTATION.md) for setup, API, deployment, and operational details. If this summary conflicts with current code, verify the source files and update this inventory.
