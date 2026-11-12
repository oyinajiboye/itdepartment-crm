import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ logged_out: true });
  response.cookies.set("itd_crm_session", "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
