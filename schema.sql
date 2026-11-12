-- =============================================================================
-- IT Department NG (itdepartment.ng) — Production PostgreSQL Schema
-- Compatible with Neon Serverless Postgres, Vercel Postgres, and standard PG
-- =============================================================================

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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
  assigned_manager_id TEXT REFERENCES crm_managers(id) ON DELETE SET NULL,
  ceo_contact TEXT NOT NULL DEFAULT '',
  hr_contact TEXT NOT NULL DEFAULT '',
  admin_contact TEXT NOT NULL DEFAULT '',
  domain_name TEXT NOT NULL DEFAULT '',
  ssl_status TEXT NOT NULL DEFAULT 'Active (Valid)',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_hr_web_tasks (
  id TEXT PRIMARY KEY,
  company_code TEXT NOT NULL,
  task_type TEXT NOT NULL,
  title TEXT NOT NULL,
  requested_by TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Pending',
  assigned_to TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_companies_manager ON crm_companies(assigned_manager_id);
CREATE INDEX IF NOT EXISTS idx_devices_company ON crm_devices(company_code);
CREATE INDEX IF NOT EXISTS idx_fix_logs_company ON crm_fix_logs(company_code);
CREATE INDEX IF NOT EXISTS idx_tickets_company ON crm_tickets(company_code);
CREATE INDEX IF NOT EXISTS idx_hr_web_company ON crm_hr_web_tasks(company_code);
