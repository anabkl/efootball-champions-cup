"use server";

import { redirect } from "next/navigation";
import { loginSchema, registrationSchema } from "@/lib/auth";
import { createPlayerAccount, findCredentialAccount, updatePasswordHash, UsernameAlreadyExistsError } from "@/lib/auth/accounts";
import { hashPassword, passwordHashNeedsUpgrade, verifyPasswordOrDummy } from "@/lib/auth/password";
import { clearLoginFailures, isLoginBlocked, loginRateLimitKeys, recordLoginFailure } from "@/lib/auth/rate-limit";
import { createSession, invalidateCurrentSession } from "@/lib/auth/session";
import { SupabaseConfigurationError } from "@/lib/supabase/config";

export type AuthState = { error?: string };

export async function signIn(_: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Username ou mot de passe incorrect." };

  try {
    const keys = await loginRateLimitKeys(parsed.data.username);
    if (await isLoginBlocked(keys)) {
      return { error: "Trop de tentatives. Réessayez dans 15 minutes." };
    }

    const account = await findCredentialAccount(parsed.data.username);
    const valid = await verifyPasswordOrDummy(account?.passwordHash ?? null, parsed.data.password);
    if (!account || !valid) {
      await recordLoginFailure(keys);
      return { error: "Username ou mot de passe incorrect." };
    }

    await clearLoginFailures(keys);
    if (passwordHashNeedsUpgrade(account.passwordHash)) {
      await updatePasswordHash(account.id, await hashPassword(parsed.data.password));
    }
    await createSession(account.id);
    redirect(account.role === "ADMIN" && account.isSuperAdmin ? "/admin" : "/dashboard");
  } catch (error) {
    if (error instanceof SupabaseConfigurationError) return { error: error.message };
    throw error;
  }
}

export async function signUp(_: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = registrationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Données invalides." };

  try {
    const passwordHash = await hashPassword(parsed.data.password);
    const profileId = await createPlayerAccount({
      displayName: parsed.data.displayName,
      username: parsed.data.username,
      efootballUsername: parsed.data.efootballUsername,
      selectedTeam: parsed.data.selectedTeam,
      passwordHash,
    });
    await createSession(profileId);
    redirect("/dashboard");
  } catch (error) {
    if (error instanceof UsernameAlreadyExistsError) return { error: "Ce username est déjà utilisé." };
    if (error instanceof SupabaseConfigurationError) return { error: error.message };
    throw error;
  }
}

export async function signOut() {
  await invalidateCurrentSession();
  redirect("/login");
}
