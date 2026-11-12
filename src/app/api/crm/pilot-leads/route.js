import { NextResponse } from "next/server";
import { loadStore, saveStore } from "../../../../lib/crmServerStore";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const payload = {
      timestamp: body.timestamp || new Date().toISOString(),
      full_name: (body.full_name || "").trim(),
      role: (body.role || "CEO / Managing Director").trim(),
      company_name: (body.company_name || "").trim(),
      contact: (body.contact || "").trim(),
      staff_pcs: Number(body.staff_pcs) || 20,
      source: body.source || "itdepartment.ng",
    };

    // 1. Forward to Google Sheets Apps Script Webhook if GOOGLE_SHEET_WEBHOOK_URL is set
    const sheetWebhookUrl = process.env.GOOGLE_SHEET_WEBHOOK_URL;
    let sheetSynced = false;
    if (sheetWebhookUrl) {
      try {
        const res = await fetch(sheetWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(payload),
        });
        sheetSynced = res.ok;
      } catch {
        sheetSynced = false;
      }
    }

    // 2. Also log as an actionable Pilot Lead task in the CRM database
    const state = await loadStore();
    const nextNum = String((state.hr_web_tasks || []).length + 1).padStart(
      2,
      "0"
    );
    const leadTask = {
      id: `PILOT-${nextNum}-${Date.now()}`,
      company_code: "7-DAY-PILOT-LEAD",
      task_type: "7-Day Free Pilot Booking",
      title: `${payload.company_name} (${payload.staff_pcs} PCs) — ${payload.full_name} (${payload.role})`,
      requested_by: payload.contact,
      status: "Pending",
      assigned_to: state.managers?.[0]?.id || "MGR-01",
      created_at: payload.timestamp,
    };
    state.hr_web_tasks = [leadTask, ...(state.hr_web_tasks || [])];
    await saveStore(state);

    return NextResponse.json(
      { ok: true, sheet_synced: sheetSynced, lead_id: leadTask.id },
      { headers: CORS_HEADERS }
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: "Invalid request payload" },
      { status: 400, headers: CORS_HEADERS }
    );
  }
}
