import { NextResponse } from "next/server";
import { loadStore, verifyDeviceRequest } from "../../../../lib/crmServerStore";

export const dynamic = "force-dynamic";

function extractEmail(contact) {
  const m = String(contact || "").match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  return m ? m[0].toLowerCase() : "";
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const deviceId = (searchParams.get("device_id") || "").trim();
  const state = await loadStore();

  const auth = verifyDeviceRequest(request, state, deviceId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const code = (auth.device.company_code || "").toUpperCase();
  const seen = new Set();
  const staff = [];

  for (const d of state.devices || []) {
    if ((d.company_code || "").toUpperCase() !== code) continue;
    if (d.approval_status === "revoked") continue;
    const name = (d.employee_name || "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    staff.push({
      name,
      department: d.department || "General",
      email: extractEmail(d.phone),
    });
  }

  return NextResponse.json({ company_code: code, staff });
}
