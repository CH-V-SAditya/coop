# Coop frontend

A React 19 single-page app (Vite + React Router + TanStack Query + Tailwind v4).

- `src/lib/supabase.ts`: Supabase client used **only for sign-in** (email/password and Google, PKCE flow).
- `src/lib/api.ts`: calls the Coop backend (`VITE_API_URL`) with the user's access token.
- `src/router.tsx`: every page is lazy-loaded (code-split).
- `src/index.css`: design tokens for the light and dark themes. The palette is a placeholder until design input arrives.

```bash
cp .env.example .env.local
npm install
npm run dev     # http://localhost:5173
```
