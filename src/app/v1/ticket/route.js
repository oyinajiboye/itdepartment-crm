import crypto from "crypto";
import { NextResponse } from "next/server";
import {
  loadStore,
  saveStore,
  verifyDeviceRequest,
  checkRateLimit,
  getClientIp,
} from "../../../lib/crmServerStore";

export async function POST(request) {
  const ip = getClientIp(request);
  if (!checkRateLimit(`ticket:${ip}`, 30, 600000)) {
    return NextResponse.json(
      { error: "Too many ticket requests. Please wait a few minutes." },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const state = await loadStore();

  const auth = verifyDeviceRequest(request, state, body.device_id);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const device = auth.device;
  const code = (device.company_code || body.company_code || "UNASSIGNED")
    .trim()
    .toUpperCase();
  const company = (state.companies || []).find(
    (c) => c.company_code.toUpperCase() === code
  );
  const assignedTo = company ? company.assigned_manager_id : null;
  const now = new Date().toISOString();
  const suffix = crypto.randomBytes(3).toString("hex").toUpperCase();
  const ticketId = `ITD-${new Date().getFullYear()}-${suffix}`;
  const remoteId = body.remote_id || body.rustdesk_id || device.remote_id || "";
  const employeeName =
    body.name || body.employee_name || device.employee_name || "Employee";
  const problem =
    body.problem || body.issue_summary || "Support request from Windows Assistant";

  device.employee_name = employeeName;
  device.department = body.department || device.department || "General";
  device.phone = body.phone || device.phone || "";
  device.remote_id = remoteId;
  device.rustdesk_id = remoteId;
  device.sysinfo = body.sysinfo || device.sysinfo || "";
  device.status = "online";
  device.last_seen = now;

  const ticket = {
    id: ticketId,
    ticket_id: ticketId,
    created: now,
    created_at: now,
    company_code: code,
    device_id: device.device_id,
    name: employeeName,
    employee_name: employeeName,
    department: device.department,
    phone: device.phone,
    hostname: body.hostname || device.hostname || "WIN-LAPTOP",
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
    ticket_id: ticketId,
    ticket_code: ticketId,
    status: "open",
    assigned_to: assignedTo,
    created_at: now,
  });
}
