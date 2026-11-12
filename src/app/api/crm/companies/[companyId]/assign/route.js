import { NextResponse } from "next/server";
import { loadStore, saveStore } from "../../../../../../lib/crmServerStore";

export async function PATCH(request, { params }) {
  const { companyId } = params;
  const body = await request.json();
  const state = loadStore();
  let updated = null;
  state.companies = state.companies.map((c) => {
    if (c.id === companyId || c.company_code === companyId) {
      updated = { ...c, assigned_manager_id: body.assigned_manager_id };
      return updated;
    }
    return c;
  });
  saveStore(state);
  if (!updated) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }
  return NextResponse.json(updated);
}
