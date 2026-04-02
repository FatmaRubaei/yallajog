# Running Trainer App

A full-stack running trainer application for managing trainees, training plans, billing, announcements, and events.

## Architecture

### Artifacts

1. **API Server** (`artifacts/api-server`) — Node.js/Express backend
   - Port: 8080 (via PORT env)
   - Entry: `src/index.ts`
   - Routes: `/api/trainees`, `/api/segments`, `/api/week-plans`, `/api/transactions`, `/api/announcements`, `/api/events`, `/api/dashboard`

2. **Trainer Dashboard** (`artifacts/trainer-web`) — React/Vite web app
   - Preview path: `/`
   - Full CRUD for trainees, segments, week plans, announcements, events
   - Uses shadcn/ui components + Tailwind CSS + wouter routing

3. **Trainee App** (`artifacts/trainee-mobile`) — React Native/Expo mobile app
   - Preview path: `/trainee-mobile/`
   - Tabs: Home, Plan, Billing, Profile
   - Trainee selects their profile (saved to AsyncStorage), views current week plan, balance, announcements

### Shared Libraries

- **`lib/db`** — Drizzle ORM schema + PostgreSQL client
  - Tables: trainees, transactions, segments, segment_types, week_plans, runs, run_segments, announcements, events
- **`lib/api-spec`** — OpenAPI spec (`openapi.yaml`) + codegen
- **`lib/api-client-react`** — Generated React Query hooks from OpenAPI spec

## Database

PostgreSQL via `DATABASE_URL` environment variable. Schema managed with Drizzle ORM.

### Running Migrations / Schema Push

```bash
pnpm --filter @workspace/db run db:push
```

### Seed Data

5 trainees (Sarah Levi, Michael Ben-David, Rachel Goldstein, David Cohen, Yoav Shapiro), segment types, segments, transactions, announcements, events, and a sample week plan.

## Development

All services run via Replit workflows. To regenerate API client after spec changes:

```bash
pnpm --filter @workspace/api-spec run codegen
```

## Key Design Decisions

- Trainee balance: positive transactions = payments received, negative = charges; balance due = sum of all (charged - paid)
- Segment text is stored as a template; `resolvedText` fills in trainee-specific HR/speed values
- Week plans have a `weekStart` date (Monday); the "current week plan" endpoint finds the plan whose weekStart matches the current Monday
- Expo app uses `setBaseUrl` from `@workspace/api-client-react` at top level in `_layout.tsx` to reach the API server via `EXPO_PUBLIC_DOMAIN`
- No emojis in UI — both trainer web and trainee mobile
