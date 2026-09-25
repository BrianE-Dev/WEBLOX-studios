import { createServer } from "node:http";
import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";
import { createMemoryStore } from "./store.js";

const scrypt = promisify(scryptCallback);
const store = createMemoryStore();
const sessions = new Map();
const port = Number(process.env.API_PORT || 3001);
const allowedOrigin = process.env.APP_ORIGIN || `http://localhost:5173`;
const cookieName = "weblox_session";
const sessionTtl = 1000 * 60 * 60 * 24 * 7;
const staffDirectory = new Map();

function send(res, status, data, headers = {}) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    ...headers,
  });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 16_384) reject(new Error("Request body is too large"));
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
    return send(res, 200, { status: "ok" });

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

  if (req.method === "POST" && url.pathname === "/api/staff/sync") {
    const body = await readBody(req);
    const entries = Array.isArray(body.staff) ? body.staff : [];
    for (const entry of entries) {
      const email = String(entry.email || "")
        .trim()
        .toLowerCase();
      if (email)
        staffDirectory.set(email, {
          email,
          name: String(entry.name || "").trim(),
          role: String(entry.role || "").trim(),
        });
    }
    return send(res, 200, { staff: [...staffDirectory.values()] });
  }

  if (req.method === "GET" && url.pathname === "/api/staff") {
    return send(res, 200, { staff: [...staffDirectory.values()] });
  }

  if (req.method === "POST" && url.pathname === "/api/auth/register") {
    const body = await readBody(req);
    const email = String(body.email || "")
      .trim()
      .toLowerCase();
    const password = String(body.password || "");
    const name = String(body.name || "").trim();
    const role = String(body.role || "").trim();
    if (!email || !name || !role || password.length < 10)
      return send(res, 400, {
        error:
          "Name, email, role, and a password of at least 10 characters are required.",
      });
    const credentials = await passwordRecord(password);
    const account = {
      id: createHash("sha256").update(email).digest("hex").slice(0, 16),
      email,
      name,
      role,
      ...credentials,
      createdAt: new Date().toISOString(),
    };
    if (!(await store.createAccount(account)))
      return send(res, 409, {
        error: "An account already exists for this email.",
      });
    return send(res, 201, { account: publicAccount(account) });
  }

  if (req.method === "POST" && url.pathname === "/api/auth/login") {
    const body = await readBody(req);
    const email = String(body.email || "")
      .trim()
      .toLowerCase();
    const password = String(body.password || "");
    const account = await store.findAccountByEmail(email);
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
    sessions.set(token, { account, expiresAt: Date.now() + sessionTtl });
    return send(
      res,
      200,
      { account: publicAccount(account) },
      {
        "set-cookie": `${cookieName}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${sessionTtl / 1000}`,
      },
    );
  }

  if (req.method === "GET" && url.pathname === "/api/auth/session") {
    const token = parseCookies(req.headers.cookie)[cookieName];
    const session = token && sessions.get(token);
    if (!session || session.expiresAt < Date.now())
      return send(res, 401, { error: "Not signed in." });
    return send(res, 200, { account: publicAccount(session.account) });
  }

  if (req.method === "POST" && url.pathname === "/api/auth/logout") {
    const token = parseCookies(req.headers.cookie)[cookieName];
    if (token) sessions.delete(token);
    return send(
      res,
      200,
      { ok: true },
      {
        "set-cookie": `${cookieName}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`,
      },
    );
  }
  return send(res, 404, { error: "Not found." });
}

createServer((req, res) => {
  handler(req, res).catch((error) => {
    console.error(error);
    send(res, 400, { error: error.message || "Request failed." });
  });
}).listen(port, () =>
  console.log(`WEBLOX auth API listening on http://localhost:${port}`),
);
