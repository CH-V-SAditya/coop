# Coop performance report

Every number here comes from a measurement that was actually run. The date and setup are listed with each one. Nothing is claimed without a measurement, and no "zero latency" claims.

**Targets** (spec §15): read API p95 < 150 ms, p99 < 400 ms. Simple write p95 < 250 ms, p99 < 600 ms. INP < 200 ms. LCP < 2.5 s. CLS < 0.1. Animations at ~60 fps.

## Measurements so far

| Date | What | Setup | Result |
| --- | --- | --- | --- |
| 2026-11-10 | Landing page scroll | Edge headless, 1440×900, 3 runs, real wheel input | 60 fps average, p95 frame 16.8 ms, 0% of frames > 25 ms. Before the fix: 47 fps, 24% > 25 ms |
| 2026-11-10 | Supabase round trip from the dev machine (India) | Node fetch, warm connection, 6 calls | 44–67 ms warm; 400–470 ms for the first calls (TLS setup) |
| 2026-11-10 | API route, first call in `next dev` | Turbopack on-demand compile | 3.3 s per route before warm-up; 0.04–0.13 s after the dev script's warm-up |
| 2026-11-10 | API token verification (fresh vs reused client) | 5 calls each, local `next dev` | ~40 ms both after the first call; not the bottleneck |
| 2026-11-10 | Single API calls, local `next dev` backend → Supabase project (not a load test) | `npm run test:api:smoke`, one run, sequential calls from India | Warm calls 102–343 ms (create organisation 173 ms, create group 102 ms, create task 343 ms, read board 102 ms); first call 885 ms. Each API call makes one or more Supabase round trips of 44–67 ms. No percentiles yet: too few samples |

## Not yet measured

- API p50/p95/p99 under load (k6). This needs the local stack's PostgREST (PLAN.md §16.4).
- Board rendering, task transitions and dependency updates end to end.
- Web Vitals of the app screens (they come with the v2-UI phase).
