import { NextResponse } from "next/server";
import {
  loadStore,
  saveStore,
  getAuthenticatedUser,
} from "../../../../../lib/crmServerStore";

export async function PATCH(request, { params }) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { taskId } = params;
  const body = await request.json();
  const state = await loadStore();
  let updated = null;

  state.hr_web_tasks = (state.hr_web_tasks || []).map((t) => {
    if (String(t.id) === String(taskId)) {
      updated = { ...t, status: body.status || "Completed" };
      return updated;
    }
    return t;
  });

  await saveStore(state);
  if (!updated) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }
  return NextResponse.json(updated);
}
