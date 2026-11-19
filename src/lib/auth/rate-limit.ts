import "server-only";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function loginRateLimitKeys(username: string) {
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || requestHeaders.get("x-real-ip") || "unknown";
  return [digest(`username:${username}`), digest(`username-ip:${username}:${ip}`)];
}

export async function isLoginBlocked(keys: string[]) {
  const { data, error } = await createAdminClient().rpc("app_auth_is_rate_limited", { rate_keys: keys });
  if (error) throw new Error(`Rate-limit check failed: ${error.code ?? "database_error"}`);
  return data === true;
}

export async function recordLoginFailure(keys: string[]) {
  const { error } = await createAdminClient().rpc("app_auth_record_failure", { rate_keys: keys });
  if (error) throw new Error(`Rate-limit update failed: ${error.code ?? "database_error"}`);
}

export async function clearLoginFailures(keys: string[]) {
  const { error } = await createAdminClient().rpc("app_auth_clear_failures", { rate_keys: keys });
  if (error) throw new Error(`Rate-limit reset failed: ${error.code ?? "database_error"}`);
}
