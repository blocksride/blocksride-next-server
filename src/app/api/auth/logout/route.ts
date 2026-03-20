import { NextResponse } from "next/server";

import { getSessionCookieOptions } from "@/server/auth/session";

export const runtime = "nodejs";

export async function POST() {
  const response = NextResponse.json({ success: true });
  const cookie = getSessionCookieOptions();
  response.cookies.set(cookie.name, "", { ...cookie, maxAge: 0 });
  return response;
}
