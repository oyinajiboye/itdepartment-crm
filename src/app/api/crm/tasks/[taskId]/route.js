import { NextResponse } from "next/server";
import { loadStore, saveStore } from "../../../../../lib/crmServerStore";

export async function PATCH(request, { params }) {
  const { taskId } = params;
  const body = await request.json();
  const state = loadStore();
  let updated = null;
  state.hr_web_tasks = state.hr_web_tasks.map((t) => {
    if (t.id === taskId) {
      updated = { ...t, status: body.status || "completed" };
      return updated;
    }
    return t;
  });
  saveStore(state);
  if (!updated) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }
  return NextResponse.json(updated);
}
