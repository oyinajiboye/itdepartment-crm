import { NextResponse } from "next/server";
import {
  loadStore,
  saveStore,
  getAuthenticatedUser,
} from "../../../../../../lib/crmServerStore";

export async function PATCH(request, { params }) {
  const user = await getAuthenticatedUser(request);
  if (!user || user.role !== "super_manager") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { companyId } = params;
  const body = await request.json();
  const state = await loadStore();
  let updated = null;

  state.companies = state.companies.map((c) => {
    if (String(c.id) === String(companyId) || c.company_code === companyId) {
      updated = { ...c, assigned_manager_id: body.assigned_manager_id };
      return updated;
    }
    return c;
  });

  if (updated) {
    state.tickets = (state.tickets || []).map((t) =>
      t.company_code === updated.company_code && t.status !== "Resolved"
        ? { ...t, assigned_manager_id: body.assigned_manager_id }
        : t
    );
  }

  await saveStore(state);
  if (!updated) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }
  return NextResponse.json(updated);
}
