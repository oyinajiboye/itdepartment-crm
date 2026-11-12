import { NextResponse } from "next/server";
import { loadStore, saveStore } from "../../../lib/crmServerStore";

export async function POST(request) {
  const body = await request.json();
  const state = await loadStore();
  const code = (body.company_code || "UNASSIGNED").trim().toUpperCase();
  const company = state.companies.find(
    (c) => c.company_code.toUpperCase() === code
  );
  const assignedTo = company ? company.assigned_manager_id : null;
  const ticketNum = 900 + state.tickets.length + 1;
  const ticketId = `ITD-2026-${ticketNum}`;
  const now = new Date().toISOString();
  const remoteId = body.remote_id || body.rustdesk_id || "";
  const employeeName =
    body.name || body.employee_name || body.hostname || "Employee";
  const problem =
    body.problem || body.issue_summary || "Support request from Windows AI App";

  if (body.device_id) {
    const devIdx = state.devices.findIndex(
      (d) => d.device_id === body.device_id
    );
    const deviceRecord = {
      device_id: body.device_id,
      company_code: code,
      employee_name: employeeName,
      department: body.department || "General",
      phone: body.phone || "",
      hostname: body.hostname || "WIN-LAPTOP",
      os_version: body.os_version || "Windows 11 Pro",
      sysinfo: body.sysinfo || "Windows 11 Pro",
      remote_id: remoteId,
      rustdesk_id: remoteId,
      ip_address: body.ip_address || "0.0.0.0",
      agent_version: body.agent_version || "2.4.0",
      health_status: "Healthy",
      status: "online",
      last_seen: now,
    };
    if (devIdx >= 0) {
      state.devices[devIdx] = { ...state.devices[devIdx], ...deviceRecord };
    } else {
      state.devices.unshift(deviceRecord);
    }
  }

  const ticket = {
    id: ticketId,
    ticket_id: ticketId,
    created: now,
    created_at: now,
    company_code: code,
    device_id: body.device_id,
    name: employeeName,
    employee_name: employeeName,
    department: body.department || "General",
    phone: body.phone || "",
    hostname: body.hostname || "WIN-LAPTOP",
    remote_id: remoteId,
    rustdesk_id: remoteId,
    problem,
    issue_summary: problem,
    transcript: body.transcript || body.ai_summary || "",
    sysinfo: body.sysinfo || "",
    priority: body.priority || "High (< 15m SLA)",
    status: "open",
    assigned_manager_id: assignedTo,
    assigned_to: assignedTo,
    manager_reply: "",
    updated_at: now,
  };
  state.tickets.unshift(ticket);
  await saveStore(state);

  return NextResponse.json({
    ticket_id: ticketNum,
    ticket_code: ticketId,
    status: "open",
    assigned_to: assignedTo,
    created_at: now,
  });
}

