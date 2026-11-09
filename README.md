# Coop

An AI-assisted workspace for coordinating and cooperating on shared work. It keeps communication flowing, surfaces blockers immediately, and gives management an honest picture of progress.

Product requirements and the phase plan are in **[PLAN.md](PLAN.md)**.

```
CoOp/
├── PLAN.md        Plan of action + PRD (updated after every phase)
├── frontend/      React 19 + Vite + React Router (lazy routes) + TanStack Query + Tailwind v4
└── backend/       Next.js 16 REST API (/api/v1) + Supabase migrations and DB tests
    └── supabase/
        ├── migrations/   7 migrations: schema, task engine, RLS, storage
        └── tests/        engine.test.mjs (runs on PGlite, no Docker needed)
```

**How the pieces talk:** the browser signs in with Supabase Auth (email/password or Google) → sends its access token to the **backend API** → the API calls Postgres **as that user** → Row Level Security and the task engine functions decide what is allowed. The AI will plug in at the API layer later and will only ever write *suggestions*.

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
   No CLI? In the dashboard **SQL Editor**, paste and run each file in `supabase/migrations/` in filename order (`…000100` → `…000700`).
3. **Auth settings** (Supabase dashboard → Authentication):
   - URL configuration: Site URL `http://localhost:5173`, and add `http://localhost:5173/auth/callback` to Redirect URLs.
   - Providers → Google: enable it and paste your Google OAuth client ID and secret. In Google Cloud, set the redirect URI to `https://<project>.supabase.co/auth/v1/callback`.
4. **Backend:** `cd backend && cp .env.example .env.local` (fill in), then `npm install && npm run dev` → http://localhost:4000
5. **Frontend:** `cd frontend && cp .env.example .env.local` (fill in), then `npm install && npm run dev` → http://localhost:5173

## Checks

```bash
cd backend  && npm run test:db && npm run build && npm run lint
cd frontend && npm run build && npm run lint
```
