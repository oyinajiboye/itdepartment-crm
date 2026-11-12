import { NextResponse } from "next/server";
import { loadStore, saveStore } from "../../../../../lib/crmServerStore";

export async function PATCH(request, { params }) {
  const { ticketId } = params;
  const body = await request.json();
  const state = loadStore();
  let updated = null;
  state.tickets = state.tickets.map((t) => {
    if (t.ticket_id === ticketId) {
      updated = {
        ...t,
        status: body.status ?? t.status,
        manager_reply: body.manager_reply ?? t.manager_reply,
        assigned_to: body.assigned_to ?? t.assigned_to,
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
