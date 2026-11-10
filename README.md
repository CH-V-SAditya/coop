# Coop

An AI-assisted workspace for coordinating and cooperating on shared work. It keeps communication flowing, surfaces blockers immediately, and gives management an honest picture of progress.

Product requirements and the phase plan are in **[PLAN.md](PLAN.md)**.

```
CoOp/
├── PLAN.md        Plan of action + PRD (updated after every phase)
├── frontend/      React 19 + Vite + React Router (lazy routes) + TanStack Query + Tailwind v4
│   └── src/
│       ├── features/     one folder per module, each owning its pages and components:
│       │                 dashboard, groups, landing, not-found, onboarding,
│       │                 people ("Who are you?"), profile, tasks
│       ├── components/   shared UI kit (ui.tsx) and app layout (sidebar shell, route guards)
│       ├── lib/          API client, queries, types, status metadata, helpers
│       └── providers/    acting person, theme and active-organisation context
└── backend/       Next.js 16 REST API (/api/v1) + Supabase migrations and DB tests
    ├── src/app/api/v1/   route handlers; folder names are the API's URLs
    ├── src/lib/          HTTP helpers, domain helpers, Supabase clients
    ├── scripts/dev.mjs   `npm run dev`: repairs a patched Next.js, starts it, pre-compiles routes
    └── supabase/
        ├── migrations/   7 migrations: schema, task engine, RLS, storage
        └── tests/        engine.test.mjs (runs on PGlite, no Docker needed)
```

**How the pieces talk (prototype mode, no sign-in):** you pick who you are on the "Who are you?" screen → the browser sends that person's id to the **backend API** (`X-Coop-Actor` header) → the API calls Postgres with the server-only secret key and says who it is acting as → a pre-request hook makes `auth.uid()` return that person, so the task engine's permission checks still apply. The frontend never talks to Supabase. The AI will plug in at the API layer later and will only ever write *suggestions*.

> **Sign-in is switched off** while features are built. Anyone who can reach the API can act as anyone, so keep real data out of this database. PLAN.md describes how to switch sign-in back on.

## Run it locally

1. **Create a Supabase project** (cloud), or run `npx supabase start` if you have Docker.
2. **Apply the migrations.** They need Supabase (they use the `auth` and `storage` schemas and its roles), so they will **not** run on a plain PostgreSQL server.
   ```bash
   cd backend
   npx supabase login
   npx supabase init                                    # creates supabase/config.toml; keeps existing migrations
   npx supabase link --project-ref <your-project-ref>   # asks for the database password
   npx supabase db push                                 # applies supabase/migrations/* in order
   ```
   No CLI? In the dashboard **SQL Editor**, paste and run each file in `supabase/migrations/` in filename order (`…000100` → `…000800`).
3. **Backend:** `cd backend && cp .env.example .env.local`, fill in `SUPABASE_URL` and `SUPABASE_SECRET_KEY` (Supabase → Project Settings → API Keys → Secret key), then `npm install && npm run dev` → http://localhost:4000
4. **Frontend:** `cd frontend && cp .env.example .env.local` (fill in), then `npm install && npm run dev` → http://localhost:5173

## Checks

```bash
cd backend  && npm run test:db && npm run build && npm run lint
cd frontend && npm run build && npm run lint
```
