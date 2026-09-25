import "dotenv/config";
import { createServer } from "node:http";
import pg from "pg";
import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  createHash,
  randomUUID,
} from "node:crypto";
import { promisify } from "node:util";
import { createPostgresStore } from "./store.js";
import { migrate } from "./migrate.js";

const scrypt = promisify(scryptCallback);
const { Pool } = pg;
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required. Copy .env.example to .env and configure PostgreSQL.");
}
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DB_POOL_MAX || 10),
  connectionTimeoutMillis: 5000,
  ...(process.env.DATABASE_SSL === "true" ? { ssl: { rejectUnauthorized: true } } : {}),
});
const store = createPostgresStore(pool);
const port = Number(process.env.PORT || process.env.API_PORT || 3001);
const allowedOrigin = process.env.APP_ORIGIN || `http://localhost:5173`;
const cookieName = "weblox_session";
const sessionTtl = 1000 * 60 * 60 * 24 * 7;
const cookieSecure = process.env.NODE_ENV === "production" ? "; Secure" : "";

function send(res, status, data, headers = {}) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    ...headers,
  });
  res.end(JSON.stringify(data));
}

function readBody(req, maxBytes = 16_384) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > maxBytes) reject(new Error("Request body is too large"));
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(raw || "{}"));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function parseCookies(header = "") {
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim().split("=").map(decodeURIComponent))
      .filter((pair) => pair.length === 2),
  );
}

async function passwordRecord(password, salt = randomBytes(16)) {
  const hash = await scrypt(password, salt, 64);
  return { salt: salt.toString("hex"), hash: hash.toString("hex") };
}

function publicAccount(account) {
  return {
    id: account.id,
    email: account.email,
    name: account.name,
    role: account.role,
    accountType: account.accountType || account.account_type || (account.role === "admin" ? "admin" : "staff"),
  };
}

