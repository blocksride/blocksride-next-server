import { NextResponse } from "next/server";

import { verifyPrivyToken } from "@/server/auth/privy";
import { createSessionToken, getSessionCookieOptions } from "@/server/auth/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Missing or invalid Authorization header" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { wallet_address?: string };
  const privyToken = authHeader.slice("Bearer ".length);

  try {
    const user = await verifyPrivyToken(privyToken, body.wallet_address);
    const token = createSessionToken(user.id);
    const response = NextResponse.json({ user });
    const cookie = getSessionCookieOptions();
    response.cookies.set(cookie.name, token, cookie);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid Privy token";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
