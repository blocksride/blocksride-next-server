import { createHmac, timingSafeEqual } from "node:crypto";

import type { SessionPayload } from "@/shared/auth";
import { env } from "@/server/config/env";

export const AUTH_COOKIE_NAME = "auth_token";
const DEFAULT_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function getJwtSecret(): string {
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET must be set and at least 32 characters long");
  }
  return env.JWT_SECRET;
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value: string): string {
  return createHmac("sha256", getJwtSecret()).update(value).digest("base64url");
}

export function createSessionToken(userId: string): string {
  const payload: SessionPayload = {
    user_id: userId,
    exp: Math.floor(Date.now() / 1000) + DEFAULT_MAX_AGE_SECONDS
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  const [encodedPayload, providedSignature] = token.split(".");
  if (!encodedPayload || !providedSignature) {
    return null;
  }

  const expectedSignature = sign(encodedPayload);
  const left = Buffer.from(providedSignature);
  const right = Buffer.from(expectedSignature);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    return null;
  }

  const payload = JSON.parse(base64UrlDecode(encodedPayload)) as SessionPayload;
  if (!payload.user_id || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }

  return payload;
}

export function getSessionCookieOptions() {
  const secure = env.ENV === "production" || env.NODE_ENV === "production";
  return {
    name: AUTH_COOKIE_NAME,
    httpOnly: true,
    secure,
    sameSite: secure ? ("strict" as const) : ("lax" as const),
    path: "/",
    maxAge: DEFAULT_MAX_AGE_SECONDS
  };
}
