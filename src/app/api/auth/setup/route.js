import { NextResponse } from "next/server";
import {
  loadStore,
  saveStore,
  hashPassword,
  createSessionToken,
  getSessionCookieOptions,
  verifySecretEqual,
  checkRateLimit,
  getClientIp,
} from "../../../../lib/crmServerStore";

export async function POST(request) {
  const ip = getClientIp(request);
  if (!checkRateLimit(`setup:${ip}`, 10, 600000)) {
    return NextResponse.json(
      { error: "Too many setup attempts. Please wait a few minutes." },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const expectedSetupKey = (process.env.SETUP_KEY || "").trim();
  const isProd = process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);

  if (isProd && !expectedSetupKey) {
    return NextResponse.json(
      {
        error:
          "Public setup is disabled in production. Set SETUP_KEY or ADMIN_EMAIL/ADMIN_PASSWORD in Vercel environment variables.",
      },
      { status: 403 }
    );
  }

  if (expectedSetupKey) {
    const providedKey = String(
      body.setup_key || request.headers.get("x-setup-key") || ""
    ).trim();
    if (!verifySecretEqual(providedKey, expectedSetupKey)) {
      return NextResponse.json(
        { error: "Invalid or missing setup key." },
        { status: 403 }
      );
    }
  }

  const state = await loadStore();
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

  if (!name || !email || password.length < 8) {
    return NextResponse.json(
      {
        error:
          "Please provide your full name, official email, and a password (at least 8 characters).",
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
  await saveStore(state);

  const token = createSessionToken(superManager);
  const { password_hash, ...safeUser } = superManager;

  const response = NextResponse.json({
    authenticated: true,
    user: safeUser,
    token,
  });

  response.cookies.set("itd_crm_session", token, getSessionCookieOptions());
  return response;
}
