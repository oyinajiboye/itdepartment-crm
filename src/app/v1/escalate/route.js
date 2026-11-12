import { NextResponse } from "next/server";
import { loadStore, saveStore } from "../../../lib/crmServerStore";

export async function POST(request) {
  const body = await request.json();
  const state = loadStore();
  const code = (body.company_code || "ITD-NEXUS-01").toUpperCase();
  const company = state.companies.find(
    (c) => c.company_code.toUpperCase() === code
  );
  const assignedTo = company ? company.assigned_manager_id : "MGR-02";
  const ticketId = `ITD-2026-${900 + state.tickets.length + 1}`;
  const ticket = {
    ticket_id: ticketId,
    company_code: code,
    device_id: body.device_id,
    employee_name: body.employee_name || body.hostname || "Employee",
    department: body.department || "General",
    hostname: body.hostname || "WIN-LAPTOP",
    rustdesk_id: body.rustdesk_id || "Pending",
    issue_summary: body.issue_summary || "Support request from Windows AI App",
    ai_summary:
      body.ai_summary ||
      "Escalated from Windows AI Support Agent with device telemetry.",
    priority: body.priority || "high",
    status: "open",
    assigned_to: assignedTo,
    manager_reply: "",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  state.tickets.unshift(ticket);
  saveStore(state);
  return NextResponse.json({
    ticket_id: ticketId,
    status: "open",
    assigned_to: assignedTo,
    created_at: ticket.created_at,
  });
}
