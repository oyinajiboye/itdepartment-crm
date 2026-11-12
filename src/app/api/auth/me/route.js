import { NextResponse } from "next/server";
import {
  loadStore,
  getAuthenticatedUser,
} from "../../../../lib/crmServerStore";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const state = loadStore();
  const needsSetup = state.managers.length === 0;
  const user = getAuthenticatedUser(request);

  return NextResponse.json({
    authenticated: Boolean(user),
    user: user || null,
    needs_setup: needsSetup,
    onboarding_completed: Boolean(state.onboarding_completed),
  });
}
