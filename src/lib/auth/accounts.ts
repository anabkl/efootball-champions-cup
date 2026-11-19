import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type CredentialAccount = {
  id: string;
  username: string;
  displayName: string;
  role: "ADMIN" | "PLAYER";
  isSuperAdmin: boolean;
  passwordHash: string;
};

export class UsernameAlreadyExistsError extends Error {}

export async function createPlayerAccount(input: {
  displayName: string;
  username: string;
  efootballUsername: string;
  selectedTeam?: string;
  passwordHash: string;
}) {
  const db = createAdminClient();
  const { data, error } = await db.rpc("app_create_player_account", {
    display_name_input: input.displayName,
    username_input: input.username,
    efootball_username_input: input.efootballUsername,
    selected_team_input: input.selectedTeam || null,
    password_hash_input: input.passwordHash,
  });
  if (error) {
    if (error.code === "23505" || error.message.toLowerCase().includes("username")) {
      throw new UsernameAlreadyExistsError();
    }
    throw new Error(`Player account creation failed: ${error.code ?? "database_error"}`);
  }
  if (typeof data !== "string") throw new Error("Player account creation returned no id");
  return data;
}

export async function findCredentialAccount(username: string): Promise<CredentialAccount | null> {
  const db = createAdminClient();
  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("id,username,display_name,role,is_super_admin")
    .eq("username", username)
    .maybeSingle();
  if (profileError) throw new Error(`Account lookup failed: ${profileError.code ?? "database_error"}`);
  if (!profile) return null;

  const { data: credential, error: credentialError } = await db
    .from("app_credentials")
    .select("password_hash,disabled_at")
    .eq("profile_id", profile.id)
    .maybeSingle();
  if (credentialError) throw new Error(`Credential lookup failed: ${credentialError.code ?? "database_error"}`);
  if (!credential || credential.disabled_at) return null;

  return {
    id: profile.id,
    username: profile.username,
    displayName: profile.display_name,
    role: profile.role,
    isSuperAdmin: profile.is_super_admin,
    passwordHash: credential.password_hash,
  };
}

export async function updatePasswordHash(profileId: string, passwordHash: string) {
  const { error } = await createAdminClient()
    .from("app_credentials")
    .update({ password_hash: passwordHash, password_changed_at: new Date().toISOString() })
    .eq("profile_id", profileId);
  if (error) throw new Error(`Password hash update failed: ${error.code ?? "database_error"}`);
}
