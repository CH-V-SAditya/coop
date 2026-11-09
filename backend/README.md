# Coop backend

The Next.js REST API (`/api/v1/*`) plus the Supabase database (`supabase/`).

- **Route handlers only.** There are no pages. Every request carries the user's Supabase access token as a `Bearer` header. The API forwards that token to Postgres, so **Row Level Security applies to every query**.
- **The task engine lives in Postgres** (`supabase/migrations/20261110000500_task_engine.sql`). The API validates input (zod), calls engine functions such as `transition_task` and `add_task_dependency`, and maps Postgres error codes to HTTP statuses (`src/lib/http.ts`).

```bash
cp .env.example .env.local   # fill in Supabase URL + publishable key
npm install
npm run dev                  # http://localhost:4000
npm run test:db              # applies all migrations to an in-memory Postgres (PGlite) and runs engine scenarios
```

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET / PATCH | `/me` | Profile and organisation memberships |
| GET | `/me/tasks` | My tasks (clearance dashboard) |
| POST | `/organisations` | Create an organisation (the caller becomes owner) |
| GET | `/organisations/:orgId/members` | Organisation members |
| GET / POST | `/organisations/:orgId/groups` | List groups / create a group (the caller becomes group admin) |
| GET / POST | `/organisations/:orgId/invitations` | Pending invitations / invite by email |
| DELETE | `/organisations/:orgId/invitations/:invitationId` | Revoke an invitation |
| GET | `/invitations/:token` · POST `/invitations/:token/accept` | Preview or accept an invitation |
| GET / PATCH | `/groups/:groupId` | Group, members, and the caller's permissions / edit the goal |
| POST | `/groups/:groupId/members` | Add an organisation member, with a functional role and permissions |
| PATCH / DELETE | `/groups/:groupId/members/:memberId` | Change role or permissions / remove a member |
| POST | `/groups/:groupId/invitations` | Invite someone into the group, with a role |
| GET / POST | `/groups/:groupId/tasks` | Board / create a task (always starts as a draft) |
| GET / PATCH / DELETE | `/tasks/:taskId` | Full task object / edit details and progress / delete |
| POST | `/tasks/:taskId/transition` | **The only way to change status** |
| POST | `/tasks/:taskId/dependencies` · DELETE `/dependencies/:id` | Finish-to-start links (cycle-checked) |
| POST | `/tasks/:taskId/blockers` · POST `/blockers/:id/(confirm\|resolve\|dismiss)` | Blocker lifecycle |
| POST | `/tasks/:taskId/comments` | Task discussion |
| GET | `/transitions` | The state machine as data |
