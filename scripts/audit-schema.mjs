import { createClient } from "@supabase/supabase-js";
import { loadEnvFile } from "node:process";

try { loadEnvFile(".env.local"); } catch {}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY et SUPABASE_SERVICE_ROLE_KEY sont requis.");
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const relations = {
  profiles: "id,username,role,is_super_admin",
  tournaments: "id,status,min_participants",
  tournament_members: "tournament_id,profile_id,status,competition_status",
  groups: "id,tournament_id,label",
  group_members: "group_id,profile_id",
  matches: "id,status,next_match_id,loser_next_match_id",
  announcements: "id,tournament_id",
  audit_logs: "id,action",
  player_contacts: "profile_id,whatsapp_phone",
  group_standings: "tournament_id,group_id,profile_id,position,points",
  app_credentials: "profile_id,password_hash,disabled_at",
  app_sessions: "id,profile_id,token_hash,expires_at",
  app_login_attempts: "rate_key,failure_count,blocked_until",
};

let failed = false;
for (const [relation, columns] of Object.entries(relations)) {
  // A real GET is intentional: PostgREST can return a false-positive 204 for HEAD on a missing table.
  const { error } = await admin.from(relation).select(columns).limit(1);
  if (error) {
    failed = true;
    const reason = [error.code, error.message, error.details, error.hint].filter(Boolean).join(" · ") || "erreur PostgREST sans détail";
    console.error(`MANQUANT/INCOMPATIBLE : ${relation} (${reason})`);
  } else {
    console.log(`OK : ${relation}`);
  }
}

if (!failed) {
  const rateKey = "0".repeat(64);
  const { error: serviceRpcError } = await admin.rpc("app_auth_is_rate_limited", { rate_keys: [rateKey] });
  if (serviceRpcError) {
    failed = true;
    console.error(`MANQUANT/INCOMPATIBLE : RPC auth serveur (${serviceRpcError.code ?? "database_error"})`);
  } else {
    console.log("OK : RPC auth accessible au serveur");
  }

  const anonymous = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: anonymousRpcError } = await anonymous.rpc("app_auth_is_rate_limited", { rate_keys: [rateKey] });
  if (!anonymousRpcError) {
    failed = true;
    console.error("INSECURE : la RPC auth interne est accessible avec la clé anon.");
  } else {
    console.log("OK : RPC auth refusée à la clé anon");
  }
}

if (failed) process.exitCode = 1;
