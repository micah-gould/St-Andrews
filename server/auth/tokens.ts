import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import crypto from "crypto";
import type { Response } from "express";
import type { StringValue } from "ms";
import type { RequestUser, SessionPayload } from "../../src/types/server.types";

const SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const DEFAULT_TTL_HOURS = Number(process.env.SESSION_DEFAULT_TTL_HOURS || 24);
const REMEMBER_TTL_DAYS = Number(process.env.SESSION_REMEMBER_TTL_DAYS || 7);

export const COOKIE_NAME = "auth_token";

export function signSessionToken(
  user: Pick<RequestUser, "id" | "email">,
  { remember = false }: { remember?: boolean } = {},
) {
  const expiresIn: StringValue = remember
    ? `${REMEMBER_TTL_DAYS}d`
    : `${DEFAULT_TTL_HOURS}h`;

  const token = jwt.sign(
    {
      sub: user.id,
      email: user.email,
      remember,
    },
    SECRET,
    { expiresIn },
  );

  const maxAgeMs = remember
    ? REMEMBER_TTL_DAYS * 24 * 60 * 60 * 1000
    : DEFAULT_TTL_HOURS * 60 * 60 * 1000;

  return { token, maxAgeMs };
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const decoded = jwt.verify(token, SECRET);
    if (typeof decoded === "string" || !decoded.sub || !decoded.email) {
      return null;
    }
    return {
      sub: String(decoded.sub),
      email: String(decoded.email),
      remember: Boolean(decoded.remember),
    };
  } catch {
    return null;
  }
}

export function setAuthCookie(res: Response, token: string, maxAgeMs: number) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: maxAgeMs,
    path: "/",
  });
}

export function clearAuthCookie(res: Response) {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, hash?: string | null) {
  if (!hash) return false;
  return bcrypt.compare(plain, hash);
}

// Tokens for password reset: random 32-byte token; we store sha256 hash, send raw to user.
export function generateResetToken() {
  const raw = crypto.randomBytes(32).toString("hex");
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  return { raw, hash };
}

export function hashResetToken(raw: string) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function publicUser(user: RequestUser | null | undefined) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    emailVerified: !!user.emailVerified,
  };
}
