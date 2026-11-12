import fs from "fs";
import path from "path";
import crypto from "crypto";

const STORE_FILE =
  process.env.CRM_DATA_FILE || path.join("/tmp", "itd_crm_prod_v1.json");
const SESSION_SECRET =
  process.env.CRM_SESSION_SECRET ||
  "itdepartment-ng-prod-hmac-secret-key-2026";

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(":")) return false;
  const [salt, key] = storedHash.split(":");
  const derived = crypto.scryptSync(String(password), salt, 64);
  const keyBuf = Buffer.from(key, "hex");
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

export function createSessionToken(manager) {
  const payload = {
    id: manager.id,
    email: manager.email,
    role: manager.role,
    name: manager.name,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days
  };
  const base64Payload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url"
  );
  const signature = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(base64Payload)
    .digest("base64url");
  return `${base64Payload}.${signature}`;
}

export function verifySessionToken(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const [base64Payload, signature] = token.split(".");
  const expectedSig = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(base64Payload)
    .digest("base64url");
  if (signature !== expectedSig) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(base64Payload, "base64url").toString("utf8")
    );
    if (!payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export function getTokenFromRequest(request) {
  const authHeader = request.headers.get("authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }
  const cookieHeader = request.headers.get("cookie") || "";
  const match = cookieHeader.match(/(?:^|;\s*)itd_crm_session=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function getAuthenticatedUser(request) {
  const token = getTokenFromRequest(request);
  const session = verifySessionToken(token);
  if (!session) return null;
  const state = loadStore();
  const manager = state.managers.find(
    (m) =>
      String(m.id) === String(session.id) ||
      m.email.toLowerCase() === String(session.email).toLowerCase()
  );
  if (manager) {
    const { password_hash, ...safeManager } = manager;
    return safeManager;
  }
  // If serverless instance restarted and token is valid, return session identity
  return {
    id: session.id,
    email: session.email,
    name: session.name,
    role: session.role,
    status: "active",
  };
}

function createEmptyStore() {
  const managers = [];

  // Optional environment-variable bootstrap for Super Manager on Vercel
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    managers.push({
      id: "MGR-01",
      name: process.env.ADMIN_NAME || "Super Manager",
      email: process.env.ADMIN_EMAIL.trim().toLowerCase(),
      phone: process.env.ADMIN_PHONE || "",
      role: "super_manager",
      specialization: "Executive Operations & SLA Director",
      password_hash: hashPassword(process.env.ADMIN_PASSWORD),
      status: "active",
      onboarded: true,
      created_at: new Date().toISOString(),
    });
  }

  return {
    managers,
    companies: [],
    devices: [],
    fix_logs: [],
    tickets: [],
    hr_web_tasks: [],
    onboarding_completed: false,
  };
}

export function loadStore() {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, "utf8");
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.managers)) {
        return parsed;
      }
    }
  } catch {
    // Fallback to clean empty store
  }
  const initial = createEmptyStore();
  saveStore(initial);
  return initial;
}

export function saveStore(state) {
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(state, null, 2), "utf8");
  } catch {
    // Ignore read-only filesystem errors if any
  }
  return state;
}

export function sanitizeStateForUser(state, user) {
  const safeManagers = (state.managers || []).map(
    ({ password_hash, ...rest }) => rest
  );

  if (!user) {
    return {
      managers: [],
      companies: [],
      devices: [],
      fix_logs: [],
      tickets: [],
      hr_web_tasks: [],
      onboarding_completed: Boolean(state.onboarding_completed),
    };
  }

  if (user.role === "super_manager") {
    return {
      managers: safeManagers,
      companies: state.companies || [],
      devices: state.devices || [],
      fix_logs: state.fix_logs || [],
      tickets: state.tickets || [],
      hr_web_tasks: state.hr_web_tasks || [],
      onboarding_completed: Boolean(state.onboarding_completed),
    };
  }

  // Scoped view for an authenticated IT Manager
  const assignedCompanies = (state.companies || []).filter(
    (c) => String(c.assigned_manager_id) === String(user.id)
  );
  const allowedCodes = new Set(assignedCompanies.map((c) => c.company_code));

  return {
    managers: safeManagers.filter((m) => String(m.id) === String(user.id)),
    companies: assignedCompanies,
    devices: (state.devices || []).filter((d) =>
      allowedCodes.has(d.company_code)
    ),
    fix_logs: (state.fix_logs || []).filter((f) =>
      allowedCodes.has(f.company_code)
    ),
    tickets: (state.tickets || []).filter((t) =>
      allowedCodes.has(t.company_code)
    ),
    hr_web_tasks: (state.hr_web_tasks || []).filter((h) =>
      allowedCodes.has(h.company_code)
    ),
    onboarding_completed: Boolean(state.onboarding_completed),
  };
}

export function computeSummary(state) {
  const companies = state.companies || [];
  const devices = state.devices || [];
  const tickets = state.tickets || [];
  const fixLogs = state.fix_logs || [];
  return {
    total_companies: companies.length,
    total_devices: devices.length,
    open_tickets: tickets.filter((t) => t.status !== "Resolved").length,
    total_fixes: fixLogs.length,
    monthly_retainer_total: companies.reduce(
      (sum, c) => sum + (Number(c.monthly_retainer || c.retainer_ngn) || 0),
      0
    ),
  };
}
