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
- Database: Prisma ORM (SQLite by default)
- Auth: JWT cookie sessions + Passport strategies

## Prerequisites

- Node.js 18+
- npm

## Local development

```bash
cp .env.example .env
npm install
npm run db:migrate
npm run dev
```

Then open `http://localhost:5174`.

## Useful scripts

- `npm run dev` - run client and server in watch mode
- `npm run build` - build frontend assets
- `npm run preview` - preview built frontend
- `npm run start:server` - run API server only
- `npm run db:migrate` - apply Prisma migrations in development
- `npm run db:deploy` - apply migrations in deployment environments
- `npm run db:studio` - open Prisma Studio

## Notes

- See `AUTH.md` for authentication and OAuth setup details.
- Default UI behavior hides `5000` and `Ext` levels on initial load.
