import { NextResponse } from "next/server";
import {
  loadStore,
  saveStore,
  hashPassword,
  getAuthenticatedUser,
} from "../../../../lib/crmServerStore";

export async function POST(request) {
  const user = await getAuthenticatedUser(request);
  if (!user || user.role !== "super_manager") {
    return NextResponse.json(
      { error: "Only the Super Manager can create IT Manager accounts." },
      { status: 403 }
    );
  }

  const body = await request.json();
  const state = await loadStore();

  const email = (body.email || "").trim().toLowerCase();
  const name = (body.name || "").trim();
  const phone = (body.phone || "").trim();
  const specialization = (
    body.specialization ||
    body.specialty ||
    "Systems, Network & Endpoint Lead"
  ).trim();
  const rawPassword = body.password || "itdept123";

  if (!name || !email) {
    return NextResponse.json(
      { error: "Manager name and official email are required." },
      { status: 400 }
    );
  }

  if (state.managers.some((m) => m.email.toLowerCase() === email)) {
    return NextResponse.json(
      { error: "An account with this email already exists." },
      { status: 400 }
    );
  }

  const nextNum = String(state.managers.length + 1).padStart(2, "0");
  const newManager = {
    id: `MGR-${nextNum}`,
    name,
    email,
    phone,
    role: body.role === "super_manager" ? "super_manager" : "it_manager",
    specialization,
    password_hash: hashPassword(rawPassword),
    status: "active",
    created_at: new Date().toISOString(),
  };

  state.managers.push(newManager);
  await saveStore(state);

  const { password_hash, ...safeManager } = newManager;
  return NextResponse.json(safeManager);
}
