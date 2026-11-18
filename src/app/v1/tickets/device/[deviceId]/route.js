import { NextResponse } from "next/server";
import { loadStore, verifyDeviceRequest } from "../../../../../lib/crmServerStore";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const { deviceId } = params;
  const state = await loadStore();

  const auth = verifyDeviceRequest(request, state, deviceId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const tickets = (state.tickets || []).filter((t) => t.device_id === deviceId);
  return NextResponse.json({
    device_id: deviceId,
    approval_status: auth.device.approval_status || "pending",
    tickets,
  });
}
