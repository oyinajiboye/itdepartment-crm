import fs from "fs";
import path from "path";
import crypto from "crypto";
import { Pool } from "pg";

const SESSION_SECRET =
  process.env.CRM_SESSION_SECRET ||
  "itdepartment-ng-prod-hmac-secret-key-2026";

const DATABASE_URL =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  "";

function getLocalStorePath() {
  if (process.env.CRM_DATA_FILE) return process.env.CRM_DATA_FILE;
  if (process.env.VERCEL) {
    return path.join("/tmp", "itd_crm_prod_v1.json");
  }
  const dataDir = path.join(process.cwd(), "data");
  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    return path.join(dataDir, "itd_crm_prod.json");
  } catch {
    return path.join("/tmp", "itd_crm_prod_v1.json");
  }
}

let pgPool = null;
let schemaInitialized = false;

function getPgPool() {
  if (!DATABASE_URL) return null;
  if (!pgPool) {
    const isLocalhost =
      DATABASE_URL.includes("localhost") || DATABASE_URL.includes("127.0.0.1");
    pgPool = new Pool({
      connectionString: DATABASE_URL,
      ssl: isLocalhost ? false : { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 8000,
    });
  }
  return pgPool;
}

export function getDatabaseEngineInfo() {
  const pool = getPgPool();
  if (pool) {
    return {
      engine: "postgresql",
      connected: true,
      mode: "Neon / Vercel Postgres (DATABASE_URL)",
    };
  }
  return {
    engine: "local-persistent-store",
    connected: true,
    mode: process.env.VERCEL
      ? "Serverless Fallback (Set DATABASE_URL in Vercel for Postgres)"
      : "Local Persistent Database (data/itd_crm_prod.json)",
  };
}

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

export async function getAuthenticatedUser(request) {
  const token = getTokenFromRequest(request);
  const session = verifySessionToken(token);
  if (!session) return null;
  const state = await loadStore();
  const manager = (state.managers || []).find(
    (m) =>
      String(m.id) === String(session.id) ||
      m.email.toLowerCase() === String(session.email).toLowerCase()
  );
  if (manager) {
    const { password_hash, ...safeManager } = manager;
    return safeManager;
  }
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

// =============================================================================
// PostgreSQL Relational Schema & Synchronization
// =============================================================================
async function ensurePostgresSchema(pool) {
  if (schemaInitialized) return;
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS crm_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS crm_managers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        phone TEXT NOT NULL DEFAULT '',
        role TEXT NOT NULL DEFAULT 'it_manager',
        specialization TEXT NOT NULL DEFAULT 'Systems, Network & Endpoint Lead',
        password_hash TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        onboarded BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS crm_companies (
        id TEXT PRIMARY KEY,
        company_code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        industry TEXT NOT NULL DEFAULT 'Corporate Enterprise',
        plan_tier TEXT NOT NULL DEFAULT 'Growth Department SLA',
        monthly_retainer INTEGER NOT NULL DEFAULT 300000,
        max_pcs INTEGER NOT NULL DEFAULT 40,
        onsite_visits_used INTEGER NOT NULL DEFAULT 0,
        onsite_visits_quota INTEGER NOT NULL DEFAULT 3,
        assigned_manager_id TEXT,
        ceo_contact TEXT NOT NULL DEFAULT '',
        hr_contact TEXT NOT NULL DEFAULT '',
        admin_contact TEXT NOT NULL DEFAULT '',
        domain_name TEXT NOT NULL DEFAULT '',
        ssl_status TEXT NOT NULL DEFAULT 'Active (Valid)',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS crm_devices (
        device_id TEXT PRIMARY KEY,
        company_code TEXT NOT NULL,
        employee_name TEXT NOT NULL DEFAULT '',
        department TEXT NOT NULL DEFAULT 'General',
        phone TEXT NOT NULL DEFAULT '',
        hostname TEXT NOT NULL DEFAULT 'WIN-LAPTOP',
        os_version TEXT NOT NULL DEFAULT 'Windows 11 Pro',
        sysinfo TEXT NOT NULL DEFAULT '',
        remote_id TEXT NOT NULL DEFAULT '',
        rustdesk_id TEXT NOT NULL DEFAULT '',
        ip_address TEXT NOT NULL DEFAULT '',
        agent_version TEXT NOT NULL DEFAULT '1.2.0',
        health_status TEXT NOT NULL DEFAULT 'Healthy',
        status TEXT NOT NULL DEFAULT 'online',
        last_seen TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS crm_fix_logs (
        id TEXT PRIMARY KEY,
        device_id TEXT NOT NULL,
        company_code TEXT NOT NULL,
        employee_name TEXT NOT NULL DEFAULT '',
        hostname TEXT NOT NULL DEFAULT 'WIN-LAPTOP',
        fix_id TEXT NOT NULL,
        fix_title TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'General',
        ok BOOLEAN NOT NULL DEFAULT TRUE,
        status TEXT NOT NULL DEFAULT 'success',
        output TEXT NOT NULL DEFAULT '',
        mode TEXT NOT NULL DEFAULT 'online',
        duration_ms INTEGER NOT NULL DEFAULT 1200,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS crm_tickets (
        id TEXT PRIMARY KEY,
        ticket_id TEXT UNIQUE NOT NULL,
        created TEXT NOT NULL,
        device_id TEXT NOT NULL,
        company_code TEXT NOT NULL,
        name TEXT NOT NULL,
        employee_name TEXT NOT NULL DEFAULT '',
        department TEXT NOT NULL DEFAULT 'General',
        phone TEXT NOT NULL DEFAULT '',
        hostname TEXT NOT NULL DEFAULT 'WIN-LAPTOP',
        problem TEXT NOT NULL,
        issue_summary TEXT NOT NULL DEFAULT '',
        transcript TEXT NOT NULL DEFAULT '',
        sysinfo TEXT NOT NULL DEFAULT '',
        remote_id TEXT NOT NULL DEFAULT '',
        rustdesk_id TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'open',
        priority TEXT NOT NULL DEFAULT 'High (< 15m SLA)',
        assigned_manager_id TEXT,
        manager_reply TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS crm_hr_web_tasks (
        id TEXT PRIMARY KEY,
        company_code TEXT NOT NULL,
        task_type TEXT NOT NULL,
        title TEXT NOT NULL,
        requested_by TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'Pending',
        assigned_to TEXT,
        created_at TEXT NOT NULL
      );
    `);
    schemaInitialized = true;
  } finally {
    client.release();
  }
}

async function loadFromPostgres(pool) {
  await ensurePostgresSchema(pool);
  const client = await pool.connect();
  try {
    const [
      mgrRes,
      compRes,
      devRes,
      fixRes,
      tktRes,
      taskRes,
      setRes,
    ] = await Promise.all([
      client.query("SELECT * FROM crm_managers ORDER BY created_at ASC"),
      client.query("SELECT * FROM crm_companies ORDER BY created_at ASC"),
      client.query("SELECT * FROM crm_devices ORDER BY last_seen DESC"),
      client.query(
        "SELECT * FROM crm_fix_logs ORDER BY created_at DESC LIMIT 200"
      ),
      client.query("SELECT * FROM crm_tickets ORDER BY created DESC LIMIT 200"),
      client.query("SELECT * FROM crm_hr_web_tasks ORDER BY created_at DESC"),
      client.query(
        "SELECT value FROM crm_settings WHERE key = 'onboarding_completed'"
      ),
    ]);

    const onboardingCompleted =
      setRes.rows.length > 0 && setRes.rows[0].value === "true";

    if (
      mgrRes.rows.length === 0 &&
      process.env.ADMIN_EMAIL &&
      process.env.ADMIN_PASSWORD
    ) {
      const initial = createEmptyStore();
      await saveToPostgres(pool, initial);
      return initial;
    }

    return {
      managers: mgrRes.rows,
      companies: compRes.rows,
      devices: devRes.rows,
      fix_logs: fixRes.rows,
      tickets: tktRes.rows,
      hr_web_tasks: taskRes.rows,
      onboarding_completed: onboardingCompleted,
    };
  } finally {
    client.release();
  }
}

async function saveToPostgres(pool, state) {
  await ensurePostgresSchema(pool);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `INSERT INTO crm_settings (key, value, updated_at)
       VALUES ('onboarding_completed', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [state.onboarding_completed ? "true" : "false"]
    );

    for (const m of state.managers || []) {
      await client.query(
        `INSERT INTO crm_managers (
           id, name, email, phone, role, specialization, password_hash, status, onboarded, created_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           email = EXCLUDED.email,
           phone = EXCLUDED.phone,
           role = EXCLUDED.role,
           specialization = EXCLUDED.specialization,
           password_hash = EXCLUDED.password_hash,
           status = EXCLUDED.status,
           onboarded = EXCLUDED.onboarded`,
        [
          String(m.id),
          m.name || "",
          (m.email || "").toLowerCase(),
          m.phone || "",
          m.role || "it_manager",
          m.specialization || m.specialty || "Systems, Network & Endpoint Lead",
          m.password_hash || "",
          m.status || "active",
          Boolean(m.onboarded ?? true),
          m.created_at || new Date().toISOString(),
        ]
      );
    }

    for (const c of state.companies || []) {
      await client.query(
        `INSERT INTO crm_companies (
           id, company_code, name, industry, plan_tier, monthly_retainer, max_pcs,
           onsite_visits_used, onsite_visits_quota, assigned_manager_id,
           ceo_contact, hr_contact, admin_contact, domain_name, ssl_status, created_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         ON CONFLICT (company_code) DO UPDATE SET
           name = EXCLUDED.name,
           industry = EXCLUDED.industry,
           plan_tier = EXCLUDED.plan_tier,
           monthly_retainer = EXCLUDED.monthly_retainer,
           max_pcs = EXCLUDED.max_pcs,
           onsite_visits_used = EXCLUDED.onsite_visits_used,
           onsite_visits_quota = EXCLUDED.onsite_visits_quota,
           assigned_manager_id = EXCLUDED.assigned_manager_id,
           ceo_contact = EXCLUDED.ceo_contact,
           hr_contact = EXCLUDED.hr_contact,
           admin_contact = EXCLUDED.admin_contact,
           domain_name = EXCLUDED.domain_name,
           ssl_status = EXCLUDED.ssl_status`,
        [
          String(c.id || c.company_code),
          (c.company_code || "").toUpperCase(),
          c.name || "",
          c.industry || "Corporate Enterprise",
          c.plan_tier || c.plan || "Growth Department SLA",
          Number(c.monthly_retainer ?? c.retainer_ngn ?? 300000),
          Number(c.max_pcs || 40),
          Number(c.onsite_visits_used || 0),
          Number(c.onsite_visits_quota || 3),
          c.assigned_manager_id ? String(c.assigned_manager_id) : null,
          c.ceo_contact || "",
          c.hr_contact || "",
          c.admin_contact || "",
          c.domain_name || "",
          c.ssl_status || "Active (Valid)",
          c.created_at || new Date().toISOString(),
        ]
      );
    }

    for (const d of state.devices || []) {
      await client.query(
        `INSERT INTO crm_devices (
           device_id, company_code, employee_name, department, phone, hostname,
           os_version, sysinfo, remote_id, rustdesk_id, ip_address, agent_version,
           health_status, status, last_seen
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         ON CONFLICT (device_id) DO UPDATE SET
           company_code = EXCLUDED.company_code,
           employee_name = EXCLUDED.employee_name,
           department = EXCLUDED.department,
           phone = EXCLUDED.phone,
           hostname = EXCLUDED.hostname,
           os_version = EXCLUDED.os_version,
           sysinfo = EXCLUDED.sysinfo,
           remote_id = EXCLUDED.remote_id,
           rustdesk_id = EXCLUDED.rustdesk_id,
           ip_address = EXCLUDED.ip_address,
           agent_version = EXCLUDED.agent_version,
           health_status = EXCLUDED.health_status,
           status = EXCLUDED.status,
           last_seen = EXCLUDED.last_seen`,
        [
          String(d.device_id),
          (d.company_code || "UNASSIGNED").toUpperCase(),
          d.employee_name || "",
          d.department || "General",
          d.phone || "",
          d.hostname || "WIN-LAPTOP",
          d.os_version || "Windows 11 Pro",
          d.sysinfo || d.os_version || "Windows 11 Pro",
          d.remote_id || d.rustdesk_id || "",
          d.rustdesk_id || d.remote_id || "",
          d.ip_address || "",
          d.agent_version || "1.2.0",
          d.health_status || "Healthy",
          d.status || "online",
          d.last_seen || new Date().toISOString(),
        ]
      );
    }

    for (const f of state.fix_logs || []) {
      await client.query(
        `INSERT INTO crm_fix_logs (
           id, device_id, company_code, employee_name, hostname, fix_id, fix_title,
           category, ok, status, output, mode, duration_ms, created_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         ON CONFLICT (id) DO NOTHING`,
        [
          String(f.id),
          String(f.device_id || ""),
          (f.company_code || "UNASSIGNED").toUpperCase(),
          f.employee_name || "",
          f.hostname || "WIN-LAPTOP",
          f.fix_id || "",
          f.fix_title || f.fix_id || "",
          f.category || "General",
          Boolean(f.ok ?? true),
          f.status || "success",
          f.output || f.details || "",
          f.mode || "online",
          Number(f.duration_ms || 1200),
          f.created_at || new Date().toISOString(),
        ]
      );
    }

    for (const t of state.tickets || []) {
      const tid = String(t.id || t.ticket_id);
      await client.query(
        `INSERT INTO crm_tickets (
           id, ticket_id, created, device_id, company_code, name, employee_name,
           department, phone, hostname, problem, issue_summary, transcript, sysinfo,
           remote_id, rustdesk_id, status, priority, assigned_manager_id, manager_reply, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
         ON CONFLICT (id) DO UPDATE SET
           status = EXCLUDED.status,
           assigned_manager_id = EXCLUDED.assigned_manager_id,
           manager_reply = EXCLUDED.manager_reply,
           updated_at = EXCLUDED.updated_at`,
        [
          tid,
          String(t.ticket_id || tid),
          t.created || t.created_at || new Date().toISOString(),
          String(t.device_id || ""),
          (t.company_code || "UNASSIGNED").toUpperCase(),
          t.name || t.employee_name || "Employee",
          t.employee_name || t.name || "Employee",
          t.department || "General",
          t.phone || "",
          t.hostname || "WIN-LAPTOP",
          t.problem || t.issue_summary || "",
          t.issue_summary || t.problem || "",
          t.transcript || t.ai_summary || "",
          t.sysinfo || "",
          t.remote_id || t.rustdesk_id || "",
          t.rustdesk_id || t.remote_id || "",
          t.status || "open",
          t.priority || "High (< 15m SLA)",
          t.assigned_manager_id || t.assigned_to || null,
          t.manager_reply || "",
          t.updated_at || new Date().toISOString(),
        ]
      );
    }

    for (const h of state.hr_web_tasks || []) {
      await client.query(
        `INSERT INTO crm_hr_web_tasks (
           id, company_code, task_type, title, requested_by, status, assigned_to, created_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (id) DO UPDATE SET
           status = EXCLUDED.status,
           title = EXCLUDED.title,
           requested_by = EXCLUDED.requested_by`,
        [
          String(h.id),
          (h.company_code || "").toUpperCase(),
          h.task_type || "HR Onboarding",
          h.title || "",
          h.requested_by || "",
          h.status || "Pending",
          h.assigned_to || null,
          h.created_at || new Date().toISOString(),
        ]
      );
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// =============================================================================
// Unified Async Store API (PostgreSQL primary -> Local Persistent fallback)
// =============================================================================
export async function loadStore() {
  const pool = getPgPool();
  if (pool) {
    try {
      return await loadFromPostgres(pool);
    } catch (err) {
      console.error("PostgreSQL load error, falling back to local store:", err);
    }
  }

  const storeFile = getLocalStorePath();
  try {
    if (fs.existsSync(storeFile)) {
      const raw = fs.readFileSync(storeFile, "utf8");
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.managers)) {
        return parsed;
      }
    }
  } catch {
    // Fallback to clean empty store
  }
  const initial = createEmptyStore();
  await saveStore(initial);
  return initial;
}

export async function saveStore(state) {
  const pool = getPgPool();
  if (pool) {
    try {
      await saveToPostgres(pool, state);
      return state;
    } catch (err) {
      console.error("PostgreSQL save error, writing to local store:", err);
    }
  }

  const storeFile = getLocalStorePath();
  try {
    fs.writeFileSync(storeFile, JSON.stringify(state, null, 2), "utf8");
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
