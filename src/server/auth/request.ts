import type { SessionPayload } from "@/shared/auth";
import { AUTH_COOKIE_NAME, verifySessionToken } from "@/server/auth/session";

export function requireSession(request: Request): SessionPayload {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const token = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${AUTH_COOKIE_NAME}=`))
    ?.slice(`${AUTH_COOKIE_NAME}=`.length);

  if (!token) {
    throw new Error("Unauthorized");
  }

  const session = verifySessionToken(token);
  if (!session) {
    throw new Error("Unauthorized");
  }

  return session;
}
