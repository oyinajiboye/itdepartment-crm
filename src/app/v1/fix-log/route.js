import { NextResponse } from "next/server";
import { loadStore, saveStore } from "../../../lib/crmServerStore";

export async function POST(request) {
  const body = await request.json();
  const state = loadStore();
  const entry = {
    id: `FIX-${1000 + state.fix_logs.length + 1}`,
    device_id: body.device_id,
    company_code: (body.company_code || "ITD-UNASSIGNED").toUpperCase(),
    employee_name: body.employee_name || body.hostname || "Employee",
    hostname: body.hostname || "WIN-LAPTOP",
    fix_id: body.fix_id,
    fix_title: body.fix_title,
    category: body.category || "System",
    status: body.status || "success",
    duration_ms: Number(body.duration_ms) || 1200,
    details: body.details || "",
    created_at: new Date().toISOString(),
  };
  state.fix_logs.unshift(entry);
  saveStore(state);
  return NextResponse.json({ logged: true, entry });
}
