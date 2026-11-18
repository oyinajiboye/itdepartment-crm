import { NextResponse } from "next/server";
import {
  loadStore,
  saveStore,
  getAuthenticatedUser,
} from "../../../../../../lib/crmServerStore";

export async function POST(request, { params }) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { deviceId } = params;
  const body = await request.json().catch(() => ({}));
  const nextStatus = body.approval_status === "revoked" ? "revoked" : "approved";

  const state = await loadStore();
  const device = (state.devices || []).find((d) => String(d.device_id) === String(deviceId));
  if (!device) {
    return NextResponse.json({ error: "Device not found." }, { status: 404 });
  }

  if (user.role !== "super_manager") {
    const company = (state.companies || []).find(
      (c) => c.company_code.toUpperCase() === (device.company_code || "").toUpperCase()
    );
    if (!company || String(company.assigned_manager_id) !== String(user.id)) {
      return NextResponse.json({ error: "Not authorized for this company." }, { status: 403 });
    }
  }

  device.approval_status = nextStatus;
  if (nextStatus === "revoked") {
    device.status = "revoked";
  }
  await saveStore(state);

  const { device_token_hash, ...safeDevice } = device;
  return NextResponse.json({ ok: true, device: safeDevice });
}