async function currentSession(req) {
  const token = parseCookies(req.headers.cookie)[cookieName];
  if (!token) return null;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const account = await store.findSession(tokenHash);
  return account ? { token, tokenHash, account } : null;
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function cleanText(value, maxLength) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function safeWebUrl(value) {
  const text = cleanText(value, 2048);
  if (!text) return "";
  try {
    const url = new URL(text);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
}

function cleanStringList(value, maxItems = 40, maxLength = 60) {
  const values = Array.isArray(value) ? value : String(value ?? "").split(",");
  return [...new Set(values.map((item) => cleanText(item, maxLength)).filter(Boolean))].slice(0, maxItems);
}

function cleanPortfolio(body, account) {
  const experience = Array.isArray(body.experience) ? body.experience : [];
  const education = Array.isArray(body.education) ? body.education : [];
  const projects = Array.isArray(body.projects) ? body.projects : [];
  const social = body.socialLinks && typeof body.socialLinks === "object" ? body.socialLinks : {};
  const email = cleanText(body.contactEmail, 254).toLowerCase();
  const accentColor = /^#[0-9a-f]{6}$/i.test(body.accentColor) ? body.accentColor : "#a259ff";
  return {
    name: cleanText(body.name, 120) || account.name,
    title: cleanText(body.title, 120),
    photoUrl: safeWebUrl(body.photoUrl),
    location: cleanText(body.location, 100),
    biography: cleanText(body.biography, 3000),
    skills: cleanStringList(body.skills),
    experience: experience.slice(0, 30).map((item) => ({
      id: cleanText(item?.id, 80) || randomUUID(),
      title: cleanText(item?.title, 120),
      organization: cleanText(item?.organization, 120),
      location: cleanText(item?.location, 100),
      startDate: cleanText(item?.startDate, 30),
      endDate: cleanText(item?.endDate, 30),
      description: cleanText(item?.description, 1500),
    })).filter((item) => item.title || item.organization),
    education: education.slice(0, 30).map((item) => ({
      id: cleanText(item?.id, 80) || randomUUID(),
      qualification: cleanText(item?.qualification, 120),
      institution: cleanText(item?.institution, 120),
      location: cleanText(item?.location, 100),
      startDate: cleanText(item?.startDate, 30),
      endDate: cleanText(item?.endDate, 30),
      description: cleanText(item?.description, 1000),
    })).filter((item) => item.qualification || item.institution),
    socialLinks: {
      linkedin: safeWebUrl(social.linkedin),
      github: safeWebUrl(social.github),
      website: safeWebUrl(social.website),
      instagram: safeWebUrl(social.instagram),
    },
    contactEmail: validEmail(email) ? email : "",
    projects: projects.slice(0, 40).map((item) => ({
      id: cleanText(item?.id, 80) || randomUUID(),
      title: cleanText(item?.title, 120),
      description: cleanText(item?.description, 2000),
      imageUrl: safeWebUrl(item?.imageUrl),
      technologies: cleanStringList(item?.technologies, 30, 50),
      liveUrl: safeWebUrl(item?.liveUrl),
      sourceUrl: safeWebUrl(item?.sourceUrl),
      startDate: cleanText(item?.startDate, 30),
      endDate: cleanText(item?.endDate, 30),
      featured: item?.featured === true,
    })).filter((item) => item.title || item.description),
    layout: body.layout === "cards" ? "cards" : "editorial",
    accentColor,
  };
}

async function handler(req, res) {
  const origin = req.headers.origin;
  if (origin && origin !== allowedOrigin)
    return send(res, 403, { error: "Origin not allowed" });
  res.setHeader("access-control-allow-origin", allowedOrigin);
  res.setHeader("access-control-allow-credentials", "true");
  res.setHeader("vary", "Origin");
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type",
    });
    return res.end();
  }

  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (req.method === "GET" && url.pathname === "/api/health")
    return send(res, 200, { status: "ok", database: "connected" });

  const publicPortfolioRoute = url.pathname.match(/^\/api\/portfolios\/public\/([a-z0-9-]{1,180})$/i);
  if (req.method === "GET" && publicPortfolioRoute) {
    const portfolio = await store.findPublishedPortfolio(publicPortfolioRoute[1].toLowerCase());
    if (!portfolio) return send(res, 404, { error: "This portfolio is unavailable." });
    return send(res, 200, { portfolio });
  }

  if (url.pathname === "/api/portfolios/me") {
    const current = await currentSession(req);
    if (!current || current.account.accountType !== "staff")
      return send(res, 401, { error: "A staff session is required." });
    if (req.method === "GET")
      return send(res, 200, { portfolio: await store.getPortfolio(current.account.id) });
    if (req.method === "PUT") {
      const body = await readBody(req, 2 * 1024 * 1024);
      if (!body || typeof body !== "object" || Array.isArray(body))
        return send(res, 400, { error: "Portfolio data must be a JSON object." });
      const draft = cleanPortfolio(body, current.account);
      return send(res, 200, { portfolio: await store.savePortfolioDraft(current.account.id, draft) });
    }
  }

  if (req.method === "POST" && url.pathname === "/api/portfolios/me/publish") {
    const current = await currentSession(req);
    if (!current || current.account.accountType !== "staff")
      return send(res, 401, { error: "A staff session is required." });
    const portfolio = await store.getPortfolio(current.account.id);
    const draft = portfolio?.draft;
    if (!draft?.name || !draft?.title || !draft?.biography)
      return send(res, 400, { error: "Add your name, professional title, and biography before publishing." });
    const slugBase = (draft.name || current.account.name)
      .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "staff-portfolio";
    const published = await store.publishPortfolio(current.account.id, slugBase);
    return send(res, 200, { portfolio: published });
  }

  if (req.method === "POST" && url.pathname === "/api/portfolios/me/unpublish") {
    const current = await currentSession(req);
    if (!current || current.account.accountType !== "staff")
      return send(res, 401, { error: "A staff session is required." });
    const portfolio = await store.unpublishPortfolio(current.account.id);
    if (!portfolio) return send(res, 404, { error: "There is no saved portfolio to unpublish." });
    return send(res, 200, { portfolio });
  }

  if (req.method === "POST" && url.pathname === "/api/enquiries") {
    const body = await readBody(req);
    const name = String(body.name || "").trim();
    const company = String(body.company || "").trim();
    const email = String(body.email || "")
      .trim()
      .toLowerCase();
    const phone = String(body.phone || "").trim();
    const projectType = String(body.projectType || "").trim();
    const budgetRange = String(body.budgetRange || "").trim();
    const description = String(body.description || "").trim();
    const timeline = String(body.timeline || "").trim();
    if (
      !name ||
      !email ||
      !projectType ||
      !budgetRange ||
      !description ||
      !timeline
    ) {
      return send(res, 400, {
        error:
          "Name, email, project type, budget range, project description, and timeline are required.",
      });
    }
    const enquiry = await store.createEnquiry({
      name,
      company,
      email,
      phone,
      projectType,
      budgetRange,
      description,
      timeline,
    });
    return send(res, 201, { enquiry });
  }

  if (req.method === "POST" && url.pathname === "/api/internship-applications") {
    const body = await readBody(req, 8 * 1024 * 1024);
    const fields = [
      "fullName", "email", "phone", "track", "background", "skills",
      "motivation", "startDate", "duration", "availability",
    ];
    const application = Object.fromEntries(
      fields.map((field) => [field, String(body[field] || "").trim()]),
    );
    application.email = application.email.toLowerCase();
    if (fields.some((field) => !application[field]) || body.consent !== true)
      return send(res, 400, { error: "Complete all required fields and confirm the accuracy statement." });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(application.email))
      return send(res, 400, { error: "Enter a valid email address." });
    const resume = body.resume;
    if (!resume || typeof resume !== "object" || typeof resume.data !== "string")
      return send(res, 400, { error: "Please attach your CV or résumé." });
    const allowedTypes = new Set([
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]);
    const size = Buffer.from(resume.data, "base64").length;
    if (!allowedTypes.has(resume.type) || size > 5 * 1024 * 1024)
      return send(res, 400, { error: "Upload a PDF, DOC, or DOCX file no larger than 5 MB." });
    application.backgroundDetails = String(body.backgroundDetails || "").trim();
    application.portfolioUrl = String(body.portfolioUrl || "").trim();
    application.githubUrl = String(body.githubUrl || "").trim();
    application.linkedinUrl = String(body.linkedinUrl || "").trim();
    application.contribution = String(body.contribution || "").trim();
    application.resume = { name: String(resume.name || "resume"), type: resume.type, size, data: resume.data };
    const saved = await store.createInternshipApplication(application);
    return send(res, 201, { application: { id: saved.id, createdAt: saved.createdAt } });
  }

  if (req.method === "POST" && url.pathname === "/api/auth/activate") {
    const body = await readBody(req);
    const email = String(body.email || "")
      .trim()
      .toLowerCase();
    const password = String(body.password || "");
    const invite = String(body.invite || "").trim();
    if (!validEmail(email) || invite.length < 32 || password.length < 12)
      return send(res, 400, { error: "Enter a valid email, a valid staff invitation, and a password of at least 12 characters." });
    const credentials = await passwordRecord(password);
    const account = {
      id: randomUUID(),
      email,
      name: "",
      role: "staff",
      accountType: "staff",
      ...credentials,
      createdAt: new Date().toISOString(),
    };
    try {
      const activated = await store.activateStaffInvitation({
        email,
        tokenHash: createHash("sha256").update(invite).digest("hex"),
        account,
      });
      if (!activated) return send(res, 400, { error: "That staff invitation is invalid, expired, or already used." });
      return send(res, 201, { account: publicAccount(account) });
    } catch (error) {
      if (error.code === "23505") return send(res, 409, { error: "An account already exists for this email." });
      throw error;
    }
  }

  if (req.method === "POST" && url.pathname === "/api/admin/staff/invitations") {
    const current = await currentSession(req);
    if (!current || current.account.accountType !== "admin")
      return send(res, 403, { error: "Administrator access is required." });
    const body = await readBody(req);
    const email = String(body.email || "").trim().toLowerCase();
    const name = String(body.name || "").trim();
    const role = String(body.role || "").trim();
    if (!validEmail(email) || !name || name.length > 120 || !role || role.length > 80)
      return send(res, 400, { error: "Enter a valid email, full name, and job role." });
    const token = randomBytes(32).toString("base64url");
    try {
      await store.createStaffInvitation({
        email,
        name,
        role,
        tokenHash: createHash("sha256").update(token).digest("hex"),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 48).toISOString(),
      });
    } catch (error) {
      if (error.code === "STAFF_ACCOUNT_EXISTS") return send(res, 409, { error: error.message });
      throw error;
    }
    const inviteUrl = new URL("/staff-sign-in.html", allowedOrigin);
    inviteUrl.searchParams.set("email", email);
    inviteUrl.searchParams.set("invite", token);
    return send(res, 201, { inviteUrl: inviteUrl.toString(), expiresInHours: 48 });
  }

  if (req.method === "GET" && url.pathname === "/api/admin/staff") {
    const current = await currentSession(req);
    if (!current || current.account.accountType !== "admin")
      return send(res, 403, { error: "Administrator access is required." });
    return send(res, 200, { staff: await store.listStaff() });
  }

  if (req.method === "POST" && url.pathname === "/api/auth/login") {
    const body = await readBody(req);
    const email = String(body.email || "")
      .trim()
      .toLowerCase();
    const password = String(body.password || "");
    const account = validEmail(email) ? await store.findAccountByEmail(email) : null;
    if (!account)
      return send(res, 401, { error: "Email or password is incorrect." });
    const actual = await passwordRecord(
      password,
      Buffer.from(account.salt, "hex"),
    );
    const expectedHash = Buffer.from(account.hash, "hex");
    const actualHash = Buffer.from(actual.hash, "hex");
    if (
      expectedHash.length !== actualHash.length ||
      !timingSafeEqual(expectedHash, actualHash)
    )
      return send(res, 401, { error: "Email or password is incorrect." });
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + sessionTtl);
    await store.createSession(account.id, createHash("sha256").update(token).digest("hex"), expiresAt.toISOString());
    return send(
      res,
      200,
      { account: publicAccount(account) },
      {
        "set-cookie": `${cookieName}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${sessionTtl / 1000}${cookieSecure}`,
      },
    );
  }

  if (req.method === "GET" && url.pathname === "/api/auth/session") {
    const current = await currentSession(req);
    if (!current)
      return send(res, 401, { error: "Not signed in." });
    return send(res, 200, { account: publicAccount(current.account) });
  }

  if (req.method === "POST" && url.pathname === "/api/auth/password") {
    const current = await currentSession(req);
    if (!current) return send(res, 401, { error: "Not signed in." });
    const body = await readBody(req);
    const oldPassword = String(body.currentPassword || "");
    const newPassword = String(body.newPassword || "");
    if (newPassword.length < 12) return send(res, 400, { error: "Use a password with at least 12 characters." });
    const account = await store.findAccountByEmail(current.account.email);
    const actual = await passwordRecord(oldPassword, Buffer.from(account.salt, "hex"));
    if (!timingSafeEqual(Buffer.from(actual.hash, "hex"), Buffer.from(account.hash, "hex")))
      return send(res, 401, { error: "Current password is incorrect." });
    const credentials = await passwordRecord(newPassword);
    await store.updatePassword(account.id, credentials.salt, credentials.hash);
    await store.deleteOtherSessions(account.id, current.tokenHash);
    return send(res, 200, { ok: true });
  }

  if (req.method === "POST" && url.pathname === "/api/auth/logout") {
    const current = await currentSession(req);
    if (current) await store.deleteSession(current.tokenHash);
    return send(
      res,
      200,
      { ok: true },
      {
        "set-cookie": `${cookieName}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${cookieSecure}`,
      },
    );
  }
  return send(res, 404, { error: "Not found." });
}

const server = createServer((req, res) => {
  handler(req, res).catch((error) => {
    console.error(error);
    const clientError = error.message === "Request body is too large" || error.message === "Invalid JSON body";
    send(res, clientError ? 400 : 500, { error: clientError ? error.message : "Request failed." });
  });
});

try {
  await migrate(pool);
  await pool.query("SELECT 1");
  server.listen(port, () =>
    console.log(`WEBLOX API connected to PostgreSQL and listening on http://localhost:${port}`),
  );
} catch (error) {
  console.error("Could not initialize PostgreSQL:", error.message);
  await pool.end();
  process.exitCode = 1;
}
