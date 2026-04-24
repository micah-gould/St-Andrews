import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const DEFAULT_TTL_HOURS = Number(process.env.SESSION_DEFAULT_TTL_HOURS || 24);
const REMEMBER_TTL_DAYS = Number(process.env.SESSION_REMEMBER_TTL_DAYS || 7);

export const COOKIE_NAME = 'auth_token';

export function signSessionToken(user, { remember = false } = {}) {
  const expiresIn = remember
    ? `${REMEMBER_TTL_DAYS}d`
    : `${DEFAULT_TTL_HOURS}h`;

  const token = jwt.sign(
    {
      sub: user.id,
      email: user.email,
      remember,
    },
    SECRET,
    { expiresIn }
  );

  const maxAgeMs = remember
    ? REMEMBER_TTL_DAYS * 24 * 60 * 60 * 1000
    : DEFAULT_TTL_HOURS * 60 * 60 * 1000;

  return { token, maxAgeMs };
}

export function verifySessionToken(token) {
  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}

export function setAuthCookie(res, token, maxAgeMs) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: maxAgeMs,
    path: '/',
  });
}

export function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

export async function hashPassword(plain) {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain, hash) {
  if (!hash) return false;
  return bcrypt.compare(plain, hash);
}

// Tokens for password reset: random 32-byte token; we store sha256 hash, send raw to user.
export function generateResetToken() {
  const raw = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return { raw, hash };
}

export function hashResetToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    emailVerified: !!user.emailVerified,
  };
}
