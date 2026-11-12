import { NextResponse } from "next/server";
import {
  loadStore,
  saveStore,
  getAuthenticatedUser,
} from "../../../../../lib/crmServerStore";

export async function PATCH(request, { params }) {
  const user = getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { ticketId } = params;
  const body = await request.json();
  const state = loadStore();
  let updated = null;

  state.tickets = (state.tickets || []).map((t) => {
    if (
      String(t.id) === String(ticketId) ||
      String(t.ticket_id) === String(ticketId)
    ) {
      updated = {
        ...t,
        status: body.status ?? t.status,
        manager_reply: body.manager_reply ?? t.manager_reply,
        assigned_manager_id:
          body.assigned_manager_id ?? body.assigned_to ?? t.assigned_manager_id,
        updated_at: new Date().toISOString(),
      };
      return updated;
    }
    return t;
  });

  saveStore(state);
  if (!updated) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }
  return NextResponse.json(updated);
}
