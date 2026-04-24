# Authentication

The `auth` branch adds a full user authentication system on top of the module
graph app.

## Features

- **Email + password** sign up / sign in (bcrypt hashed, min 8 chars)
- **Google OAuth** sign in / sign up
- **Microsoft OAuth** sign in / sign up
- **Remember me** — sessions last 24 h by default, 7 days when checked
- **Forgot password** flow with secure single-use, 1-hour reset tokens
- **Rate limiting** on login, signup, and reset endpoints
- **HTTP-only JWT cookie** sessions (no client-side token storage)
- **OAuth account linking** by verified email
- **Account guard** — `/` redirects to `/login.html` until signed in

## Stack

| Concern        | Choice                                  | Why |
|----------------|------------------------------------------|-----|
| Database       | Prisma ORM + Postgres | Free tier options (Neon/Supabase) and works in serverless/container deploys |
| Sessions       | JWT in httpOnly cookie                   | Stateless, no extra infra |
| OAuth          | Passport.js (`google-oauth20`, `microsoft`) | Mature, well-maintained |
| Email          | Resend (free 3k/mo) with console fallback | Best free transactional email DX |

## Quick start

```bash
cp .env.example .env
# edit .env — at minimum set JWT_SECRET to something random
npm install                # runs prisma generate via postinstall
npm run db:push            # sync schema to DATABASE_URL
npm run dev                # starts vite (5174) and the API (5175)
```

Open http://localhost:5174 — you'll be redirected to `/login.html`.
Click **Create one** to register. You're in.

## OAuth setup

The OAuth buttons are hidden until you supply real credentials in `.env`.

### Google

1. Go to https://console.cloud.google.com/apis/credentials
2. Create OAuth client ID → Web application
3. Authorized redirect URI (local): `http://localhost:5175/api/auth/google/callback`
4. Authorized redirect URI (production): `https://<your-vercel-domain>/api/auth/google/callback`
5. Paste the client ID / secret into `.env`

### Microsoft

1. https://portal.azure.com → Microsoft Entra ID → App registrations → New registration
2. Redirect URI (Web, local): `http://localhost:5175/api/auth/microsoft/callback`
3. Redirect URI (Web, production): `https://<your-vercel-domain>/api/auth/microsoft/callback`
4. Certificates & secrets → New client secret
5. Paste the application (client) ID and secret value into `.env`
6. Leave `MICROSOFT_TENANT=common` to allow personal + work accounts

## Password reset email

Without `RESEND_API_KEY`, reset links are printed to the server console. To
send real emails, sign up at https://resend.com (free 3k/mo, no card), create
an API key, and put it in `.env`.

For your own domain, verify it in the Resend dashboard and update
`EMAIL_FROM`. The default `onboarding@resend.dev` works only for sending to
the address that owns the Resend account.

## Production database

Use a managed Postgres (Neon/Supabase/etc.) in `DATABASE_URL`.

For first-time bootstrap on a fresh database:

```bash
npx prisma db push
npx prisma generate
```

After you establish a migration history for Postgres, you can use:

```bash
npm run db:deploy
```

## File map

```
prisma/
  schema.prisma            # User, OAuthAccount, PasswordResetToken
server/
  auth/
    prisma.js              # Prisma client singleton
    tokens.js              # JWT, bcrypt, cookies, reset tokens
    passport.js            # Local + Google + Microsoft strategies
    email.js               # Resend wrapper with dev fallback
    routes.js              # /api/auth/* router (signup/login/logout/forgot/reset/oauth)
src/
  authGuard.js             # gates index.html, adds sign-out button
  auth/
    auth.css               # shared styling for login / signup / forgot / reset
    authClient.js          # fetch wrapper + OAuth button helper
    login.js  signup.js  forgot.js  reset.js
login.html  signup.html  forgot-password.html  reset-password.html
```
