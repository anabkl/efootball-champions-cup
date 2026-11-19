import { hash, verify, Algorithm, Version } from "@node-rs/argon2";
import { createClient } from "@supabase/supabase-js";
import { loadEnvFile } from "node:process";

try { loadEnvFile(".env.local"); } catch {}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const username = (process.env.ADMIN_USERNAME ?? "anas").trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;

if (!url || !serviceKey || !password) {
  throw new Error("Configuration manquante : NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY et ADMIN_PASSWORD sont requis.");
}
if (!/^[a-z0-9_]{3,24}$/.test(username)) {
  throw new Error("ADMIN_USERNAME doit contenir 3 à 24 lettres minuscules, chiffres ou underscores.");
}

const host = new URL(url).hostname;
const local = ["localhost", "127.0.0.1"].includes(host);
const strong = password.length >= 12 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password);
if (!strong && !(local && process.env.ALLOW_INSECURE_LOCAL_ADMIN_PASSWORD === "1")) {
  throw new Error("Mot de passe admin refusé : utilisez au moins 12 caractères avec minuscule, majuscule, chiffre et symbole. Le mot de passe faible n’est autorisé que sur PostgreSQL local avec ALLOW_INSECURE_LOCAL_ADMIN_PASSWORD=1.");
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const { error: schemaError } = await admin.from("app_credentials").select("profile_id", { head: true }).limit(1);
if (schemaError) throw new Error("Provisionnement annulé avant toute écriture : appliquez d’abord la migration username/password 006.");

const passwordHash = await hash(password, {
  algorithm: Algorithm.Argon2id,
  version: Version.V0x13,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
});
const { data: profileId, error: provisionError } = await admin.rpc("app_provision_admin_account", {
  display_name_input: "Anas",
  username_input: username,
  efootball_username_input: username,
  password_hash_input: passwordHash,
});
if (provisionError || typeof profileId !== "string") {
  throw new Error(`Provisionnement ADMIN impossible : ${provisionError?.code ?? "réponse vide"}.`);
}

const [{ data: profile, error: profileError }, { data: credential, error: credentialError }] = await Promise.all([
  admin.from("profiles").select("username,role,is_super_admin").eq("id", profileId).single(),
  admin.from("app_credentials").select("password_hash,disabled_at").eq("profile_id", profileId).single(),
]);
const passwordVerified = credential?.password_hash ? await verify(credential.password_hash, password) : false;
if (profileError || credentialError || profile?.username !== username || profile?.role !== "ADMIN" || profile?.is_super_admin !== true || credential?.disabled_at || !credential?.password_hash?.startsWith("$argon2id$") || !passwordVerified) {
  throw new Error("Vérification ADMIN échouée : profil ou identifiants incohérents.");
}

console.log(`Succès : ${username} possède un profil ADMIN et un identifiant Argon2id vérifiés.`);
