import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getSupabaseServerConfig } from "./config";

export function createAdminClient() {
  const { url, serviceRoleKey } = getSupabaseServerConfig();
  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}
