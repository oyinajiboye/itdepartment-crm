import { NextResponse } from "next/server";
import {
  loadStore,
  verifyPassword,
  createSessionToken,
} from "../../../../lib/crmServerStore";

export async function POST(request) {
  const body = await request.json();
  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 }
    );
  }

  const state = await loadStore();
  const manager = state.managers.find(
    (m) => m.email.toLowerCase() === email && m.status !== "suspended"
  );

  if (!manager || !verifyPassword(password, manager.password_hash)) {
    return NextResponse.json(
      { error: "Invalid email or password." },
      { status: 401 }
    );
  }

  const token = createSessionToken(manager);
  const { password_hash, ...safeUser } = manager;

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
