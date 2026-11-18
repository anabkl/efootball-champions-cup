import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

const run = process.env.RUN_SUPABASE_INTEGRATION === "1";
const url = process.env.SUPABASE_TEST_URL;
const anon = process.env.SUPABASE_TEST_ANON_KEY;
const serviceKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
const suite = run ? describe : describe.skip;

suite("real Supabase tournament lifecycle", () => {
  it("registers players, starts manually, calculates standings, progresses knockout and preserves eliminated accounts", async () => {
    if (!url || !anon || !serviceKey) throw new Error("Set all SUPABASE_TEST_* variables.");
    const service = createClient(url, serviceKey, { auth: { persistSession: false } });
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const password = `Test-${stamp}-Strong!`;
    const users: string[] = [];
    let tournamentId: string | undefined;
    try {
      for (let index = 0; index < 7; index++) {
        const username = index === 0 ? `admin_${stamp}` : `player_${index}_${stamp}`;
        const { data, error } = await service.auth.admin.createUser({ email: `${username}@players.efootball-champions-cup.invalid`, password, email_confirm: true, user_metadata: { display_name: username, username, efootball_username: username } });
        if (error || !data.user) throw error ?? new Error("User creation failed");
        users.push(data.user.id);
      }
      await service.from("profiles").update({ role: "ADMIN", is_super_admin: true }).eq("id", users[0]);
      const signIn = async (index: number) => { const client = createClient(url, anon, { auth: { persistSession: false } }); const username = index === 0 ? `admin_${stamp}` : `player_${index}_${stamp}`; const { error } = await client.auth.signInWithPassword({ email: `${username}@players.efootball-champions-cup.invalid`, password }); if (error) throw error; return client; };
      const admin = await signIn(0);
      const { data: tournament, error: createError } = await admin.from("tournaments").insert({ name: `E2E ${stamp}`, slug: `e2e-${stamp}`, invitation_code: `E2E-${stamp}`.toUpperCase(), created_by: users[0], min_participants: 6 }).select("id").single();
      if (createError) throw createError; tournamentId = tournament.id;
      expect((await admin.rpc("admin_set_registration", { tid: tournamentId, open: true })).error).toBeNull();
      for (let index = 1; index < 7; index++) { const player = await signIn(index); expect((await player.rpc("join_tournament", { tid: tournamentId })).error).toBeNull(); }
      expect((await admin.rpc("admin_set_registration", { tid: tournamentId, open: false })).error).toBeNull();
      expect((await admin.rpc("admin_generate_draw", { tid: tournamentId, group_count: 2 })).error).toBeNull();
      expect((await admin.rpc("admin_confirm_draw", { tid: tournamentId })).error).toBeNull();
      expect((await admin.rpc("admin_start_tournament", { tid: tournamentId })).error).toBeNull();
      const { data: groupMatches } = await service.from("matches").select("id").eq("tournament_id", tournamentId).eq("round", "GROUP");
      for (const match of groupMatches ?? []) expect((await admin.rpc("admin_record_result", { mid: match.id, home_goals: 1, away_goals: 0, penalties_h: null, penalties_a: null })).error).toBeNull();
      const { data: standings } = await service.from("group_standings").select("group_id,position").eq("tournament_id", tournamentId);
      expect(standings).toHaveLength(6); expect(standings?.filter(row => row.position <= 2)).toHaveLength(4);
      for (const round of ["SEMI_FINAL", "THIRD_PLACE", "FINAL"]) { const { data: games } = await service.from("matches").select("id,home_profile_id,away_profile_id").eq("tournament_id", tournamentId).eq("round", round); for (const game of games ?? []) { expect(game.home_profile_id).toBeTruthy(); expect(game.away_profile_id).toBeTruthy(); expect((await admin.rpc("admin_record_result", { mid: game.id, home_goals: 2, away_goals: 1, penalties_h: null, penalties_a: null })).error).toBeNull(); } }
      const { data: finalTournament } = await service.from("tournaments").select("status").eq("id", tournamentId).single(); expect(finalTournament?.status).toBe("COMPLETED");
      const { data: memberships } = await service.from("tournament_members").select("competition_status").eq("tournament_id", tournamentId); expect(memberships).toHaveLength(6); expect(memberships?.some(m => m.competition_status === "ELIMINATED")).toBe(true); expect(memberships?.some(m => m.competition_status === "CHAMPION")).toBe(true);
      const { data: survivingUser } = await service.auth.admin.getUserById(users[1]); expect(survivingUser.user?.id).toBe(users[1]);
    } finally {
      if (tournamentId) await service.from("tournaments").delete().eq("id", tournamentId);
      for (const id of users.reverse()) await service.auth.admin.deleteUser(id);
    }
  }, 120_000);
});
