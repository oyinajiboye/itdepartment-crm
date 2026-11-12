import { NextResponse } from "next/server";
import {
  loadStore,
  saveStore,
  hashPassword,
  createSessionToken,
} from "../../../../lib/crmServerStore";

export async function POST(request) {
  const body = await request.json();
  const state = loadStore();

  const hasSuperManager = state.managers.some(
    (m) => m.role === "super_manager"
  );
  if (hasSuperManager) {
    return NextResponse.json(
      {
        error:
          "Super Manager account already exists. Please sign in with your credentials.",
      },
      { status: 400 }
    );
  }

  const name = (body.name || "").trim();
  const email = (body.email || "").trim().toLowerCase();
  const phone = (body.phone || "").trim();
  const password = body.password || "";

  if (!name || !email || password.length < 6) {
    return NextResponse.json(
      {
        error:
          "Please provide your full name, official email, and a password (at least 6 characters).",
      },
      { status: 400 }
    );
  }

  const superManager = {
    id: "MGR-01",
    name,
    email,
    phone,
    role: "super_manager",
    specialization:
      body.specialization || "Executive Operations & SLA Director",
    password_hash: hashPassword(password),
    status: "active",
    onboarded: false,
    created_at: new Date().toISOString(),
  };

  state.managers.push(superManager);
  saveStore(state);

  const token = createSessionToken(superManager);
  const { password_hash, ...safeUser } = superManager;

  const response = NextResponse.json({
    authenticated: true,
    user: safeUser,
    token,
  });

  response.cookies.set("itd_crm_session", token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}
