import { createClient } from "@supabase/supabase-js";
const username = process.env.ADMIN_USERNAME ?? "anas";
const password = process.env.ADMIN_PASSWORD;
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || !password) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and ADMIN_PASSWORD. Never commit these values.");
if (password === "anas" && process.env.NODE_ENV === "production") throw new Error("The temporary password is forbidden in production.");
if (password.length < 10 && !(password === "anas" && process.env.NODE_ENV !== "production")) throw new Error("Use at least 10 characters.");
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const email = `${username.toLowerCase()}@players.efootball-champions-cup.invalid`;
const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: "Anas", username, efootball_username: "anas" } });
if (error && !error.message.includes("already been registered")) throw error;
const id = data.user?.id;
if (id) { const { error: updateError } = await admin.from("profiles").update({ role: "ADMIN", is_super_admin: true }).eq("id", id); if (updateError) throw updateError; }
console.log(`Admin ${username} provisioned.`);
