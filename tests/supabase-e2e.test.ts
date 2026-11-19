import { createHash, randomBytes } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

const run = process.env.RUN_SUPABASE_INTEGRATION === "1";
const url = process.env.SUPABASE_TEST_URL;
const serviceKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
const destructiveConfirmation = process.env.SUPABASE_TEST_CONFIRM === "disposable-project";
const suite = run ? describe : describe.skip;

suite("real PostgreSQL username authentication and authorization", () => {
  it("creates amin, persists and invalidates sessions, provisions anas and joins a tournament", async () => {
    if (!url || !serviceKey) throw new Error("Set SUPABASE_TEST_URL and SUPABASE_TEST_SERVICE_ROLE_KEY on a disposable project.");
    if (!destructiveConfirmation) throw new Error("Set SUPABASE_TEST_CONFIRM=disposable-project to acknowledge that this test creates and deletes data.");
    const applicationUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (applicationUrl && new URL(applicationUrl).origin === new URL(url).origin) {
      throw new Error("SUPABASE_TEST_URL must not target the Supabase project configured for the application.");
    }
    const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const password = `Test-${Date.now()}-Strong!`;
    const passwordHash = await hash(password, { algorithm: 2, version: 1, memoryCost: 19_456, timeCost: 2, parallelism: 1, outputLen: 32 });
    const profileIds: string[] = [];
    let tournamentId: string | undefined;

    const { data: existing, error: existingError } = await db.from("profiles").select("username").in("username", ["amin", "anas"]);
    if (existingError) throw existingError;
    if (existing?.length) throw new Error("The disposable test project already contains amin or anas; use a clean project.");

    const login = async (username: string) => {
      const { data: profile, error: profileError } = await db.from("profiles").select("id,role,is_super_admin").eq("username", username).single();
      if (profileError) throw profileError;
      const { data: credential, error: credentialError } = await db.from("app_credentials").select("password_hash,disabled_at").eq("profile_id", profile.id).single();
      if (credentialError) throw credentialError;
      expect(credential.disabled_at).toBeNull();
      expect(await verify(credential.password_hash, password)).toBe(true);
      return profile;
    };
    const createSession = async (profileId: string) => {
      const token = randomBytes(32).toString("base64url");
      const tokenHash = createHash("sha256").update(token).digest("hex");
      const { error } = await db.from("app_sessions").insert({ profile_id: profileId, token_hash: tokenHash, expires_at: new Date(Date.now() + 3_600_000).toISOString() });
      if (error) throw error;
      return { token, tokenHash };
    };

    try {
      const { data: aminId, error: aminError } = await db.rpc("app_create_player_account", {
        display_name_input: "Amin",
        username_input: "amin",
        efootball_username_input: "amin",
        selected_team_input: null,
        password_hash_input: passwordHash,
      });
      if (aminError || typeof aminId !== "string") throw aminError ?? new Error("amin creation failed");
      profileIds.push(aminId);
      expect((await db.from("profiles").select("username").eq("id", aminId).single()).data?.username).toBe("amin");

      const amin = await login("amin");
      const firstSession = await createSession(amin.id);
      expect(firstSession.token).not.toBe(firstSession.tokenHash);
      expect((await db.from("app_sessions").select("id").eq("token_hash", firstSession.tokenHash).single()).data).toBeTruthy();
      expect((await db.from("app_sessions").select("id").eq("token_hash", firstSession.tokenHash).single()).data).toBeTruthy();
      expect((await db.from("app_sessions").delete().eq("token_hash", firstSession.tokenHash)).error).toBeNull();
      expect((await db.from("app_sessions").select("id").eq("token_hash", firstSession.tokenHash).maybeSingle()).data).toBeNull();
      await login("amin");
      await createSession(amin.id);

      const { data: adminId, error: adminError } = await db.rpc("app_provision_admin_account", {
        display_name_input: "Anas",
        username_input: "anas",
        efootball_username_input: "anas",
        password_hash_input: passwordHash,
      });
      if (adminError || typeof adminId !== "string") throw adminError ?? new Error("anas creation failed");
      profileIds.push(adminId);
      const anas = await login("anas");
      expect(anas.role).toBe("ADMIN");
      expect(anas.is_super_admin).toBe(true);
      await createSession(anas.id);

      const marker = Date.now();
      const { data: tournament, error: tournamentError } = await db.from("tournaments").insert({
        name: "E2E Champions Cup",
        slug: `e2e-${marker}`,
        invitation_code: `E2E-${marker}`,
        created_by: anas.id,
        min_participants: 6,
      }).select("id").single();
      if (tournamentError) throw tournamentError;
      tournamentId = tournament.id;
      expect((await db.rpc("app_admin_set_registration", { actor_id: anas.id, tid: tournament.id, open: true })).error).toBeNull();
      expect((await db.rpc("app_admin_set_registration", { actor_id: amin.id, tid: tournament.id, open: false })).error).not.toBeNull();
      expect((await db.rpc("app_join_tournament", { actor_id: amin.id, tid: tournament.id })).error).toBeNull();
      expect((await db.from("tournament_members").select("status").eq("tournament_id", tournament.id).eq("profile_id", amin.id).single()).data?.status).toBe("CONFIRMED");
    } finally {
      if (tournamentId) await db.from("tournaments").delete().eq("id", tournamentId);
      if (profileIds.length) await db.from("profiles").delete().in("id", profileIds);
    }
  }, 120_000);
});
