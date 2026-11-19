import { verify } from "@node-rs/argon2";
import { createClient } from "@supabase/supabase-js";
import { loadEnvFile } from "node:process";

try { loadEnvFile(".env.local"); } catch {}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const username = (process.env.ADMIN_USERNAME ?? "anas").trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
if (!url || !serviceKey) throw new Error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis.");

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: profile, error: profileError } = await admin.from("profiles").select("id,username,role,is_super_admin").eq("username", username).maybeSingle();
if (profileError || !profile) {
  console.error(`ÉCHEC : aucun profil applicatif avec le username ${username}.`);
  process.exitCode = 1;
} else {
  const { data: credential, error: credentialError } = await admin.from("app_credentials").select("password_hash,disabled_at").eq("profile_id", profile.id).maybeSingle();
  if (credentialError || !credential) {
    console.error("ÉCHEC : profil trouvé, mais identifiant applicatif absent.");
    process.exitCode = 1;
  } else if (profile.role !== "ADMIN" || profile.is_super_admin !== true || credential.disabled_at || !credential.password_hash.startsWith("$argon2id$") || (password && !(await verify(credential.password_hash, password)))) {
    console.error("ÉCHEC : rôle ADMIN ou identifiant Argon2id incorrect.");
    process.exitCode = 1;
  } else {
    console.log(`OK : ${username} possède un profil ADMIN et un identifiant Argon2id actifs.`);
  }
}
