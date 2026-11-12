import { NextResponse } from "next/server";
import { loadStore, saveStore } from "../../../../lib/crmServerStore";

export async function POST(request) {
  const body = await request.json();
  const state = loadStore();
  const prefix =
    (body.name || "COMP")
      .replace(/[^A-Za-z]/g, "")
      .slice(0, 5)
      .toUpperCase() || "CLIENT";
  const newCompany = {
    id: `COMP-0${state.companies.length + 1}`,
    name: body.name,
    company_code: (
      body.company_code || `ITD-${prefix}-0${state.companies.length + 1}`
    ).toUpperCase(),
    industry: body.industry || "Corporate Enterprise",
    plan: body.plan || "Growth Managed IT",
    retainer_ngn: Number(body.retainer_ngn) || 350000,
    assigned_manager_id: body.assigned_manager_id || "MGR-02",
    contact_name: body.contact_name || "",
    contact_email: body.contact_email || "",
    created_at: new Date().toISOString(),
  };
  state.companies.push(newCompany);
  saveStore(state);
  return NextResponse.json(newCompany);
}
