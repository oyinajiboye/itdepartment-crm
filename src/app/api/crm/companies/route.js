import { NextResponse } from "next/server";
import {
  loadStore,
  saveStore,
  getAuthenticatedUser,
} from "../../../../lib/crmServerStore";

export async function POST(request) {
  const user = getAuthenticatedUser(request);
  if (!user || user.role !== "super_manager") {
    return NextResponse.json(
      { error: "Only the Super Manager can onboard client companies." },
      { status: 403 }
    );
  }

  const body = await request.json();
  const state = loadStore();

  const name = (body.name || "").trim();
  if (!name) {
    return NextResponse.json(
      { error: "Company name is required." },
      { status: 400 }
    );
  }

  const prefix =
    name
      .replace(/[^A-Za-z0-9]/g, "")
      .slice(0, 6)
      .toUpperCase() || "CLIENT";
  const nextNum = String(state.companies.length + 1).padStart(2, "0");
  const companyCode = (
    body.company_code || `ITD-${prefix}-${nextNum}`
  )
    .trim()
    .toUpperCase();

  const planTier = body.plan_tier || body.plan || "Growth Department SLA";
  const monthlyRetainer =
    body.monthly_retainer !== undefined
      ? Number(body.monthly_retainer)
      : Number(body.retainer_ngn) || 300000;

  const newCompany = {
    id: `COMP-${nextNum}`,
    name,
    company_code: companyCode,
    industry: (body.industry || "Corporate Enterprise").trim(),
    plan_tier: planTier,
    monthly_retainer: monthlyRetainer,
    max_pcs: Number(body.max_pcs) || 40,
    onsite_visits_used: 0,
    onsite_visits_quota: Number(body.onsite_visits_quota) || 3,
    assigned_manager_id: body.assigned_manager_id || user.id,
    ceo_contact: (body.ceo_contact || body.contact_name || "").trim(),
    hr_contact: (body.hr_contact || "").trim(),
    admin_contact: (body.admin_contact || body.hr_contact || "").trim(),
    domain_name: (body.domain_name || "").trim(),
    ssl_status: body.ssl_status || "Active (Valid)",
    created_at: new Date().toISOString(),
  };

  state.companies.push(newCompany);
  state.onboarding_completed = true;
  saveStore(state);

  return NextResponse.json(newCompany);
}
