import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "@/server/config/env";

export const ADMIN_COOKIE_NAME = "admin_session";
const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 8;

function getAdminPassword(): string {
  return env.ADMIN_SECRET ?? env.ADMIN_USER_IDS ?? "changeme";
}

function getSigningSecret(): string {
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET must be set and at least 32 characters long");
  }
  return `${env.JWT_SECRET}:admin`;
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value: string): string {
  return createHmac("sha256", getSigningSecret()).update(value).digest("base64url");
}

export function matchesAdminPassword(password: string): boolean {
  return password === getAdminPassword();
}

export function createAdminSessionToken(): string {
  const payload = {
    exp: Math.floor(Date.now() / 1000) + ADMIN_COOKIE_MAX_AGE
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifyAdminSessionToken(token: string): boolean {
  const [encodedPayload, providedSignature] = token.split(".");
  if (!encodedPayload || !providedSignature) {
    return false;
  }

  const expectedSignature = sign(encodedPayload);
  const left = Buffer.from(providedSignature);
  const right = Buffer.from(expectedSignature);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    return false;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as { exp?: number };
    return typeof payload.exp === "number" && payload.exp >= Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export function getAdminSessionCookieOptions() {
  const secure = env.ENV === "production" || env.NODE_ENV === "production";
  return {
    name: ADMIN_COOKIE_NAME,
    httpOnly: true,
    secure,
    sameSite: secure ? ("none" as const) : ("lax" as const),
    path: "/",
    maxAge: ADMIN_COOKIE_MAX_AGE
  };
}

export function requireAdminSession(request: Request): void {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const token = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${ADMIN_COOKIE_NAME}=`))
    ?.slice(`${ADMIN_COOKIE_NAME}=`.length);

  if (!token || !verifyAdminSessionToken(token)) {
    throw new Error("Unauthorized");
  }
}
