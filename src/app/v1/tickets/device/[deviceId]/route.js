import { NextResponse } from "next/server";
import { loadStore } from "../../../../../lib/crmServerStore";

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  const { deviceId } = params;
  const state = loadStore();
  const tickets = (state.tickets || []).filter((t) => t.device_id === deviceId);
  return NextResponse.json({ device_id: deviceId, tickets });
}
