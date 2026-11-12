import { NextResponse } from "next/server";
import { loadStore, saveStore } from "../../../../lib/crmServerStore";

export async function POST(request) {
  const body = await request.json();
  const state = loadStore();
  const newTask = {
    id: `TSK-30${state.hr_web_tasks.length + 1}`,
    company_code: body.company_code,
    task_type: body.task_type || "hr_onboarding",
    title: body.title,
    person_or_domain: body.person_or_domain || "",
    status: "pending",
    due_date: body.due_date || "Today",
    assigned_to: body.assigned_to || "MGR-02",
    created_at: new Date().toISOString(),
  };
  state.hr_web_tasks.unshift(newTask);
  saveStore(state);
  return NextResponse.json(newTask);
}
