import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const auth = readFileSync("supabase/migrations/202611190006_username_password_auth.sql", "utf8");
const competition = readFileSync("supabase/migrations/202611180005_standings_knockout_podium.sql", "utf8");
const authAction = readFileSync("src/app/actions/auth.ts", "utf8");
const tournamentAction = readFileSync("src/app/actions/tournament.ts", "utf8");
const session = readFileSync("src/lib/auth/session.ts", "utf8");

describe("custom authentication contracts", () => {
  it("uses application credentials and never synthesizes an email", () => {
    expect(auth).toContain("app_credentials");
    expect(authAction).not.toMatch(/supabase\.auth|signInWithPassword|usernameToEmail|@example\.|\.invalid/i);
  });
  it("stores Argon2id hashes and hashed session tokens", () => {
    expect(auth).toContain("password_hash ~ '^\\$argon2id\\$'");
    expect(auth).toContain("token_hash text not null unique");
    expect(auth).not.toContain("password text");
  });
  it("uses hardened server-only session cookies", () => {
    expect(session).toContain("httpOnly: true");
    expect(session).toContain("secure: process.env.NODE_ENV === \"production\"");
    expect(session).toContain("sameSite: \"lax\"");
    expect(session).toContain("__Host-efcc_session");
  });
  it("enables RLS and removes browser access to authentication tables", () => {
    expect(auth).toContain("alter table public.app_credentials enable row level security");
    expect(auth).toContain("revoke all on table public.app_credentials, public.app_sessions, public.app_login_attempts from public, anon, authenticated");
  });
  it("revokes legacy auth.uid mutation RPCs", () => {
    expect(auth).toContain("revoke execute on function public.join_tournament(uuid)");
    expect(auth).toContain("from public, anon, authenticated");
  });
  it("checks the server session and admin role in every tournament mutation", () => {
    expect(tournamentAction.match(/requireAdmin\(\)/g)?.length).toBeGreaterThanOrEqual(7);
    expect(tournamentAction.match(/requireUser\(\)/g)?.length).toBeGreaterThanOrEqual(2);
  });
  it("rate limits repeated login failures", () => {
    expect(auth).toContain("app_auth_record_failure");
    expect(auth).toContain("failure_count + 1 >= 5");
    expect(auth).toContain("interval '15 minutes'");
  });
  it("keeps eliminated profiles and internal knockout functions protected", () => {
    expect(competition).toContain("competition_status='ELIMINATED'");
    expect(competition).not.toMatch(/delete from profiles/i);
    expect(competition).toContain("revoke all on function public.generate_knockout_if_ready(uuid),public.progress_knockout(uuid) from public,anon,authenticated");
  });
});
