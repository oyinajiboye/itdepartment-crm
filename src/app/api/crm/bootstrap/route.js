import { NextResponse } from "next/server";
import {
  loadStore,
  getAuthenticatedUser,
  sanitizeStateForUser,
  computeSummary,
} from "../../../../lib/crmServerStore";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const user = getAuthenticatedUser(request);
  const state = loadStore();
  const scoped = sanitizeStateForUser(state, user);

  return NextResponse.json({
    ...scoped,
    summary: computeSummary(scoped),
    source: "nextjs-api",
  });
}
