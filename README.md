# Ravenshaw Free Fire Esports

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/) [![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15%2B-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/) [![Vercel](https://img.shields.io/badge/Deploy-Vercel-black?logo=vercel)](https://vercel.com/)

A responsive tournament portal for Ravenshaw Free Fire Esports: squad registration, protected five-match score entry, and persistent live standings backed by PostgreSQL.

## Features

- Twelve squad slots with captain, department, contact, player and substitute details.
- Persistent PostgreSQL storage, including Supabase-hosted PostgreSQL.
- Five-match organizer score entry protected by a server-side `ADMIN_PIN`.
- Live leaderboard with automatic refresh every 30 seconds and a manual refresh button.
- Official scoring: placement points are 12, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0, 0 for places 1–12; each kill earns one point.
- Tie-break order: total points → Booyahs → kills → best Match 5 placement.
- Input validation, clear API error messages, accessible responsive UI, and save/error notifications.

## Tech stack

- Static HTML, CSS and browser JavaScript
- Vercel serverless Node.js API functions
- PostgreSQL via `pg` (managed PostgreSQL or Supabase connection string)

## Repository structure

```text
.
├── api/
│   ├── _lib/db.js
│   ├── register.js
│   ├── scores.js
│   └── tournament.js
├── db/schema.sql
├── public/
│   ├── css/styles.css
│   ├── index.html
│   └── js/app.js
├── .env.example
├── package.json
├── vercel.json
└── README.md
```

## Local setup

1. Install Node.js 18+ and PostgreSQL 15+ (or create a Supabase project).
2. Create a database and apply the schema:

   ```bash
   psql "$DATABASE_URL" -f db/schema.sql
   ```

   Alternatively, run `db/schema.sql` in the Supabase SQL Editor.
3. Copy `.env.example` to `.env`, then set `DATABASE_URL` to your PostgreSQL connection string and choose a strong `ADMIN_PIN`.
4. Install the dependency:

   ```bash
   npm install
   ```
5. Run locally with the Vercel CLI (the API functions require the Vercel runtime):

   ```bash
   npx vercel dev
   ```

   Open the local URL printed by Vercel. Without database configuration, the API reports a clear setup error; it does not store registrations in browser-only storage.

## Deploy to Vercel + PostgreSQL / Supabase

1. Create a PostgreSQL database. For Supabase, open **Project Settings → Database** and copy a PostgreSQL connection string suitable for your deployment (use the pooler connection if required by your hosting environment). The backend connects through `DATABASE_URL`; never expose the database password or an elevated database credential in browser code.
2. Apply `db/schema.sql` to the database using `psql` or the Supabase SQL Editor.
3. Import this repository in Vercel. The Vercel configuration serves `public/` and deploys the `api/` serverless functions.
4. In Vercel **Project Settings → Environment Variables**, add `DATABASE_URL` and a strong `ADMIN_PIN` for Production (and Preview if desired). Do not commit `.env` or secrets.
5. Redeploy after setting environment variables, then verify the deployment by opening the site and registering a test squad. The leaderboard API returns all 12 slots, including open slots.

## API

- `GET /api/tournament` — all 12 slots, scores, and computed leaderboard.
- `POST /api/register` — registers a squad into an open slot; an existing slot cannot be overwritten.
- `POST /api/scores` — saves score entries; requires the `admin-pin` request header matching the server-side `ADMIN_PIN`.

Score requests use `{ "scores": [{ "slot": 1, "match_number": 1, "placement": 1, "kills": 5 }] }`. The PIN is never embedded in the frontend or deployment bundle.
