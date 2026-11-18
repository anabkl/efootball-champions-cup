import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabasePublicConfig } from "./config";
export async function createClient() { const {url,anonKey}=getSupabasePublicConfig();const store = await cookies(); return createServerClient(url,anonKey, { cookies: { getAll: () => store.getAll(), setAll: (items) => { try { items.forEach(({ name, value, options }) => store.set(name, value, options)); } catch {} } } }); }
