import { NextResponse } from "next/server";
import { loadStore, saveStore } from "../../../../lib/crmServerStore";

export async function POST(request) {
  const body = await request.json();
  const state = loadStore();
  const newManager = {
    id: `MGR-0${state.managers.length + 1}`,
    name: body.name || "IT Manager",
    email: body.email || "manager@itdepartment.ng",
    phone: body.phone || "+234 800 000 0000",
    role: body.role || "it_manager",
    specialty: body.specialty || "Windows Endpoints & Remote Support",
    status: "active",
    created_at: new Date().toISOString(),
  };
  state.managers.push(newManager);
  saveStore(state);
  return NextResponse.json(newManager);
}
