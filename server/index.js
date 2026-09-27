import "dotenv/config";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
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
import { createCertificatePdf, createCertificateSvg } from "./certificates.js";

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

function sendImage(res, image) {
  res.writeHead(200, {
    "content-type": image.contentType,
    "content-length": image.content.length,
    "cache-control": "public, max-age=31536000, immutable",
    "x-content-type-options": "nosniff",
  });
  res.end(image.content);
}

function sendCertificatePdf(res, certificate) {
  res.writeHead(200, {
    "content-type": "application/pdf",
    "content-length": certificate.pdf.length,
    "content-disposition": `attachment; filename="${certificate.credentialId}.pdf"`,
    "cache-control": "private, no-store",
    "x-content-type-options": "nosniff",
  });
  res.end(certificate.pdf);
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
    profilePhotoUrl: account.profilePhotoUrl || "",
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

function reportDateInZone(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: process.env.REPORT_TIME_ZONE || 'Africa/Lagos' }).format(date);
}

function isFridayEveningInZone(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: process.env.REPORT_TIME_ZONE || 'Africa/Lagos', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return value.weekday === 'Fri' && (Number(value.hour) > 18 || (Number(value.hour) === 18 && Number(value.minute) >= 30));
}

async function runScheduledWeeklyReport() {
  if (!isFridayEveningInZone()) return;
  const reportDate = reportDateInZone();
  if (await store.hasScheduledReport(reportDate)) return;
  const { people, attendance, checkins } = await store.getWeeklyReportData();
  const lines = [`Weekly attendance and check-in summary for the week ending ${reportDate}.`, ''];
  for (const person of people) {
    const personAttendance = attendance.filter((row) => row.accountId === person.id);
    const personCheckins = checkins.filter((row) => row.accountId === person.id);
    if (person.accountType === 'staff') {
      const clockedIn = personAttendance.filter((row) => row.clockInAt).length;
      lines.push(`${person.name} (${person.role}) — attendance: ${clockedIn} day(s) recorded out of 5; ${personAttendance.filter((row) => row.clockOutAt).length} clock-outs recorded.`);
    } else {
      lines.push(`${person.name} (Intern) — check-ins: ${personCheckins.filter((row) => row.morning).length} morning and ${personCheckins.filter((row) => row.evening).length} evening updates recorded.`);
    }
  }
  const result = await store.sendWorkspaceMessage({
    type: 'weekly_report', subject: `Weekly team report · ${reportDate}`, body: lines.join('\n'),
    sender: { name: 'WEBLOX Weekly Reports', email: '' }, recipientIds: people.map((person) => person.id), reportDate,
  });
  return result;
}

