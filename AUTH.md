# Authentication

This project includes email/password auth plus optional Google and Microsoft OAuth.

## What It Supports

- Sign up
- Login
- Logout
- Remember me sessions
- Forgot/reset password
- Google OAuth
- Microsoft OAuth
- Shared-plan access control

## Main Auth Files

```text
server/auth/
  prisma.ts        # Prisma client usage for auth
  tokens.ts        # JWT cookies, password hashing, reset tokens
  passport.ts      # Passport strategies
  email.ts         # Reset/access email helpers
  routes.ts        # /api/auth/* routes

src/
  providers/AuthProvider.tsx
  auth/authClient.ts
  Pages/Login.Page.tsx
  Pages/Signup.Page.tsx
  Pages/ForgotPassword.Page.tsx
  Pages/ResetPassword.Page.tsx
  components/ProtectedRoute.tsx
  components/PublicOnlyRoute.tsx
```

## Local Setup

```bash
cp .env.example .env
npm install
npm run db:push
npm run dev
```

At minimum, set a strong `JWT_SECRET` in `.env`.

## OAuth Setup

OAuth buttons stay hidden until credentials are configured.

### Google

1. Create OAuth credentials in Google Cloud
2. Add redirect URI:
   `http://localhost:5175/api/auth/google/callback`
3. Add production redirect URI:
   `https://<your-domain>/api/auth/google/callback`
4. Set the Google client id/secret in `.env`

### Microsoft

1. Create an app registration in Microsoft Entra ID
2. Add redirect URI:
   `http://localhost:5175/api/auth/microsoft/callback`
3. Add production redirect URI:
   `https://<your-domain>/api/auth/microsoft/callback`
4. Set the Microsoft client id/secret in `.env`

## Password Reset

- Without `RESEND_API_KEY`, reset links are logged to the server console
- With `RESEND_API_KEY`, emails are sent normally

## Auth Flow Notes

- Sessions use HTTP-only JWT cookies
- The React app uses `AuthProvider` for auth state
- Protected app routes are wrapped in `ProtectedRoute`
- Auth-only pages are wrapped in `PublicOnlyRoute`

## If You Need To Change Auth

1. Start in `server/auth/routes.ts`
2. Then check `server/auth/tokens.ts` and `server/auth/passport.ts`
3. Then update `src/providers/AuthProvider.tsx` or `src/auth/authClient.ts` if the response shape changed
