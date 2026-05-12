import express from "express";
import rateLimit from "express-rate-limit";
import crypto from "crypto";
import passport, { isProviderEnabled } from "./passport";
import { prisma } from "./prisma";
import {
  COOKIE_NAME,
  signSessionToken,
  verifySessionToken,
  setAuthCookie,
  clearAuthCookie,
  hashPassword,
  generateResetToken,
  hashResetToken,
  publicUser,
} from "./tokens";
import { sendPasswordResetEmail, sendSignupVerificationEmail } from "./email";
import type { NextFunction, Response } from "express";
import type {
  AuthedRequest,
  PartialAuthedRequest,
} from "../../src/types/server.types";

const router = express.Router();

const APP_URL = process.env.APP_URL || "http://localhost:5174";
const IS_E2E = process.env.E2E === "1";

// Basic email validation
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SIGNUP_CODE_RE = /^\d{6}$/;
const SIGNUP_CODE_TTL_MS = 15 * 60 * 1000;
const SIGNUP_RESEND_DELAY_MS = 60 * 1000;
const SIGNUP_MAX_RESENDS = 10;

function badRequest(res: Response, message: string) {
  return res.status(400).json({ error: message });
}

function hashSignupCode(raw: string) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function createSignupCode() {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

function signupPendingPayload(record: {
  email: string;
  expiresAt: Date;
  lastSentAt: Date;
  resendCount: number;
}) {
  return {
    pendingVerification: true,
    email: record.email,
    expiresInMs: Math.max(0, record.expiresAt.getTime() - Date.now()),
    resendAvailableInMs: Math.max(
      0,
      record.lastSentAt.getTime() + SIGNUP_RESEND_DELAY_MS - Date.now(),
    ),
    maxResends: SIGNUP_MAX_RESENDS,
    resendsUsed: record.resendCount,
  };
}

async function deleteExpiredPendingSignup(email?: string) {
  await prisma.pendingSignup.deleteMany({
    where: {
      ...(email ? { email } : {}),
      expiresAt: { lt: new Date() },
    },
  });
}

// Rate limiters - per IP
const authLimiter = IS_E2E
  ? (_req, _res, next) => next()
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 30,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: "Too many attempts. Please try again later." },
    });

const resetLimiter = IS_E2E
  ? (_req, _res, next) => next()
  : rateLimit({
      windowMs: 60 * 60 * 1000,
      max: 5,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        error: "Too many password reset requests. Please try again later.",
      },
    });

// ---- Middleware: attach req.user from JWT cookie ----
export async function attachUser(
  req: PartialAuthedRequest,
  _res: Response,
  next: NextFunction,
) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return next();
  const payload = verifySessionToken(token);
  if (!payload?.sub) return next();
  try {
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (user) {
      req.user = user;
      req.session = { remember: !!payload.remember };
    }
  } catch (err) {
    console.error("[auth] attachUser error", err);
  }
  next();
}

export function requireAuth(
  req: PartialAuthedRequest,
  res: Response,
  next: NextFunction,
) {
  if (!req.user) return res.status(401).json({ error: "Not authenticated." });
  next();
}

// ---- GET /api/auth/me ----
router.get("/me", (req: PartialAuthedRequest, res: Response) => {
  res.json({
    user: publicUser(req.user),
    providers: {
      google: isProviderEnabled("google"),
      microsoft: isProviderEnabled("microsoft"),
    },
  });
});

// ---- POST /api/auth/signup ----
router.post("/signup", authLimiter, async (req, res) => {
  const { email, password, name, remember } = req.body || {};
  const normalized = String(email || "")
    .trim()
    .toLowerCase();
  if (!normalized || !EMAIL_RE.test(normalized)) {
    return badRequest(res, "Please provide a valid email address.");
  }
  if (typeof password !== "string" || password.length < 8) {
    return badRequest(res, "Password must be at least 8 characters.");
  }
  if (password.length > 200) {
    return badRequest(res, "Password is too long.");
  }

  try {
    await deleteExpiredPendingSignup(normalized);

    const existing = await prisma.user.findUnique({
      where: { email: normalized },
    });
    if (existing) {
      return res
        .status(409)
        .json({ error: "An account with that email already exists." });
    }

    const passwordHash = await hashPassword(password);
    const code = createSignupCode();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SIGNUP_CODE_TTL_MS);

    const pending = await prisma.pendingSignup.upsert({
      where: { email: normalized },
      update: {
        name: typeof name === "string" && name.trim() ? name.trim() : null,
        passwordHash,
        remember: !!remember,
        codeHash: hashSignupCode(code),
        expiresAt,
        lastSentAt: now,
        resendCount: 0,
      },
      create: {
        email: normalized,
        name: typeof name === "string" && name.trim() ? name.trim() : null,
        passwordHash,
        remember: !!remember,
        codeHash: hashSignupCode(code),
        expiresAt,
        lastSentAt: now,
        resendCount: 0,
      },
    });

    await sendSignupVerificationEmail({
      to: normalized,
      code,
      name: pending.name,
    });

    res.status(202).json(signupPendingPayload(pending));
  } catch (err) {
    console.error("[auth] signup error", err);
    res.status(500).json({ error: "Could not create account." });
  }
});

