import { NextResponse } from "next/server";
import {
  loadStore,
  getAuthenticatedUser,
  sanitizeStateForUser,
  computeSummary,
  getDatabaseEngineInfo,
} from "../../../../lib/crmServerStore";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const user = await getAuthenticatedUser(request);
  const state = await loadStore();
  const scoped = sanitizeStateForUser(state, user);

  return NextResponse.json({
    ...scoped,
    summary: computeSummary(scoped),
    database: getDatabaseEngineInfo(),
    source: "nextjs-db",
  });
}
