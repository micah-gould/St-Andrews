# St Andrews Module Planner

Interactive planner for St Andrews module pathways, with prerequisite graphing,
saved plans, and account-based sharing.

## What This Project Is

- React frontend for browsing module catalogs and planning pathways
- D3-powered graph view for prerequisites, co-requisites, and exclusions
- Express server for auth, saved plans, and catalog data
- Prisma/Postgres backend for persistence

## Quick Start

```bash
cp .env.example .env
npm install
npm run db:push
npm run dev
```

Open `http://localhost:5174`.

## Useful Commands

- `npm run dev` - frontend + server in watch mode
- `npm run build` - production frontend build
- `npm run preview` - preview built frontend
- `npm run typecheck` - TypeScript check
- `npm run start:server` - run server only
- `npm run db:push` - sync Prisma schema to database
- `npm run db:migrate` - create/apply local migrations
- `npm run db:deploy` - apply existing migrations

## File Structure

```text
src/
  App.tsx                    # Main authenticated app shell
  main.tsx                   # React entrypoint
  router.tsx                 # App routes
  Pages/                     # Route-level pages
  components/                # Reusable React UI components
  hooks/                     # React hooks and frontend app orchestration
  moduleGraph/               # Imperative D3 graph runtime only
  auth/                      # Auth client helpers and auth styles
  providers/                 # React providers (auth)
  types/                     # Shared frontend/server TS types
  graph.ts                   # Graph/domain logic
  render.ts                  # D3 render styling logic
  state.ts                   # Graph UI state helpers
  dataLoader.ts              # Frontend graph/catalog loading
  savedStatesApi.ts          # Saved-plan API client

server/
  index.ts                   # Express server entrypoint
  auth/                      # Auth routes, tokens, passport, prisma, email
  savedStates/               # Saved plan routes and permission logic
  catalogs/                  # Catalog parsing/build helpers
  moduleData.ts              # Server-side graph data assembly

prisma/
  schema.prisma              # Database schema
```

## Frontend Architecture

The frontend is React-first now.

- React owns app state, routing, forms, toolbars, subject selection, saved plans, feedback, and status text.
- D3 is isolated to the graph canvas runtime in `src/moduleGraph/runtime.ts`.
- `src/components/ModuleGraphCanvas.tsx` is the React wrapper around the D3 runtime.
- `src/hooks/useModuleGraphApp.ts` coordinates frontend app state and actions.

Rule of thumb:

- If it is UI, route, form state, or app flow: keep it in React.
- If it is graph layout/rendering internals: keep it in `.ts` runtime/helpers.

## Style Guide

Keep this simple and consistent.

### Naming

- Pages: `src/Pages/Foo.Page.tsx`
- Components: `src/components/Foo.tsx`
- Hooks: `src/hooks/useSomething.ts`
- Type files: `src/types/*.types.ts`
- Server files: `.ts`

### React

- Prefer functional components
- Keep state close to where it is used
- Prefer small focused hooks over one giant hook
- Prefer props and explicit callbacks over globals
- Avoid direct DOM access unless wrapping a browser/D3 integration

### TypeScript

- Add types for public function inputs/outputs when useful
- Keep related custom types together in `*.types.ts`
- Prefer small explicit types over `any`

### D3 / Imperative Code

- Keep D3 isolated behind React wrappers
- Do not spread DOM querying across the app shell
- If a feature can be expressed in React state, do that first

### Files

- Prefer small files with one main responsibility
- When a file gets too large, split by responsibility, not arbitrarily
- Avoid creating helpers that are only used once unless they clarify structure

## Where To Start If You Are New

Read files in this order:

1. `src/App.tsx`
2. `src/hooks/useModuleGraphApp.ts`
3. `src/components/ModuleGraphCanvas.tsx`
4. `src/moduleGraph/runtime.ts`
5. `server/index.ts`
6. `server/auth/routes.ts`
7. `server/savedStates/routes.ts`

## Common Tasks

### Add a new page

1. Create `src/Pages/NewPage.Page.tsx`
2. Add the route in `src/router.tsx`
3. Reuse existing components where possible

### Add a new shared component

1. Create `src/components/NewComponent.tsx`
2. Keep it presentational if possible
3. Pass data/callbacks in via props

### Change graph behavior

1. Check `src/hooks/useModuleGraphApp.ts` for app-level flow
2. Check `src/moduleGraph/runtime.ts` for graph interactions
3. Check `src/graph.ts` for graph logic
4. Check `src/render.ts` for visual state/render rules

### Change saved plan behavior

1. Check `src/hooks/useModuleGraphApp.ts`
2. Check `src/savedStatesApi.ts`
3. Check `server/savedStates/routes.ts`

## Auth

See `AUTH.md` for auth setup and OAuth details.

## Notes

- Default initial UI hides `5000` and `Ext` levels
- Shared plan links can include a saved-plan id in the URL
- The frontend is fully TypeScript/React; the remaining imperative pieces are graph-runtime internals only
