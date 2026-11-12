import { NextResponse } from "next/server";
import { loadStore, saveStore } from "../../../lib/crmServerStore";

export async function POST(request) {
  const body = await request.json();
  const state = await loadStore();
  const code = (body.company_code || "ITD-UNASSIGNED").trim().toUpperCase();
  const company = state.companies.find(
    (c) => c.company_code.toUpperCase() === code
  );
  if (!company) {
    return NextResponse.json(
      { error: `Company Code '${code}' not found in CRM` },
      { status: 404 }
    );
  }
  const manager = state.managers.find(
    (m) => String(m.id) === String(company.assigned_manager_id)
  );
  const remoteId = body.remote_id || body.rustdesk_id || "";
  const sysinfo =
    body.sysinfo ||
    `${body.os_version || "Windows 11 Pro"} (${body.hostname || "WIN-LAPTOP"})`;

  const deviceRecord = {
    device_id: body.device_id,
    company_code: company.company_code,
    employee_name: body.employee_name || body.hostname || "Employee",
    department: body.department || "General",
    phone: body.phone || "",
    hostname: body.hostname || "WIN-LAPTOP",
    os_version: body.os_version || "Windows 11 Pro",
    sysinfo,
    remote_id: remoteId,
    rustdesk_id: remoteId,
    ip_address: body.ip_address || "0.0.0.0",
    agent_version: body.agent_version || "1.2.0",
    health_status: body.health_status || "Healthy",
    status: "online",
    last_seen: new Date().toISOString(),
  };

  const existingIdx = state.devices.findIndex(
    (d) => d.device_id === body.device_id
  );
  if (existingIdx >= 0) {
    state.devices[existingIdx] = deviceRecord;
  } else {
    state.devices.unshift(deviceRecord);
  }
  await saveStore(state);

  return NextResponse.json({
    enrolled: true,
    company_code: company.company_code,
    company_name: company.name,
    assigned_manager_id: company.assigned_manager_id,
    assigned_it_manager: manager ? manager.name : "IT Operations Manager",
    assigned_manager_name: manager ? manager.name : "IT Operations Manager",
    device: deviceRecord,
  });
}
