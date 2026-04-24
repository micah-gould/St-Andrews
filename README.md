# St Andrews Module Planner

Interactive planner for St Andrews module pathways, with prerequisite graphing,
saved plans, and account-based sharing.

## What it does

- Visualizes module dependencies for each subject/year catalog.
- Lets users include/exclude/pass modules and preview resulting unlock paths.
- Supports saved plans with per-user ownership and sharing permissions.
- Includes authentication (email/password + optional Google/Microsoft OAuth).

## Tech stack

- Frontend: Vite, D3
- Backend: Node.js + Express
- Database: Prisma ORM + Postgres
- Auth: JWT cookie sessions + Passport strategies

## Prerequisites

- Node.js 18+
- npm

## Local development

```bash
cp .env.example .env
npm install
npm run db:push
npm run dev
```

Then open `http://localhost:5174`.

## Useful scripts

- `npm run dev` - run client and server in watch mode
- `npm run build` - build frontend assets
- `npm run preview` - preview built frontend
- `npm run start:server` - run API server only
- `npm run db:migrate` - create/apply Prisma migrations during local schema work
- `npm run db:push` - sync schema to the configured database (recommended for first prod bootstrap)
- `npm run db:deploy` - apply existing migrations in deployment environments
- `npm run db:studio` - open Prisma Studio

## Free deployment (Vercel + Render + Neon)

This project is set up to work with a free split deployment:

- Frontend: Vercel
- API: Render Web Service
- Database: Neon Postgres

### 1) Create a Neon database

- Create a free Neon project and copy the connection string.
- Put it in `DATABASE_URL` in your deployment environment.

### 2) Deploy the API to Render

- Create a new Web Service from this repo.
- Build command: `npm ci`
- Start command: `npm run start:server`
- Environment variables:
  - `DATABASE_URL` = your Neon URL
  - `JWT_SECRET` = long random secret
  - `APP_URL` = your Vercel app URL (for redirects and reset links)
  - `NODE_ENV` = `production`
  - Optional OAuth/email vars from `.env.example`

Then run once in Render Shell:

```bash
npx prisma db push
npx prisma generate
```

### 3) Configure Vercel API proxy

`vercel.json` includes a rewrite from `/api/*` to your Render backend.
Update this value before deploy:

- `vercel.json` -> `https://YOUR_RENDER_SERVICE.onrender.com`

### 4) OAuth callback URLs

Set OAuth callback URLs to your Vercel domain so auth returns to the frontend:

- Google: `https://<your-vercel-domain>/api/auth/google/callback`
- Microsoft: `https://<your-vercel-domain>/api/auth/microsoft/callback`

### 5) Verify

- `https://<your-vercel-domain>/api/health` returns `{ "ok": true }`
- Sign up / login works
- Saved plans persist

## Notes

- See `AUTH.md` for authentication and OAuth setup details.
- Default UI behavior hides `5000` and `Ext` levels on initial load.
