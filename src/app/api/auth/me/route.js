import { NextResponse } from "next/server";
import {
  loadStore,
  getAuthenticatedUser,
  getDatabaseEngineInfo,
} from "../../../../lib/crmServerStore";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const state = await loadStore();
  const needsSetup = state.managers.length === 0;
  const user = await getAuthenticatedUser(request);

  return NextResponse.json({
    authenticated: Boolean(user),
    user: user || null,
    needs_setup: needsSetup,
    onboarding_completed: Boolean(state.onboarding_completed),
    database: getDatabaseEngineInfo(),
  });
}
