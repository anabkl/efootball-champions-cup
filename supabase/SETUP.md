# Supabase setup and migration order

The five migrations are ordered and depend on one another:

1. `202611170001_initial.sql` creates the base schema, RLS and indexes.
2. `202611180002_secure_username_auth.sql` adds username/role fields and the Auth profile trigger.
3. `202611180003_tournament_workflows.sql` adds registration and lifecycle RPCs.
4. `202611180004_competition_and_communications.sql` adds draw, scores, contacts and announcements.
5. `202611180005_standings_knockout_podium.sql` adds standings and knockout progression.

## Fresh Supabase project

Install the Supabase CLI, authenticate, then link the intended **test project** first:

```bash
supabase login
supabase link --project-ref YOUR_TEST_PROJECT_REF
supabase migration list
supabase db push --dry-run
supabase db push
```

Do not run `db reset` against a remote project. If SQL was previously pasted manually and only partly succeeded, stop: do not rerun arbitrary fragments. Use a fresh test project, or reconcile the remote migration history and schema before applying anything further.

In Supabase Dashboard → Authentication → Providers → Email:

- keep email/password sign-up enabled;
- disable email confirmation because internal identifiers cannot receive mail;
- require a minimum password length of 8;
- do not build email recovery for these internal identifiers.

Players never provide an email. The server maps usernames to the IANA-reserved domain `users.efootball-champions-cup.example.com`; it is an identifier only, never a mailbox. Password hashing, access tokens, refresh tokens and sessions remain managed by Supabase Auth.

## Verification

After migration:

```bash
npm run audit:schema
```

Provision the administrator only after setting a strong password (12+ characters with uppercase, lowercase, digit and symbol):

```bash
npm run provision:admin
npm run audit:admin
```

For the destructive integration scenario, configure a separate disposable project in `.env.test.local` and run:

```bash
npm run test:integration
```

The integration test creates and then removes temporary Auth users and tournament data. Never point it at production.
