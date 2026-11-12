import { NextResponse } from "next/server";
import { loadStore, computeSummary } from "../../../../lib/crmServerStore";

export const dynamic = "force-dynamic";

export async function GET() {
  const backendUrl = process.env.FASTAPI_BACKEND_URL;
  if (backendUrl) {
    try {
      const res = await fetch(`${backendUrl}/api/crm/bootstrap`, {
        cache: "no-store",
        signal: AbortSignal.timeout(2500),
      });
      if (res.ok) {
        const data = await res.json();
        return NextResponse.json({ ...data, source: "fastapi-backend" });
      }
    } catch {
      // Fallback to Next.js serverless store
    }
  }
  const state = loadStore();
  return NextResponse.json({
    ...state,
    summary: computeSummary(state),
    source: "nextjs-api",
  });
}