// ---- POST /api/auth/signup/verify ----
router.post("/signup/verify", authLimiter, async (req, res) => {
  const email = String(req.body?.email || "")
    .trim()
    .toLowerCase();
  const code = String(req.body?.code || "").trim();

  if (!email || !EMAIL_RE.test(email)) {
    return badRequest(res, "Please provide a valid email address.");
  }
  if (!SIGNUP_CODE_RE.test(code)) {
    return badRequest(res, "Please provide a valid 6-digit code.");
  }

  try {
    await deleteExpiredPendingSignup(email);

    const pending = await prisma.pendingSignup.findUnique({
      where: { email },
    });
    if (!pending) {
      return res.status(400).json({
        error: "This verification request is invalid or has expired.",
      });
    }

    if (pending.expiresAt < new Date()) {
      await prisma.pendingSignup.delete({ where: { id: pending.id } });
      return res.status(400).json({
        error: "This verification request is invalid or has expired.",
      });
    }

    if (pending.codeHash !== hashSignupCode(code)) {
      return res
        .status(400)
        .json({ error: "The verification code is incorrect." });
    }

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: pending.email,
          name: pending.name,
          passwordHash: pending.passwordHash,
          emailVerified: new Date(),
        },
      });
      await tx.pendingSignup.delete({ where: { id: pending.id } });
      return created;
    });

    const { token, maxAgeMs } = signSessionToken(user, {
      remember: pending.remember,
    });
    setAuthCookie(res, token, maxAgeMs);
    res.status(201).json({ user: publicUser(user) });
  } catch (err) {
    console.error("[auth] signup verify error", err);
    const message = String((err as { message?: string })?.message || "");
    if (message.includes("Unique constraint")) {
      return res
        .status(409)
        .json({ error: "An account with that email already exists." });
    }
    res.status(500).json({ error: "Could not verify your signup." });
  }
});

// ---- POST /api/auth/signup/resend ----
router.post("/signup/resend", authLimiter, async (req, res) => {
  const email = String(req.body?.email || "")
    .trim()
    .toLowerCase();

  if (!email || !EMAIL_RE.test(email)) {
    return badRequest(res, "Please provide a valid email address.");
  }

  try {
    await deleteExpiredPendingSignup(email);

    const pending = await prisma.pendingSignup.findUnique({ where: { email } });
    if (!pending) {
      return res.status(400).json({
        error: "This verification request is invalid or has expired.",
      });
    }

    if (pending.expiresAt < new Date()) {
      await prisma.pendingSignup.delete({ where: { id: pending.id } });
      return res.status(400).json({
        error: "This verification request is invalid or has expired.",
      });
    }

    if (pending.resendCount >= SIGNUP_MAX_RESENDS) {
      return res.status(429).json({
        error: "You have reached the resend limit. Please sign up again.",
        ...signupPendingPayload(pending),
      });
    }

    const retryAfterMs =
      pending.lastSentAt.getTime() + SIGNUP_RESEND_DELAY_MS - Date.now();
    if (retryAfterMs > 0) {
      return res.status(429).json({
        error: "You can request a new code in a moment.",
        retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
        ...signupPendingPayload(pending),
      });
    }

    const code = createSignupCode();
    const updated = await prisma.pendingSignup.update({
      where: { id: pending.id },
      data: {
        codeHash: hashSignupCode(code),
        lastSentAt: new Date(),
        resendCount: { increment: 1 },
      },
    });

    await sendSignupVerificationEmail({
      to: updated.email,
      code,
      name: updated.name,
    });

    res.json(signupPendingPayload(updated));
  } catch (err) {
    console.error("[auth] signup resend error", err);
    res
      .status(500)
      .json({ error: "Could not send another verification code." });
  }
});

