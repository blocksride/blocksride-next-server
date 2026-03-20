import type { SessionPayload } from "@/shared/auth";
import { env } from "@/server/config/env";
import { requireSession } from "@/server/auth/request";

function getAdminIds(): Set<string> {
  return new Set(
    (env.ADMIN_USER_IDS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );
}

export function isAdminUser(userId: string): boolean {
  return getAdminIds().has(userId);
}

export function requireAdminSession(request: Request): SessionPayload {
  const session = requireSession(request);
  if (!isAdminUser(session.user_id)) {
    throw new Error("Forbidden");
  }
  return session;
}
