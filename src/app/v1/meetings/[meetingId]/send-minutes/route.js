import { NextResponse } from "next/server";
import {
  loadStore,
  saveStore,
  verifyDeviceRequest,
  checkRateLimit,
} from "../../../../../lib/crmServerStore";

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function markdownToSimpleHtml(title, md, orgName) {
  const lines = String(md || "").split("\n").map((line) => {
    const escaped = escapeHtml(line);
    if (escaped.startsWith("### ")) return `<h3 style="margin:14px 0 6px;color:#0F300F;">${escaped.slice(4)}</h3>`;
    if (escaped.startsWith("## ")) return `<h2 style="margin:16px 0 6px;color:#0F300F;">${escaped.slice(3)}</h2>`;
    if (escaped.startsWith("# ")) return `<h1 style="margin:0 0 10px;color:#0F300F;">${escaped.slice(2)}</h1>`;
    if (escaped.startsWith("- ") || escaped.startsWith("* ")) return `<li style="margin:4px 0;">${escaped.slice(2)}</li>`;
    if (!escaped.trim()) return "<br/>";
    return `<p style="margin:6px 0;line-height:1.5;">${escaped}</p>`;
  });
  return `
    <div style="font-family:Segoe UI,Arial,sans-serif;max-width:680px;margin:0 auto;color:#111;border:1px solid #e2e5e2;border-radius:10px;overflow:hidden;">
      <div style="background:#0F300F;color:#fff;padding:18px 22px;">
        <div style="font-size:12px;opacity:0.8;">MEETING MINUTES • ${escapeHtml(orgName)}</div>
        <div style="font-size:18px;font-weight:600;margin-top:4px;">${escapeHtml(title)}</div>
      </div>
      <div style="padding:20px 22px;background:#fff;">
        ${lines.join("\n")}
      </div>
      <div style="padding:12px 22px;background:#F3F3F1;font-size:11px;color:#555;">
        Sent via Office Assistant by IT Department Nigeria (itdepartment.ng)
      </div>
    </div>
  `;
}

export async function POST(request, { params }) {
  const { meetingId } = params;
  const body = await request.json().catch(() => ({}));
  const state = await loadStore();

  const auth = verifyDeviceRequest(request, state, body.device_id);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!checkRateLimit(`meeting-send:${auth.device.device_id}`, 20, 3600000)) {
    return NextResponse.json(
      { error: "Too many email sends in the last hour." },
      { status: 429 }
    );
  }

  const attendees = Array.isArray(body.attendees) ? body.attendees : [];
  const emails = Array.from(
    new Set(
      attendees
        .map((a) => (typeof a === "string" ? a : a?.email || ""))
        .map((e) => String(e).trim().toLowerCase())
        .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
    )
  );

  if (emails.length === 0) {
    return NextResponse.json(
      { error: "Please add at least one valid attendee email address." },
      { status: 400 }
    );
  }

  const resendKey = (process.env.RESEND_API_KEY || "").trim();
  if (!resendKey) {
    return NextResponse.json(
      {
        error:
          "Email delivery is not configured yet. Add RESEND_API_KEY (and optional MEETING_FROM_EMAIL) in Vercel Environment Variables.",
      },
      { status: 503 }
    );
  }

  const company = (state.companies || []).find(
    (c) => c.company_code.toUpperCase() === (auth.device.company_code || "").toUpperCase()
  );
  const title = String(body.title || "Meeting Minutes").trim();
  const minutesMarkdown = String(body.minutes_markdown || "").trim();
  if (!minutesMarkdown) {
    return NextResponse.json({ error: "Meeting minutes content is empty." }, { status: 400 });
  }

  const fromEmail =
    (process.env.MEETING_FROM_EMAIL || "").trim() ||
    "IT Department Assistant <minutes@itdepartment.ng>";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: emails,
      subject: `Meeting Minutes: ${title}`,
      text: minutesMarkdown,
      html: markdownToSimpleHtml(title, minutesMarkdown, company?.name || auth.device.company_code),
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error("Resend email error:", res.status, errText);
    return NextResponse.json(
      { error: `Email provider returned HTTP ${res.status}. Check your RESEND_API_KEY and verified sender domain.` },
      { status: 502 }
    );
  }

  const meeting = (state.meetings || []).find((m) => String(m.id) === String(meetingId));
  if (meeting) {
    meeting.sent_to_json = JSON.stringify(emails);
    meeting.status = "sent";
    await saveStore(state);
  }

  return NextResponse.json({
    ok: true,
    sent: true,
    meeting_id: meetingId,
    recipients: emails,
    count: emails.length,
  });
}
