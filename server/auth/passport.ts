import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as MicrosoftStrategy } from 'passport-microsoft';
import { prisma } from './prisma';
import { verifyPassword } from './tokens';

const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_CALLBACK_URL,
  MICROSOFT_CLIENT_ID,
  MICROSOFT_CLIENT_SECRET,
  MICROSOFT_CALLBACK_URL,
  MICROSOFT_TENANT,
} = process.env;

// ---- Local (email + password) ----
passport.use(
  'local',
  new LocalStrategy(
    { usernameField: 'email', passwordField: 'password', session: false },
    async (email, password, done) => {
      try {
        const normalized = String(email || '').trim().toLowerCase();
        if (!normalized || !password) {
          return done(null, false, { message: 'Email and password are required.' });
        }
        const user = await prisma.user.findUnique({ where: { email: normalized } });
        if (!user || !user.passwordHash) {
          return done(null, false, { message: 'Invalid email or password.' });
        }
        const ok = await verifyPassword(password, user.passwordHash);
        if (!ok) {
          return done(null, false, { message: 'Invalid email or password.' });
        }
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  )
);

// ---- Helper: find or create user from OAuth profile ----
async function upsertOAuthUser({ provider, providerAccountId, email, name, avatarUrl }) {
  const normalizedEmail = email ? String(email).trim().toLowerCase() : null;

  // 1) Existing OAuth account?
  const existing = await prisma.oAuthAccount.findUnique({
    where: { provider_providerAccountId: { provider, providerAccountId } },
    include: { user: true },
  });
  if (existing) return existing.user;

  // 2) Existing user with this email? Link the OAuth account to it.
  if (normalizedEmail) {
    const byEmail = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (byEmail) {
      await prisma.oAuthAccount.create({
        data: { userId: byEmail.id, provider, providerAccountId },
      });
      // Backfill profile fields if they were missing.
      if (!byEmail.name && name) {
        await prisma.user.update({ where: { id: byEmail.id }, data: { name } });
      }
      return byEmail;
    }
  }

  // 3) Brand new user.
  if (!normalizedEmail) {
    throw new Error(`No email returned from ${provider}; cannot create account.`);
  }

  const created = await prisma.user.create({
    data: {
      email: normalizedEmail,
      name: name || null,
      avatarUrl: avatarUrl || null,
      emailVerified: new Date(),
      accounts: {
        create: { provider, providerAccountId },
      },
    },
  });
  return created;
}

// ---- Google ----
if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
  passport.use(
    'google',
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: GOOGLE_CALLBACK_URL || '/api/auth/google/callback',
        scope: ['profile', 'email'],
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          const user = await upsertOAuthUser({
            provider: 'google',
            providerAccountId: profile.id,
            email,
            name: profile.displayName,
            avatarUrl: profile.photos?.[0]?.value,
          });
          done(null, user);
        } catch (err) {
          done(err);
        }
      }
    )
  );
} else {
  console.warn('[auth] Google OAuth not configured (GOOGLE_CLIENT_ID/SECRET missing)');
}

// ---- Microsoft ----
if (MICROSOFT_CLIENT_ID && MICROSOFT_CLIENT_SECRET) {
  passport.use(
    'microsoft',
    new MicrosoftStrategy(
      {
        clientID: MICROSOFT_CLIENT_ID,
        clientSecret: MICROSOFT_CLIENT_SECRET,
        callbackURL: MICROSOFT_CALLBACK_URL || '/api/auth/microsoft/callback',
        scope: ['user.read'],
        tenant: MICROSOFT_TENANT || 'common',
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email =
            profile.emails?.[0]?.value ||
            profile._json?.mail ||
            profile._json?.userPrincipalName;
          const user = await upsertOAuthUser({
            provider: 'microsoft',
            providerAccountId: profile.id,
            email,
            name: profile.displayName,
            avatarUrl: null,
          });
          done(null, user);
        } catch (err) {
          done(err);
        }
      }
    )
  );
} else {
  console.warn('[auth] Microsoft OAuth not configured (MICROSOFT_CLIENT_ID/SECRET missing)');
}

export default passport;

export function isProviderEnabled(name) {
  if (name === 'google') return !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
  if (name === 'microsoft') return !!(MICROSOFT_CLIENT_ID && MICROSOFT_CLIENT_SECRET);
  return false;
}
