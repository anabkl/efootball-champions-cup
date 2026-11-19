import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

const SESSION_LIFETIME_SECONDS = 60 * 60 * 24 * 30;
export const SESSION_COOKIE_NAME = process.env.NODE_ENV === "production" ? "__Host-efcc_session" : "efcc_session";

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function sessionCookieOptions(expires: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires,
    priority: "high" as const,
  };
}

export async function createSessionRecord(profileId: string) {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_LIFETIME_SECONDS * 1000);
  const { error } = await createAdminClient().from("app_sessions").insert({
    profile_id: profileId,
    token_hash: tokenHash(token),
    expires_at: expires.toISOString(),
  });
  if (error) throw new Error(`Session creation failed: ${error.code ?? "database_error"}`);
  return { token, expires };
}

export async function createSession(profileId: string) {
  const session = await createSessionRecord(profileId);
  (await cookies()).set(SESSION_COOKIE_NAME, session.token, sessionCookieOptions(session.expires));
}

export async function validateSessionToken(token: string) {
  const db = createAdminClient();
  const { data: session, error: sessionError } = await db
    .from("app_sessions")
    .select("id,profile_id,expires_at")
    .eq("token_hash", tokenHash(token))
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (sessionError) throw new Error(`Session lookup failed: ${sessionError.code ?? "database_error"}`);
  if (!session) return null;

  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("id,username,display_name,role,is_super_admin")
    .eq("id", session.profile_id)
    .maybeSingle();
  if (profileError) throw new Error(`Session profile lookup failed: ${profileError.code ?? "database_error"}`);
  if (!profile) return null;

  return {
    id: session.id,
    expiresAt: session.expires_at,
    user: {
      id: profile.id,
      username: profile.username,
      displayName: profile.display_name,
      role: profile.role as "ADMIN" | "PLAYER",
      isSuperAdmin: profile.is_super_admin,
    },
  };
}

export async function getCurrentSession() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  return token ? validateSessionToken(token) : null;
}

export async function invalidateSessionToken(token: string) {
  const { error } = await createAdminClient().from("app_sessions").delete().eq("token_hash", tokenHash(token));
  if (error) throw new Error(`Session invalidation failed: ${error.code ?? "database_error"}`);
}

export async function invalidateCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (token) await invalidateSessionToken(token);
  cookieStore.set(SESSION_COOKIE_NAME, "", { ...sessionCookieOptions(new Date(0)), maxAge: 0 });
}
