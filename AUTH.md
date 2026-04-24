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
| Database       | Prisma ORM + SQLite (dev) / Postgres (prod) | Free everywhere, swap by changing `DATABASE_URL` |
| Sessions       | JWT in httpOnly cookie                   | Stateless, no extra infra |
| OAuth          | Passport.js (`google-oauth20`, `microsoft`) | Mature, well-maintained |
| Email          | Resend (free 3k/mo) with console fallback | Best free transactional email DX |

## Quick start

```bash
cp .env.example .env
# edit .env — at minimum set JWT_SECRET to something random
npm install                # runs prisma generate via postinstall
npm run db:migrate         # creates prisma/dev.db with the auth schema
npm run dev                # starts vite (5174) and the API (5175)
```

Open http://localhost:5174 — you'll be redirected to `/login.html`.
Click **Create one** to register. You're in.

## OAuth setup

The OAuth buttons are hidden until you supply real credentials in `.env`.

### Google

1. Go to https://console.cloud.google.com/apis/credentials
2. Create OAuth client ID → Web application
3. Authorized redirect URI: `http://localhost:5175/api/auth/google/callback`
4. Paste the client ID / secret into `.env`

### Microsoft

1. https://portal.azure.com → Microsoft Entra ID → App registrations → New registration
2. Redirect URI (Web): `http://localhost:5175/api/auth/microsoft/callback`
3. Certificates & secrets → New client secret
4. Paste the application (client) ID and secret value into `.env`
5. Leave `MICROSOFT_TENANT=common` to allow personal + work accounts

## Password reset email

Without `RESEND_API_KEY`, reset links are printed to the server console. To
send real emails, sign up at https://resend.com (free 3k/mo, no card), create
an API key, and put it in `.env`.

For your own domain, verify it in the Resend dashboard and update
`EMAIL_FROM`. The default `onboarding@resend.dev` works only for sending to
the address that owns the Resend account.

## Production database

SQLite is great for local dev. For production, point `DATABASE_URL` at a
free Postgres (Neon, Supabase, Railway, Vercel Postgres) and change the
provider in `prisma/schema.prisma` to `postgresql`. Then:

```bash
npm run db:deploy   # apply migrations to the target DB
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
