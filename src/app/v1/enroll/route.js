import { NextResponse } from "next/server";
import {
  loadStore,
  saveStore,
  generateDeviceToken,
  hashDeviceToken,
  verifySecretEqual,
  checkRateLimit,
  getClientIp,
} from "../../../lib/crmServerStore";

export async function POST(request) {
  const ip = getClientIp(request);
  if (!checkRateLimit(`enroll:${ip}`, 15, 600000)) {
    return NextResponse.json(
      { error: "Too many enrollment attempts. Please wait a few minutes and try again." },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const deviceId = String(body.device_id || "").trim();
  const code = String(body.company_code || "").trim().toUpperCase();
  const enrollmentKey = String(body.enrollment_key || "").trim().toUpperCase();

  if (!deviceId || !code || !enrollmentKey) {
    return NextResponse.json(
      { error: "device_id, company_code, and enrollment_key are required." },
      { status: 400 }
    );
  }

  const state = await loadStore();
  const company = (state.companies || []).find(
    (c) => c.company_code.toUpperCase() === code
  );
  if (!company) {
    return NextResponse.json(
      { error: `Company Code '${code}' not found in CRM.` },
      { status: 404 }
    );
  }

  if (!verifySecretEqual(enrollmentKey, (company.enrollment_key || "").toUpperCase())) {
    return NextResponse.json(
      { error: "Invalid Enrollment Key for this Company Code." },
      { status: 401 }
    );
  }

  const manager = (state.managers || []).find(
    (m) => String(m.id) === String(company.assigned_manager_id)
  );
  const remoteId = body.remote_id || body.rustdesk_id || "";
  const sysinfo =
    body.sysinfo ||
    `${body.os_version || "Windows 11 Pro"} (${body.hostname || "WIN-LAPTOP"})`;

  const existingIdx = (state.devices || []).findIndex(
    (d) => d.device_id === deviceId
  );
  const existing = existingIdx >= 0 ? state.devices[existingIdx] : null;

  const deviceToken = generateDeviceToken();
  const approvalStatus =
    existing && existing.approval_status === "approved" ? "approved" : "pending";

  const deviceRecord = {
    device_id: deviceId,
    company_code: company.company_code,
    employee_name: body.employee_name || body.hostname || "Employee",
    department: body.department || "General",
    phone: body.phone || "",
    hostname: body.hostname || "WIN-LAPTOP",
    os_version: body.os_version || "Windows 11 Pro",
    sysinfo,
    remote_id: remoteId,
    rustdesk_id: remoteId,
    ip_address: body.ip_address || ip,
    agent_version: body.agent_version || "1.3.0",
    health_status: body.health_status || "Healthy",
    status: "online",
    approval_status: approvalStatus,
    device_token_hash: hashDeviceToken(deviceToken),
    last_seen: new Date().toISOString(),
  };

  if (existingIdx >= 0) {
    state.devices[existingIdx] = deviceRecord;
  } else {
    state.devices.unshift(deviceRecord);
  }
  await saveStore(state);

  const { device_token_hash, ...safeDevice } = deviceRecord;
  return NextResponse.json({
    enrolled: true,
    device_token: deviceToken,
    approval_status: approvalStatus,
    company_code: company.company_code,
    company_name: company.name,
    assigned_manager_id: company.assigned_manager_id,
    assigned_it_manager: manager ? manager.name : "IT Operations Manager",
    assigned_manager_name: manager ? manager.name : "IT Operations Manager",
    device: safeDevice,
  });
}