// ---- POST /api/auth/login ----
router.post("/login", authLimiter, (req, res, next) => {
  passport.authenticate("local", { session: false }, (err, user, info) => {
    if (err) {
      console.error("[auth] login error", err);
      return res.status(500).json({ error: "Login failed." });
    }
    if (!user) {
      return res
        .status(401)
        .json({ error: info?.message || "Invalid email or password." });
    }
    const { token, maxAgeMs } = signSessionToken(user, {
      remember: !!req.body?.remember,
    });
    setAuthCookie(res, token, maxAgeMs);
    res.json({ user: publicUser(user) });
  })(req, res, next);
});

// ---- POST /api/auth/logout ----
router.post("/logout", (_req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

// ---- Password reset: request ----
router.post("/forgot-password", resetLimiter, async (req, res) => {
  const email = String(req.body?.email || "")
    .trim()
    .toLowerCase();
  // Always 200 to avoid email enumeration.
  if (!email || !EMAIL_RE.test(email)) {
    return res.json({ ok: true });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      const { raw, hash } = generateResetToken();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash: hash, expiresAt },
      });
      const resetUrl = `${APP_URL}/reset-password?token=${encodeURIComponent(raw)}`;
      try {
        await sendPasswordResetEmail({
          to: user.email,
          resetUrl,
          name: user.name,
        });
      } catch (err) {
        console.error("[auth] failed to send reset email", err);
      }
    }
  } catch (err) {
    console.error("[auth] forgot-password error", err);
  }

  res.json({ ok: true });
});

// ---- Password reset: confirm ----
router.post("/reset-password", authLimiter, async (req, res) => {
  const { token, password } = req.body || {};
  if (typeof token !== "string" || !token) {
    return badRequest(res, "Reset token is required.");
  }
  if (typeof password !== "string" || password.length < 8) {
    return badRequest(res, "Password must be at least 8 characters.");
  }

  try {
    const tokenHash = hashResetToken(token);
    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      return res
        .status(400)
        .json({ error: "This reset link is invalid or has expired." });
    }

    const passwordHash = await hashPassword(password);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);

    // Invalidate any other outstanding reset tokens for this user.
    await prisma.passwordResetToken.updateMany({
      where: { userId: record.userId, usedAt: null },
      data: { usedAt: new Date() },
    });

    const { token: jwtToken, maxAgeMs } = signSessionToken(record.user, {
      remember: false,
    });
    setAuthCookie(res, jwtToken, maxAgeMs);
    res.json({ user: publicUser(record.user) });
  } catch (err) {
    console.error("[auth] reset-password error", err);
    res.status(500).json({ error: "Could not reset password." });
  }
});

// ---- OAuth: Google ----
router.get("/google", (req, res, next) => {
  if (!isProviderEnabled("google"))
    return res.status(503).send("Google sign-in is not configured.");
  // remember=1 query param survives the round-trip via OAuth `state`
  const remember = req.query.remember === "1" ? "1" : "0";
  passport.authenticate("google", {
    session: false,
    state: remember,
  })(req, res, next);
});

router.get("/google/callback", (req, res, next) => {
  if (!isProviderEnabled("google"))
    return res.status(503).send("Google sign-in is not configured.");
  passport.authenticate(
    "google",
    { session: false, failureRedirect: `${APP_URL}/login?error=oauth` },
    (err, user) => {
      if (err || !user) {
        console.error("[auth] google callback error", err);
        return res.redirect(`${APP_URL}/login?error=oauth`);
      }
      const remember = req.query.state === "1";
      const { token, maxAgeMs } = signSessionToken(user, { remember });
      setAuthCookie(res, token, maxAgeMs);
      res.redirect(`${APP_URL}/`);
    },
  )(req, res, next);
});

// ---- OAuth: Microsoft ----
router.get("/microsoft", (req, res, next) => {
  if (!isProviderEnabled("microsoft"))
    return res.status(503).send("Microsoft sign-in is not configured.");
  const remember = req.query.remember === "1" ? "1" : "0";
  passport.authenticate("microsoft", {
    session: false,
    state: remember,
  })(req, res, next);
});

router.get("/microsoft/callback", (req, res, next) => {
  if (!isProviderEnabled("microsoft"))
    return res.status(503).send("Microsoft sign-in is not configured.");
  passport.authenticate(
    "microsoft",
    { session: false, failureRedirect: `${APP_URL}/login?error=oauth` },
    (err, user) => {
      if (err || !user) {
        console.error("[auth] microsoft callback error", err);
        return res.redirect(`${APP_URL}/login?error=oauth`);
      }
      const remember = req.query.state === "1";
      const { token, maxAgeMs } = signSessionToken(user, { remember });
      setAuthCookie(res, token, maxAgeMs);
      res.redirect(`${APP_URL}/`);
    },
  )(req, res, next);
});

export default router;
