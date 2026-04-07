# Trainer App — Local Setup

## Requirements
- Node.js 20+  (https://nodejs.org)
- pnpm         (run: npm install -g pnpm)
- PostgreSQL   (local install or cloud: neon.tech / supabase.com)

---

## 1. Install dependencies

```bash
pnpm install
```

---

## 2. Set up environment variables

Edit `artifacts/api-server/.env` with your database details:

```
DATABASE_URL=postgresql://user:password@localhost:5432/trainer_db
SESSION_SECRET=any-long-random-string
PORT=8080
```

---

## 3. Set up the database

First, create the session table manually (required once):

```sql
CREATE TABLE session (
  sid varchar PRIMARY KEY,
  sess json NOT NULL,
  expire timestamp(6) NOT NULL
);
```

Then push all other tables:

```bash
pnpm --filter @workspace/db run db:push
```

---

## 4. Start the API server

```bash
cd artifacts/api-server
pnpm run dev
```

API runs on http://localhost:8080

---

## 5. Start the trainer dashboard

Open a second terminal:

```bash
cd artifacts/trainer-web
pnpm run dev
```

Dashboard runs on http://localhost:5173

---

## First login

Go to http://localhost:5173 and register a new trainer account.
