import crypto from "crypto";
import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import {
  loadStore,
  verifyDeviceRequest,
  checkRateLimit,
} from "../../../../lib/crmServerStore";

export async function POST(request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "Vercel Blob is not configured yet (missing BLOB_READ_WRITE_TOKEN)." },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const deviceId = (searchParams.get("device_id") || request.headers.get("x-device-id") || "").trim();
  const state = await loadStore();

  const auth = verifyDeviceRequest(request, state, deviceId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!checkRateLimit(`meeting-upload:${auth.device.device_id}`, 12, 3600000)) {
    return NextResponse.json(
      { error: "Too many meeting uploads in the last hour." },
      { status: 429 }
    );
  }

  const contentType = request.headers.get("content-type") || "audio/wav";
  const ext = contentType.includes("ogg") ? "ogg" : contentType.includes("mpeg") ? "mp3" : "wav";
  const rawBuffer = Buffer.from(await request.arrayBuffer());
  if (!rawBuffer.length) {
    return NextResponse.json({ error: "Empty audio file." }, { status: 400 });
  }
  if (rawBuffer.length > 50 * 1024 * 1024) {
    return NextResponse.json({ error: "Audio file exceeds 50 MB limit." }, { status: 413 });
  }

  const companyCode = (auth.device.company_code || "UNASSIGNED").toUpperCase();
  const key = `meetings/${companyCode}/${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${ext}`;

  const blob = await put(key, rawBuffer, {
    access: "public",
    contentType,
  });

  return NextResponse.json({
    ok: true,
    audio_url: blob.url,
    size_bytes: rawBuffer.length,
    mime_type: contentType,
  });
}