setInterval(() => runScheduledWeeklyReport().catch((error) => console.error('Scheduled weekly report failed:', error)), 60_000).unref();

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isAdministrator(account) {
  return account?.accountType === "admin" || account?.accountType === "master_admin";
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
  const metrics = Array.isArray(body.metrics) ? body.metrics : [];
  const repositories = Array.isArray(body.repositories) ? body.repositories : [];
  const testimonials = Array.isArray(body.testimonials) ? body.testimonials : Array.isArray(body.recommendations) ? body.recommendations : [];
  const social = body.socialLinks && typeof body.socialLinks === "object" ? body.socialLinks : {};
  const email = cleanText(body.contactEmail, 254).toLowerCase();
  const accentColor = /^#[0-9a-f]{6}$/i.test(body.accentColor) ? body.accentColor : "#a259ff";
  return {
    name: cleanText(body.name, 120) || account.name,
    title: cleanText(body.title, 120),
    photoUrl: safeWebUrl(body.photoUrl),
    location: cleanText(body.location, 100),
    availability: cleanText(body.availability, 120),
    cvUrl: safeWebUrl(body.cvUrl),
    biography: cleanText(body.biography, 3000),
    skills: cleanStringList(body.skills),
    metrics: metrics.slice(0, 8).map((item) => ({
      id: cleanText(item?.id, 80) || randomUUID(),
      value: cleanText(item?.value, 50),
      label: cleanText(item?.label, 80),
      detail: cleanText(item?.detail, 100),
    })).filter((item) => item.value && item.label),
    experience: experience.slice(0, 30).map((item) => ({
      id: cleanText(item?.id, 80) || randomUUID(),
      title: cleanText(item?.title, 120),
      organization: cleanText(item?.organization, 120),
      location: cleanText(item?.location, 100),
      startDate: cleanText(item?.startDate, 30),
      endDate: cleanText(item?.endDate, 30),
      description: cleanText(item?.description, 1500),
      technologies: cleanStringList(item?.technologies, 15, 50),
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
      category: cleanText(item?.category, 60),
    })).filter((item) => item.title || item.description),
    repositories: repositories.slice(0, 30).map((item) => ({
      id: cleanText(item?.id, 80) || randomUUID(),
      name: cleanText(item?.name, 120),
      description: cleanText(item?.description, 600),
      language: cleanText(item?.language, 50),
      url: safeWebUrl(item?.url),
      stars: cleanText(item?.stars, 30),
    })).filter((item) => item.name || item.description),
    testimonials: testimonials.slice(0, 20).map((item) => ({
      id: cleanText(item?.id, 80) || randomUUID(),
      quote: cleanText(typeof item === "string" ? item : item?.quote || item?.recommendation || item?.text, 1000),
      name: cleanText(item?.name || item?.author, 120),
      title: cleanText(item?.title, 120),
      organization: cleanText(item?.organization, 120),
    })).filter((item) => item.quote),
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
      "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
      "access-control-allow-headers": "content-type",
    });
    return res.end();
  }

  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (req.method === "GET" && url.pathname === "/api/health")
    return send(res, 200, { status: "ok", database: "connected" });

  const publicImageRoute = url.pathname.match(/^\/api\/media\/([0-9a-f-]{36})$/i);
  if (req.method === "GET" && publicImageRoute) {
    const image = await store.findDashboardImage(publicImageRoute[1]);
    if (!image) return send(res, 404, { error: "Image not found." });
    return sendImage(res, image);
  }

  if ((url.pathname === "/api/media/library" && ["GET", "POST"].includes(req.method)) || (url.pathname.startsWith("/api/media/library/") && req.method === "DELETE")) {
    const current = await currentSession(req);
    if (!current || !["staff", "intern", "admin", "master_admin"].includes(current.account.accountType))
      return send(res, 401, { error: "Sign in to manage your image library." });

    if (req.method === "GET") {
      const [images, usage] = await Promise.all([
        store.listDashboardImages(current.account.id),
        store.getDashboardImageUsage(current.account.id),
      ]);
      return send(res, 200, { images: images.map((image) => ({ ...image, url: `/api/media/${image.id}` })), usage });
    }

    if (req.method === "POST") {
      const body = await readBody(req, 7_100_000);
      const contentType = String(body.contentType || "").toLowerCase();
      if (!["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"].includes(contentType))
        return send(res, 400, { error: "Upload a JPEG, PNG, WebP, GIF, or PDF file." });
      if (typeof body.data !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(body.data) || body.data.length % 4 !== 0)
        return send(res, 400, { error: "The selected file could not be read." });
      const content = Buffer.from(body.data, "base64");
      if (!content.length || content.length > 5 * 1024 * 1024 || content.toString("base64") !== body.data)
        return send(res, 400, { error: "Files must be smaller than 5 MB." });
      const signatures = {
        "image/jpeg": content.length >= 3 && content[0] === 0xff && content[1] === 0xd8 && content[2] === 0xff,
        "image/png": content.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
        "image/webp": content.length >= 12 && content.toString("ascii", 0, 4) === "RIFF" && content.toString("ascii", 8, 12) === "WEBP",
        "image/gif": ["GIF87a", "GIF89a"].includes(content.toString("ascii", 0, 6)),
        "application/pdf": content.length >= 5 && content.toString("ascii", 0, 5) === "%PDF-",
      };
      if (!signatures[contentType]) return send(res, 400, { error: "The selected file does not match its file type." });
      const usage = await store.getDashboardImageUsage(current.account.id);
      if (usage.byteSize + content.length > 50 * 1024 * 1024 || usage.count >= 200)
        return send(res, 413, { error: "Your image library is full. Remove an image before uploading more." });
      const originalName = cleanText(body.name, 180).replace(/[\\/\u0000-\u001f]/g, "_") || "image";
      const image = await store.saveDashboardImage({
        id: randomUUID(), accountId: current.account.id, originalName, contentType, content,
      });
      return send(res, 201, { image: { ...image, url: `/api/media/${image.id}` } });
    }

    const deleteRoute = url.pathname.match(/^\/api\/media\/library\/([0-9a-f-]{36})$/i);
    if (deleteRoute) {
      const removed = await store.deleteDashboardImage(current.account.id, deleteRoute[1]);
      return removed ? send(res, 200, { ok: true }) : send(res, 404, { error: "Image not found in your library." });
    }
  }

  const certificateRoute = url.pathname.match(/^\/api\/certificates\/([0-9a-f-]{36})\/(image|pdf)$/i);
  if (certificateRoute && req.method === "GET") {
    const certificate = await store.findInternshipCertificate(certificateRoute[1]);
    if (!certificate) return send(res, 404, { error: "Certificate not found." });
    if (certificateRoute[2] === "image") {
      res.writeHead(200, { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "public, max-age=3600", "x-content-type-options": "nosniff" });
      return res.end(certificate.imageSvg);
    }
    const current = await currentSession(req);
    if (!current || (current.account.id !== certificate.internAccountId && !isAdministrator(current.account)))
      return send(res, 403, { error: "Only this intern and administrators can download the certificate." });
    return sendCertificatePdf(res, certificate);
  }

  if (url.pathname === "/api/admin/certificates" && ["GET", "POST"].includes(req.method)) {
    const current = await currentSession(req);
    if (!current || !isAdministrator(current.account))
      return send(res, 403, { error: "Administrator access is required." });
    if (req.method === "GET") {
      const certificates = await store.listInternshipCertificates();
      return send(res, 200, { certificates: certificates.map((item) => ({
        ...item,
        imageUrl: `/api/certificates/${item.id}/image`,
        pdfUrl: `/api/certificates/${item.id}/pdf`,
      })) });
    }
    const body = await readBody(req);
    const internId = cleanText(body.internAccountId, 100);
    const intern = (await store.listPeople("intern")).find((person) => person.id === internId);
    if (!intern) return send(res, 404, { error: "Select an existing intern account." });
    const name = cleanText(body.name, 120) || intern.name;
    const track = cleanText(body.track, 120);
    const dateValue = (value) => {
      const text = cleanText(value, 10);
      if (!text) return "";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
      const parsed = new Date(`${text}T00:00:00.000Z`);
      return Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== text ? null : text;
    };
    const startDate = dateValue(body.startDate);
    const completionDate = dateValue(body.completionDate);
    if (!name || !track || startDate === null || completionDate === null || (startDate && completionDate && completionDate < startDate))
      return send(res, 400, { error: "Enter the intern name, program or track, and valid dates." });
    const id = randomUUID();
    const credentialId = `WEBLOX-INT-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;
    const signatureAsset = async (field) => {
      const value = cleanText(body[field], 2048);
      if (!value) return null;
      if (!/^\/api\/media\/[0-9a-f-]{36}$/i.test(value)) throw new Error(`Choose a PNG from your uploaded files for ${field}.`);
      const asset = await store.findOwnedDashboardImage(current.account.id, value.slice("/api/media/".length));
      if (!asset || asset.contentType !== "image/png") throw new Error(`Choose an uploaded PNG for ${field}.`);
      const storedAsset = await store.findDashboardImage(value.slice("/api/media/".length));
      return { url: value, content: storedAsset.content };
    };
    let signature1, signature2, logo;
    try {
      [signature1, signature2, logo] = await Promise.all([
        signatureAsset("signature1Url"), signatureAsset("signature2Url"),
        readFile(new URL("../public/assets/weblox-logo-light.png", import.meta.url)),
      ]);
    } catch (error) {
      if (error.code === "ENOENT") throw error;
      return send(res, 400, { error: error.message || "Could not load certificate image assets." });
    }
    const imageAssets = { signature1: signature1?.content, signature2: signature2?.content, logo };
    const certificateData = {
      name, track, startDate, completionDate,
      description: cleanText(body.description, 500) || "For outstanding dedication, practical contribution, and successful completion of the WEBLOX Internship Program.",
      credentialId,
      issuedAt: new Date().toISOString().slice(0, 10),
      signatory1Name: cleanText(body.signatory1Name, 120) || "Chukwuemeka Nkama",
      signatory1Title: cleanText(body.signatory1Title, 120) || "Founder & Team Lead",
      signatory2Name: cleanText(body.signatory2Name, 120),
      signatory2Title: cleanText(body.signatory2Title, 120),
      signature1Url: signature1?.url || "",
      signature2Url: signature2?.url || "",
    };
    const pdf = createCertificatePdf(certificateData, imageAssets);
    const imageSvg = createCertificateSvg({ certificateData }, allowedOrigin.replace(/\/$/, ""), imageAssets);
    const saved = await store.issueInternshipCertificate({
      id, credentialId, internAccountId: intern.id, issuedByAccountId: current.account.id,
      certificateData, pdf, imageSvg,
    });
    return send(res, 201, {
      certificate: {
        ...saved, internName: intern.name, internEmail: intern.email,
        imageUrl: `/api/certificates/${id}/image`, pdfUrl: `/api/certificates/${id}/pdf`,
      },
    });
  }

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

  const adminPortfolioRoute = url.pathname.match(/^\/api\/admin\/staff\/([^/]+)\/portfolio$/);
  if (adminPortfolioRoute) {
    const current = await currentSession(req);
    if (!current || !isAdministrator(current.account))
      return send(res, 403, { error: "Master administrator access is required." });
    const accountId = decodeURIComponent(adminPortfolioRoute[1]);
    const staff = await store.findStaffAccount(accountId);
    if (!staff) return send(res, 404, { error: "Staff account not found." });
    if (req.method === "GET")
      return send(res, 200, { portfolio: await store.getPortfolio(accountId) });
    if (req.method === "PUT") {
      const body = await readBody(req, 2 * 1024 * 1024);
      if (!body || typeof body !== "object" || Array.isArray(body))
        return send(res, 400, { error: "Portfolio data must be a JSON object." });
      const draft = cleanPortfolio(body, staff);
      const portfolio = await store.savePortfolioDraft(accountId, draft);
      await store.recordPortfolioAdminEdit({ accountId, actor: current.account });
      return send(res, 200, { portfolio });
    }
  }

  const adminPortfolioPublishRoute = url.pathname.match(/^\/api\/admin\/staff\/([^/]+)\/portfolio\/(publish|unpublish)$/);
  if (req.method === "POST" && adminPortfolioPublishRoute) {
    const current = await currentSession(req);
    if (!current || !isAdministrator(current.account))
      return send(res, 403, { error: "Master administrator access is required." });
    const accountId = decodeURIComponent(adminPortfolioPublishRoute[1]);
    const staff = await store.findStaffAccount(accountId);
    if (!staff) return send(res, 404, { error: "Staff account not found." });
    if (adminPortfolioPublishRoute[2] === "unpublish") {
      const portfolio = await store.unpublishPortfolio(accountId);
      if (!portfolio) return send(res, 404, { error: "There is no saved portfolio to unpublish." });
      return send(res, 200, { portfolio });
    }
    const portfolio = await store.getPortfolio(accountId);
    const draft = portfolio?.draft;
    if (!draft?.name || !draft?.title || !draft?.biography)
      return send(res, 400, { error: "Add the staff member's name, professional title, and biography before publishing." });
    const slugBase = draft.name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "staff-portfolio";
    const published = await store.publishPortfolio(accountId, slugBase);
    return send(res, 200, { portfolio: published });
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
    const fileTypes = {
      pdf: "application/pdf",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
    const extension = String(resume.name || "").split(".").pop().toLowerCase();
    const size = Buffer.from(resume.data, "base64").length;
    if (!fileTypes[extension] || size > 5 * 1024 * 1024)
      return send(res, 400, { error: "Upload a PDF, DOC, or DOCX file no larger than 5 MB." });
    application.backgroundDetails = String(body.backgroundDetails || "").trim();
    application.portfolioUrl = String(body.portfolioUrl || "").trim();
    application.githubUrl = String(body.githubUrl || "").trim();
    application.linkedinUrl = String(body.linkedinUrl || "").trim();
    application.contribution = String(body.contribution || "").trim();
    application.resume = { name: String(resume.name || "resume"), type: fileTypes[extension], size, data: resume.data };
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
    if (!validEmail(email) || invite.length < 32 || password.length < 8)
      return send(res, 400, { error: "Enter a valid email, a valid staff invitation, and a password of at least 8 characters." });
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
    if (!current || !isAdministrator(current.account))
      return send(res, 403, { error: "Administrator access is required." });
    const body = await readBody(req);
    const email = String(body.email || "").trim().toLowerCase();
    const name = String(body.name || "").trim();
    const role = String(body.role || "").trim();
    const jobType = String(body.jobType || "Full-time").trim();
    const gender = String(body.gender || "").trim().slice(0, 60);
    if (!validEmail(email) || !name || name.length > 120 || !role || role.length > 80 || !jobType || jobType.length > 80)
      return send(res, 400, { error: "Enter a valid email, full name, and job role." });
    const token = randomBytes(32).toString("base64url");
    try {
      await store.createStaffInvitation({
        email,
        name,
        role,
        jobType,
        gender,
        actor: current.account,
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
    if (!current || !isAdministrator(current.account))
      return send(res, 403, { error: "Administrator access is required." });
    return send(res, 200, { staff: await store.listStaff() });
  }

  if (url.pathname === "/api/staff/attendance") {
    const current = await currentSession(req);
    if (!current || !["staff", "admin", "master_admin"].includes(current.account.accountType))
      return send(res, 401, { error: "A staff or administrator session is required." });
    if (req.method === "GET") return send(res, 200, { attendance: await store.getAttendance(current.account.id) });
    if (req.method === "POST") {
      const body = await readBody(req);
      if (!["clock_in", "clock_out"].includes(body.action))
        return send(res, 400, { error: "Choose clock in or clock out." });
      return send(res, 200, { attendance: await store.recordAttendance(current.account.id, body.action) });
    }
  }

  if (url.pathname === "/api/workspace/inbox" && req.method === "GET") {
    const current = await currentSession(req);
    if (!current || !["staff", "intern"].includes(current.account.accountType))
      return send(res, 401, { error: "A staff or intern session is required." });
    return send(res, 200, { messages: await store.listInbox(current.account.id) });
  }

  const inboxReadMatch = url.pathname.match(/^\/api\/workspace\/inbox\/([^/]+)\/read$/);
  if (req.method === "POST" && inboxReadMatch) {
    const current = await currentSession(req);
    if (!current || !["staff", "intern"].includes(current.account.accountType))
      return send(res, 401, { error: "A staff or intern session is required." });
    const messageId = decodeURIComponent(inboxReadMatch[1]);
    if (!await store.markInboxRead(current.account.id, messageId))
      return send(res, 404, { error: "Inbox message not found." });
    return send(res, 200, { ok: true });
  }

  if (url.pathname === "/api/admin/workspace/recipients" && req.method === "GET") {
    const current = await currentSession(req);
    if (!current || !isAdministrator(current.account))
      return send(res, 403, { error: "Administrator access is required." });
    return send(res, 200, { recipients: await store.listReportRecipients(), sentMessages: await store.listSentWorkspaceMessages() });
  }

  if (url.pathname === "/api/admin/internship-applications" && req.method === "GET") {
    const current = await currentSession(req);
    if (!current || !isAdministrator(current.account))
      return send(res, 403, { error: "Administrator access is required." });
    return send(res, 200, { applications: await store.listInternshipApplications() });
  }

  const applicantResumeMatch = url.pathname.match(/^\/api\/admin\/internship-applications\/(\d+)\/resume$/);
  if (req.method === "GET" && applicantResumeMatch) {
    const current = await currentSession(req);
    if (!current || !isAdministrator(current.account))
      return send(res, 403, { error: "Administrator access is required." });
    const resume = await store.getInternshipApplicationResume(applicantResumeMatch[1]);
    if (!resume?.data) return send(res, 404, { error: "Applicant CV not found." });
    res.writeHead(200, { "content-type": resume.type, "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(resume.name || 'applicant-cv')}`, "cache-control": "private, no-store" });
    return res.end(Buffer.from(resume.data, "base64"));
  }

  if (url.pathname === "/api/admin/portfolio/me") {
    const current = await currentSession(req);
    if (!current || current.account.accountType !== "master_admin")
      return send(res, 403, { error: "Master administrator access is required." });
    if (req.method === "GET") return send(res, 200, { portfolio: await store.getPortfolio(current.account.id) });
    if (req.method === "PUT") {
      const body = await readBody(req, 2 * 1024 * 1024);
      if (!body || typeof body !== "object" || Array.isArray(body)) return send(res, 400, { error: "Portfolio data must be a JSON object." });
      return send(res, 200, { portfolio: await store.savePortfolioDraft(current.account.id, cleanPortfolio(body, current.account)) });
    }
  }

  if (url.pathname === "/api/admin/portfolio/me/publish" && req.method === "POST") {
    const current = await currentSession(req);
    if (!current || current.account.accountType !== "master_admin") return send(res, 403, { error: "Master administrator access is required." });
    const portfolio = await store.getPortfolio(current.account.id);
    if (!portfolio?.draft) return send(res, 400, { error: "Save your portfolio before publishing." });
    const slugBase = (current.account.name || "master-admin").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "master-admin";
    return send(res, 200, { portfolio: await store.publishPortfolio(current.account.id, slugBase) });
  }

  if (url.pathname === "/api/admin/portfolio/me/unpublish" && req.method === "POST") {
    const current = await currentSession(req);
    if (!current || current.account.accountType !== "master_admin") return send(res, 403, { error: "Master administrator access is required." });
    const portfolio = await store.unpublishPortfolio(current.account.id);
    if (!portfolio) return send(res, 404, { error: "There is no saved portfolio to unpublish." });
    return send(res, 200, { portfolio });
  }


  if (url.pathname === "/api/admin/workspace/report-preview" && req.method === "GET") {
    const current = await currentSession(req);
    if (!current || !isAdministrator(current.account)) return send(res, 403, { error: "Administrator access is required." });
    const { people, attendance, checkins } = await store.getWeeklyReportData();
    const lines = [`Weekly attendance and check-in summary · ${reportDateInZone()}`, ''];
    for (const person of people) {
      const attended = attendance.filter((row) => row.accountId === person.id);
      const updates = checkins.filter((row) => row.accountId === person.id);
      lines.push(person.accountType === 'staff'
        ? `${person.name} (${person.role}) — ${attended.filter((row) => row.clockInAt).length} attendance days; ${attended.filter((row) => row.clockOutAt).length} clock-outs.`
        : `${person.name} (Intern) — ${updates.filter((row) => row.morning).length} morning and ${updates.filter((row) => row.evening).length} evening check-ins.`);
    }
    const reportDate = reportDateInZone();
    const sent = await store.findScheduledReport(reportDate);
    return send(res, 200, { subject: `Weekly team report · ${reportDate}`, body: lines.join('\n'), alreadySent: Boolean(sent?.id) });
  }

  if (url.pathname === "/api/admin/workspace/messages" && req.method === "POST") {
    const current = await currentSession(req);
    if (!current || !isAdministrator(current.account))
      return send(res, 403, { error: "Administrator access is required." });
    const body = await readBody(req, 100_000);
    const type = body.type === "weekly_report" ? "weekly_report" : "announcement";
    const subject = cleanText(body.subject, 180);
    const messageBody = cleanText(body.body, 20_000);
    const recipientIds = [...new Set(Array.isArray(body.recipientIds) ? body.recipientIds.map((id) => cleanText(id, 120)).filter(Boolean) : [])].slice(0, 1000);
    if (!subject || !messageBody || !recipientIds.length)
      return send(res, 400, { error: "Enter a subject and message, and select at least one recipient." });
    const result = await store.sendWorkspaceMessage({ type, subject, body: messageBody, sender: current.account, recipientIds });
    return send(res, 201, result);
  }

  if (url.pathname === "/api/intern/me/certificates" && req.method === "GET") {
    const current = await currentSession(req);
    if (!current || current.account.accountType !== "intern")
      return send(res, 401, { error: "An intern session is required." });
    const certificates = await store.listMyInternshipCertificates(current.account.id);
    return send(res, 200, { certificates: certificates.map((item) => ({
      ...item,
      imageUrl: `/api/certificates/${item.id}/image`,
      pdfUrl: `/api/certificates/${item.id}/pdf`,
    })) });
  }

  if (url.pathname === "/api/intern/me/profile" && req.method === "PUT") {
    const current = await currentSession(req);
    if (!current || current.account.accountType !== "intern")
      return send(res, 401, { error: "An intern session is required." });
    const body = await readBody(req, 4_096);
    const profilePhotoUrl = cleanText(body.profilePhotoUrl, 2048);
    if (profilePhotoUrl && !/^\/api\/media\/[0-9a-f-]{36}$/i.test(profilePhotoUrl))
      return send(res, 400, { error: "Choose a profile picture from your uploaded files." });
    if (profilePhotoUrl) {
      const photoId = profilePhotoUrl.slice("/api/media/".length);
      const photo = await store.findOwnedDashboardImage(current.account.id, photoId);
      if (!photo || !photo.contentType.startsWith("image/"))
        return send(res, 400, { error: "Choose an image you uploaded to your files." });
    }
    const account = await store.updateInternProfilePhoto(current.account.id, profilePhotoUrl);
    return send(res, 200, { account: publicAccount(account) });
  }

  if (url.pathname === "/api/intern/me/checkins") {
    const current = await currentSession(req);
    if (!current || current.account.accountType !== "intern")
      return send(res, 401, { error: "An intern session is required." });
    if (req.method === "GET") {
      return send(res, 200, { checkins: await store.listMyInternCheckins(current.account.id) });
    }
    if (req.method === "POST") {
      const body = await readBody(req);
      if (!["morning", "evening"].includes(body.slot) || typeof body.text !== "string" || !body.text.trim() || body.text.length > 3000)
        return send(res, 400, { error: "Enter a check-in update of up to 3,000 characters." });
      return send(res, 200, { checkin: await store.saveInternCheckin(current.account.id, body.slot, body.text.trim()) });
    }
  }

  if (url.pathname === "/api/admin/activity") {
    const current = await currentSession(req);
    if (!current || !isAdministrator(current.account))
      return send(res, 403, { error: "Administrator access is required." });
    if (req.method === "GET")
      return send(res, 200, { staffActivity: await store.listStaffActivity(), internCheckins: await store.listInternCheckins(), audit: await store.listAdminAudit() });
  }

  const staffRecordMatch = url.pathname.match(/^\/api\/admin\/staff\/([^/]+)$/);
  if (staffRecordMatch && ["PUT", "DELETE"].includes(req.method)) {
    const current = await currentSession(req);
    if (!current || !isAdministrator(current.account))
      return send(res, 403, { error: "Administrator access is required." });
    const id = decodeURIComponent(staffRecordMatch[1]);
    if (req.method === "DELETE") {
      if (!await store.setPersonActive(id, "staff", false, current.account)) return send(res, 404, { error: "Staff account not found." });
      return send(res, 200, { ok: true });
    }
    const body = await readBody(req);
    const email = String(body.email || "").trim().toLowerCase();
    const name = String(body.name || "").trim();
    const role = String(body.role || "").trim();
    const jobType = String(body.jobType || "Full-time").trim();
    const gender = String(body.gender || "").trim().slice(0, 60);
    const oldEmail = String(body.oldEmail || "").trim().toLowerCase();
    if (!validEmail(email) || !validEmail(oldEmail) || !name || name.length > 120 || !role || role.length > 80 || !jobType || jobType.length > 80)
      return send(res, 400, { error: "Enter a valid name, email, and role." });
    try {
      const staff = await store.updateStaff({ id, oldEmail, email, name, role, jobType, gender, actor: current.account });
      return staff ? send(res, 200, { staff }) : send(res, 404, { error: "Staff account not found." });
    } catch (error) {
      if (error.code === "23505") return send(res, 409, { error: "An account already exists for this email." });
      throw error;
    }
  }

  const pendingStaffMatch = url.pathname.match(/^\/api\/admin\/staff-directory\/([^/]+)$/);
  if (pendingStaffMatch && ["PUT", "DELETE"].includes(req.method)) {
    const current = await currentSession(req);
    if (!current || !isAdministrator(current.account))
      return send(res, 403, { error: "Administrator access is required." });
    const email = decodeURIComponent(pendingStaffMatch[1]).trim().toLowerCase();
    if (req.method === "DELETE") {
      if (!await store.removePendingStaff(email, current.account)) return send(res, 404, { error: "Pending staff invitation not found." });
      return send(res, 200, { ok: true });
    }
    const body = await readBody(req);
    const name = String(body.name || "").trim();
    const role = String(body.role || "").trim();
    const jobType = String(body.jobType || "Full-time").trim();
    const gender = String(body.gender || "").trim().slice(0, 60);
    if (!name || name.length > 120 || !role || role.length > 80 || !jobType || jobType.length > 80)
      return send(res, 400, { error: "Enter a valid name and role." });
    if (!await store.updatePendingStaff(email, name, role, jobType, gender, current.account)) return send(res, 404, { error: "Pending staff invitation not found." });
    return send(res, 200, { ok: true });
  }

  const restoreMatch = url.pathname.match(/^\/api\/admin\/(staff|interns)\/([^/]+)\/restore$/);
  if (req.method === "POST" && restoreMatch) {
    const current = await currentSession(req);
    if (!current || !isAdministrator(current.account))
      return send(res, 403, { error: "Administrator access is required." });
    const type = restoreMatch[1] === "staff" ? "staff" : "intern";
    if (!await store.setPersonActive(decodeURIComponent(restoreMatch[2]), type, true, current.account))
      return send(res, 404, { error: "Account not found." });
    return send(res, 200, { ok: true });
  }

  if (url.pathname === "/api/admin/interns") {
    const current = await currentSession(req);
    if (!current || !isAdministrator(current.account))
      return send(res, 403, { error: "Administrator access is required." });
    if (req.method === "GET") return send(res, 200, { interns: await store.listPeople("intern") });
    if (req.method === "POST") {
      const body = await readBody(req);
      const email = String(body.email || "").trim().toLowerCase();
      const name = String(body.name || "").trim();
      const role = String(body.role || "Intern").trim();
      const jobType = String(body.jobType || "Internship").trim();
      const gender = String(body.gender || "").trim().slice(0, 60);
      const password = String(body.password || "");
      if (!validEmail(email) || !name || name.length > 120 || !role || role.length > 80 || !jobType || jobType.length > 80 || password.length < 8)
        return send(res, 400, { error: "Enter a valid name, email, program, and password of at least 8 characters." });
      try {
        const credentials = await passwordRecord(password);
        await store.createIntern({ id: randomUUID(), email, name, role, jobType, gender, ...credentials, actor: current.account });
        return send(res, 201, { ok: true });
      } catch (error) {
        if (error.code === "23505") return send(res, 409, { error: "An account already exists for this email." });
        throw error;
      }
    }
  }

  const internRecordMatch = url.pathname.match(/^\/api\/admin\/interns\/([^/]+)$/);
  if (internRecordMatch && ["PUT", "DELETE"].includes(req.method)) {
    const current = await currentSession(req);
    if (!current || !isAdministrator(current.account))
      return send(res, 403, { error: "Administrator access is required." });
    const id = decodeURIComponent(internRecordMatch[1]);
    if (req.method === "DELETE") {
      if (!await store.setPersonActive(id, "intern", false, current.account)) return send(res, 404, { error: "Intern account not found." });
      return send(res, 200, { ok: true });
    }
    const body = await readBody(req);
    const email = String(body.email || "").trim().toLowerCase();
    const name = String(body.name || "").trim();
    const role = String(body.role || "").trim();
    const jobType = String(body.jobType || "Internship").trim();
    const gender = String(body.gender || "").trim().slice(0, 60);
    if (!validEmail(email) || !name || name.length > 120 || !role || role.length > 80 || !jobType || jobType.length > 80)
      return send(res, 400, { error: "Enter a valid name, email, and program." });
    try {
      const intern = await store.updateIntern({ id, email, name, role, jobType, gender, actor: current.account });
      return intern ? send(res, 200, { intern }) : send(res, 404, { error: "Intern account not found." });
    } catch (error) {
      if (error.code === "23505") return send(res, 409, { error: "An account already exists for this email." });
      throw error;
    }
  }

  if (url.pathname === "/api/admin/admins") {
    const current = await currentSession(req);
    if (!current || current.account.accountType !== "master_admin")
      return send(res, 403, { error: "Master administrator access is required." });
    if (req.method === "GET")
      return send(res, 200, { admins: await store.listAdmins(current.account.id) });
    if (req.method === "POST") {
      const body = await readBody(req);
      const email = String(body.email || "").trim().toLowerCase();
      const name = String(body.name || "").trim();
      const gender = String(body.gender || "").trim().slice(0, 60);
      const password = String(body.password || "");
      if (!validEmail(email) || !name || name.length > 120 || password.length < 8)
        return send(res, 400, { error: "Enter a valid name and email, and a password of at least 8 characters." });
      const credentials = await passwordRecord(password);
      try {
        await store.createAdmin({ id: randomUUID(), email, name, gender, ...credentials });
      } catch (error) {
        if (error.code === "23505") return send(res, 409, { error: "An account already exists for this email." });
        throw error;
      }
      return send(res, 201, { ok: true });
    }
  }

  const removeAdminMatch = url.pathname.match(/^\/api\/admin\/admins\/([^/]+)$/);
  if (req.method === "DELETE" && removeAdminMatch) {
    const current = await currentSession(req);
    if (!current || current.account.accountType !== "master_admin")
      return send(res, 403, { error: "Master administrator access is required." });
    let id;
    try { id = decodeURIComponent(removeAdminMatch[1]); }
    catch { return send(res, 400, { error: "Invalid administrator ID." }); }
    const result = await store.removeAdmin(id, current.account.id);
    if (result === "CURRENT_ACCOUNT") return send(res, 400, { error: "You cannot remove your own administrator account." });
    if (result === "LAST_ADMIN") return send(res, 400, { error: "The last administrator account cannot be removed." });
    if (result === "NOT_FOUND") return send(res, 404, { error: "Administrator account not found." });
    return send(res, 200, { ok: true });
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
    if (account.accountType === "staff") await store.recordStaffSignin(account.id);
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
    if (newPassword.length < 8) return send(res, 400, { error: "Use a password with at least 8 characters." });
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
    const bodyTooLarge = error.message === "Request body is too large";
    const clientError = bodyTooLarge || error.message === "Invalid JSON body";
    send(res, bodyTooLarge ? 413 : clientError ? 400 : 500, { error: clientError ? error.message : "Request failed." });
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
