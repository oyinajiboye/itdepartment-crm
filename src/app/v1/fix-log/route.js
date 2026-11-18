import crypto from "crypto";
import { NextResponse } from "next/server";
import {
  loadStore,
  saveStore,
  verifyDeviceRequest,
} from "../../../lib/crmServerStore";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const state = await loadStore();

  const auth = verifyDeviceRequest(request, state, body.device_id);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const device = auth.device;
  const now = new Date().toISOString();
  device.last_seen = now;
  device.status = "online";

  const entry = {
    id: `FIX-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
    device_id: device.device_id,
    company_code: (device.company_code || "UNASSIGNED").toUpperCase(),
    employee_name: body.employee_name || device.employee_name || "Employee",
    hostname: body.hostname || device.hostname || "WIN-LAPTOP",
    fix_id: body.fix_id,
    fix_title: body.fix_title || body.fix_id,
    category: body.category || "System",
    ok: body.ok !== undefined ? Boolean(body.ok) : true,
    status: body.status || (body.ok === false ? "failed" : "success"),
    output: body.output || body.details || "",
    mode: body.mode || "online",
    duration_ms: Number(body.duration_ms) || 1200,
    created_at: now,
  };
  state.fix_logs.unshift(entry);
  await saveStore(state);
  return NextResponse.json({ logged: true, log_id: entry.id, entry });
}
