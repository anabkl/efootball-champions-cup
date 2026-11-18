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
2. In Supabase SQL Editor, run every file in `supabase/migrations` in filename order (`202611170001` through `202611180005`).
3. Install and run:

```bash
npm install
npm run dev
```

In Supabase Authentication, enable Email/Password and disable email confirmation for this private username-based app. Usernames are mapped internally to non-deliverable addresses; players never provide an email. Do not expose `SUPABASE_SERVICE_ROLE_KEY`; it is used only by the provisioning script.

Provision the only administrator with a strong password:

```bash
ADMIN_USERNAME=anas ADMIN_PASSWORD='replace-with-a-strong-password' npm run provision:admin
```

The temporary password `anas` is accepted only when `NODE_ENV` is not `production`.

## Deploy to Vercel

Import the repository into Vercel, add the three environment variables from `.env.example` (mark the service role key secret), and deploy. Configure Supabase Authentication redirect URLs for the Vercel URL and `http://localhost:3000`.

## First tournament

1. Sign in as the provisioned `anas` administrator.
2. Create a tournament from `/admin` with a unique invitation code.
3. Open registration and share `https://your-domain.com/join/EFC-2026` over WhatsApp.
4. Approve registrations. Close registration when ready.
5. Select and confirm a valid group format, generate fixtures, then press **Start tournament**.

## Validation scope

`npm test` covers format balancing, standings recalculation, score correction, knockout plans, authorization contracts and draw privacy. A full persistence scenario requires a dedicated Supabase test project configured through `.env.local`; local unit tests do not claim remote persistence coverage.

### Real Supabase integration test

Use a disposable Supabase project, never production. Apply all five migrations, then create `.env.test.local`:

```dotenv
SUPABASE_TEST_URL=https://your-test-project.supabase.co
SUPABASE_TEST_ANON_KEY=your-test-anon-key
SUPABASE_TEST_SERVICE_ROLE_KEY=your-test-service-role-key
```

Run `npm run test:integration`. The test creates seven temporary accounts, executes registration closure, draw, manual start, group results, standings, qualification, elimination, semi-finals, third-place match and final, verifies the podium and retained eliminated account, then removes its temporary data.

No license is included until an explicit license choice is made.
