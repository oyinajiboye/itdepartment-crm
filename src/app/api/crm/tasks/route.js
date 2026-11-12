import { NextResponse } from "next/server";
import {
  loadStore,
  saveStore,
  getAuthenticatedUser,
} from "../../../../lib/crmServerStore";

export async function POST(request) {
  const user = getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const state = loadStore();
  const nextNum = String((state.hr_web_tasks || []).length + 1).padStart(2, "0");

  const newTask = {
    id: `TSK-${nextNum}-${Date.now()}`,
    company_code: (body.company_code || "").trim().toUpperCase(),
    task_type: body.task_type || "HR Onboarding",
    title: (body.title || "").trim(),
    requested_by: (body.requested_by || body.person_or_domain || "").trim(),
    status: "Pending",
    assigned_to: body.assigned_to || user.id,
    created_at: new Date().toISOString(),
  };

  state.hr_web_tasks.unshift(newTask);
  saveStore(state);
  return NextResponse.json(newTask);
}
