# eFootball Champions Cup

A full-stack tournament management platform for private eFootball competitions. It supports flexible registrations, admin-controlled starts, dynamic World Cup groups, fixtures, standings, knockout progression, profiles, and public tournament pages.

## Product rules

- Registration never closes or starts the cup automatically.
- An administrator must close registration, confirm at least the configured minimum (default: 6) players, approve the group draw and fixtures, then explicitly start the tournament.
- Groups are balanced for actual participant counts; no fake players are created.
- Player name and eFootball username are primary identities; team selection is optional.

## Stack

Next.js App Router, TypeScript, Tailwind CSS, Supabase Auth/Postgres/Realtime/Storage, Zod and React Hook Form. GitHub Actions runs linting, type checks, and tests.

## Local setup

1. Copy `.env.example` to `.env.local` and set your Supabase project URL and anon key.
2. In Supabase SQL Editor, run `supabase/migrations/202611170001_initial.sql`.
3. Install and run:

```bash
npm install
npm run dev
```

Use Supabase Authentication to enable email/password and optionally Google OAuth. Do not expose `SUPABASE_SERVICE_ROLE_KEY`; it is server-only.

## Deploy to Vercel

Import the repository into Vercel, add the three environment variables from `.env.example` (mark the service role key secret), and deploy. Configure Supabase Authentication redirect URLs for the Vercel URL and `http://localhost:3000`.

## First tournament

1. Promote the organizer profile to `is_super_admin` in Supabase.
2. Create a tournament with a unique invitation code (for example `EFC-2026`).
3. Open registration and share `https://your-domain.com/join/EFC-2026` over WhatsApp.
4. Approve registrations. Close registration when ready.
5. Select and confirm a valid group format, generate fixtures, then press **Start tournament**.

## Repository publishing

```bash
git init
git add .
git commit -m "feat: initialize eFootball Champions Cup platform"
gh repo create efootball-champions-cup --private --source=. --remote=origin --push
```

No license is included until an explicit license choice is made.
